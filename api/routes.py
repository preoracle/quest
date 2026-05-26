"""FastAPI routes for Quest (Phase 4)."""

from __future__ import annotations

import json
import os

import yaml
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from api.schemas import (
    BaselineAnswerRequest,
    ConceptSearchHit,
    ConceptSearchResponse,
    DueItem,
    DueResponse,
    GenerateTopicRequest,
    ImportTopicRequest,
    MasteryItem,
    MasteryResponse,
    StartBaselineRequest,
    StartSessionRequest,
    SubmitTurnRequest,
    TopicCatalogItem,
    TopicCatalogResponse,
    TopicCreatedResponse,
    TopicLifecycleResponse,
    TopicSummaryItem,
    TopicSummaryResponse,
    TurnItem,
    UpdateTopicRequest,
)
from core.baseline_api import BaselineView, start_baseline, submit_baseline_answer
from core.session_api import SessionView, get_session_view, start_session, submit_turn
from core.topic_catalog import list_topic_catalog
from core.topic_generator import generate_topic_payload, write_topic_yaml
from core.topic_graph import TopicGraph, get_topic_graph, topic_mastery_summary
from core.topic_lifecycle import (
    TopicLifecycleError,
    delete_topic,
    is_user_deletable,
    mark_topic_user_created,
    rename_topic,
    set_topic_archived,
    set_topic_pinned,
    update_topic_display_name,
)
from core.topic_search import search_concepts_across_topics, search_topics
from core.topic_validate import validate_topic_payload
from db import queries

router = APIRouter()


# ---------------------------------------------------------------------------
# Auth dependency — extracts user_id from Supabase JWT or falls back to
# "default" in dev (no SUPABASE_JWT_SECRET configured).
# ---------------------------------------------------------------------------

async def get_current_user(request: Request) -> str:
    """Return the authenticated user_id from Supabase JWT, or 'default' in dev."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return "default"
    token = auth[7:]
    jwt_secret = os.environ.get("SUPABASE_JWT_SECRET")
    if not jwt_secret:
        return "default"  # dev mode: accept any request
    try:
        import jwt as pyjwt  # noqa: PLC0415
        payload = pyjwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return str(payload["sub"])
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc


def _catalog_items(
    conn,
    user_id: str,
    rows: list[dict],
) -> list[TopicCatalogItem]:
    """Merge catalog rows with mastery rollups and lifecycle flags."""
    summaries = {s["topic_id"]: s for s in topic_mastery_summary(conn, user_id)}
    last_study = queries.get_topic_last_study_at(conn, user_id)
    meta = queries.list_topic_metadata(conn)
    items: list[TopicCatalogItem] = []
    for row in rows:
        tid = row["id"]
        s = summaries.get(tid, {})
        m = meta.get(tid, {})
        items.append(
            TopicCatalogItem(
                id=tid,
                display_name=row["display_name"],
                concept_count=row["concept_count"],
                preview_concepts=row["preview_concepts"],
                hook=row["hook"],
                started=bool(s.get("started")),
                mastered_count=int(s.get("mastered_count") or 0),
                avg_score_1_to_5=float(s.get("avg_score_1_to_5") or 0),
                due_count=int(s.get("due_count") or 0),
                last_studied_at=last_study.get(tid),
                archived=bool(row.get("archived") or m.get("archived_at")),
                pinned=bool(row.get("pinned") or m.get("pinned_at")),
                user_created=bool(m.get("user_created")),
                deletable=is_user_deletable(conn, tid),
            )
        )
    return items


@router.get("/topics", response_model=TopicCatalogResponse)
def list_available_topics(
    q: str = Query(default="", description="Search topics and concept previews"),
    include_archived: bool = Query(default=False),
    enrolled_only: bool = Query(default=False, description="Return only topics this user is enrolled in"),
    current_user: str = Depends(get_current_user),
) -> TopicCatalogResponse:
    """Return topic catalog with previews, search, and user progress rollups."""
    with queries.get_connection() as conn:
        queries.get_or_create_user(conn, current_user)
        meta = queries.list_topic_metadata(conn)
        rows = search_topics(
            query=q,
            include_archived=include_archived,
            metadata=meta,
        )
        if enrolled_only:
            enrolled = queries.get_user_enrolled_topics(conn, current_user)
            rows = [r for r in rows if r["id"] in enrolled]
        items = _catalog_items(conn, current_user, rows)
        enrolled_ids = queries.get_user_enrolled_topics(conn, current_user)
        for item in items:
            item.enrolled = item.id in enrolled_ids
    return TopicCatalogResponse(user_id=current_user, topics=items)


@router.get("/search/concepts", response_model=ConceptSearchResponse)
def search_concepts(
    q: str = Query(..., min_length=1),
    current_user: str = Depends(get_current_user),
) -> ConceptSearchResponse:
    """Find concept names across topics matching a query string."""
    with queries.get_connection() as conn:
        queries.get_or_create_user(conn, current_user)
        meta = queries.list_topic_metadata(conn)
        hits = search_concepts_across_topics(q, metadata=meta)
    return ConceptSearchResponse(
        query=q,
        hits=[ConceptSearchHit(**h) for h in hits],
    )


@router.post("/topics/{topic_id}/enroll", response_model=dict)
def enroll_in_topic(
    topic_id: str,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Add a topic to the current user's enrolled quests."""
    with queries.get_connection() as conn:
        queries.get_or_create_user(conn, current_user)
        queries.enroll_topic(conn, current_user, topic_id)
    return {"enrolled": True, "topic_id": topic_id}


@router.delete("/topics/{topic_id}/enroll", response_model=dict)
def unenroll_from_topic(
    topic_id: str,
    current_user: str = Depends(get_current_user),
) -> dict:
    """Remove a topic from the current user's enrolled quests."""
    with queries.get_connection() as conn:
        queries.get_or_create_user(conn, current_user)
        queries.unenroll_topic(conn, current_user, topic_id)
    return {"enrolled": False, "topic_id": topic_id}


@router.patch("/topics/{topic_id}", response_model=TopicLifecycleResponse)
def patch_topic(
    topic_id: str,
    body: UpdateTopicRequest,
    current_user: str = Depends(get_current_user),
) -> TopicLifecycleResponse:
    """Rename, update display name, archive, or pin a topic."""
    try:
        with queries.get_connection() as conn:
            queries.get_or_create_user(conn, current_user)
            if body.new_topic_id:
                result = rename_topic(
                    conn,
                    topic_id,
                    body.new_topic_id,
                    display_name=body.display_name,
                )
                return TopicLifecycleResponse(
                    topic_id=result["topic_id"],
                    display_name=result["display_name"],
                    previous_id=result["previous_id"],
                )
            display_name = body.display_name
            if display_name is not None:
                updated = update_topic_display_name(conn, topic_id, display_name)
                display_name = updated["display_name"]
            archived = body.archived
            if archived is not None:
                set_topic_archived(conn, topic_id, archived=archived)
            pinned = body.pinned
            if pinned is not None:
                set_topic_pinned(conn, topic_id, pinned=pinned)
            if (
                display_name is None
                and archived is None
                and pinned is None
            ):
                raise TopicLifecycleError("No fields to update")
            return TopicLifecycleResponse(
                topic_id=topic_id,
                display_name=display_name,
                archived=archived,
                pinned=pinned,
            )
    except TopicLifecycleError as exc:
        msg = str(exc)
        code = 404 if "Unknown topic" in msg or "No concept map" in msg else 403
        raise HTTPException(status_code=code, detail=msg) from exc


@router.delete("/topics/{topic_id}", response_model=TopicLifecycleResponse)
def remove_topic(
    topic_id: str,
    wipe_progress: bool = Query(default=True),
    current_user: str = Depends(get_current_user),
) -> TopicLifecycleResponse:
    """Delete a user-created topic and its progress."""
    try:
        with queries.get_connection() as conn:
            queries.get_or_create_user(conn, current_user)
            delete_topic(conn, topic_id, user_id=current_user, wipe_progress=wipe_progress)
        return TopicLifecycleResponse(
            topic_id=topic_id,
            deleted=True,
            message="Topic removed",
        )
    except TopicLifecycleError as exc:
        msg = str(exc)
        code = 404 if "Unknown topic" in msg or "No concept map" in msg else 403
        raise HTTPException(status_code=code, detail=msg) from exc


@router.get("/topics/{topic_id}/graph", response_model=TopicGraph)
def read_topic_graph(
    topic_id: str,
    current_user: str = Depends(get_current_user),
) -> TopicGraph:
    """Concept DAG with prerequisites and user mastery scores."""
    try:
        with queries.get_connection() as conn:
            return get_topic_graph(conn, current_user, topic_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/users/{user_id}/progress/summary", response_model=TopicSummaryResponse)
@router.get("/users/me/progress/summary", response_model=TopicSummaryResponse)
def read_progress_summary(
    user_id: str = "default",
    current_user: str = Depends(get_current_user),
) -> TopicSummaryResponse:
    """Per-topic mastery rollup for dashboard cards."""
    uid = current_user if current_user != "default" else user_id
    with queries.get_connection() as conn:
        rows = topic_mastery_summary(conn, uid)
    return TopicSummaryResponse(
        user_id=uid,
        topics=[TopicSummaryItem(**r) for r in rows],
    )


@router.post("/topics/generate", response_model=TopicCreatedResponse)
def generate_topic(body: GenerateTopicRequest) -> TopicCreatedResponse:
    """Generate a concept map from a learning goal (LLM)."""
    try:
        data = generate_topic_payload(body.goal)
        path = write_topic_yaml(data, force=body.force)
    except FileExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    with queries.get_connection() as conn:
        mark_topic_user_created(conn, data["topic"])
    return TopicCreatedResponse(
        topic_id=data["topic"],
        display_name=data["display_name"],
        concept_count=len(data.get("concepts") or []),
        path=str(path),
    )


@router.post("/topics/import", response_model=TopicCreatedResponse)
def import_topic(body: ImportTopicRequest) -> TopicCreatedResponse:
    """Validate and save a hand-written topic YAML."""
    try:
        data = yaml.safe_load(body.yaml_text)
    except yaml.YAMLError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid YAML: {exc}") from exc
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="YAML must be a mapping")
    try:
        validate_topic_payload(data)
        path = write_topic_yaml(data, force=body.force)
    except FileExistsError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    with queries.get_connection() as conn:
        mark_topic_user_created(conn, data["topic"])
    return TopicCreatedResponse(
        topic_id=data["topic"],
        display_name=data["display_name"],
        concept_count=len(data.get("concepts") or []),
        path=str(path),
    )


@router.post("/baseline", response_model=BaselineView)
def create_baseline(
    body: StartBaselineRequest,
    current_user: str = Depends(get_current_user),
) -> BaselineView:
    """Start or resume baseline calibration; returns first question."""
    try:
        with queries.get_connection() as conn:
            return start_baseline(conn, current_user, body.topic)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/baseline/{session_id}/answer", response_model=BaselineView)
def post_baseline_answer(session_id: str, body: BaselineAnswerRequest) -> BaselineView:
    """Submit one baseline answer; returns next question or completion."""
    try:
        with queries.get_connection() as conn:
            return submit_baseline_answer(conn, session_id, body.answer)
    except ValueError as exc:
        msg = str(exc)
        code = 404 if "Unknown" in msg else 409 if "already" in msg else 400
        raise HTTPException(status_code=code, detail=msg) from exc


@router.post("/sessions", response_model=SessionView)
def create_session(
    body: StartSessionRequest,
    current_user: str = Depends(get_current_user),
) -> SessionView:
    """Start or resume a session; returns the pending tutor question."""
    try:
        with queries.get_connection() as conn:
            return start_session(
                conn,
                current_user,
                body.topic,
                resume=body.resume,
                replay=body.replay,
            )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/sessions/{session_id}", response_model=SessionView)
def read_session(session_id: str) -> SessionView:
    """Return current session state from the graph checkpointer."""
    try:
        with queries.get_connection() as conn:
            return get_session_view(conn, session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/turn", response_model=SessionView)
def post_turn(session_id: str, body: SubmitTurnRequest) -> SessionView:
    """Submit an answer; returns evaluator output and the next question (or completion)."""
    try:
        with queries.get_connection() as conn:
            return submit_turn(conn, session_id, body.answer)
    except ValueError as exc:
        msg = str(exc)
        if "Unknown session" in msg:
            raise HTTPException(status_code=404, detail=msg) from exc
        if "already ended" in msg or "not waiting" in msg:
            raise HTTPException(status_code=409, detail=msg) from exc
        raise HTTPException(status_code=400, detail=msg) from exc


@router.post("/sessions/{session_id}/finish", response_model=SessionView)
def finish_session_route(session_id: str) -> SessionView:
    """End a session early and generate its report."""
    try:
        with queries.get_connection() as conn:
            return session_api.finish_session(conn, session_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/sessions/{session_id}/turns", response_model=list[TurnItem])
def list_session_turns(session_id: str) -> list[TurnItem]:
    """Return ordered turns for rebuilding the session transcript in the UI."""
    row_check = None
    with queries.get_connection() as conn:
        row_check = queries.get_session(conn, session_id)
        if row_check is None:
            raise HTTPException(status_code=404, detail=f"Unknown session: {session_id}")
        rows = queries.get_session_turns_detailed(conn, session_id)

    out: list[TurnItem] = []
    for r in rows:
        gaps: list[str] = []
        if r.get("evaluator_gaps_json"):
            try:
                gaps = json.loads(r["evaluator_gaps_json"])
            except json.JSONDecodeError:
                gaps = []
        out.append(
            TurnItem(
                turn_idx=int(r["turn_idx"]),
                role=r["role"],
                content=r["content"],
                evaluator_score=r.get("evaluator_score"),
                evaluator_gaps=gaps,
                evaluator_reasoning=r.get("evaluator_reasoning"),
            )
        )
    return out


@router.get("/users/{user_id}/due", response_model=DueResponse)
@router.get("/users/me/due", response_model=DueResponse)
def read_due(
    user_id: str = "default",
    topic: str | None = Query(default=None, description="Filter by topic id"),
    current_user: str = Depends(get_current_user),
) -> DueResponse:
    """Return concepts due for SM-2 review."""
    uid = current_user if current_user != "default" else user_id
    with queries.get_connection() as conn:
        rows = queries.get_due_concepts(conn, uid, topic=topic)
    return DueResponse(
        user_id=uid,
        items=[
            DueItem(
                topic=r.topic,
                concept_id=r.concept_id,
                name=r.name,
                score_1_to_5=r.score_1_to_5,
                next_review_at=r.next_review_at,
                overdue=r.overdue,
            )
            for r in rows
        ],
    )


@router.get("/users/{user_id}/mastery", response_model=MasteryResponse)
@router.get("/users/me/mastery", response_model=MasteryResponse)
def read_mastery(
    user_id: str = "default",
    topic: str | None = Query(default=None, description="Filter by topic id"),
    current_user: str = Depends(get_current_user),
) -> MasteryResponse:
    """Return mastery rows for a user."""
    uid = current_user if current_user != "default" else user_id
    with queries.get_connection() as conn:
        rows = queries.get_mastery_for_user(conn, uid, topic=topic)
    return MasteryResponse(
        user_id=uid,
        items=[
            MasteryItem(
                concept_id=r.concept_id,
                topic=r.topic,
                kind=r.kind,
                name=r.name,
                score=r.score,
                score_1_to_5=r.score_1_to_5,
                num_evaluations=r.num_evaluations,
            )
            for r in rows
        ],
    )

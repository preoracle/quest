"""FastAPI routes for Quest (Phase 4)."""

from __future__ import annotations

import json
import os

import yaml
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from openai import APIConnectionError, APIStatusError, AuthenticationError, RateLimitError

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
from core.session_api import SessionView, finish_session, get_session_view, start_session, submit_turn
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

def _make_jwks_client():
    """Build a PyJWKClient pointed at this project's Supabase JWKS endpoint."""
    supabase_url = (
        os.environ.get("SUPABASE_URL")
        or os.environ.get("VITE_SUPABASE_URL", "")
    ).rstrip("/")
    if not supabase_url:
        return None
    import jwt as pyjwt  # noqa: PLC0415
    return pyjwt.PyJWKClient(f"{supabase_url}/auth/v1/.well-known/jwks.json")


_jwks_client = _make_jwks_client()


class _AuthUser:
    """Carries user_id + display name extracted from the JWT."""
    def __init__(self, user_id: str, name: str):
        self.user_id = user_id
        self.name = name


async def get_current_user(request: Request) -> _AuthUser:
    """Return authenticated user info from Supabase JWT, or a 'default' sentinel in dev."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or _jwks_client is None:
        return _AuthUser("default", "Default User")
    token = auth[7:]
    try:
        import jwt as pyjwt  # noqa: PLC0415
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "HS256"],
            options={"verify_aud": False},
        )
        user_id = str(payload["sub"])
        meta = payload.get("user_metadata") or {}
        name = (
            meta.get("full_name")
            or meta.get("name")
            or payload.get("email", "")
            or "User"
        )
        return _AuthUser(user_id, str(name))
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired token") from exc


def get_uid(auth: _AuthUser = Depends(get_current_user)) -> str:
    """Convenience dependency — returns just the user_id string."""
    return auth.user_id


def _catalog_items(
    conn,
    user_id: str,
    rows: list[dict],
) -> list[TopicCatalogItem]:
    """Merge catalog rows with mastery rollups and lifecycle flags."""
    summaries = {s["topic_id"]: s for s in topic_mastery_summary(conn, user_id)}
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
                last_studied_at=s.get("last_studied_at"),
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
    current_user: str = Depends(get_uid),
    auth: _AuthUser = Depends(get_current_user),
) -> TopicCatalogResponse:
    """Return topic catalog with previews, search, and user progress rollups."""
    with queries.get_connection() as conn:
        queries.get_or_create_user(conn, current_user, name=auth.name)
        meta = queries.list_topic_metadata(conn)
        rows = search_topics(
            query=q,
            include_archived=include_archived,
            metadata=meta,
        )
        enrolled_ids = queries.get_user_enrolled_topics(conn, current_user)
        if enrolled_only:
            rows = [r for r in rows if r["id"] in enrolled_ids]
        items = _catalog_items(conn, current_user, rows)
        for item in items:
            item.enrolled = item.id in enrolled_ids
    return TopicCatalogResponse(user_id=current_user, topics=items)


@router.get("/search/concepts", response_model=ConceptSearchResponse)
def search_concepts(
    q: str = Query(..., min_length=1),
    current_user: str = Depends(get_uid),
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
    current_user: str = Depends(get_uid),
) -> dict:
    """Add a topic to the current user's enrolled quests."""
    with queries.get_connection() as conn:
        queries.get_or_create_user(conn, current_user)
        queries.enroll_topic(conn, current_user, topic_id)
    return {"enrolled": True, "topic_id": topic_id}


@router.delete("/topics/{topic_id}/enroll", response_model=dict)
def unenroll_from_topic(
    topic_id: str,
    current_user: str = Depends(get_uid),
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
    current_user: str = Depends(get_uid),
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
    current_user: str = Depends(get_uid),
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
    current_user: str = Depends(get_uid),
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
    current_user: str = Depends(get_uid),
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
    current_user: str = Depends(get_uid),
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
    current_user: str = Depends(get_uid),
    auth: _AuthUser = Depends(get_current_user),
) -> SessionView:
    """Start or resume a session; returns the pending tutor question."""
    try:
        with queries.get_connection() as conn:
            queries.get_or_create_user(conn, current_user, name=auth.name)
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
def read_session(session_id: str, current_user: str = Depends(get_uid)) -> SessionView:
    """Return current session state from the graph checkpointer."""
    try:
        # Brief ownership check — conn held for ms, released before LLM call
        with queries.get_connection() as conn:
            row = queries.get_session(conn, session_id)
            if row is None:
                raise HTTPException(status_code=404, detail="Session not found")
            if current_user != "default" and row.get("user_id") != current_user:
                raise HTTPException(status_code=403, detail="Not your session")
        # conn released — get_session_view manages its own connections around LLM
        return get_session_view(session_id)
    except HTTPException:
        raise
    except AuthenticationError as exc:
        raise HTTPException(status_code=502, detail="LLM backend authentication failed — check LLM_API_KEY") from exc
    except RateLimitError as exc:
        raise HTTPException(status_code=503, detail="LLM backend rate limit reached — retry shortly") from exc
    except APIConnectionError as exc:
        raise HTTPException(status_code=503, detail="LLM backend unreachable — check LLM_BASE_URL") from exc
    except APIStatusError as exc:
        raise HTTPException(status_code=502, detail=f"LLM backend error {exc.status_code}: {exc.message}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/sessions/{session_id}/turn", response_model=SessionView)
def post_turn(session_id: str, body: SubmitTurnRequest) -> SessionView:
    """Submit an answer; returns evaluator output and the next question (or completion)."""
    try:
        # submit_turn manages its own connections — no conn held during LLM calls
        return submit_turn(session_id, body.answer)
    except AuthenticationError as exc:
        raise HTTPException(status_code=502, detail="LLM backend authentication failed — check LLM_API_KEY") from exc
    except RateLimitError as exc:
        raise HTTPException(status_code=503, detail="LLM backend rate limit reached — retry shortly") from exc
    except APIConnectionError as exc:
        raise HTTPException(status_code=503, detail="LLM backend unreachable — check LLM_BASE_URL") from exc
    except APIStatusError as exc:
        raise HTTPException(status_code=502, detail=f"LLM backend error {exc.status_code}: {exc.message}") from exc
    except ValueError as exc:
        msg = str(exc)
        if "Unknown session" in msg:
            raise HTTPException(status_code=404, detail=msg) from exc
        if "already ended" in msg or "not waiting" in msg:
            raise HTTPException(status_code=409, detail=msg) from exc
        if "Rate limit" in msg:
            raise HTTPException(status_code=429, detail=msg) from exc
        raise HTTPException(status_code=400, detail=msg) from exc


@router.post("/sessions/{session_id}/finish", response_model=SessionView)
def finish_session_route(session_id: str) -> SessionView:
    """End a session early and generate its report."""
    from pydantic import ValidationError  # noqa: PLC0415
    try:
        with queries.get_connection() as conn:
            return finish_session(conn, session_id)
    except ValidationError:
        raise  # let FastAPI return 500 with the real error — not a 404
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
    current_user: str = Depends(get_uid),
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
    current_user: str = Depends(get_uid),
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

"""FastAPI routes for Quest (Phase 4)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

import json

import yaml

from api.schemas import (
    BaselineAnswerRequest,
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
    TopicSummaryItem,
    TopicSummaryResponse,
    TurnItem,
)
from core.baseline_api import BaselineView, start_baseline, submit_baseline_answer
from core.session_api import SessionView, get_session_view, start_session, submit_turn
from core.topic_catalog import list_topic_catalog
from core.topic_generator import generate_topic_payload, write_topic_yaml
from core.topic_graph import TopicGraph, get_topic_graph, topic_mastery_summary
from core.topic_validate import validate_topic_payload
from db import queries

router = APIRouter()


@router.get("/topics", response_model=TopicCatalogResponse)
def list_available_topics(user_id: str = Query(default="default")) -> TopicCatalogResponse:
    """Return topic catalog with previews and user progress rollups."""
    catalog = list_topic_catalog()
    with queries.get_connection() as conn:
        summaries = {
            s["topic_id"]: s for s in topic_mastery_summary(conn, user_id)
        }
        last_study = queries.get_topic_last_study_at(conn, user_id)

    items: list[TopicCatalogItem] = []
    for row in catalog:
        s = summaries.get(row["id"], {})
        items.append(
            TopicCatalogItem(
                id=row["id"],
                display_name=row["display_name"],
                concept_count=row["concept_count"],
                preview_concepts=row["preview_concepts"],
                hook=row["hook"],
                started=bool(s.get("started")),
                mastered_count=int(s.get("mastered_count") or 0),
                avg_score_1_to_5=float(s.get("avg_score_1_to_5") or 0),
                due_count=int(s.get("due_count") or 0),
                last_studied_at=last_study.get(row["id"]),
            )
        )
    return TopicCatalogResponse(user_id=user_id, topics=items)


@router.get("/topics/{topic_id}/graph", response_model=TopicGraph)
def read_topic_graph(
    topic_id: str,
    user_id: str = Query(default="default"),
) -> TopicGraph:
    """Concept DAG with prerequisites and user mastery scores."""
    try:
        with queries.get_connection() as conn:
            return get_topic_graph(conn, user_id, topic_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/users/{user_id}/progress/summary", response_model=TopicSummaryResponse)
def read_progress_summary(user_id: str) -> TopicSummaryResponse:
    """Per-topic mastery rollup for dashboard cards."""
    with queries.get_connection() as conn:
        rows = topic_mastery_summary(conn, user_id)
    return TopicSummaryResponse(
        user_id=user_id,
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
    return TopicCreatedResponse(
        topic_id=data["topic"],
        display_name=data["display_name"],
        concept_count=len(data.get("concepts") or []),
        path=str(path),
    )


@router.post("/baseline", response_model=BaselineView)
def create_baseline(body: StartBaselineRequest) -> BaselineView:
    """Start or resume baseline calibration; returns first question."""
    try:
        with queries.get_connection() as conn:
            return start_baseline(conn, body.user_id, body.topic)
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
def create_session(body: StartSessionRequest) -> SessionView:
    """Start or resume a session; returns the pending tutor question."""
    try:
        with queries.get_connection() as conn:
            return start_session(
                conn,
                body.user_id,
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
def read_due(
    user_id: str,
    topic: str | None = Query(default=None, description="Filter by topic id"),
) -> DueResponse:
    """Return concepts due for SM-2 review."""
    with queries.get_connection() as conn:
        rows = queries.get_due_concepts(conn, user_id, topic=topic)
    return DueResponse(
        user_id=user_id,
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
def read_mastery(
    user_id: str,
    topic: str | None = Query(default=None, description="Filter by topic id"),
) -> MasteryResponse:
    """Return mastery rows for a user."""
    with queries.get_connection() as conn:
        rows = queries.get_mastery_for_user(conn, user_id, topic=topic)
    return MasteryResponse(
        user_id=user_id,
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

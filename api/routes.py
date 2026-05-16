"""FastAPI routes for Quest (Phase 4)."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from api.schemas import (
    MasteryItem,
    MasteryResponse,
    StartSessionRequest,
    SubmitTurnRequest,
)
from core.session_api import SessionView, get_session_view, start_session, submit_turn
from db import queries

router = APIRouter()


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

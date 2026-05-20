"""Session operations for CLI and HTTP (Phase 4).

Wraps the LangGraph checkpointer the same way the CLI does, but returns
structured state instead of printing or reading stdin.
"""

from __future__ import annotations

import sqlite3

from langgraph.types import Command
from pydantic import BaseModel, Field

from core.graph import build_checkpointer, build_quest_graph, seed_state_from_turns
from core.models import EvaluatorOutput
from core.topics import load_topic
from db import queries


class EvaluationView(BaseModel):
    """Evaluator output exposed to API clients."""

    score: int
    gaps: list[str] = Field(default_factory=list)
    reasoning: str
    inferred_concept_id: str | None = None
    inferred_concept_confidence: float = 0.0


class SessionView(BaseModel):
    """Current session snapshot for GET /sessions or turn responses."""

    session_id: str
    user_id: str
    topic_id: str
    topic_display: str
    done: bool = False
    waiting_for_answer: bool = False
    focus: str | None = None
    focus_scope: str | None = None
    tutor_message: str | None = None
    last_evaluation: EvaluationView | None = None
    summary: str | None = None
    ended_at: str | None = None


def _graph_config(session_id: str) -> dict:
    """Build LangGraph configurable dict for a session thread."""
    return {"configurable": {"thread_id": session_id}}


def _values_to_view(
    values: dict,
    session_row: dict,
    topic_display: str,
    *,
    waiting: bool,
) -> SessionView:
    """Map graph state + DB session row to a SessionView."""
    raw_eval = values.get("last_evaluation")
    evaluation = None
    if raw_eval:
        ev = EvaluatorOutput.model_validate(raw_eval)
        evaluation = EvaluationView(
            score=ev.score,
            gaps=ev.gaps,
            reasoning=ev.reasoning,
            inferred_concept_id=ev.inferred_concept_id,
            inferred_concept_confidence=ev.inferred_concept_confidence,
        )

    done = bool(values.get("done"))
    tutor = values.get("tutor_message")
    summary = None
    if done and tutor:
        summary = session_row.get("summary_text") or tutor

    return SessionView(
        session_id=session_row["id"],
        user_id=session_row["user_id"],
        topic_id=session_row["topic"],
        topic_display=topic_display,
        done=done,
        waiting_for_answer=waiting and not done,
        focus=values.get("current_concept_name"),
        focus_scope=values.get("current_concept_scope"),
        tutor_message=tutor if waiting or done else None,
        last_evaluation=evaluation,
        summary=summary,
        ended_at=session_row.get("ended_at"),
    )


def get_session_view(conn: sqlite3.Connection, session_id: str) -> SessionView:
    """Return the current graph/DB view for a session.

    Raises ValueError if the session id does not exist.
    """
    row = queries.get_session(conn, session_id)
    if row is None:
        raise ValueError(f"Unknown session: {session_id}")

    topic_data = load_topic(row["topic"])
    display = topic_data.get("display_name") or row["topic"]

    checkpointer = build_checkpointer()
    graph = build_quest_graph(conn, checkpointer)
    config = _graph_config(session_id)
    snapshot = graph.get_state(config)
    values = snapshot.values or {}

    waiting = bool(snapshot.next)
    if not values and row["ended_at"]:
        return SessionView(
            session_id=session_id,
            user_id=row["user_id"],
            topic_id=row["topic"],
            topic_display=display,
            done=True,
            summary=row.get("summary_text"),
            ended_at=row["ended_at"],
        )

    return _values_to_view(values, row, display, waiting=waiting)


def start_session(
    conn: sqlite3.Connection,
    user_id: str,
    topic_id: str,
    *,
    resume: bool = True,
    replay: bool = False,
) -> SessionView:
    """Create or resume a session and return the first pending question.

    Runs the graph until it interrupts at `wait_for_user` or completes.
    When `resume` is True, reuses an open session for (user_id, topic_id).

    When ``replay`` is True, starts a **new** session that walks the concept DAG
    from scratch for this run (scheduling ignores stored mastery). DB mastery
    still updates. Implies ``resume`` does not reuse an open session.
    """
    topic_data = load_topic(topic_id)
    display = topic_data.get("display_name") or topic_id

    queries.get_or_create_user(conn, user_id)
    concept_list = queries.upsert_topic_concepts(conn, topic_data)

    want_resume = resume and not replay
    open_id = queries.get_open_session(conn, user_id, topic_id) if want_resume else None
    if open_id:
        session_id = open_id
        resuming = True
    else:
        session_id = queries.create_session(conn, user_id, topic_id)
        resuming = False

    checkpointer = build_checkpointer()
    graph = build_quest_graph(conn, checkpointer)
    config = _graph_config(session_id)

    snapshot = graph.get_state(config)
    if not snapshot.values:
        if resuming:
            state = seed_state_from_turns(
                conn, session_id, user_id, topic_id, concept_list
            )
            graph.update_state(config, state)
        else:
            graph.invoke(
                {
                    "user_id": user_id,
                    "topic_id": topic_id,
                    "session_id": session_id,
                    "concept_list": concept_list,
                    "turn_idx": 0,
                    "history": [],
                    "concept_turn_count": 0,
                    "done": False,
                    "session_complete": False,
                    "replay_mode": replay,
                    "completed_concept_ids": [],
                },
                config,
            )

    snapshot = graph.get_state(config)
    row = queries.get_session(conn, session_id)
    if row is None:
        raise ValueError(f"Unknown session: {session_id}")
    return _values_to_view(
        snapshot.values or {},
        row,
        display,
        waiting=bool(snapshot.next),
    )


def submit_turn(
    conn: sqlite3.Connection,
    session_id: str,
    answer: str,
) -> SessionView:
    """Submit a student answer and advance the graph to the next question or end.

    Raises ValueError if the session is unknown, ended, or not waiting for input.
    """
    row = queries.get_session(conn, session_id)
    if row is None:
        raise ValueError(f"Unknown session: {session_id}")
    if row["ended_at"]:
        raise ValueError(f"Session already ended: {session_id}")

    topic_data = load_topic(row["topic"])
    display = topic_data.get("display_name") or row["topic"]

    checkpointer = build_checkpointer()
    graph = build_quest_graph(conn, checkpointer)
    config = _graph_config(session_id)
    snapshot = graph.get_state(config)

    if not snapshot.next:
        raise ValueError("Session is not waiting for an answer")

    graph.invoke(Command(resume=answer.strip()), config)

    snapshot = graph.get_state(config)
    row = queries.get_session(conn, session_id)
    if row is None:
        raise ValueError(f"Unknown session: {session_id}")
    return _values_to_view(
        snapshot.values or {},
        row,
        display,
        waiting=bool(snapshot.next),
    )

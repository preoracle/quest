"""Session operations for CLI and HTTP (Phase 4).

Wraps the LangGraph checkpointer the same way the CLI does, but returns
structured state instead of printing or reading stdin.
"""

from __future__ import annotations

import sqlite3

from langgraph.types import Command
import datetime as _dt

from pydantic import BaseModel, Field, field_validator

from core.graph import checkpointer_session, build_quest_graph, seed_state_from_turns
from core.models import EvaluatorOutput
from core.session_report import SessionReport, build_session_report, report_from_json
from core.topics import load_topic
from db import queries


class EvaluationView(BaseModel):
    """Evaluator output exposed to API clients."""

    score: int
    gaps: list[str] = Field(default_factory=list)
    reasoning: str
    gap_type: str | None = None
    expert_framing: str | None = None
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
    report: SessionReport | None = None
    ended_at: str | None = None

    @field_validator("ended_at", mode="before")
    @classmethod
    def coerce_ended_at(cls, v: object) -> str | None:
        """Postgres returns ended_at as datetime; SQLite returns str. Normalize to ISO string."""
        if v is None:
            return None
        if isinstance(v, (_dt.datetime, _dt.date)):
            return v.isoformat()
        return str(v)


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
            gap_type=ev.gap_type,
            expert_framing=ev.expert_framing,
            inferred_concept_id=ev.inferred_concept_id,
            inferred_concept_confidence=ev.inferred_concept_confidence,
        )

    done = bool(values.get("done"))
    tutor = values.get("tutor_message")
    summary = session_row.get("summary_text") if done else None
    report = None
    if done:
        raw_report = values.get("session_report")
        if raw_report:
            report = SessionReport.model_validate(raw_report)
        elif session_row.get("report_json"):
            report = report_from_json(session_row["report_json"])

    return SessionView(
        session_id=session_row["id"],
        user_id=session_row["user_id"],
        topic_id=session_row["topic"],
        topic_display=topic_display,
        done=done,
        waiting_for_answer=waiting and not done,
        focus=values.get("current_concept_name"),
        focus_scope=values.get("current_concept_scope"),
        tutor_message=tutor,  # always expose — frontend guards on waiting_for_answer
        last_evaluation=evaluation,
        summary=summary,
        report=report,
        ended_at=session_row.get("ended_at"),
    )


def finish_session(conn: sqlite3.Connection, session_id: str) -> SessionView:
    """Mark a session as done, build its report, and return the updated view.

    Returns directly from DB — does not call get_session_view so that
    LangGraph graph state (which still has done=False) is never consulted.
    """
    row = queries.get_session(conn, session_id)
    if row is None:
        raise ValueError(f"Unknown session: {session_id}")
    if not row.get("ended_at"):
        queries.end_session(conn, session_id)
    try:
        topic_data = load_topic(row["topic"])
        display = topic_data.get("display_name") or row["topic"]
    except FileNotFoundError:
        display = row["topic"]
    report = build_session_report(conn, session_id, row["topic"], display)
    queries.set_session_report(conn, session_id, report.model_dump_json())
    row = queries.get_session(conn, session_id)
    return SessionView(
        session_id=session_id,
        user_id=row["user_id"],
        topic_id=row["topic"],
        topic_display=display,
        done=True,
        report=report,
        ended_at=row.get("ended_at"),
    )


def _initial_graph_state(
    session_id: str,
    user_id: str,
    topic_id: str,
    concept_list: list[dict],
    *,
    replay_mode: bool = False,
) -> dict:
    """Build the initial state dict for a brand-new LangGraph session."""
    return {
        "user_id": user_id,
        "topic_id": topic_id,
        "session_id": session_id,
        "concept_list": concept_list,
        "turn_idx": 0,
        "history": [],
        "concept_turn_count": 0,
        "done": False,
        "session_complete": False,
        "replay_mode": replay_mode,
        "completed_concept_ids": [],
        "advance_concept": False,
        "last_score": None,
        "last_evaluation": None,
        "last_gap_type": None,
        "last_expert_framing": None,
        "session_report": None,
        "current_concept_id": None,
        "current_concept_name": None,
        "current_concept_scope": None,
        "tutor_message": None,
        "user_input": None,
        "last_tutor_question": None,
    }


def get_session_view(session_id: str) -> SessionView:
    """Return the current graph/DB view for a session.

    If the session has no checkpoint state yet (POST /sessions created the DB
    record but hasn't run the graph), this call triggers the graph — including
    the first Claude call — so the SessionPage skeleton shows during the wait
    instead of blocking the session-start request.

    Raises ValueError if the session id does not exist.
    No DB connection is held during Claude API calls.
    """
    # Brief DB read — connection held for ms, released before any Claude call
    with queries.get_connection() as conn:
        row = queries.get_session(conn, session_id)
        if row is None:
            raise ValueError(f"Unknown session: {session_id}")
        topic_data = load_topic(row["topic"])
        display = topic_data.get("display_name") or row["topic"]

    with checkpointer_session() as checkpointer:
        graph = build_quest_graph(checkpointer)
        config = _graph_config(session_id)
        snapshot = graph.get_state(config)
        values = snapshot.values or {}

        # Ended session with no graph state — return from DB only
        if not values and row.get("ended_at"):
            return SessionView(
                session_id=session_id,
                user_id=row["user_id"],
                topic_id=row["topic"],
                topic_display=display,
                done=True,
                summary=row.get("summary_text"),
                report=report_from_json(row.get("report_json")),
                ended_at=row["ended_at"],
            )

        # No graph state yet — OR partial checkpoint from a failed graph.invoke()
        # (e.g. LLM API error mid-run): pick_concept wrote state but ask_question
        # never completed, so tutor_message is null and the session looks alive but
        # is permanently stuck.  Treat both cases as uninitialised and re-run.
        def _is_broken_state(v: dict) -> bool:
            return bool(v) and not v.get("tutor_message") and not v.get("done")

        if (not values or _is_broken_state(values)) and not row.get("ended_at"):
            # Brief write before Claude call — own connection, released immediately
            with queries.get_connection() as conn:
                concept_list = queries.upsert_topic_concepts(conn, topic_data)
                queries.get_or_create_user(conn, row["user_id"])
            # NO connection held during graph.invoke() (Claude API call)
            replay_mode = row.get("session_kind") == "replay"
            graph.invoke(
                _initial_graph_state(
                    session_id,
                    row["user_id"],
                    row["topic"],
                    concept_list,
                    replay_mode=replay_mode,
                ),
                config,
            )
            snapshot = graph.get_state(config)
            values = snapshot.values or {}

        waiting = bool(snapshot.next)
        return _values_to_view(values, row, display, waiting=waiting)


def start_session(
    conn: sqlite3.Connection,
    user_id: str,
    topic_id: str,
    *,
    resume: bool = True,
    replay: bool = False,
) -> SessionView:
    """Create or resume a session.

    For NEW sessions this returns immediately (no Claude call) — the graph is
    initialised lazily on the first GET /sessions/:id so the session-start
    button is instant and the Claude wait happens behind the SessionPage
    skeleton instead.

    For RESUMED sessions (existing open session) the graph state is
    reconstructed from stored turns (fast, no Claude call).
    """
    topic_data = load_topic(topic_id)
    display = topic_data.get("display_name") or topic_id

    queries.get_or_create_user(conn, user_id)
    concept_list = queries.upsert_topic_concepts(conn, topic_data)

    want_resume = resume and not replay
    open_id = queries.get_open_session(conn, user_id, topic_id) if want_resume else None

    if open_id:
        # ── RESUME: existing open session ─────────────────────────────────
        session_id = open_id
        with checkpointer_session() as checkpointer:
            graph = build_quest_graph(checkpointer)
            config = _graph_config(session_id)
            snapshot = graph.get_state(config)

            if not snapshot.values:
                # Checkpoint gone (e.g. DB wiped) — rebuild from stored turns
                row = queries.get_session(conn, session_id)
                if row and row.get("session_kind") not in ("study", "replay"):
                    raise ValueError(
                        f"Session {session_id} is not a study session; "
                        "start a new session instead."
                    )
                state = seed_state_from_turns(
                    conn, session_id, user_id, topic_id, concept_list
                )
                graph.update_state(config, state)
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

    # ── NEW session ───────────────────────────────────────────────────────
    if not want_resume:
        queries.close_open_study_sessions(conn, user_id, topic_id)

    kind = "replay" if replay else "study"
    session_id = queries.create_session(conn, user_id, topic_id, session_kind=kind)
    row = queries.get_session(conn, session_id)

    # Return a pending view immediately — graph.invoke() (the slow Claude call)
    # is deferred to the first GET /sessions/:id call in get_session_view().
    return SessionView(
        session_id=session_id,
        user_id=user_id,
        topic_id=topic_id,
        topic_display=display,
        done=False,
        waiting_for_answer=False,  # Not yet — will be True after first GET
        tutor_message=None,
    )


def submit_turn(
    session_id: str,
    answer: str,
) -> SessionView:
    """Submit a student answer and advance the graph to the next question or end.

    Raises ValueError if the session is unknown, ended, or not waiting for input.
    No DB connection is held during Claude API calls (evaluator + tutor).
    """
    # Brief validation read — connection held for ms, released before Claude
    with queries.get_connection() as conn:
        row = queries.get_session(conn, session_id)
        if row is None:
            raise ValueError(f"Unknown session: {session_id}")
        if row["ended_at"]:
            raise ValueError(f"Session already ended: {session_id}")
        # Per-user rate limit: 60 student turns/hour prevents automated calibration
        # attacks while leaving ample headroom for real humans (~6 turns/session).
        turn_count = queries.count_user_turns_last_hour(conn, row["user_id"])
        if turn_count >= 60:
            raise ValueError(
                f"Rate limit: user submitted {turn_count} turns in the last hour "
                "(max 60). Please wait before continuing."
            )
        topic_data = load_topic(row["topic"])
        display = topic_data.get("display_name") or row["topic"]

    with checkpointer_session() as checkpointer:
        graph = build_quest_graph(checkpointer)
        config = _graph_config(session_id)
        snapshot = graph.get_state(config)

        if not snapshot.next:
            raise ValueError("Session is not waiting for an answer")

        # NO connection held during graph.invoke() (evaluator + tutor Claude calls)
        graph.invoke(Command(resume=answer.strip()), config)

        snapshot = graph.get_state(config)
        # Brief read after graph completes
        with queries.get_connection() as conn:
            row = queries.get_session(conn, session_id)
            if row is None:
                raise ValueError(f"Unknown session: {session_id}")
        return _values_to_view(
            snapshot.values or {},
            row,
            display,
            waiting=bool(snapshot.next),
        )

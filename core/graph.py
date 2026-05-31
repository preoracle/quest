"""LangGraph session flow (Phase 3). Replaces the Phase 2 REPL loop."""

from __future__ import annotations

import os
import sqlite3
import time
from contextlib import contextmanager
from typing import Literal, TypedDict

from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.exceptions import OutputParserException
from langgraph.graph import END, StateGraph
from langgraph.types import Command, interrupt

from core.chains import build_evaluator_chain, build_socratic_chain
from core.eval_context import build_evaluator_invoke_payload, get_eval_mode
from core.concept_pick import pick_next_concept, pick_next_concept_replay
from core.mastery import apply_evaluation_to_mastery
from core.memory import summarize_session
from core.session_report import build_session_report
from core.messages import message_content, messages_from_dicts, messages_to_dicts
from core.models import EvaluatorOutput
from db import queries

CONCEPT_MASTERED_MIN_SCORE = 4
CONCEPT_MASTERED_MIN_TURNS = 3
# Safety valve: advance regardless of score after this many turns on one concept.
# Prevents students from being trapped when the evaluator is miscalibrated or
# the question is genuinely too hard. Not a mastery signal — mastery is not
# written (SM-2 treats unmastered concepts as due immediately for next session).
CONCEPT_MAX_TURNS = 8

_TASK_INSTRUCTION = (
    "Ask ONE question. The student must understand the intellectual TASK "
    "(compare two options, sequence events, predict an outcome, commit to one "
    "choice, or state a decision rule) without you defining terms or giving away "
    "the specific technical term, formula, or mechanism being asked about. "
    "Not yet seen concepts in the mastery profile are listed for context only — "
    "do not reference them by name in your question."
)


def _timed_invoke(chain, payload: dict, *, chain_name: str, session_id: str, turn_idx: int) -> object:
    """Invoke a LangChain chain, log latency + outcome to llm_calls table.

    Always re-raises the original exception — logging is best-effort and must
    never silently swallow errors that the caller needs to handle.
    """
    model_name = getattr(getattr(chain, "first", None), "model_name", None) or "unknown"
    # For composed chains (RunnableSequence), walk .steps to find the LLM
    if model_name == "unknown":
        for step in getattr(chain, "steps", []):
            m = getattr(step, "model_name", None)
            if m:
                model_name = m
                break

    t0 = time.monotonic()
    error: str | None = None
    success = True
    result = None
    try:
        result = chain.invoke(payload)
        return result
    except Exception as exc:
        success = False
        error = type(exc).__name__
        raise
    finally:
        latency_ms = int((time.monotonic() - t0) * 1000)
        try:
            with queries.get_connection() as _log_conn:
                queries.log_llm_call(
                    _log_conn,
                    chain=chain_name,
                    model=model_name,
                    session_id=session_id,
                    turn_idx=turn_idx,
                    latency_ms=latency_ms,
                    success=success,
                    error=error,
                )
        except Exception:  # noqa: BLE001  — logging must never crash the session
            pass


def _concept_scope_from_list(
    concept_list: list[dict],
    concept_id: str | None,
) -> str:
    """Short probe line from the concept YAML description (for tutor + UI)."""
    if not concept_id:
        return ""
    for item in concept_list:
        if item.get("id") == concept_id:
            desc = (item.get("description") or "").strip()
            if desc.lower().startswith("probes "):
                desc = desc[7:].strip()
            if len(desc) > 100:
                return desc[:97] + "..."
            return desc
    return ""


class QuestState(TypedDict, total=False):
    """Graph state persisted by LangGraph checkpointer."""

    user_id: str
    student_name: str | None
    topic_id: str
    session_id: str
    concept_list: list[dict]
    current_concept_id: str | None
    current_concept_name: str | None
    current_concept_scope: str | None
    concept_turn_count: int
    turn_idx: int
    last_tutor_question: str | None
    history: list[dict]
    tutor_message: str
    user_input: str
    done: bool
    session_complete: bool
    advance_concept: bool
    last_score: int | None
    last_evaluation: dict | None
    last_gap_type: str | None
    last_expert_framing: str | None
    recent_scores: list[int]  # last N scores on the current concept (reset on concept change)
    replay_mode: bool
    completed_concept_ids: list[str]
    session_report: dict | None


# ---------------------------------------------------------------------------
# Checkpointer — separate pool so graph ops don't block the app DB pool
# ---------------------------------------------------------------------------

_checkpointer_pool = None
_sqlite_saver = None


def _get_checkpointer_pool():
    """Return (or create) the psycopg pool used exclusively for LangGraph checkpoints."""
    global _checkpointer_pool
    if _checkpointer_pool is not None:
        return _checkpointer_pool
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        return None
    try:
        from psycopg_pool import ConnectionPool  # noqa: PLC0415
        from langgraph.checkpoint.postgres import PostgresSaver  # noqa: PLC0415
        _checkpointer_pool = ConnectionPool(
            db_url,
            min_size=0,   # don't pre-warm — avoids stale idle connections
            max_size=20,
            open=False,   # open lazily on first use
            # autocommit + no prepared statements: required for Supabase
            # Transaction Pooler (PgBouncer transaction mode).
            # keepalives prevent the server from silently dropping idle TCP connections.
            kwargs={
                "autocommit": True,
                "prepare_threshold": None,
                "keepalives": 1,
                "keepalives_idle": 30,
                "keepalives_interval": 10,
                "keepalives_count": 5,
            },
        )
        _checkpointer_pool.open(wait=True)
        # Create checkpoint tables once at startup
        with _checkpointer_pool.connection() as conn:
            PostgresSaver(conn).setup()
    except ImportError as exc:
        raise ImportError(
            "DATABASE_URL is set but psycopg[pool] or langgraph-checkpoint-postgres "
            "is not installed."
        ) from exc
    return _checkpointer_pool


@contextmanager
def checkpointer_session():
    """Context manager that yields a ready LangGraph checkpointer.

    Postgres: checks a connection out of the dedicated checkpointer pool,
    wraps it in PostgresSaver, then returns it to the pool on exit.
    SQLite (dev): yields the shared SqliteSaver singleton.

    Each concurrent graph.invoke() / graph.get_state() gets its OWN
    connection, making concurrent sessions fully thread-safe.
    """
    pool = _get_checkpointer_pool()
    if pool is None:
        # Dev: SQLite — single-connection saver is fine for sequential dev use
        global _sqlite_saver
        if _sqlite_saver is None:
            from langgraph.checkpoint.sqlite import SqliteSaver  # noqa: PLC0415
            path = queries.get_checkpoint_db_path()
            conn = sqlite3.connect(str(path), check_same_thread=False)
            _sqlite_saver = SqliteSaver(conn)
        yield _sqlite_saver
        return

    from langgraph.checkpoint.postgres import PostgresSaver  # noqa: PLC0415
    conn = pool.getconn()
    try:
        yield PostgresSaver(conn)
    finally:
        pool.putconn(conn)


# Backwards-compat: callers that used get_checkpointer() directly
# now need to use the checkpointer_session() context manager.
def get_checkpointer():
    """Deprecated — use checkpointer_session() context manager instead.

    Returns the checkpointer pool sentinel; only useful for callers that
    haven't been migrated yet (will be removed).
    """
    raise RuntimeError(
        "get_checkpointer() is no longer supported. "
        "Use `with checkpointer_session() as cp:` instead."
    )


# ---------------------------------------------------------------------------
# Evaluator chain singleton — built once at process startup, shared across
# all requests.  Building ChatOpenAI is cheap but needlessly re-runs on every
# graph.invoke() call (once per GET /sessions/:id and POST /turn) when the
# instance is stateless and safe to share across threads.
# ---------------------------------------------------------------------------

_evaluator_chain = None


def _get_evaluator_chain():
    """Return the shared evaluator chain, building it on first call."""
    global _evaluator_chain
    if _evaluator_chain is None:
        _evaluator_chain = build_evaluator_chain()
    return _evaluator_chain


# ---------------------------------------------------------------------------
# Graph builder — nodes own their own short-lived DB connections
# ---------------------------------------------------------------------------

def build_quest_graph(checkpointer):
    """Compile the Quest StateGraph.

    Each graph node opens its OWN connection from the shared app pool for the
    brief SQL it needs (ms-level reads/writes), then releases it immediately.
    No connection is held during LLM API calls, so the pool is never
    saturated by slow LLM latency.

    Returns a compiled graph. Use thread_id = session_id in config.
    """
    evaluator = _get_evaluator_chain()  # singleton — safe to share across threads

    def pick_concept(state: QuestState) -> dict:
        """Select the next due, unmastered concept with satisfied prerequisites."""
        topic_id = state["topic_id"]
        user_id = state["user_id"]
        with queries.get_connection() as conn:
            concepts = queries.get_topic_concepts(conn, topic_id)
            if state.get("replay_mode"):
                completed = set(state.get("completed_concept_ids") or [])
                nxt = pick_next_concept_replay(concepts, topic_id, completed)
            else:
                scores, reviews, eval_counts = queries.get_mastery_maps(
                    conn, user_id, topic_id,
                )
                nxt = pick_next_concept(
                    concepts, topic_id, scores, reviews, eval_counts=eval_counts,
                )
        if nxt is None:
            return {
                "session_complete": True,
                "current_concept_id": None,
                "current_concept_name": None,
                "current_concept_scope": None,
            }
        prev = state.get("current_concept_id")
        reset_turns = prev != nxt["id"]
        scope = _concept_scope_from_list(state.get("concept_list") or [], nxt["id"])
        patch: dict = {
            "session_complete": False,
            "advance_concept": False,
            "current_concept_id": nxt["id"],
            "current_concept_name": nxt["name"],
            "current_concept_scope": scope,
            "concept_turn_count": 0 if reset_turns else state.get("concept_turn_count", 0),
        }
        if reset_turns:
            patch["history"] = []
            patch["recent_scores"] = []
        return patch

    def ask_question(state: QuestState) -> dict:
        """Generate the next Socratic question for the current concept."""
        topic_id = state["topic_id"]
        persisted = messages_from_dicts(state.get("history") or [])
        concept_name = state.get("current_concept_name") or "this topic"
        scope = state.get("current_concept_scope") or ""
        turn_count = state.get("concept_turn_count", 0)
        user_id = state["user_id"]

        # Opening turn: one-shot instructor steer (not saved). Follow-ups use real dialogue.
        recent_scores: list[int] = list(state.get("recent_scores") or [])
        # Stuck = last 3+ scores all ≤ 3 (student plateauing, not improving)
        is_stuck = len(recent_scores) >= 3 and all(s <= 3 for s in recent_scores[-3:])
        # Plateau = scores oscillating without reaching 4 over last 4 turns
        is_plateau = len(recent_scores) >= 4 and max(recent_scores[-4:]) <= 3

        if turn_count == 0:
            steer = (
                "[Instructor note — not the student's words. "
                f"Ask your opening Socratic question for concept '{concept_name}'. "
                f"{_TASK_INSTRUCTION}"
            )
            # If a prior concept was completed this session, inject its final exchange
            # so the tutor doesn't re-ask questions the student already answered.
            completed_ids: list[str] = list(state.get("completed_concept_ids") or [])
            if completed_ids:
                concept_map = {c["id"]: c["name"] for c in (state.get("concept_list") or [])}
                prior_concept_name = concept_map.get(completed_ids[-1], "the prior concept")
                history = list(state.get("history") or [])
                # Find the last AI question and human answer before this concept started
                last_ai = next(
                    (m["content"] for m in reversed(history) if m.get("role") == "ai"),
                    None,
                )
                last_human = next(
                    (m["content"] for m in reversed(history) if m.get("role") == "human"),
                    None,
                )
                if last_ai and last_human:
                    prior_q = last_ai[:200].rstrip()
                    prior_a = last_human[:200].rstrip()
                    steer += (
                        f" IMPORTANT: The student just completed '{prior_concept_name}'."
                        f" Their final exchange — Q: \"{prior_q}\" / A: \"{prior_a}\"."
                        " Do NOT re-ask this angle. Start one layer deeper, building on what they demonstrated."
                    )
            if scope:
                # One punchy nudge — cap at 120 chars so the scope hint doesn't
                # balloon into a multi-part brief that tempts compound questions.
                scope_hint = scope[:120].rstrip()
                steer += f" Core tension to probe (one angle only, do not quote): {scope_hint}"
            # Brief read — connection held for ms, released before LLM call
            with queries.get_connection() as conn:
                prior = queries.get_recent_summaries(conn, user_id, topic_id, limit=5)
                mastery_rows = queries.get_mastery_for_user(conn, user_id, topic=topic_id)
            if prior:
                snippets = " | ".join(s[:280] for s in prior)
                steer += (
                    " Prior sessions on this topic (vary your angle; do not repeat): "
                    f"{snippets}"
                )
            # Inject structured mastery profile so the tutor knows exactly which
            # concepts the student has attempted, how well, and what's untouched.
            # Format: "score/5 ×evals" — compact enough to not bloat the steer.
            if mastery_rows:
                # Concepts in state order (YAML DAG order) for readability
                concept_order = {c["id"]: i for i, c in enumerate(state.get("concept_list") or [])}
                mastery_rows_sorted = sorted(
                    mastery_rows,
                    key=lambda r: concept_order.get(r.concept_id, 999),
                )
                seen = [
                    f"{r.name}: {r.score_1_to_5:.1f}/5 ×{r.num_evaluations}"
                    for r in mastery_rows_sorted
                    if r.num_evaluations > 0
                ]
                seen_ids = {r.concept_id for r in mastery_rows if r.num_evaluations > 0}
                unseen = [
                    c["name"]
                    for c in (state.get("concept_list") or [])
                    if c["id"] not in seen_ids
                ]
                profile_parts = []
                if seen:
                    profile_parts.append("Seen: " + ", ".join(seen))
                if unseen:
                    profile_parts.append("Not yet seen: " + ", ".join(unseen))
                if profile_parts:
                    steer += (
                        " Student mastery profile (use to vary depth and angle — "
                        "do NOT directly quote scores to the student): "
                        + " | ".join(profile_parts)
                    )
            student_name = state.get("student_name")
            if student_name and student_name not in ("Default User", ""):
                first_name = student_name.split()[0]
                steer += f" Student's first name: {first_name} (use occasionally, not every message)."
            steer += "]"
            invoke_history = [HumanMessage(content=steer)]
        else:
            # Follow-up turns: inject a lightweight instructor note that gives the
            # tutor two signals it otherwise can't see from conversation alone:
            # (1) how many turns remain so it knows when to wrap up or go deeper
            # (2) whether the student is stuck (scores ≤ 3 for 3+ turns in a row)
            # (3) what evaluation gap was observed on the last answer
            max_turns = CONCEPT_MAX_TURNS  # 8
            turns_left = max(0, max_turns - turn_count)
            needs_instructor_note = turn_count >= 1
            if needs_instructor_note:
                last_eval = state.get("last_evaluation") or {}
                last_score = last_eval.get("score")
                last_gap_type = last_eval.get("gap_type", "none")
                last_expert_framing = last_eval.get("expert_framing")
                parts: list[str] = []
                if turn_count >= 3 or is_stuck or is_plateau:
                    parts.append(f"turn {turn_count + 1} of {max_turns} on this concept — {turns_left} left")
                if is_stuck or is_plateau:
                    score_str = " → ".join(str(s) for s in recent_scores[-4:])
                    parts.append(
                        f"STUCK PATTERN detected (scores: {score_str}). "
                        "Do NOT ask a bigger or similar question. "
                        "Find the single most primitive sub-question hiding inside "
                        "the one they cannot answer — strip back to first principles. "
                        "ONE STEP SMALLER."
                    )
                elif turn_count >= 3:
                    parts.append(
                        "if the student seems unsure, go smaller and more concrete"
                    )
                if last_score is not None and turn_count >= 1:
                    if last_score >= 4 and last_expert_framing:
                        probe_target = str(last_expert_framing)[:240]
                        parts.append(
                            f"Last eval: {last_score}/5, gap={last_gap_type}. "
                            "Probe toward this missing layer WITHOUT revealing it — "
                            f"ask a question that forces them to articulate: {probe_target}"
                        )
                    else:
                        parts.append(f"Last eval: {last_score}/5, gap={last_gap_type}")
                # Mirror student phrasing: give the tutor the exact words the student used
                # so it can echo a phrase back as the hinge of the next question.
                student_messages = [m for m in persisted if isinstance(m, HumanMessage)]
                if student_messages:
                    last_ans = student_messages[-1].content
                    if isinstance(last_ans, str) and not last_ans.startswith("[Instructor"):
                        snippet = last_ans.strip()[:150]
                        parts.append(
                            f"Student's last answer — use a fragment of their exact phrasing as a hinge: \"{snippet}\""
                        )
                if parts:
                    pace_note = "[Instructor note: " + " | ".join(parts) + "]"
                    invoke_history = persisted + [HumanMessage(content=pace_note)]
                else:
                    invoke_history = persisted
            else:
                invoke_history = persisted

        # LLM call — NO database connection held during this
        turn_idx = state.get("turn_idx", 0)
        # Higher temperature on opening turns → more angle diversity across sessions.
        # Follow-up turns stay grounded at 0.7 to track the student's actual words.
        chain = build_socratic_chain(topic=topic_id, temperature=0.85 if turn_count == 0 else 0.7)
        response = _timed_invoke(
            chain,
            {"history": invoke_history},
            chain_name="tutor",
            session_id=state["session_id"],
            turn_idx=turn_idx,
        )
        tutor_text = message_content(response)

        if turn_count == 0:
            new_history = [AIMessage(content=tutor_text)]
        else:
            new_history = persisted + [AIMessage(content=tutor_text)]

        # Brief write — new connection, released immediately after
        with queries.get_connection() as conn:
            queries.record_turn(conn, state["session_id"], turn_idx, "tutor", tutor_text)

        return {
            "history": messages_to_dicts(new_history),
            "tutor_message": tutor_text,
            "last_tutor_question": tutor_text,
            "turn_idx": turn_idx + 1,
        }

    def wait_for_user(state: QuestState) -> dict:
        """Pause until the student submits their answer."""
        answer = interrupt(state.get("tutor_message", ""))
        return {"user_input": str(answer)}

    def evaluate_answer(state: QuestState) -> dict:
        """Score the student's answer with the evaluator chain."""
        payload = build_evaluator_invoke_payload(
            topic_id=state["topic_id"],
            concept_list=state["concept_list"],
            tutor_question=state.get("last_tutor_question") or "",
            student_answer=state["user_input"],
            history=state.get("history"),
            mode=get_eval_mode(),
        )
        # LLM evaluator call — NO database connection held during this
        turn_idx = state.get("turn_idx", 0)
        try:
            evaluation: EvaluatorOutput = _timed_invoke(
                evaluator,
                payload,
                chain_name="evaluator",
                session_id=state["session_id"],
                turn_idx=turn_idx,
            )
        except OutputParserException:
            # Some OpenAI-compatible providers occasionally emit a tool name with
            # a "functions." prefix ("functions.EvaluatorOutput"), which fails
            # LangChain's strict parser. One immediate retry usually succeeds.
            evaluation = _timed_invoke(
                evaluator,
                payload,
                chain_name="evaluator",
                session_id=state["session_id"],
                turn_idx=turn_idx,
            )
        concept_id = state.get("current_concept_id") or evaluation.inferred_concept_id
        # Brief write
        with queries.get_connection() as conn:
            queries.record_turn(
                conn,
                state["session_id"],
                turn_idx,
                "user",
                state["user_input"],
                evaluator_score=evaluation.score,
                evaluator_gaps=evaluation.gaps,
                evaluator_reasoning=evaluation.reasoning,
                evaluator_gap_type=evaluation.gap_type,
                evaluator_expert_framing=evaluation.expert_framing,
                evaluator_concept_id=concept_id,
                evaluator_concept_confidence=(
                    1.0 if state.get("current_concept_id")
                    else evaluation.inferred_concept_confidence
                ),
            )
        history = messages_from_dicts(state.get("history") or [])
        history.append(HumanMessage(content=state["user_input"]))

        # Keep a rolling window of the last 4 scores on this concept so the
        # tutor steer can detect a stuck pattern (e.g., 2-3-2-3 plateau).
        recent = list(state.get("recent_scores") or [])
        recent.append(evaluation.score)
        recent = recent[-4:]  # keep last 4 only

        return {
            "turn_idx": turn_idx + 1,
            "last_score": evaluation.score,
            "last_evaluation": evaluation.model_dump(),
            "last_gap_type": evaluation.gap_type,
            "last_expert_framing": evaluation.expert_framing,
            "recent_scores": recent,
            "history": messages_to_dicts(history),
        }

    def update_mastery(state: QuestState) -> dict:
        """Persist mastery + SM-2 from the latest evaluation."""
        raw = state.get("last_evaluation")
        if raw:
            with queries.get_connection() as conn:
                apply_evaluation_to_mastery(
                    conn,
                    state["user_id"],
                    state["topic_id"],
                    EvaluatorOutput.model_validate(raw),
                    current_concept_id=state.get("current_concept_id"),
                    concept_list=state.get("concept_list"),  # validate inferred IDs
                )
        return {"concept_turn_count": state.get("concept_turn_count", 0) + 1}

    def decide(state: QuestState) -> dict:
        """Set routing flags after an evaluated turn.

        Advances to the next concept when the student has demonstrated mastery
        (score >= 4, turns >= 3) OR when the hard cap is reached (turns >= 8).
        The hard cap prevents students from being permanently stuck if the
        evaluator is miscalibrated or a concept is genuinely too hard this session.
        """
        score = state.get("last_score") or 0
        turns = state.get("concept_turn_count", 0)

        mastered = score >= CONCEPT_MASTERED_MIN_SCORE and turns >= CONCEPT_MASTERED_MIN_TURNS
        capped = turns >= CONCEPT_MAX_TURNS  # safety valve — advance regardless

        if mastered or capped:
            patch: dict = {"advance_concept": True}
            if state.get("replay_mode"):
                cid = state.get("current_concept_id")
                prev = list(state.get("completed_concept_ids") or [])
                if cid and cid not in prev:
                    prev.append(cid)
                patch["completed_concept_ids"] = prev
            return patch
        return {"advance_concept": False}

    def summarize(state: QuestState) -> dict:
        """End session: structured report + optional narrative summary."""
        session_id = state["session_id"]
        from core.topics import load_topic  # noqa: PLC0415

        topic_id = state["topic_id"]
        display = load_topic(topic_id).get("display_name") or topic_id
        with queries.get_connection() as conn:
            summary = summarize_session(conn, session_id, display)
            report = build_session_report(
                conn,
                session_id,
                topic_id,
                display,
                narrative=summary,
            )
            queries.set_session_report(conn, session_id, report.model_dump_json())
            queries.end_session(conn, session_id)
        return {
            "done": True,
            "session_report": report.model_dump(),
            "tutor_message": "Session complete.",
        }

    def route_after_pick(state: QuestState) -> Literal["ask_question", "summarize"]:
        if state.get("session_complete"):
            return "summarize"
        return "ask_question"

    def route_after_decide(state: QuestState) -> Literal["pick_concept", "ask_question"]:
        if state.get("advance_concept"):
            return "pick_concept"
        return "ask_question"

    graph = StateGraph(QuestState)
    graph.add_node("pick_concept", pick_concept)
    graph.add_node("ask_question", ask_question)
    graph.add_node("wait_for_user", wait_for_user)
    graph.add_node("evaluate_answer", evaluate_answer)
    graph.add_node("update_mastery", update_mastery)
    graph.add_node("decide", decide)
    graph.add_node("summarize", summarize)

    graph.set_entry_point("pick_concept")
    graph.add_conditional_edges("pick_concept", route_after_pick)
    graph.add_edge("ask_question", "wait_for_user")
    graph.add_edge("wait_for_user", "evaluate_answer")
    graph.add_edge("evaluate_answer", "update_mastery")
    graph.add_edge("update_mastery", "decide")
    graph.add_conditional_edges("decide", route_after_decide)
    graph.add_edge("summarize", END)

    return graph.compile(checkpointer=checkpointer)


def seed_state_from_turns(
    conn,
    session_id: str,
    user_id: str,
    topic_id: str,
    concept_list: list[dict],
    student_name: str | None = None,
) -> QuestState:
    """Rebuild graph state from DB turns when checkpoint is missing."""
    turns = queries.get_turns_for_session(conn, session_id)
    history: list[dict] = []
    last_tutor: str | None = None
    for t in turns:
        role = "human" if t["role"] == "user" else "ai"
        history.append({"role": role, "content": t["content"]})
        if t["role"] == "tutor":
            last_tutor = t["content"]
    return {
        "user_id": user_id,
        "student_name": student_name,
        "topic_id": topic_id,
        "session_id": session_id,
        "concept_list": concept_list,
        "turn_idx": len(turns),
        "history": history,
        "last_tutor_question": last_tutor,
        "concept_turn_count": 0,
        "done": False,
        "session_complete": False,
        "replay_mode": False,
        "completed_concept_ids": [],
    }

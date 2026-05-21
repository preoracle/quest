"""HTTP-friendly baseline calibration (multi-step)."""

from __future__ import annotations

import sqlite3

from pydantic import BaseModel, Field

from core.baseline import BASELINE_MAX_CONCEPTS, baseline_probe_question
from core.chains import build_evaluator_chain
from core.concept_pick import topological_concept_ids
from core.eval_context import build_evaluator_invoke_payload, get_eval_mode
from core.mastery import apply_evaluation_to_mastery
from core.models import EvaluatorOutput
from core.topics import load_topic
from db import queries


class BaselineResultItem(BaseModel):
    concept_id: str
    name: str
    score: int
    skipped_study: bool


class BaselineView(BaseModel):
    """State of an in-progress or completed baseline run."""

    session_id: str
    topic_id: str
    topic_display: str
    done: bool = False
    question: str | None = None
    concept_name: str | None = None
    step: int = 0
    total: int = Field(default=BASELINE_MAX_CONCEPTS)
    results: list[BaselineResultItem] = Field(default_factory=list)


def _open_baseline_session(conn: sqlite3.Connection, user_id: str, topic_id: str) -> str | None:
    row = conn.execute(
        """
        SELECT id FROM sessions
        WHERE user_id = ? AND topic = ? AND session_kind = 'baseline'
          AND ended_at IS NULL
        ORDER BY started_at DESC
        LIMIT 1
        """,
        (user_id, topic_id),
    ).fetchone()
    return row["id"] if row else None


def _baseline_progress(conn: sqlite3.Connection, session_id: str) -> tuple[int, list[BaselineResultItem]]:
    """Return (concepts_completed, results) from recorded turns."""
    turns = queries.get_session_turns_detailed(conn, session_id)
    results: list[BaselineResultItem] = []
    i = 0
    while i < len(turns):
        t = turns[i]
        if t["role"] == "tutor" and i + 1 < len(turns) and turns[i + 1]["role"] == "user":
            u = turns[i + 1]
            if u.get("evaluator_score") is not None:
                cid = u.get("evaluator_concept_id") or "unknown"
                results.append(
                    BaselineResultItem(
                        concept_id=cid,
                        name=cid.split(":")[-1].replace("_", " "),
                        score=int(u["evaluator_score"]),
                        skipped_study=int(u["evaluator_score"]) >= 4,
                    )
                )
            i += 2
        else:
            i += 1
    return len(results), results


def start_baseline(conn: sqlite3.Connection, user_id: str, topic_id: str) -> BaselineView:
    """Start or resume baseline; returns the next question or completion."""
    topic_data = load_topic(topic_id)
    display = topic_data.get("display_name") or topic_id
    queries.get_or_create_user(conn, user_id)
    queries.upsert_topic_concepts(conn, topic_data)
    concepts = queries.get_topic_concepts(conn, topic_id)
    ordered = topological_concept_ids(concepts, topic_id)[:BASELINE_MAX_CONCEPTS]

    session_id = _open_baseline_session(conn, user_id, topic_id)
    if session_id is None:
        session_id = queries.create_session(
            conn, user_id, topic_id, session_kind="baseline",
        )
        turn_idx = 0
        completed = 0
    else:
        completed, _ = _baseline_progress(conn, session_id)
        turns = queries.get_session_turns_detailed(conn, session_id)
        turn_idx = len(turns)
        last = turns[-1] if turns else None
        if last and last["role"] == "tutor":
            by_id = {c["id"]: c for c in concepts}
            cid = ordered[completed] if completed < len(ordered) else None
            concept = by_id.get(cid) if cid else None
            return BaselineView(
                session_id=session_id,
                topic_id=topic_id,
                topic_display=display,
                question=last["content"],
                concept_name=concept.get("name") if concept else None,
                step=completed + 1,
                total=min(len(ordered), BASELINE_MAX_CONCEPTS),
            )

    if completed >= len(ordered):
        queries.end_session(conn, session_id)
        _, results = _baseline_progress(conn, session_id)
        return BaselineView(
            session_id=session_id,
            topic_id=topic_id,
            topic_display=display,
            done=True,
            step=completed,
            total=len(ordered),
            results=results,
        )

    by_id = {c["id"]: c for c in concepts}
    cid = ordered[completed]
    concept = by_id[cid]
    question = baseline_probe_question(concept)
    queries.record_turn(conn, session_id, turn_idx, "tutor", question)

    return BaselineView(
        session_id=session_id,
        topic_id=topic_id,
        topic_display=display,
        question=question,
        concept_name=concept.get("name"),
        step=completed + 1,
        total=len(ordered),
    )


def submit_baseline_answer(
    conn: sqlite3.Connection,
    session_id: str,
    answer: str,
) -> BaselineView:
    """Score the current baseline answer and return the next question or done."""
    row = queries.get_session(conn, session_id)
    if row is None:
        raise ValueError(f"Unknown session: {session_id}")
    if row.get("session_kind") != "baseline":
        raise ValueError("Not a baseline session")
    if row.get("ended_at"):
        raise ValueError("Baseline already completed")

    topic_id = row["topic"]
    user_id = row["user_id"]
    topic_data = load_topic(topic_id)
    display = topic_data.get("display_name") or topic_id
    concept_list = queries.upsert_topic_concepts(conn, topic_data)
    concepts = queries.get_topic_concepts(conn, topic_id)
    by_id = {c["id"]: c for c in concepts}
    ordered = topological_concept_ids(concepts, topic_id)[:BASELINE_MAX_CONCEPTS]

    turns = queries.get_session_turns_detailed(conn, session_id)
    if not turns or turns[-1]["role"] != "tutor":
        raise ValueError("Not waiting for a baseline answer")

    question = turns[-1]["content"]
    turn_idx = len(turns)
    completed_before, _ = _baseline_progress(conn, session_id)
    cid = ordered[completed_before]

    evaluator = build_evaluator_chain()
    payload = build_evaluator_invoke_payload(
        topic_id=topic_id,
        concept_list=concept_list,
        tutor_question=question,
        student_answer=answer.strip(),
        history=None,
        mode=get_eval_mode(),
    )
    evaluation: EvaluatorOutput = evaluator.invoke(payload)
    queries.record_turn(
        conn,
        session_id,
        turn_idx,
        "user",
        answer.strip(),
        evaluator_score=evaluation.score,
        evaluator_gaps=evaluation.gaps,
        evaluator_reasoning=evaluation.reasoning,
        evaluator_concept_id=cid,
        evaluator_concept_confidence=0.9,
    )
    targeted = evaluation.model_copy(
        update={"inferred_concept_id": cid, "inferred_concept_confidence": 0.9},
    )
    apply_evaluation_to_mastery(conn, user_id, topic_id, targeted)

    completed = completed_before + 1
    if completed >= len(ordered):
        queries.end_session(conn, session_id)
        _, results = _baseline_progress(conn, session_id)
        for i, r in enumerate(results):
            if i < len(ordered):
                c = by_id.get(ordered[i])
                if c:
                    results[i] = BaselineResultItem(
                        concept_id=r.concept_id,
                        name=c.get("name", r.name),
                        score=r.score,
                        skipped_study=r.skipped_study,
                    )
        return BaselineView(
            session_id=session_id,
            topic_id=topic_id,
            topic_display=display,
            done=True,
            step=completed,
            total=len(ordered),
            results=results,
        )

    next_cid = ordered[completed]
    next_concept = by_id[next_cid]
    next_q = baseline_probe_question(next_concept)
    queries.record_turn(conn, session_id, turn_idx + 1, "tutor", next_q)

    return BaselineView(
        session_id=session_id,
        topic_id=topic_id,
        topic_display=display,
        question=next_q,
        concept_name=next_concept.get("name"),
        step=completed + 1,
        total=len(ordered),
    )


def run_baseline_sync(conn: sqlite3.Connection, user_id: str, topic_id: str, answers: list[str]) -> BaselineView:
    """Run full baseline with a list of answers (for tests)."""
    view = start_baseline(conn, user_id, topic_id)
    for ans in answers:
        if view.done:
            break
        view = submit_baseline_answer(conn, view.session_id, ans)
    return view

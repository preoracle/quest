"""Baseline assessment — seed mastery before study sessions (Phase B5)."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass, field

from core.chains import build_evaluator_chain
from core.concept_pick import topological_concept_ids
from core.eval_context import build_evaluator_invoke_payload, get_eval_mode
from core.mastery import apply_evaluation_to_mastery
from core.models import EvaluatorOutput
from core.topics import load_topic
from db import queries

BASELINE_MAX_CONCEPTS = 5
BASELINE_SKIP_IF_MASTERED = 4  # score >= 4 seeds strong mastery (0.8+)


@dataclass
class BaselineConceptResult:
    """One baseline probe outcome."""

    concept_id: str
    name: str
    score: int
    skipped_study: bool


@dataclass
class BaselineResult:
    """Summary after a baseline run."""

    session_id: str
    topic_id: str
    topic_display: str
    concepts: list[BaselineConceptResult] = field(default_factory=list)


def baseline_probe_question(concept: dict) -> str:
    """One short cold-start question for a concept (no tutor LLM)."""
    name = concept.get("name") or concept["id"]
    desc = (concept.get("description") or "").strip()
    if desc.lower().startswith("probes "):
        desc = desc[7:].strip()
    if len(desc) > 160:
        desc = desc[:157] + "..."
    if desc:
        return (
            f"What do you already know about {name}? "
            f"(We're calibrating — answer in your own words. Context: {desc})"
        )
    return (
        f"What do you already know about {name}? "
        "(We're calibrating your starting point — a few sentences is fine.)"
    )


def run_baseline_assessment(
    conn: sqlite3.Connection,
    user_id: str,
    topic_id: str,
    *,
    on_question=None,
    on_result=None,
) -> BaselineResult:
    """Run up to BASELINE_MAX_CONCEPTS probes and seed mastery from scores.

    Optional callbacks:
      on_question(str) -> str  — display question, return user answer
      on_result(BaselineConceptResult) — after each scored concept
    """
    topic_data = load_topic(topic_id)
    display = topic_data.get("display_name") or topic_id
    queries.get_or_create_user(conn, user_id)
    concept_list = queries.upsert_topic_concepts(conn, topic_data)
    concepts = queries.get_topic_concepts(conn, topic_id)
    by_id = {c["id"]: c for c in concepts}
    ordered = topological_concept_ids(concepts, topic_id)[:BASELINE_MAX_CONCEPTS]

    session_id = queries.create_session(
        conn, user_id, topic_id, session_kind="baseline",
    )
    evaluator = build_evaluator_chain()
    results: list[BaselineConceptResult] = []
    turn_idx = 0

    for cid in ordered:
        concept = by_id[cid]
        question = baseline_probe_question(concept)
        queries.record_turn(conn, session_id, turn_idx, "tutor", question)
        turn_idx += 1

        if on_question is None:
            raise RuntimeError("Baseline requires on_question callback")
        answer = on_question(question).strip()
        if not answer:
            continue

        payload = build_evaluator_invoke_payload(
            topic_id=topic_id,
            concept_list=concept_list,
            tutor_question=question,
            student_answer=answer,
            history=None,
            mode=get_eval_mode(),
        )
        evaluation: EvaluatorOutput = evaluator.invoke(payload)
        queries.record_turn(
            conn,
            session_id,
            turn_idx,
            "user",
            answer,
            evaluator_score=evaluation.score,
            evaluator_gaps=evaluation.gaps,
            evaluator_reasoning=evaluation.reasoning,
            evaluator_concept_id=evaluation.inferred_concept_id or cid,
            evaluator_concept_confidence=max(
                evaluation.inferred_concept_confidence, 0.85,
            ),
        )
        turn_idx += 1

        targeted = evaluation.model_copy(
            update={
                "inferred_concept_id": cid,
                "inferred_concept_confidence": 0.9,
            },
        )
        apply_evaluation_to_mastery(conn, user_id, topic_id, targeted)

        row = BaselineConceptResult(
            concept_id=cid,
            name=concept.get("name", cid),
            score=evaluation.score,
            skipped_study=evaluation.score >= BASELINE_SKIP_IF_MASTERED,
        )
        results.append(row)
        if on_result:
            on_result(row)

    queries.end_session(conn, session_id)
    return BaselineResult(
        session_id=session_id,
        topic_id=topic_id,
        topic_display=display,
        concepts=results,
    )

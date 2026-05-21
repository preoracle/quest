"""Evaluator dialogue modes (Phase B6)."""

from __future__ import annotations

import os
from enum import Enum

from langchain_core.messages import AIMessage, HumanMessage

from core.messages import messages_from_dicts


class EvalMode(str, Enum):
    """How much context the evaluator sees."""

    LAST_TURN = "last_turn"
    CONCEPT_THREAD = "concept_thread"


def get_eval_mode() -> EvalMode:
    """Read mode from QUEST_EVAL_MODE (default: last_turn)."""
    raw = os.environ.get("QUEST_EVAL_MODE", EvalMode.LAST_TURN.value).strip().lower()
    try:
        return EvalMode(raw)
    except ValueError:
        return EvalMode.LAST_TURN


def format_concept_thread(history: list[dict]) -> str:
    """Format tutor/student messages for concept-thread scoring."""
    messages = messages_from_dicts(history)
    if not messages:
        return "(no prior dialogue on this concept)"
    lines: list[str] = []
    for msg in messages:
        role = "Tutor" if isinstance(msg, AIMessage) else "Student"
        content = msg.content if isinstance(msg.content, str) else str(msg.content)
        lines.append(f"{role}: {content}")
    return "\n".join(lines)


def build_evaluator_invoke_payload(
    *,
    topic_id: str,
    concept_list: list[dict],
    tutor_question: str,
    student_answer: str,
    history: list[dict] | None,
    mode: EvalMode | None = None,
) -> dict:
    """Build the input dict for build_evaluator_chain()."""
    mode = mode or get_eval_mode()
    if mode == EvalMode.CONCEPT_THREAD:
        thread = format_concept_thread(history or [])
        return {
            "topic": topic_id,
            "concept_list": concept_list,
            "scoring_scope": (
                "Score the student's understanding across the FULL concept "
                "dialogue below. Weight the latest answer most heavily, but "
                "earlier turns may reveal gaps still relevant to the score."
            ),
            "tutor_question": tutor_question or "(see dialogue)",
            "student_answer": (
                f"{thread}\n\n--- Latest answer to score ---\n{student_answer}"
            ),
        }
    return {
        "topic": topic_id,
        "concept_list": concept_list,
        "scoring_scope": (
            "Score ONLY the latest tutor question and student answer pair below. "
            "Ignore any earlier turns."
        ),
        "tutor_question": tutor_question,
        "student_answer": student_answer,
    }

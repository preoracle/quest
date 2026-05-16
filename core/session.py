"""Phase 2 session orchestration: Socratic REPL + evaluator + SQLite.

Superseded by `core/graph.py` (LangGraph) in Phase 3. This module is the
real Phase 2 glue — not a placeholder.
"""

from __future__ import annotations

import sqlite3
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage

from core.chains import build_evaluator_chain, build_socratic_chain
from core.models import CONCEPT_INFERENCE_CONFIDENCE_THRESHOLD, EvaluatorOutput
from core.topics import load_topic
from db import queries

EXIT_COMMANDS = {":quit", ":q", ":exit"}
DEFAULT_USER_ID = "default"


def _message_content(msg: BaseMessage | Any) -> str:
    """Normalize AIMessage content to a plain string."""
    content = msg.content if hasattr(msg, "content") else str(msg)
    if isinstance(content, list):
        return "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )
    return str(content)


def _apply_mastery_updates(
    conn: sqlite3.Connection,
    user_id: str,
    topic_id: str,
    evaluation: EvaluatorOutput,
) -> None:
    """Update topic-level mastery; concept-level when confidence is high enough."""
    normalized = evaluation.normalized_score()
    queries.upsert_mastery(conn, user_id, topic_id, normalized)

    if (
        evaluation.inferred_concept_id
        and evaluation.inferred_concept_confidence
        >= CONCEPT_INFERENCE_CONFIDENCE_THRESHOLD
    ):
        queries.upsert_mastery(
            conn, user_id, evaluation.inferred_concept_id, normalized
        )


def run_session(
    conn: sqlite3.Connection,
    user_id: str,
    topic_id: str,
) -> None:
    """Run a persisted Socratic session until the user exits.

    Ensures concepts are in SQLite, creates a session row, pairs Socratic +
    evaluator calls on each user turn, persists turns and mastery, and sets
    ended_at on exit.
    """
    topic_data = load_topic(topic_id)
    display = topic_data.get("display_name") or topic_id

    queries.get_or_create_user(conn, user_id)
    concept_list = queries.upsert_topic_concepts(conn, topic_data)
    session_id = queries.create_session(conn, user_id, topic_id)

    print(f"\nQuest — topic: {display}")
    print("Type your responses. Send `:q` to exit.")
    print("(Evaluator scores shown after each answer — Phase 2)\n")

    socratic = build_socratic_chain(topic=topic_id)
    evaluator = build_evaluator_chain()
    history: list[BaseMessage] = []
    turn_idx = 0
    last_tutor_question: str | None = None

    def persist_tutor(content: str) -> None:
        nonlocal turn_idx
        queries.record_turn(conn, session_id, turn_idx, "tutor", content)
        turn_idx += 1

    def persist_user(
        content: str,
        evaluation: EvaluatorOutput | None,
    ) -> None:
        nonlocal turn_idx
        queries.record_turn(
            conn,
            session_id,
            turn_idx,
            "user",
            content,
            evaluator_score=evaluation.score if evaluation else None,
            evaluator_gaps=evaluation.gaps if evaluation else None,
            evaluator_reasoning=evaluation.reasoning if evaluation else None,
            evaluator_concept_id=evaluation.inferred_concept_id if evaluation else None,
            evaluator_concept_confidence=(
                evaluation.inferred_concept_confidence if evaluation else None
            ),
        )
        turn_idx += 1

    print("(opening question...)")
    history.append(HumanMessage(content="Begin. Ask me an opening question."))
    opening = socratic.invoke({"history": history})
    opening_text = _message_content(opening)
    history.append(AIMessage(content=opening_text))
    last_tutor_question = opening_text
    persist_tutor(opening_text)
    print(f"\nTutor: {opening_text}\n")

    try:
        while True:
            try:
                user_input = input("You: ").strip()
            except (EOFError, KeyboardInterrupt):
                print("\n\nSession ended.")
                break

            if not user_input:
                continue
            if user_input in EXIT_COMMANDS:
                print("\nSession ended.")
                break

            evaluation: EvaluatorOutput | None = None
            if last_tutor_question:
                try:
                    evaluation = evaluator.invoke(
                        {
                            "topic": topic_id,
                            "concept_list": concept_list,
                            "tutor_question": last_tutor_question,
                            "student_answer": user_input,
                        }
                    )
                except Exception as exc:
                    print(f"\n[evaluator error: {exc}]\n")

            persist_user(user_input, evaluation)
            if evaluation:
                _apply_mastery_updates(conn, user_id, topic_id, evaluation)
                gaps = ", ".join(evaluation.gaps) if evaluation.gaps else "none"
                concept_note = ""
                if evaluation.inferred_concept_id:
                    concept_note = (
                        f" | concept: {evaluation.inferred_concept_id}"
                        f" ({evaluation.inferred_concept_confidence:.0%})"
                    )
                print(
                    f"\n[score {evaluation.score}/5 — {evaluation.reasoning}"
                    f" | gaps: {gaps}{concept_note}]\n"
                )

            history.append(HumanMessage(content=user_input))
            try:
                response = socratic.invoke({"history": history})
            except Exception as exc:
                print(f"\n[tutor error: {exc}]\n")
                history.pop()
                continue

            tutor_text = _message_content(response)
            history.append(AIMessage(content=tutor_text))
            last_tutor_question = tutor_text
            persist_tutor(tutor_text)
            print(f"\nTutor: {tutor_text}\n")

    finally:
        queries.end_session(conn, session_id)

"""Quest CLI session driver — LangGraph + SQLite (Phase 3)."""

from __future__ import annotations

import sqlite3

from langgraph.types import Command

from core.graph import build_checkpointer, build_quest_graph, seed_state_from_turns
from core.models import EvaluatorOutput
from core.topics import load_topic
from db import queries

EXIT_COMMANDS = {":quit", ":q", ":exit"}
PAUSE_COMMANDS = EXIT_COMMANDS  # pause without ending session
DEFAULT_USER_ID = "default"


def _print_evaluation(evaluation: dict | None) -> None:
    """Print evaluator feedback from graph state."""
    if not evaluation:
        return
    ev = EvaluatorOutput.model_validate(evaluation)
    gaps = ", ".join(ev.gaps) if ev.gaps else "none"
    concept_note = ""
    if ev.inferred_concept_id:
        concept_note = (
            f" | concept: {ev.inferred_concept_id}"
            f" ({ev.inferred_concept_confidence:.0%})"
        )
    print(
        f"\n[score {ev.score}/5 — {ev.reasoning} | gaps: {gaps}{concept_note}]\n"
    )


def run_session(
    conn: sqlite3.Connection,
    user_id: str,
    topic_id: str,
) -> None:
    """Run or resume a Socratic session backed by LangGraph + SQLite.

    `:q` pauses (session stays open, checkpoint saved). Session completes
    when all concepts in the DAG are mastered; then summary + ended_at.
    """
    topic_data = load_topic(topic_id)
    display = topic_data.get("display_name") or topic_id

    queries.get_or_create_user(conn, user_id)
    concept_list = queries.upsert_topic_concepts(conn, topic_data)

    open_id = queries.get_open_session(conn, user_id, topic_id)
    if open_id:
        session_id = open_id
        resuming = True
    else:
        session_id = queries.create_session(conn, user_id, topic_id)
        resuming = False

    checkpointer = build_checkpointer()
    graph = build_quest_graph(conn, checkpointer)
    config = {"configurable": {"thread_id": session_id}}

    print(f"\nQuest — topic: {display}")
    if resuming:
        print("Resuming open session (checkpoint + DB).")
    print("`:q` to pause and resume later. Session ends when all concepts are mastered.\n")

    snapshot = graph.get_state(config)
    if snapshot.values:
        state = snapshot.values
    elif resuming:
        state = seed_state_from_turns(conn, session_id, user_id, topic_id, concept_list)
        graph.update_state(config, state)
    else:
        state: dict = {
            "user_id": user_id,
            "topic_id": topic_id,
            "session_id": session_id,
            "concept_list": concept_list,
            "turn_idx": 0,
            "history": [],
            "concept_turn_count": 0,
            "done": False,
            "session_complete": False,
        }
        graph.invoke(state, config)

    paused = False
    try:
        while True:
            snapshot = graph.get_state(config)
            values = snapshot.values or {}

            if values.get("done"):
                print(values.get("tutor_message", "Session complete."))
                break

            if snapshot.next:
                concept = values.get("current_concept_name")
                if concept:
                    print(f"[focus: {concept}]")
                print(f"\nTutor: {values.get('tutor_message', '')}\n")
                try:
                    user_input = input("You: ").strip()
                except (EOFError, KeyboardInterrupt):
                    print("\n\nPaused. Run again to resume.")
                    paused = True
                    break

                if not user_input:
                    continue
                if user_input in PAUSE_COMMANDS:
                    print("\nPaused. Run again to resume.")
                    paused = True
                    break

                graph.invoke(Command(resume=user_input), config)
                snap2 = graph.get_state(config)
                _print_evaluation((snap2.values or {}).get("last_evaluation"))
                continue

            break
    finally:
        if not paused and not (graph.get_state(config).values or {}).get("done"):
            pass  # completed via summarize node sets ended_at

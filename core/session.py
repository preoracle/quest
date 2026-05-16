"""Quest CLI session driver — LangGraph + SQLite (Phase 3+)."""

from __future__ import annotations

import sqlite3

from core.models import EvaluatorOutput
from core.session_api import EvaluationView, SessionView, start_session, submit_turn
from db import queries

EXIT_COMMANDS = {":quit", ":q", ":exit"}
PAUSE_COMMANDS = EXIT_COMMANDS
DEFAULT_USER_ID = "default"


def _print_view(view: SessionView, *, show_eval: EvaluationView | None = None) -> None:
    """Print CLI formatting for a session view."""
    ev = show_eval or view.last_evaluation
    if ev:
        gaps = ", ".join(ev.gaps) if ev.gaps else "none"
        concept_note = ""
        if ev.inferred_concept_id:
            concept_note = (
                f" | concept: {ev.inferred_concept_id}"
                f" ({ev.inferred_concept_confidence:.0%})"
            )
        print(
            f"\n[score {ev.score}/5 — {ev.reasoning}"
            f" | gaps: {gaps}{concept_note}]\n"
        )

    if view.done:
        print(view.summary or view.tutor_message or "Session complete.")
        return

    if view.focus:
        print(f"[focus: {view.focus}]")
    if view.tutor_message:
        print(f"\nTutor: {view.tutor_message}\n")


def run_session(
    conn: sqlite3.Connection,
    user_id: str,
    topic_id: str,
) -> None:
    """Run or resume a Socratic session until the user pauses or the DAG completes."""
    open_id = queries.get_open_session(conn, user_id, topic_id)
    view = start_session(conn, user_id, topic_id, resume=True)

    print(f"\nQuest — topic: {view.topic_display}")
    if open_id:
        print("Resuming open session.")
    print("`:q` to pause. Session ends when all concepts are mastered.\n")

    if view.done:
        _print_view(view)
        return

    _print_view(view)

    while view.waiting_for_answer:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n\nPaused. Run again to resume.")
            return

        if not user_input:
            continue
        if user_input in PAUSE_COMMANDS:
            print("\nPaused. Run again to resume.")
            return

        prev_eval = view.last_evaluation
        view = submit_turn(conn, view.session_id, user_input)
        if view.last_evaluation and view.last_evaluation != prev_eval:
            _print_view(view, show_eval=view.last_evaluation)
        elif view.done:
            _print_view(view)
            return
        else:
            _print_view(view)

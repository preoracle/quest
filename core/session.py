"""Quest CLI session driver — LangGraph + SQLite (Phase 3+)."""

from __future__ import annotations

import sqlite3

from core.session_api import SessionView, start_session, submit_turn
from core.ui import QuestCliUi
from db import queries

EXIT_COMMANDS = {":quit", ":q", ":exit"}
PAUSE_COMMANDS = EXIT_COMMANDS | {"/quit", "/q", "/exit"}
DEFAULT_USER_ID = "default"


def run_session(
    conn: sqlite3.Connection,
    user_id: str,
    topic_id: str,
    *,
    replay: bool = False,
) -> None:
    """Run or resume a Socratic session until the user pauses or the DAG completes.

    ``replay=True`` starts a **new** session that walks the full concept DAG again
    for this run (scheduling ignores stored mastery). Still updates mastery in DB.
    """
    ui = QuestCliUi()
    want_resume = not replay
    open_id = (
        queries.get_open_session(conn, user_id, topic_id) if want_resume else None
    )
    view = start_session(
        conn, user_id, topic_id, resume=True, replay=replay,
    )

    progress = ui.build_progress(conn, user_id, view)
    ui.sticky.enable(ui.build_header_lines(view, progress))

    try:
        ui.render_session_start(
            view, resuming=bool(open_id) and not replay,
        )
        ui.render_turn(view, progress)

        if view.done:
            return

        turns_since_checkpoint = 0

        while view.waiting_for_answer:
            try:
                user_input = ui.prompt_answer().strip()
            except (EOFError, KeyboardInterrupt):
                ui.render_paused()
                return

            if not user_input:
                continue
            if user_input in PAUSE_COMMANDS:
                ui.render_paused()
                return
            if user_input.startswith("/"):
                if _handle_command(ui, conn, user_id, view, user_input):
                    ui.render_paused()
                    return
                continue

            prev_eval = view.last_evaluation
            with ui.thinking():
                view = submit_turn(conn, view.session_id, user_input)
            turns_since_checkpoint += 1

            progress = ui.build_progress(conn, user_id, view)
            synthesis = (
                view.last_evaluation
                if view.last_evaluation != prev_eval
                else None
            )
            ui.sticky.update(ui.build_header_lines(view, progress))
            ui.render_turn(view, progress, synthesis=synthesis)

            if view.done:
                return

            if turns_since_checkpoint % 5 == 0:
                ui.render_checkpoint(turns_since_checkpoint, progress)
    finally:
        ui.sticky.disable()


def _handle_command(
    ui: QuestCliUi,
    conn: sqlite3.Connection,
    user_id: str,
    view: SessionView,
    raw: str,
) -> bool:
    """Handle slash commands. Returns True when the session should pause."""
    command = raw.split()[0].lower()
    if command in PAUSE_COMMANDS:
        return True
    if command == "/help":
        ui.render_help()
        return False
    if command == "/last":
        ui.render_last(view.last_evaluation)
        return False
    if command == "/progress":
        ui.render_progress(ui.build_progress(conn, user_id, view))
        return False
    if command == "/mastery":
        rows = queries.get_mastery_for_user(conn, user_id)
        ui.render_mastery(rows)
        return False

    ui.console.print(f"[dim]Unknown command: {command}. Try /help.[/dim]\n")
    return False

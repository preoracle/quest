"""Quest CLI (Phase 4 — use `python cli.py` instead of main.py)."""

from __future__ import annotations

import os
import sys

from core.paths import env_file, load_quest_env
from core.session import DEFAULT_USER_ID, EXIT_COMMANDS, run_session
from core.version import __version__
from core.topic_cli import cmd_topic_archive, cmd_topic_rename, cmd_topic_rm
from core.topic_picker import create_topic_from_goal, pick_topic_interactive
from core.topics import list_topics, load_topic
from db import queries

__all__ = ["EXIT_COMMANDS", "list_topics", "load_topic"]


def print_due_table(
    user_id: str = DEFAULT_USER_ID,
    topic: str | None = None,
    *,
    as_json: bool = False,
) -> None:
    """Print concepts due for SM-2 review."""
    import json

    from rich.console import Console
    from rich.table import Table

    queries.init_db()
    with queries.get_connection() as conn:
        rows = queries.get_due_concepts(conn, user_id, topic=topic)

    if as_json:
        payload = [
            {
                "topic": r.topic,
                "concept_id": r.concept_id,
                "name": r.name,
                "score_1_to_5": round(r.score_1_to_5, 1),
                "next_review_at": r.next_review_at,
                "overdue": r.overdue,
            }
            for r in rows
        ]
        print(json.dumps(payload, indent=2))
        return

    if not rows:
        label = f" for topic '{topic}'" if topic else ""
        print(f"Nothing due{label}. Run a session or check back after reviews schedule.")
        return

    console = Console()
    table = Table(title=f"Due today — {user_id}", show_header=True, header_style="bold")
    table.add_column("Topic", style="dim")
    table.add_column("Concept")
    table.add_column("Mastery", justify="right")
    table.add_column("Due", style="dim")
    for r in rows:
        due_label = "now" if not r.next_review_at else r.next_review_at[:10]
        if r.overdue:
            due_label = f"[red]{due_label}[/red]"
        table.add_row(
            r.topic,
            r.name,
            f"{r.score_1_to_5:.1f}/5",
            due_label,
        )
    console.print(table)
    console.print()


def print_mastery_table(user_id: str = DEFAULT_USER_ID, topic: str | None = None) -> None:
    """Print topic and concept mastery rows for a user."""
    queries.init_db()
    with queries.get_connection() as conn:
        rows = queries.get_mastery_for_user(conn, user_id, topic=topic)

    if not rows:
        label = f" for topic '{topic}'" if topic else ""
        print(f"No mastery recorded yet{label}. Run a session first.")
        return

    print(f"\nMastery — user: {user_id}")
    if topic:
        print(f"Topic filter: {topic}")
    print(f"{'Kind':<8} {'Name':<32} {'Score':>6} {'/5':>6} {'N':>4}")
    print("-" * 60)
    for row in rows:
        print(
            f"{row.kind:<8} {row.name[:32]:<32} "
            f"{row.score:>6.2f} {row.score_1_to_5:>6.1f} {row.num_evaluations:>4}"
        )
    print()


def reset_progress(
    user_id: str = DEFAULT_USER_ID,
    *,
    topic: str | None = None,
    assume_yes: bool = False,
) -> int:
    """Wipe sessions, turns, mastery, and checkpoints. Concept YAMLs survive."""
    queries.init_db()
    scope = f"topic '{topic}'" if topic else "ALL topics"
    print(f"\nThis will delete sessions, turns, mastery, and checkpoints for {scope}.")
    print(f"User: {user_id}")
    print("Concept maps in quest_data/concepts/*.yaml are NOT touched.\n")
    if not assume_yes:
        answer = input("Type 'yes' to continue: ").strip().lower()
        if answer != "yes":
            print("Aborted.")
            return 1

    with queries.get_connection() as conn:
        counts = queries.reset_user_progress(conn, user_id, topic=topic)
    removed = queries.delete_checkpoint_db() if topic is None else []

    print(
        f"Deleted: {counts['turns']} turns, "
        f"{counts['sessions']} sessions, "
        f"{counts['mastery']} mastery rows."
    )
    if removed:
        names = ", ".join(p.name for p in removed)
        print(f"Removed checkpoint files: {names}")
    elif topic is None:
        print("No checkpoint DB to remove.")
    print()
    return 0


def cmd_topic_new(argv_tail: list[str]) -> int:
    """Handle `cli.py topic new ...` — LLM-generated concept map."""
    assume_yes = "--yes" in argv_tail or "-y" in argv_tail
    force = "--force" in argv_tail
    rest = [a for a in argv_tail if a not in ("--yes", "-y", "--force")]
    if not rest:
        try:
            goal = input("What do you want to learn? ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nAborted.")
            return 1
    else:
        goal = " ".join(rest).strip()

    tid = create_topic_from_goal(
        goal,
        assume_write=assume_yes,
        force=force,
    )
    if not tid:
        return 2 if not goal else 1

    print(f"Start with:  quest {tid}")
    print(f"Replay DAG:  quest {tid} --fresh")
    return 0


def _require_api_key() -> int | None:
    """Check that the LLM proxy is configured (LLM_BASE_URL + LLM_API_KEY)."""
    base_url = os.environ.get("LLM_BASE_URL", "").strip()
    api_key = os.environ.get("LLM_API_KEY", "").strip()
    if base_url and api_key:
        return None
    print(
        "Quest needs LLM_BASE_URL and LLM_API_KEY to run sessions.\n\n"
        "  export LLM_BASE_URL=http://localhost:3001/v1\n"
        "  export LLM_API_KEY=freellmapi-dev\n"
        "  # or put them in:\n"
        f"  {env_file()}\n",
        file=sys.stderr,
    )
    return 2


def main(argv: list[str] | None = None) -> int:
    """CLI entry point."""
    if argv is None:
        argv = sys.argv
    load_quest_env()
    queries.init_db()

    from core.picker_types import BASELINE_FLAGS, REPLAY_FLAGS

    raw = argv[1:]
    if raw and raw[0] in ("--version", "-V"):
        print(f"quest-ai {__version__}")
        return 0

    fresh = any(flag in raw for flag in REPLAY_FLAGS)
    baseline = any(flag in raw for flag in BASELINE_FLAGS)
    skip_flags = REPLAY_FLAGS | BASELINE_FLAGS
    args = [a for a in raw if a not in skip_flags]

    if not args:
        try:
            selection = pick_topic_interactive()
        except SystemExit as exc:  # pick_topic_interactive raises 1 on empty catalog
            code = exc.code
            return int(code) if isinstance(code, int) else 1
        if (code := _require_api_key()) is not None:
            return code
        try:
            with queries.get_connection() as conn:
                run_session(
                    conn,
                    DEFAULT_USER_ID,
                    selection.topic_id,
                    replay=fresh or selection.replay,
                    baseline=baseline or selection.baseline,
                )
        except FileNotFoundError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            return 1
        return 0

    if args[0] == "topic":
        if len(args) >= 2 and args[1] == "new":
            return cmd_topic_new(args[2:])
        if len(args) >= 2 and args[1] == "archive":
            return cmd_topic_archive(args[2:], archived=True)
        if len(args) >= 2 and args[1] == "unarchive":
            return cmd_topic_archive(args[2:], archived=False)
        if len(args) >= 2 and args[1] == "rename":
            return cmd_topic_rename(args[2:])
        if len(args) >= 2 and args[1] in ("rm", "delete"):
            return cmd_topic_rm(args[2:])
        print(
            "Usage: python cli.py topic new \"what you want to learn\"\n"
            "       python cli.py topic new --yes \"...\"   # skip confirm\n"
            "       python cli.py topic new --force \"...\" # overwrite YAML\n"
            "       python cli.py topic archive TOPIC_ID\n"
            "       python cli.py topic unarchive TOPIC_ID\n"
            "       python cli.py topic rename OLD_ID NEW_ID\n"
            "       python cli.py topic rm TOPIC_ID [--yes]",
            file=sys.stderr,
        )
        return 2

    if args[0] == "mastery":
        topic_filter = args[1] if len(args) > 1 else None
        print_mastery_table(topic=topic_filter)
        return 0

    if args[0] == "due":
        topic_filter = args[1] if len(args) > 1 and not args[1].startswith("-") else None
        as_json = "--json" in args[1:]
        print_due_table(topic=topic_filter, as_json=as_json)
        return 0

    if args[0] == "reset":
        assume_yes = "--yes" in args[1:] or "-y" in args[1:]
        positional = [a for a in args[1:] if not a.startswith("-")]
        topic = positional[0] if positional else None
        return reset_progress(topic=topic, assume_yes=assume_yes)

    topic_id = args[0]
    if (code := _require_api_key()) is not None:
        return code
    try:
        with queries.get_connection() as conn:
            run_session(
                conn,
                DEFAULT_USER_ID,
                topic_id,
                replay=fresh,
                baseline=baseline,
            )
    except FileNotFoundError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

"""Quest CLI (Phase 4 — use `python cli.py` instead of main.py)."""

from __future__ import annotations

import sys

from dotenv import load_dotenv

from core.session import DEFAULT_USER_ID, EXIT_COMMANDS, run_session
from core.topic_picker import create_topic_from_goal, pick_topic_interactive
from core.topics import list_topics, load_topic
from db import queries

__all__ = ["EXIT_COMMANDS", "list_topics", "load_topic"]


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
    print("Concept maps in concepts/*.yaml are NOT touched.\n")
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

    print(f"Start with:  python cli.py {tid}")
    print(f"Replay DAG:  python cli.py {tid} --fresh")
    return 0


def main(argv: list[str]) -> int:
    """CLI entry point."""
    load_dotenv()
    queries.init_db()

    raw = argv[1:]
    fresh = "--fresh" in raw or "-f" in raw
    args = [a for a in raw if a not in ("--fresh", "-f")]

    if not args:
        try:
            topic_id = pick_topic_interactive()
        except SystemExit as exc:  # pick_topic_interactive raises 1 on empty catalog
            code = exc.code
            return int(code) if isinstance(code, int) else 1
        try:
            with queries.get_connection() as conn:
                run_session(conn, DEFAULT_USER_ID, topic_id, replay=fresh)
        except FileNotFoundError as exc:
            print(f"Error: {exc}", file=sys.stderr)
            return 1
        return 0

    if args[0] == "topic":
        if len(args) >= 2 and args[1] == "new":
            return cmd_topic_new(args[2:])
        print(
            "Usage: python cli.py topic new \"what you want to learn\"\n"
            "       python cli.py topic new --yes \"...\"   # skip confirm\n"
            "       python cli.py topic new --force \"...\" # overwrite YAML",
            file=sys.stderr,
        )
        return 2

    if args[0] == "mastery":
        topic_filter = args[1] if len(args) > 1 else None
        print_mastery_table(topic=topic_filter)
        return 0

    if args[0] == "reset":
        assume_yes = "--yes" in args[1:] or "-y" in args[1:]
        positional = [a for a in args[1:] if not a.startswith("-")]
        topic = positional[0] if positional else None
        return reset_progress(topic=topic, assume_yes=assume_yes)

    topic_id = args[0]
    try:
        with queries.get_connection() as conn:
            run_session(conn, DEFAULT_USER_ID, topic_id, replay=fresh)
    except FileNotFoundError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

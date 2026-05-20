"""Quest CLI (Phase 4 — use `python cli.py` instead of main.py)."""

from __future__ import annotations

import sys

from dotenv import load_dotenv

from core.session import DEFAULT_USER_ID, EXIT_COMMANDS, run_session
from core.topics import list_topics, load_topic
from db import queries

__all__ = ["EXIT_COMMANDS", "list_topics", "load_topic"]


def pick_topic_interactive() -> str:
    """Show numbered topic list, read user choice, return topic id."""
    topics = list_topics()
    if not topics:
        print("No concept YAMLs found in concepts/. Add one and retry.")
        raise SystemExit(1)

    print("\nPick a topic:")
    for idx, (_, display) in enumerate(topics, start=1):
        print(f"  {idx}. {display}")
    print()

    while True:
        raw = input("> ").strip()
        if not raw:
            continue
        if raw in EXIT_COMMANDS:
            raise SystemExit(0)
        if raw.isdigit():
            i = int(raw)
            if 1 <= i <= len(topics):
                return topics[i - 1][0]
        for tid, _ in topics:
            if raw == tid:
                return tid
        print(f"Pick a number 1–{len(topics)} or a topic id.")


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


def main(argv: list[str]) -> int:
    """CLI entry point."""
    load_dotenv()
    queries.init_db()

    if len(argv) > 1 and argv[1] == "mastery":
        topic_filter = argv[2] if len(argv) > 2 else None
        print_mastery_table(topic=topic_filter)
        return 0

    if len(argv) > 1 and argv[1] == "reset":
        assume_yes = "--yes" in argv[2:] or "-y" in argv[2:]
        positional = [a for a in argv[2:] if not a.startswith("-")]
        topic = positional[0] if positional else None
        return reset_progress(topic=topic, assume_yes=assume_yes)

    if len(argv) > 1:
        topic_id = argv[1]
    else:
        topic_id = pick_topic_interactive()

    try:
        with queries.get_connection() as conn:
            run_session(conn, DEFAULT_USER_ID, topic_id)
    except FileNotFoundError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))

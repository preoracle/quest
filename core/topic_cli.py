"""CLI handlers for topic lifecycle commands."""

from __future__ import annotations

import sys

from core.topic_lifecycle import (
    TopicLifecycleError,
    delete_topic,
    rename_topic,
    set_topic_archived,
    update_topic_display_name,
)
from db import queries


def cmd_topic_archive(argv: list[str], *, archived: bool) -> int:
    """Archive or unarchive a topic by id."""
    if not argv:
        label = "archive" if archived else "unarchive"
        print(f"Usage: quest topic {label} TOPIC_ID", file=sys.stderr)
        return 2
    topic_id = argv[0]
    queries.init_db()
    try:
        with queries.get_connection() as conn:
            set_topic_archived(conn, topic_id, archived=archived)
    except TopicLifecycleError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    verb = "Archived" if archived else "Unarchived"
    print(f"{verb} topic: {topic_id}")
    return 0


def cmd_topic_rename(argv: list[str]) -> int:
    """Rename a user-created topic slug."""
    if len(argv) < 2:
        print(
            'Usage: quest topic rename OLD_ID NEW_ID\n'
            '       quest topic rename OLD_ID NEW_ID "New Display Name"',
            file=sys.stderr,
        )
        return 2
    old_id, new_id = argv[0], argv[1]
    display = " ".join(argv[2:]).strip() if len(argv) > 2 else None
    queries.init_db()
    try:
        with queries.get_connection() as conn:
            result = rename_topic(conn, old_id, new_id, display_name=display or None)
    except TopicLifecycleError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    print(f"Renamed {result['previous_id']} → {result['topic_id']}")
    print(f"Start with:  quest {result['topic_id']}")
    return 0


def cmd_topic_rm(argv: list[str]) -> int:
    """Delete a user-created topic."""
    assume_yes = "--yes" in argv or "-y" in argv
    positional = [a for a in argv if not a.startswith("-")]
    if not positional:
        print("Usage: quest topic rm TOPIC_ID [--yes]", file=sys.stderr)
        return 2
    topic_id = positional[0]
    queries.init_db()
    try:
        with queries.get_connection() as conn:
            if not assume_yes:
                from core.topic_lifecycle import is_user_deletable

                if not is_user_deletable(conn, topic_id):
                    print(
                        f"Error: bundled topic '{topic_id}' cannot be deleted. "
                        "Use: quest topic archive",
                        file=sys.stderr,
                    )
                    return 1
                answer = input(
                    f"Delete topic '{topic_id}' and all progress? Type 'yes': "
                ).strip().lower()
                if answer != "yes":
                    print("Aborted.")
                    return 1
            result = delete_topic(conn, topic_id)
    except TopicLifecycleError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    print(
        f"Deleted topic {topic_id}: "
        f"{result['sessions']} sessions, {result['mastery']} mastery rows."
    )
    return 0

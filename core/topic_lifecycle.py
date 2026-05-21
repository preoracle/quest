"""Topic lifecycle: archive, rename, delete, and ownership checks."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import yaml

from core import paths
from core.topic_validate import validate_topic_payload
from core.topics import load_topic
from db import queries

_TOPIC_ID_RE = re.compile(r"^[a-z][a-z0-9_]{0,47}$")


class TopicLifecycleError(ValueError):
    """Raised when a lifecycle operation is invalid."""


def topic_yaml_path(topic_id: str) -> Path | None:
    """Return the writable YAML path for a topic, preferring user dir."""
    user = paths.user_concepts_dir() / f"{topic_id}.yaml"
    if user.exists():
        return user
    bundled = paths.bundled_concepts_dir() / f"{topic_id}.yaml"
    if bundled.exists():
        return bundled
    return None


def is_bundled_topic(topic_id: str) -> bool:
    """True if the topic ships in the bundled concepts directory."""
    return (paths.bundled_concepts_dir() / f"{topic_id}.yaml").exists()


def is_user_deletable(
    conn: Any,
    topic_id: str,
) -> bool:
    """True when the topic YAML may be removed from disk."""
    meta = queries.get_topic_metadata(conn, topic_id)
    if meta and meta.get("user_created"):
        return True
    user = paths.user_concepts_dir() / f"{topic_id}.yaml"
    bundled = paths.bundled_concepts_dir() / f"{topic_id}.yaml"
    if user.exists() and bundled.exists():
        try:
            return user.resolve() != bundled.resolve()
        except OSError:
            return True
    return user.exists() and not bundled.exists()


def mark_topic_user_created(conn: Any, topic_id: str) -> None:
    """Record that this topic was generated or imported by the user."""
    queries.upsert_topic_metadata(conn, topic_id, user_created=True)


def set_topic_archived(conn: Any, topic_id: str, *, archived: bool) -> dict[str, Any]:
    """Archive or unarchive a topic in metadata."""
    _require_topic_exists(topic_id)
    return queries.upsert_topic_metadata(conn, topic_id, archived=archived)


def set_topic_pinned(conn: Any, topic_id: str, *, pinned: bool) -> dict[str, Any]:
    """Pin or unpin a topic for catalog ranking."""
    _require_topic_exists(topic_id)
    return queries.upsert_topic_metadata(conn, topic_id, pinned=pinned)


def update_topic_display_name(
    conn: Any,
    topic_id: str,
    display_name: str,
) -> dict[str, Any]:
    """Update display_name in the topic YAML and concepts table."""
    _require_topic_exists(topic_id)
    name = display_name.strip()
    if not name:
        raise TopicLifecycleError("display_name must be non-empty")

    path = topic_yaml_path(topic_id)
    if path is None:
        raise TopicLifecycleError(f"Unknown topic: {topic_id}")

    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    data["display_name"] = name
    path.write_text(
        yaml.safe_dump(data, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    queries.upsert_topic_concepts(conn, data)
    queries.upsert_topic_metadata(conn, topic_id)
    return {"topic_id": topic_id, "display_name": name}


def rename_topic(
    conn: Any,
    old_id: str,
    new_id: str,
    *,
    display_name: str | None = None,
) -> dict[str, Any]:
    """Rename topic slug: move YAML, migrate DB rows, re-upsert concepts."""
    _require_topic_exists(old_id)
    if not _TOPIC_ID_RE.match(new_id):
        raise TopicLifecycleError(
            "Invalid topic slug: use snake_case, start with a letter, max 48 chars."
        )
    if old_id == new_id:
        raise TopicLifecycleError("New topic id must differ from the current id.")
    if not is_user_deletable(conn, old_id):
        raise TopicLifecycleError(
            f"Bundled topic '{old_id}' cannot be renamed. "
            "Update display_name only, or archive it."
        )

    new_path = paths.user_concepts_dir() / f"{new_id}.yaml"
    if new_path.exists():
        raise TopicLifecycleError(f"Topic already exists: {new_id}")

    path = topic_yaml_path(old_id)
    assert path is not None
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    data["topic"] = new_id
    if display_name is not None:
        data["display_name"] = display_name.strip()
    validate_topic_payload(data)

    paths.user_concepts_dir().mkdir(parents=True, exist_ok=True)
    new_path.write_text(
        yaml.safe_dump(data, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    if path.resolve() != new_path.resolve():
        path.unlink()

    queries.migrate_topic_id(conn, old_id, new_id)
    queries.upsert_topic_concepts(conn, data)
    meta = queries.get_topic_metadata(conn, new_id)
    if meta is None and queries.get_topic_metadata(conn, old_id):
        queries.upsert_topic_metadata(conn, new_id, user_created=True)
    queries.delete_topic_metadata(conn, old_id)

    return {
        "topic_id": new_id,
        "display_name": data.get("display_name") or new_id.replace("_", " ").title(),
        "previous_id": old_id,
    }


def delete_topic(
    conn: Any,
    topic_id: str,
    *,
    user_id: str = "default",
    wipe_progress: bool = True,
) -> dict[str, Any]:
    """Remove a user-created topic YAML and wipe associated progress."""
    _require_topic_exists(topic_id)
    if not is_user_deletable(conn, topic_id):
        raise TopicLifecycleError(
            f"Bundled topic '{topic_id}' cannot be deleted. Archive it instead."
        )

    path = topic_yaml_path(topic_id)
    counts: dict[str, int] = {"turns": 0, "sessions": 0, "mastery": 0, "concepts": 0}
    if wipe_progress:
        counts = queries.reset_user_progress(conn, user_id, topic=topic_id)
    counts["concepts"] = queries.delete_concepts_for_topic(conn, topic_id)

    if path is not None and path.exists():
        try:
            path.unlink()
        except OSError as exc:
            raise TopicLifecycleError(f"Could not remove {path}: {exc}") from exc

    queries.delete_topic_metadata(conn, topic_id)
    return {"topic_id": topic_id, "deleted": True, "wipe_progress": wipe_progress, **counts}


def _require_topic_exists(topic_id: str) -> None:
    try:
        load_topic(topic_id)
    except FileNotFoundError as exc:
        raise TopicLifecycleError(str(exc)) from exc

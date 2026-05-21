"""Tests for topic lifecycle (archive, rename, delete, search)."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from core import paths
from core.topic_lifecycle import (
    TopicLifecycleError,
    delete_topic,
    mark_topic_user_created,
    rename_topic,
    set_topic_archived,
)
from core.topic_search import search_topics
from db import queries


@pytest.fixture
def isolated_concepts(tmp_path, monkeypatch):
    """Separate bundled vs user concept dirs for lifecycle tests."""
    bundled = tmp_path / "bundled"
    user = tmp_path / "user"
    bundled.mkdir()
    user.mkdir()

    bundled_yaml = {
        "topic": "bundled_topic",
        "display_name": "Bundled Topic",
        "concepts": _minimal_concepts("bundled_topic"),
    }
    (bundled / "bundled_topic.yaml").write_text(
        yaml.safe_dump(bundled_yaml, sort_keys=False),
        encoding="utf-8",
    )

    monkeypatch.setattr(paths, "bundled_concepts_dir", lambda: bundled)
    monkeypatch.setattr(paths, "user_concepts_dir", lambda: user)
    monkeypatch.setattr(paths, "concept_search_dirs", lambda: [user, bundled])
    return {"bundled": bundled, "user": user}


def _minimal_concepts(topic: str) -> list[dict]:
    """Five concepts with no prerequisites (valid topic shape)."""
    return [
        {
            "id": f"c{i}",
            "name": f"Concept {i}",
            "description": f"Desc {i}",
            "prerequisites": [],
        }
        for i in range(5)
    ]


def _write_user_topic(user_dir: Path, topic_id: str, display: str) -> None:
    data = {
        "topic": topic_id,
        "display_name": display,
        "concepts": _minimal_concepts(topic_id),
    }
    (user_dir / f"{topic_id}.yaml").write_text(
        yaml.safe_dump(data, sort_keys=False),
        encoding="utf-8",
    )


def test_archive_and_search_excludes(isolated_concepts, tmp_db):
    user = isolated_concepts["user"]
    _write_user_topic(user, "my_topic", "My Topic")
    with tmp_db as conn:
        mark_topic_user_created(conn, "my_topic")
        set_topic_archived(conn, "my_topic", archived=True)
        meta = queries.list_topic_metadata(conn)
    rows = search_topics(metadata=meta)
    ids = [r["id"] for r in rows]
    assert "my_topic" not in ids
    rows_all = search_topics(include_archived=True, metadata=meta)
    assert "my_topic" in [r["id"] for r in rows_all]


def test_delete_user_topic(isolated_concepts, tmp_db):
    user = isolated_concepts["user"]
    _write_user_topic(user, "gone_topic", "Gone")
    with tmp_db as conn:
        mark_topic_user_created(conn, "gone_topic")
        result = delete_topic(conn, "gone_topic")
    assert result["deleted"] is True
    assert not (user / "gone_topic.yaml").exists()


def test_cannot_delete_bundled(isolated_concepts, tmp_db):
    with tmp_db as conn:
        with pytest.raises(TopicLifecycleError, match="cannot be deleted"):
            delete_topic(conn, "bundled_topic")


def test_rename_user_topic(isolated_concepts, tmp_db):
    user = isolated_concepts["user"]
    _write_user_topic(user, "old_slug", "Old Name")
    with tmp_db as conn:
        mark_topic_user_created(conn, "old_slug")
        queries.upsert_topic_concepts(conn, yaml.safe_load((user / "old_slug.yaml").read_text()))
        out = rename_topic(conn, "old_slug", "new_slug", display_name="New Name")
    assert out["topic_id"] == "new_slug"
    assert (user / "new_slug.yaml").exists()
    assert not (user / "old_slug.yaml").exists()


def test_search_topics_by_display_name(isolated_concepts, tmp_db):
    user = isolated_concepts["user"]
    _write_user_topic(user, "alpha_topic", "Unique Alpha Label")
    rows = search_topics(query="unique alpha")
    assert any(r["id"] == "alpha_topic" for r in rows)

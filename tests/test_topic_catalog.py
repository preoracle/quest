"""Tests for topic catalog metadata."""

from __future__ import annotations

from core.topic_catalog import list_topic_catalog


def test_list_topic_catalog_includes_previews():
    rows = list_topic_catalog()
    assert len(rows) >= 1
    row = next(r for r in rows if r["id"] == "binary_search")
    assert row["display_name"] == "Binary Search"
    assert row["concept_count"] == 6
    assert "Search space halving" in row["preview_concepts"]
    assert row["hook"]

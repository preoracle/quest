"""Tests for replay-mode concept picking."""

from __future__ import annotations

from core.concept_pick import pick_next_concept_replay


def _rows(topic: str = "t1"):
    # namespaced ids as returned from DB
    return [
        {
            "id": f"{topic}:a",
            "name": "A",
            "prerequisites_json": "[]",
        },
        {
            "id": f"{topic}:b",
            "name": "B",
            "prerequisites_json": '["a"]',
        },
        {
            "id": f"{topic}:c",
            "name": "C",
            "prerequisites_json": '["b"]',
        },
    ]


def test_replay_picks_in_order_with_empty_completed():
    concepts = _rows()
    nxt = pick_next_concept_replay(concepts, "t1", set())
    assert nxt["id"] == "t1:a"


def test_replay_skips_completed_and_respects_prereqs():
    concepts = _rows()
    nxt = pick_next_concept_replay(concepts, "t1", {"t1:a"})
    assert nxt["id"] == "t1:b"
    nxt2 = pick_next_concept_replay(concepts, "t1", {"t1:a", "t1:b"})
    assert nxt2["id"] == "t1:c"


def test_replay_returns_none_when_all_done():
    concepts = _rows()
    done = {"t1:a", "t1:b", "t1:c"}
    assert pick_next_concept_replay(concepts, "t1", done) is None

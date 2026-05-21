"""Unit tests for core/concept_pick.py."""

from datetime import datetime, timedelta, timezone

from core.concept_pick import (
    is_concept_mastered,
    pick_next_concept,
    topological_concept_ids,
)


def test_topological_order():
    concepts = [
        {"id": "t:closure", "prerequisites_json": '["t:lexical"]'},
        {"id": "t:lexical", "prerequisites_json": "[]"},
    ]
    order = topological_concept_ids(concepts, "t")
    assert order.index("t:lexical") < order.index("t:closure")


def test_pick_skips_unmet_prereq():
    concepts = [
        {"id": "t:a", "prerequisites_json": "[]", "name": "A"},
        {"id": "t:b", "prerequisites_json": '["a"]', "name": "B"},
    ]
    picked = pick_next_concept(concepts, "t", {}, {})
    assert picked["id"] == "t:a"


def test_pick_none_when_all_mastered():
    concepts = [{"id": "t:a", "prerequisites_json": "[]", "name": "A"}]
    picked = pick_next_concept(
        concepts,
        "t",
        {"t:a": 0.9},
        {"t:a": None},
        eval_counts={"t:a": 3},
    )
    assert picked is None


def test_pick_unmastered_not_due_still_eligible():
    """Regression: SM-2 future date must not block first-pass learning."""
    concepts = [
        {"id": "sd:req", "prerequisites_json": "[]", "name": "Requirements"},
        {
            "id": "sd:boe",
            "prerequisites_json": '["req"]',
            "name": "Back-of-Envelope",
        },
    ]
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    picked = pick_next_concept(
        concepts,
        "sd",
        {
            "sd:req": 0.6,
            "sd:boe": 1.0,
        },
        {"sd:req": future, "sd:boe": future},
        eval_counts={"sd:req": 2, "sd:boe": 1},
    )
    assert picked is not None
    assert picked["id"] == "sd:req"


def test_single_five_not_mastered():
    assert not is_concept_mastered(1.0, 1)
    assert is_concept_mastered(0.8, 3)


def test_system_design_deadlock_scenario():
    """Reproduce post-session state: only requirements should be pickable."""
    concepts = [
        {"id": "sd:req", "prerequisites_json": "[]", "name": "Requirements"},
        {
            "id": "sd:boe",
            "prerequisites_json": '["req"]',
            "name": "Back-of-Envelope",
        },
        {
            "id": "sd:core",
            "prerequisites_json": '["req"]',
            "name": "Core Components",
        },
    ]
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    picked = pick_next_concept(
        concepts,
        "sd",
        {"sd:req": 0.6, "sd:boe": 1.0},
        {"sd:req": future, "sd:boe": future},
        eval_counts={"sd:req": 2, "sd:boe": 1},
    )
    assert picked["id"] == "sd:req"

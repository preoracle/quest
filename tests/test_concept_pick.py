"""Unit tests for core/concept_pick.py."""

from core.concept_pick import pick_next_concept, topological_concept_ids


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
    picked = pick_next_concept(concepts, "t", {"t:a": 0.9}, {"t:a": None})
    assert picked is None

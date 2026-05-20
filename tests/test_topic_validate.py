"""Tests for concept map validation."""

from __future__ import annotations

import pytest

from core.topic_validate import validate_topic_payload


def _valid_map():
    return {
        "topic": "sample_topic",
        "display_name": "Sample Topic",
        "concepts": [
            {"id": "a", "name": "A", "description": "a", "prerequisites": []},
            {"id": "b", "name": "B", "description": "b", "prerequisites": ["a"]},
            {"id": "c", "name": "C", "description": "c", "prerequisites": ["a"]},
            {"id": "d", "name": "D", "description": "d", "prerequisites": ["b", "c"]},
            {"id": "e", "name": "E", "description": "e", "prerequisites": ["d"]},
        ],
    }


def test_validate_topic_payload_accepts_minimal_dag():
    validate_topic_payload(_valid_map())


def test_validate_rejects_bad_topic_slug():
    data = _valid_map()
    data["topic"] = "9bad"
    with pytest.raises(ValueError, match="slug"):
        validate_topic_payload(data)


def test_validate_rejects_too_few_concepts():
    data = _valid_map()
    data["concepts"] = data["concepts"][:3]
    with pytest.raises(ValueError, match="between"):
        validate_topic_payload(data)


def test_validate_rejects_unknown_prereq():
    data = _valid_map()
    data["concepts"][0]["prerequisites"] = ["ghost"]
    with pytest.raises(ValueError, match="unknown"):
        validate_topic_payload(data)

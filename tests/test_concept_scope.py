"""Tests for concept scope helper used in tutor prompts."""

from __future__ import annotations

from core.graph import _concept_scope_from_list


def test_concept_scope_strips_probes_prefix():
    concepts = [
        {
            "id": "react_hooks:use_effect",
            "name": "useEffect",
            "description": "Probes how useEffect schedules side effects after render.",
        }
    ]
    scope = _concept_scope_from_list(concepts, "react_hooks:use_effect")
    assert scope.startswith("how useEffect")
    assert not scope.lower().startswith("probes")

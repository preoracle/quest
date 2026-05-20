"""Validate generated or hand-written topic YAML dicts before persistence."""

from __future__ import annotations

import re
from typing import Any

from core.concept_pick import topological_concept_ids
from db import queries

_TOPIC_ID_RE = re.compile(r"^[a-z][a-z0-9_]{0,47}$")
_CONCEPT_ID_RE = re.compile(r"^[a-z][a-z0-9_]{0,63}$")
_MIN_CONCEPTS = 5
_MAX_CONCEPTS = 10


def validate_topic_payload(data: dict[str, Any]) -> None:
    """Raise ValueError with a clear message if the map is invalid."""
    if not isinstance(data, dict):
        raise ValueError("Topic data must be a dict")

    topic_id = data.get("topic")
    if not isinstance(topic_id, str) or not _TOPIC_ID_RE.match(topic_id):
        raise ValueError(
            "Invalid topic slug: use snake_case, start with a letter, max 48 chars."
        )

    display = data.get("display_name")
    if not isinstance(display, str) or not display.strip():
        raise ValueError("display_name must be a non-empty string")

    concepts_raw = data.get("concepts")
    if not isinstance(concepts_raw, list):
        raise ValueError("concepts must be a list")
    if not _MIN_CONCEPTS <= len(concepts_raw) <= _MAX_CONCEPTS:
        raise ValueError(
            f"Need between {_MIN_CONCEPTS} and {_MAX_CONCEPTS} concepts; "
            f"got {len(concepts_raw)}"
        )

    rows: list[dict[str, Any]] = []
    for i, c in enumerate(concepts_raw):
        if not isinstance(c, dict):
            raise ValueError(f"concepts[{i}] must be an object")
        cid = c.get("id")
        if not isinstance(cid, str) or not _CONCEPT_ID_RE.match(cid):
            raise ValueError(f"Invalid concept id at index {i}: {cid!r}")

        name = c.get("name")
        if not isinstance(name, str) or not name.strip():
            raise ValueError(f"concepts[{cid}].name required")

        desc = c.get("description")
        if desc is not None and not isinstance(desc, str):
            raise ValueError(f"concepts[{cid}].description must be a string")

        prereqs = c.get("prerequisites")
        if prereqs is None:
            prereqs = []
        if not isinstance(prereqs, list):
            raise ValueError(f"concepts[{cid}].prerequisites must be a list")
        clean_prereqs: list[str] = []
        for p in prereqs:
            if not isinstance(p, str) or not _CONCEPT_ID_RE.match(p):
                raise ValueError(f"Invalid prerequisite id under {cid}: {p!r}")
            clean_prereqs.append(p)

        rows.append(
            {
                "id": cid,
                "name": name.strip(),
                "description": (desc or "").strip(),
                "prerequisites": clean_prereqs,
            }
        )

    all_ids = {r["id"] for r in rows}
    if len(all_ids) != len(rows):
        raise ValueError("Duplicate concept ids.")

    for r in rows:
        for p in r["prerequisites"]:
            if p not in all_ids:
                raise ValueError(
                    f"Concept {r['id']} references unknown prerequisite {p!r}"
                )

    db_shape = [
        {
            "id": queries.namespace_concept_id(topic_id, r["id"]),
            "prerequisites_json": [
                queries.namespace_concept_id(topic_id, p) for p in r["prerequisites"]
            ],
        }
        for r in rows
    ]
    try:
        topo = topological_concept_ids(db_shape, topic_id)
    except Exception as exc:  # pragma: no cover
        raise ValueError(f"Invalid prerequisite graph: {exc}") from exc

    if len(topo) != len(all_ids):
        raise ValueError("Concept graph has a cycle or missing ids.")

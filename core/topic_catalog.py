"""Topic catalog metadata for the UI (no DB required)."""

from __future__ import annotations

from pathlib import Path

import yaml

from core.topics import _iter_concept_files


def _concept_names(concepts: list) -> list[str]:
    names: list[str] = []
    for c in concepts:
        if isinstance(c, dict) and isinstance(c.get("name"), str):
            names.append(c["name"].strip())
    return names


def _topic_hook(concepts: list, *, concept_count: int) -> str:
    for c in concepts:
        if isinstance(c, dict):
            desc = c.get("description")
            if isinstance(desc, str) and desc.strip():
                return desc.strip()[:140]
    return f"Socratic study across {concept_count} linked concepts."


def catalog_entry_from_path(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    topic_id = data.get("topic") or path.stem
    display = data.get("display_name") or topic_id.replace("_", " ").title()
    concepts = data.get("concepts") if isinstance(data.get("concepts"), list) else []
    names = _concept_names(concepts)
    return {
        "id": topic_id,
        "display_name": display,
        "concept_count": len(concepts),
        "preview_concepts": names[:4],
        "hook": _topic_hook(concepts, concept_count=len(concepts)),
    }


def list_topic_catalog() -> list[dict]:
    """Return catalog rows sorted by display name."""
    rows = [catalog_entry_from_path(p) for p in _iter_concept_files()]
    rows.sort(key=lambda r: r["display_name"].lower())
    return rows

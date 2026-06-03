"""Load hand-curated concept maps from bundled and user concept YAML dirs."""

from __future__ import annotations

from pathlib import Path

import yaml

from core.paths import concept_search_dirs
from db import queries


def _iter_concept_files() -> list[Path]:
    """All ``*.yaml`` topic files, user dir first (overrides bundled stem)."""
    seen: set[str] = set()
    paths: list[Path] = []
    for directory in concept_search_dirs():
        for path in sorted(directory.glob("*.yaml")):
            if path.stem in seen:
                continue
            seen.add(path.stem)
            paths.append(path)
    return paths


def list_topics() -> list[tuple[str, str]]:
    """Return [(topic_id, display_name), ...] for every concept YAML on disk."""
    out: list[tuple[str, str]] = []
    for path in _iter_concept_files():
        with path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        topic_id = data.get("topic") or path.stem
        display = data.get("display_name") or topic_id.replace("_", " ").title()
        out.append((topic_id, display))
    return out


def load_topic(topic_id: str) -> dict:
    """Load a single concept YAML by topic id (filename stem).

    Checks disk first (fast path for bundled topics), then falls back to
    dag_json stored in DB — this covers user-generated topics that were
    lost from Render's ephemeral filesystem after a redeploy.
    """
    for directory in concept_search_dirs():
        path = directory / f"{topic_id}.yaml"
        if path.exists():
            with path.open("r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
    try:
        with queries.get_connection() as conn:
            dag = queries.get_topic_dag(conn, topic_id)
            if dag:
                return dag
    except Exception:  # noqa: BLE001
        pass
    available = [tid for tid, _ in list_topics()]
    raise FileNotFoundError(
        f"No concept map for '{topic_id}'. "
        f"Available: {available or '(none — run: quest topic new \"...\")'}"
    )

"""Load hand-curated concept maps from `concepts/*.yaml`."""

from __future__ import annotations

from pathlib import Path

import yaml

_REPO_ROOT = Path(__file__).resolve().parent.parent
_CONCEPTS_DIR = _REPO_ROOT / "concepts"


def list_topics() -> list[tuple[str, str]]:
    """Return [(topic_id, display_name), ...] for every concept YAML on disk."""
    if not _CONCEPTS_DIR.exists():
        return []
    out: list[tuple[str, str]] = []
    for path in sorted(_CONCEPTS_DIR.glob("*.yaml")):
        with path.open("r", encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        topic_id = data.get("topic") or path.stem
        display = data.get("display_name") or topic_id.replace("_", " ").title()
        out.append((topic_id, display))
    return out


def load_topic(topic_id: str) -> dict:
    """Load a single concept YAML by topic id (filename stem).

    Raises FileNotFoundError with available topics listed if missing.
    """
    path = _CONCEPTS_DIR / f"{topic_id}.yaml"
    if not path.exists():
        available = [tid for tid, _ in list_topics()]
        raise FileNotFoundError(
            f"No concept map for '{topic_id}'. "
            f"Available: {available or '(none — add a YAML to concepts/)'}"
        )
    with path.open("r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}

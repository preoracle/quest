"""Generate and persist concept maps from a natural-language learning goal."""

from __future__ import annotations

from pathlib import Path

import yaml

from core.chains import build_topic_generator_chain
from core.topic_validate import validate_topic_payload

_REPO_ROOT = Path(__file__).resolve().parent.parent
_CONCEPTS_DIR = _REPO_ROOT / "concepts"


def generate_topic_payload(learning_goal: str) -> dict:
    """Call the LLM and return a validated topic dict (ready for YAML)."""
    chain = build_topic_generator_chain()
    result = chain.invoke({"learning_goal": learning_goal.strip()})
    data = result.model_dump()
    validate_topic_payload(data)
    return data


def write_topic_yaml(data: dict, *, force: bool = False) -> Path:
    """Write ``concepts/<topic>.yaml``. Raises FileExistsError unless force."""
    validate_topic_payload(data)
    _CONCEPTS_DIR.mkdir(parents=True, exist_ok=True)
    path = _CONCEPTS_DIR / f"{data['topic']}.yaml"
    if path.exists() and not force:
        raise FileExistsError(
            f"Topic file already exists: {path.name}. Use --force to overwrite."
        )
    body = {
        "topic": data["topic"],
        "display_name": data["display_name"].strip(),
        "concepts": [
            {
                "id": c["id"],
                "name": c["name"].strip(),
                "description": (c.get("description") or "").strip(),
                "prerequisites": list(c.get("prerequisites") or []),
            }
            for c in data["concepts"]
        ],
    }
    text = yaml.dump(
        body,
        default_flow_style=False,
        allow_unicode=True,
        sort_keys=False,
    )
    path.write_text(text, encoding="utf-8")
    return path

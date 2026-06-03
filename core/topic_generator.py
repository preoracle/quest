"""Generate and persist concept maps from a natural-language learning goal."""

from __future__ import annotations

import logging
from pathlib import Path

import yaml

from core.chains import build_topic_generator_chain
from core.llm_client import MODEL_CHAIN_TOPIC, llm_base_url, resolve_model
from core.paths import user_concepts_dir
from core.topic_validate import validate_topic_payload
from db import queries

log = logging.getLogger(__name__)


def find_existing_topic(learning_goal: str) -> str | None:
    """Return an existing topic slug if the goal semantically matches one, else None.

    Uses a cheap single LLM call to compare the goal against all known topics.
    This prevents generating duplicate topics (e.g. "RAG" when "rag_pipeline" exists).
    """
    from core.topics import list_topics  # noqa: PLC0415 — avoids circular import at module level

    known = list_topics()
    if not known:
        return None
    topics_list = "\n".join(f"- {slug}: {display}" for slug, display in known)
    prompt = (
        f"Here are existing topics:\n{topics_list}\n\n"
        f'A user wants to learn about: "{learning_goal}"\n\n'
        "Does this match any existing topic? Reply with ONLY the exact topic slug "
        "(e.g. rag_pipeline) if it matches, or the word NONE if it does not match. "
        "Be liberal: partial overlaps count as matches. No explanation."
    )
    from core.llm_client import MODEL_CHAIN_TOPIC, make_chat_model  # noqa: PLC0415
    from langchain_core.messages import HumanMessage  # noqa: PLC0415

    try:
        model = make_chat_model(*MODEL_CHAIN_TOPIC, temperature=0, max_tokens=20)
        result = model.invoke([HumanMessage(content=prompt)])
        answer = result.content.strip().lower().strip('"').strip("'")
        known_slugs = {slug for slug, _ in known}
        if answer in known_slugs:
            log.info("topic_dedup: goal=%r matched existing topic=%r", learning_goal, answer)
            return answer
    except Exception:  # noqa: BLE001 — dedup is best-effort; fall through to generation
        log.warning("topic_dedup check failed, proceeding with generation")
    return None


def generate_topic_payload(learning_goal: str) -> dict:
    """Call the LLM and return a validated topic dict (ready for YAML)."""
    chain = build_topic_generator_chain()
    log.info(
        "topic_generator model=%s base_url=%s",
        resolve_model(*MODEL_CHAIN_TOPIC),
        llm_base_url(),
    )
    result = chain.invoke({"learning_goal": learning_goal.strip()})
    data = result.model_dump()
    validate_topic_payload(data)
    return data


def write_topic_yaml(data: dict, *, force: bool = False) -> Path:
    """Write ``concepts/<topic>.yaml``. Raises FileExistsError unless force."""
    validate_topic_payload(data)
    concepts_dir = user_concepts_dir()
    concepts_dir.mkdir(parents=True, exist_ok=True)
    path = concepts_dir / f"{data['topic']}.yaml"
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
                "description": c["description"].strip(),
                "prerequisites": list(c.get("prerequisites") or []),
            }
            for c in data["concepts"]
        ],
    }
    path.write_text(
        yaml.safe_dump(body, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    # Also persist to DB so user-generated topics survive Render redeploys.
    try:
        with queries.get_connection() as conn:
            queries.upsert_topic_dag(conn, body["topic"], body)
    except Exception:  # noqa: BLE001 — persistence is best-effort; YAML is the canonical copy
        log.warning("Failed to persist topic DAG for %s to DB", body["topic"])
    return path

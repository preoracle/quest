"""DAG-aware concept selection for Phase 3 sessions."""

from __future__ import annotations

import json
from datetime import datetime, timezone

MASTERY_THRESHOLD = 0.8  # normalized score in [0, 1]


def _parse_prereqs(raw: str | list | None, topic_id: str) -> list[str]:
    """Normalize prerequisite ids to namespaced concept ids."""
    if raw is None:
        prereqs: list = []
    elif isinstance(raw, str):
        prereqs = json.loads(raw)
    else:
        prereqs = raw
    out: list[str] = []
    for p in prereqs:
        if ":" in p:
            out.append(p)
        else:
            out.append(f"{topic_id}:{p}")
    return out


def topological_concept_ids(
    concepts: list[dict],
    topic_id: str,
) -> list[str]:
    """Return concept ids in prerequisite order (prereqs before dependents)."""
    ids = [c["id"] for c in concepts]
    id_set = set(ids)
    prereq_map = {
        c["id"]: _parse_prereqs(c.get("prerequisites_json"), topic_id)
        for c in concepts
    }
    ordered: list[str] = []
    seen: set[str] = set()

    def visit(cid: str) -> None:
        if cid in seen or cid not in id_set:
            return
        for p in prereq_map.get(cid, []):
            if p in id_set:
                visit(p)
        seen.add(cid)
        ordered.append(cid)

    for cid in ids:
        visit(cid)
    return ordered


def is_due(next_review_at: str | None, now: datetime | None = None) -> bool:
    """True if never scheduled or review date is in the past."""
    if not next_review_at:
        return True
    now = now or datetime.now(timezone.utc)
    try:
        due = datetime.fromisoformat(next_review_at.replace("Z", "+00:00"))
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
    except ValueError:
        return True
    return due <= now


def pick_next_concept(
    concepts: list[dict],
    topic_id: str,
    mastery_scores: dict[str, float],
    next_review: dict[str, str | None],
    *,
    now: datetime | None = None,
) -> dict | None:
    """Pick the weakest unmastered concept that is due and has prereqs satisfied.

    Returns the concept row dict (id, name, ...) or None if all concepts are
    mastered or none are eligible yet.
    """
    ordered = topological_concept_ids(concepts, topic_id)
    by_id = {c["id"]: c for c in concepts}

    for cid in ordered:
        score = mastery_scores.get(cid, 0.0)
        if score >= MASTERY_THRESHOLD:
            continue
        if not is_due(next_review.get(cid), now):
            continue
        prereqs = _parse_prereqs(by_id[cid].get("prerequisites_json"), topic_id)
        if all(mastery_scores.get(p, 0.0) >= MASTERY_THRESHOLD for p in prereqs):
            return by_id[cid]
    return None


def pick_next_concept_replay(
    concepts: list[dict],
    topic_id: str,
    completed: set[str],
) -> dict | None:
    """Pick the next concept for a replay session (ignores stored mastery).

    Concepts whose ids appear in ``completed`` are skipped. Prerequisite
    concepts must be completed before a dependent is eligible. Returns ``None``
    when every concept has been completed this session.
    """
    ordered = topological_concept_ids(concepts, topic_id)
    by_id = {c["id"]: c for c in concepts}
    id_set = set(by_id.keys())
    for cid in ordered:
        if cid in completed:
            continue
        prereqs = _parse_prereqs(by_id[cid].get("prerequisites_json"), topic_id)
        needed = [p for p in prereqs if p in id_set]
        if all(p in completed for p in needed):
            return by_id[cid]
    return None

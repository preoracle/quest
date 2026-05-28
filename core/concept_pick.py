"""DAG-aware concept selection for Phase 3 sessions."""

from __future__ import annotations

import json
from datetime import datetime, timezone

MASTERY_THRESHOLD = 0.8  # normalized score in [0, 1]
MIN_EVALUATIONS_FOR_MASTERY = 3


def is_concept_mastered(score: float, num_evaluations: int) -> bool:
    """True when the student has enough evaluations at or above the mastery bar."""
    return (
        num_evaluations >= MIN_EVALUATIONS_FOR_MASTERY
        and score >= MASTERY_THRESHOLD
    )


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


def is_due(next_review_at: str | datetime | None, now: datetime | None = None) -> bool:
    """True if never scheduled or review date is in the past."""
    if not next_review_at:
        return True
    now = now or datetime.now(timezone.utc)
    try:
        if isinstance(next_review_at, datetime):
            due = next_review_at
        else:
            due = datetime.fromisoformat(next_review_at.replace("Z", "+00:00"))
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return True
    return due <= now


def _score_and_evals(
    cid: str,
    mastery_scores: dict[str, float],
    eval_counts: dict[str, int],
) -> tuple[float, int]:
    return mastery_scores.get(cid, 0.0), eval_counts.get(cid, 0)


def pick_next_concept(
    concepts: list[dict],
    topic_id: str,
    mastery_scores: dict[str, float],
    next_review: dict[str, str | None],
    *,
    eval_counts: dict[str, int] | None = None,
    now: datetime | None = None,
) -> dict | None:
    """Pick the weakest unmastered concept with satisfied prerequisites.

    Unmastered concepts are always eligible (SM-2 due dates apply only after
    mastery). Returns the concept row dict (id, name, ...) or None when every
    concept in the topic is mastered.
    """
    eval_counts = eval_counts or {}
    ordered = topological_concept_ids(concepts, topic_id)
    by_id = {c["id"]: c for c in concepts}

    for cid in ordered:
        score, n = _score_and_evals(cid, mastery_scores, eval_counts)
        if is_concept_mastered(score, n):
            continue
        prereqs = _parse_prereqs(by_id[cid].get("prerequisites_json"), topic_id)
        if not all(
            is_concept_mastered(*_score_and_evals(p, mastery_scores, eval_counts))
            for p in prereqs
        ):
            continue
        return by_id[cid]
    return None


def topic_has_unmastered_concepts(
    concepts: list[dict],
    topic_id: str,
    mastery_scores: dict[str, float],
    *,
    eval_counts: dict[str, int] | None = None,
) -> bool:
    """True if any concept in the topic is not yet mastered."""
    eval_counts = eval_counts or {}
    for c in concepts:
        cid = c["id"]
        score, n = _score_and_evals(cid, mastery_scores, eval_counts)
        if not is_concept_mastered(score, n):
            return True
    return False


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

"""Mastery updates combining running average + SM-2 (Phase 3)."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

from core.concept_pick import is_concept_mastered
from core.models import CONCEPT_INFERENCE_CONFIDENCE_THRESHOLD, EvaluatorOutput
from core.sm2 import Sm2State, sm2_schedule
from db import queries


def apply_evaluation_to_mastery(
    conn: sqlite3.Connection,
    user_id: str,
    topic_id: str,
    evaluation: EvaluatorOutput,
    *,
    current_concept_id: str | None = None,
    concept_list: list[dict] | None = None,
) -> None:
    """Update topic mastery and the active concept (study uses current, not inferred).

    concept_list — the session's concept list from graph state.  When provided,
    any inferred_concept_id returned by the evaluator is validated against it.
    Hallucinated IDs (not in the list) are silently dropped so phantom mastery
    rows are never written.
    """
    normalized = evaluation.normalized_score()
    quality = evaluation.score

    _upsert_with_sm2(conn, user_id, topic_id, normalized, quality)

    # Build a set of valid concept IDs for quick validation
    valid_ids: set[str] = {c["id"] for c in concept_list} if concept_list else set()

    concept_id = current_concept_id
    if (
        not concept_id
        and evaluation.inferred_concept_id
        and evaluation.inferred_concept_confidence >= CONCEPT_INFERENCE_CONFIDENCE_THRESHOLD
    ):
        inferred = evaluation.inferred_concept_id
        # Only trust the inferred ID if it actually exists in the concept list.
        # Weaker models can be confidently wrong — reject rather than corrupt mastery.
        if not valid_ids or inferred in valid_ids:
            concept_id = inferred
        # else: silently discard the hallucinated concept ID

    if concept_id:
        _upsert_with_sm2(conn, user_id, concept_id, normalized, quality)


def _upsert_with_sm2(
    conn: sqlite3.Connection,
    user_id: str,
    concept_id: str,
    normalized_score: float,
    quality: int,
) -> None:
    """Write running average and SM-2 fields for one concept."""
    existing = queries.get_mastery_sm2_state(conn, user_id, concept_id)
    now = datetime.now(timezone.utc).isoformat()

    if existing is None:
        sm2 = sm2_schedule(quality, Sm2State(0, 2.5, 1))
        n = 1
        score = normalized_score
        next_at = sm2.next_review_at.isoformat()
        if not is_concept_mastered(score, n):
            next_at = now
        conn.execute(
            """
            INSERT INTO mastery (
                user_id, concept_id, score, num_evaluations,
                ease_factor, interval_days, repetitions,
                last_reviewed_at, next_review_at
            ) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                concept_id,
                score,
                sm2.ease_factor,
                sm2.interval_days,
                sm2.repetitions,
                now,
                next_at,
            ),
        )
    else:
        old_score, n, ef, interval, reps = existing
        new_n = n + 1
        new_score = (old_score * n + normalized_score) / new_n
        sm2 = sm2_schedule(quality, Sm2State(reps, ef, interval))
        next_at = sm2.next_review_at.isoformat()
        if not is_concept_mastered(new_score, new_n):
            next_at = now
        conn.execute(
            """
            UPDATE mastery
            SET score = ?, num_evaluations = ?,
                ease_factor = ?, interval_days = ?, repetitions = ?,
                last_reviewed_at = ?, next_review_at = ?
            WHERE user_id = ? AND concept_id = ?
            """,
            (
                new_score,
                new_n,
                sm2.ease_factor,
                sm2.interval_days,
                sm2.repetitions,
                now,
                next_at,
                user_id,
                concept_id,
            ),
        )
    conn.commit()

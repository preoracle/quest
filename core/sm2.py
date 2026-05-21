"""SM-2 spaced repetition scheduling (Phase 3).

Pure functions only — no I/O. Fed by evaluator scores (1–5) from Haiku.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

_MAX_INTERVAL_DAYS = 3650


@dataclass(frozen=True)
class Sm2State:
    """SM-2 fields stored on a mastery row."""

    repetitions: int
    ease_factor: float
    interval_days: int


@dataclass(frozen=True)
class Sm2Result(Sm2State):
    """SM-2 state after one review, plus the next review timestamp."""

    next_review_at: datetime


def sm2_schedule(
    quality: int,
    state: Sm2State,
    *,
    reviewed_at: datetime | None = None,
) -> Sm2Result:
    """Apply one SM-2 review for `quality` in [0, 5] and return updated scheduling.

    Quality < 3 resets the repetition count. Quality >= 3 advances the interval
    using the standard SM-2 ease-factor formula. Minimum ease factor is 1.3.
    """
    if not 0 <= quality <= 5:
        raise ValueError(f"quality must be 0–5, got {quality}")

    ease = state.ease_factor
    reps = state.repetitions
    interval = state.interval_days

    ease = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    if ease < 1.3:
        ease = 1.3

    if quality < 3:
        reps = 0
        interval = 1
    else:
        if reps == 0:
            interval = 1
        elif reps == 1:
            interval = 6
        else:
            interval = min(_MAX_INTERVAL_DAYS, max(1, round(interval * ease)))
        reps += 1

    interval = min(_MAX_INTERVAL_DAYS, max(1, interval))
    reviewed = reviewed_at or datetime.now(timezone.utc)
    next_at = reviewed + timedelta(days=interval)
    return Sm2Result(
        repetitions=reps,
        ease_factor=ease,
        interval_days=interval,
        next_review_at=next_at,
    )

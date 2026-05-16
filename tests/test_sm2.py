"""Unit tests for core/sm2.py."""

from datetime import datetime, timezone

from core.sm2 import Sm2State, sm2_schedule


def test_sm2_fail_resets_repetitions():
    result = sm2_schedule(2, Sm2State(repetitions=3, ease_factor=2.5, interval_days=10))
    assert result.repetitions == 0
    assert result.interval_days == 1


def test_sm2_pass_advances_interval():
    s = Sm2State(0, 2.5, 1)
    r1 = sm2_schedule(4, s)
    assert r1.repetitions == 1
    assert r1.interval_days == 1
    r2 = sm2_schedule(4, Sm2State(r1.repetitions, r1.ease_factor, r1.interval_days))
    assert r2.repetitions == 2
    assert r2.interval_days == 6


def test_sm2_next_review_in_future():
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    result = sm2_schedule(5, Sm2State(0, 2.5, 1), reviewed_at=now)
    assert result.next_review_at > now

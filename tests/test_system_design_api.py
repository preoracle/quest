"""API regression: system design study must not end while concepts remain unmastered."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from core.concept_pick import pick_next_concept
from core.models import EvaluatorOutput
from db import queries
from main import app

TOPIC = "system_design_interview"
USER = "sd_api_user"


@pytest.fixture
def client(tmp_db_path, monkeypatch):
    cp_path = tmp_db_path.with_name(tmp_db_path.stem + "_checkpoints.db")
    monkeypatch.setattr("core.paths.db_path", lambda: tmp_db_path)
    monkeypatch.setattr("core.paths.checkpoint_db_path", lambda: cp_path)
    queries.init_db(tmp_db_path)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def mock_llm():
    eval_out = EvaluatorOutput(
        score=4,
        gaps=[],
        reasoning="Solid.",
        inferred_concept_id=f"{TOPIC}:requirements_clarification",
        inferred_concept_confidence=0.9,
    )
    with (
        patch("core.graph.build_socratic_chain") as mock_soc,
        patch("core.graph.build_evaluator_chain") as mock_eval,
    ):
        mock_soc.return_value.invoke.return_value = AIMessage(
            content="What functional requirements would you clarify first?",
        )
        mock_eval.return_value.invoke.return_value = eval_out
        yield


def _seed_deadlock_state(conn, user_id: str) -> None:
    """Mimic the pre-fix DB state that incorrectly ended the session."""
    from core.topics import load_topic

    queries.get_or_create_user(conn, user_id)
    data = load_topic(TOPIC)
    queries.upsert_topic_concepts(conn, data)
    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """
        INSERT INTO mastery (
            user_id, concept_id, score, num_evaluations,
            ease_factor, interval_days, repetitions,
            last_reviewed_at, next_review_at
        ) VALUES (?, ?, ?, ?, 2.5, 1, 1, ?, ?)
        """,
        (user_id, f"{TOPIC}:requirements_clarification", 0.6, 2, now, future),
    )
    conn.execute(
        """
        INSERT INTO mastery (
            user_id, concept_id, score, num_evaluations,
            ease_factor, interval_days, repetitions,
            last_reviewed_at, next_review_at
        ) VALUES (?, ?, ?, ?, 2.5, 1, 1, ?, ?)
        """,
        (user_id, f"{TOPIC}:back_of_envelope_estimation", 1.0, 1, now, future),
    )
    conn.commit()


def test_picker_finds_requirements_after_deadlock_state(tmp_db_path, monkeypatch):
    monkeypatch.setattr("core.paths.db_path", lambda: tmp_db_path)
    queries.init_db(tmp_db_path)
    with queries.get_connection(tmp_db_path) as conn:
        _seed_deadlock_state(conn, USER)
        concepts = queries.get_topic_concepts(conn, TOPIC)
        scores, reviews, eval_counts = queries.get_mastery_maps(conn, USER, TOPIC)
        picked = pick_next_concept(
            concepts, TOPIC, scores, reviews, eval_counts=eval_counts,
        )
        assert picked is not None
        assert picked["id"] == f"{TOPIC}:requirements_clarification"


def test_study_session_starts_with_question(client, mock_llm, tmp_db_path, monkeypatch):
    monkeypatch.setattr("core.paths.db_path", lambda: tmp_db_path)
    queries.init_db(tmp_db_path)
    with queries.get_connection(tmp_db_path) as conn:
        _seed_deadlock_state(conn, USER)

    start = client.post(
        "/sessions",
        json={"user_id": USER, "topic": TOPIC, "resume": False, "replay": False},
    )
    assert start.status_code == 200
    body = start.json()
    assert body["done"] is False
    assert body["waiting_for_answer"] is True
    assert body["tutor_message"]
    assert "Requirements" in (body.get("focus") or "")

    turn = client.post(
        f"/sessions/{body['session_id']}/turn",
        json={"answer": "I would ask about scale and read/write ratio."},
    )
    assert turn.status_code == 200
    t = turn.json()
    assert t["done"] is False
    assert t["waiting_for_answer"] is True
    assert t["last_evaluation"]["score"] == 4

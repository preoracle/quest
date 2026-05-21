"""HTTP API tests with mocked LLM chains."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from core.models import EvaluatorOutput
from db import queries
from main import app

TOPIC = "closures_in_javascript"
USER = "test_api_user"


@pytest.fixture
def client(tmp_db_path, monkeypatch):
    """TestClient with isolated quest.db and checkpoint store."""
    cp_path = tmp_db_path.with_name(tmp_db_path.stem + "_checkpoints.db")
    monkeypatch.setattr("core.paths.db_path", lambda: tmp_db_path)
    monkeypatch.setattr("core.paths.checkpoint_db_path", lambda: cp_path)
    queries.init_db(tmp_db_path)
    with TestClient(app) as c:
        yield c


@pytest.fixture
def mock_llm():
    """Patch Socratic + evaluator chains used inside the graph."""
    eval_out = EvaluatorOutput(
        score=4,
        gaps=[],
        reasoning="Solid.",
        inferred_concept_id=f"{TOPIC}:variable_scope",
        inferred_concept_confidence=0.9,
    )
    with (
        patch("core.graph.build_socratic_chain") as mock_soc,
        patch("core.graph.build_evaluator_chain") as mock_eval,
    ):
        soc = mock_soc.return_value
        soc.invoke.side_effect = [
            AIMessage(content="Where does inner look for variables?"),
            AIMessage(content="What about after outer returns?"),
            AIMessage(content="Third question?"),
        ]
        mock_eval.return_value.invoke.return_value = eval_out
        yield


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_session_turn_flow(client, mock_llm):
    start = client.post(
        "/sessions",
        json={"user_id": USER, "topic": TOPIC, "resume": False},
    )
    assert start.status_code == 200
    body = start.json()
    assert body["waiting_for_answer"] is True
    assert body["tutor_message"]
    sid = body["session_id"]

    turn = client.post(
        f"/sessions/{sid}/turn",
        json={"answer": "Outer lexical environment."},
    )
    assert turn.status_code == 200
    t = turn.json()
    assert t["last_evaluation"]["score"] == 4
    assert t["waiting_for_answer"] is True

    got = client.get(f"/sessions/{sid}")
    assert got.status_code == 200
    assert got.json()["session_id"] == sid

    mastery = client.get(f"/users/{USER}/mastery", params={"topic": TOPIC})
    assert mastery.status_code == 200
    assert len(mastery.json()["items"]) >= 1


def test_turn_on_unknown_session(client):
    r = client.post(
        "/sessions/00000000-0000-0000-0000-000000000000/turn",
        json={"answer": "hi"},
    )
    assert r.status_code == 404


def test_session_turns_list(client, mock_llm):
    start = client.post(
        "/sessions",
        json={"user_id": USER, "topic": TOPIC, "resume": False},
    )
    sid = start.json()["session_id"]
    client.post(f"/sessions/{sid}/turn", json={"answer": "Scope chain."})
    turns = client.get(f"/sessions/{sid}/turns")
    assert turns.status_code == 200
    data = turns.json()
    assert len(data) >= 2
    assert data[0]["role"] == "tutor"
    assert any(t["role"] == "user" for t in data)


def test_due_endpoint(client):
    r = client.get(f"/users/{USER}/due")
    assert r.status_code == 200
    assert "items" in r.json()


def test_unknown_topic(client):
    r = client.post(
        "/sessions",
        json={"user_id": USER, "topic": "not_a_real_topic", "resume": False},
    )
    assert r.status_code == 404

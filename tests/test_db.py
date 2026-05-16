"""Structural tests for db/queries.py."""

from __future__ import annotations

import sqlite3

from db import queries


def test_init_db_creates_tables(tmp_db_path):
  """init_db should create all expected tables."""
  queries.init_db(tmp_db_path)
  with queries.get_connection(tmp_db_path) as conn:
    tables = {
      row[0]
      for row in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
      ).fetchall()
    }
  assert tables >= {"users", "concepts", "mastery", "sessions", "turns"}


def test_upsert_topic_concepts_idempotent(tmp_db, closures_topic_data):
  """Calling upsert twice should not duplicate concept rows."""
  queries.upsert_topic_concepts(tmp_db, closures_topic_data)
  queries.upsert_topic_concepts(tmp_db, closures_topic_data)
  count = tmp_db.execute(
    "SELECT COUNT(*) FROM concepts WHERE topic = ?",
    ("closures_in_javascript",),
  ).fetchone()[0]
  # 1 topic + 2 concepts
  assert count == 3


def test_mastery_running_average(tmp_db):
  """upsert_mastery should maintain a running average in [0, 1]."""
  queries.get_or_create_user(tmp_db, "u1")
  queries.upsert_topic_concepts(
    tmp_db,
    {
      "topic": "t1",
      "display_name": "T1",
      "concepts": [],
    },
  )
  queries.upsert_mastery(tmp_db, "u1", "t1", 1.0)  # score 5/5
  queries.upsert_mastery(tmp_db, "u1", "t1", 0.6)  # score 3/5
  row = tmp_db.execute(
    "SELECT score, num_evaluations FROM mastery WHERE user_id = ? AND concept_id = ?",
    ("u1", "t1"),
  ).fetchone()
  assert row["num_evaluations"] == 2
  assert abs(row["score"] - 0.8) < 1e-6


def test_record_turn_and_session_lifecycle(tmp_db):
  """Sessions and turns should persist with expected fields."""
  queries.get_or_create_user(tmp_db, "u1")
  queries.upsert_topic_concepts(
    tmp_db, {"topic": "t1", "display_name": "T1", "concepts": []}
  )
  sid = queries.create_session(tmp_db, "u1", "t1")
  queries.record_turn(tmp_db, sid, 0, "tutor", "Where does inner look?")
  queries.record_turn(
    tmp_db,
    sid,
    1,
    "user",
    "Outer scope",
    evaluator_score=3,
    evaluator_gaps=["precision"],
    evaluator_reasoning="Roughly right.",
    evaluator_concept_id="t1:c1",
    evaluator_concept_confidence=0.8,
  )
  queries.end_session(tmp_db, sid)

  turns = tmp_db.execute(
    "SELECT role, evaluator_score FROM turns WHERE session_id = ? ORDER BY turn_idx",
    (sid,),
  ).fetchall()
  assert turns[0]["role"] == "tutor"
  assert turns[1]["evaluator_score"] == 3
  ended = tmp_db.execute(
    "SELECT ended_at FROM sessions WHERE id = ?", (sid,)
  ).fetchone()
  assert ended["ended_at"] is not None


def test_get_mastery_for_user(tmp_db, closures_topic_data):
  """get_mastery_for_user should join concept metadata."""
  queries.get_or_create_user(tmp_db, "u1")
  queries.upsert_topic_concepts(tmp_db, closures_topic_data)
  queries.upsert_mastery(tmp_db, "u1", "closures_in_javascript", 0.8)
  rows = queries.get_mastery_for_user(tmp_db, "u1", topic="closures_in_javascript")
  assert len(rows) == 1
  assert rows[0].kind == "topic"
  assert rows[0].score_1_to_5 == 4.0

-- Quest SQLite schema (Phase 2+)
-- Applied by db/queries.py::init_db. Do not run raw SQL elsewhere (per BRIEF).

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS concepts (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('topic', 'concept')),
  name TEXT NOT NULL,
  description TEXT,
  prerequisites_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS mastery (
  user_id TEXT NOT NULL REFERENCES users(id),
  concept_id TEXT NOT NULL REFERENCES concepts(id),
  score REAL NOT NULL DEFAULT 0.0,
  num_evaluations INTEGER NOT NULL DEFAULT 0,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  interval_days INTEGER NOT NULL DEFAULT 1,
  repetitions INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMP,
  next_review_at TIMESTAMP,
  PRIMARY KEY (user_id, concept_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  topic TEXT NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMP,
  summary_text TEXT,
  report_json TEXT,
  session_kind TEXT NOT NULL DEFAULT 'study' CHECK (session_kind IN ('study', 'baseline'))
);

CREATE TABLE IF NOT EXISTS turns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  turn_idx INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'tutor')),
  content TEXT NOT NULL,
  evaluator_score INTEGER,
  evaluator_gaps_json TEXT,
  evaluator_reasoning TEXT,
  evaluator_concept_id TEXT,
  evaluator_concept_confidence REAL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_turns_session ON turns(session_id, turn_idx);
CREATE INDEX IF NOT EXISTS idx_mastery_user ON mastery(user_id);

# Quest — product snapshot (0.3.0)

## What it is

Local Socratic tutor: **one question at a time**, separate **evaluator** (1–5), **concept DAG** per topic, progress in **SQLite** (`~/.quest/`).

## Session loop

1. Pick or create a topic.
2. System selects next **concept** (mastery + SM-2, or full DAG with `--fresh`).
3. Tutor asks → you answer → evaluator scores **that answer** → repeat.
4. Concept “done” after score ≥ 4 on **3 turns** → next concept.
5. `/quit` pauses; same topic resumes later.

## Memory (important)

| Layer | What it remembers |
|--------|-------------------|
| **Tutor** | Full Q↔A thread **within the current concept** |
| **Evaluator** | **Last question + last answer** by default (`QUEST_EVAL_MODE=last_turn`) |
| **Evaluator (alt)** | Full **concept thread** (`QUEST_EVAL_MODE=concept_thread`) |
| **Scheduler** | Per-concept mastery scores across sessions |

Cross-concept chat context is **not** kept in the tutor thread (by design today).

**Baseline:** `quest TOPIC --baseline` asks up to 5 calibration questions, seeds mastery, then study skips concepts you already know (score ≥ 4).

## Commands

| Command | Purpose |
|---------|---------|
| `quest` | Topic catalog → session |
| `quest TOPIC` | Start / resume topic |
| `quest TOPIC --fresh` | New session, replay full DAG |
| `quest topic new "goal"` | LLM-generated topic YAML |
| `quest mastery` / `quest reset` | Progress |
| `quest due` | Concepts due for SM-2 review |
| `quest TOPIC --baseline` | Calibrate, then study |
| `quest --version` | Installed version |

At catalog `›`: `3`, `binary_search`, `binary_search --fresh`, `new …`, `help`, `quit`.

**End of session:** structured report (concepts, scores, gaps) plus optional narrative notes.

## Not yet shipped

Web UI as primary (API + `frontend/` exist; CLI is canonical).

Planning (contributors): [ROADMAP](https://github.com/preoracle/quest/blob/main/docs/ROADMAP.md) on GitHub — not part of the PyPI package page.

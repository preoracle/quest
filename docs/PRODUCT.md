# Quest — product snapshot (0.1.1)

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
| **Evaluator** | **Last question + last answer only** |
| **Scheduler** | Per-concept mastery scores across sessions |

Cross-concept chat context is **not** kept in the tutor thread (by design today).

## Commands

| Command | Purpose |
|---------|---------|
| `quest` | Topic catalog → session |
| `quest TOPIC` | Start / resume topic |
| `quest TOPIC --fresh` | New session, replay full DAG |
| `quest topic new "goal"` | LLM-generated topic YAML |
| `quest mastery` / `quest reset` | Progress |

At catalog `›`: `3`, `binary_search`, `binary_search --fresh`, `new …`, `help`, `quit`.

## Not yet shipped

Session report, `quest due`, baseline assessment, web UI as primary. See [ROADMAP.md](ROADMAP.md).

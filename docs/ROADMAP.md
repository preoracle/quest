# Quest roadmap

**Quest** is a Socratic AI tutor: it never explains, only asks the next better question. A separate evaluator scores understanding; concept DAGs, mastery, and SM-2 scheduling drive what you practice next.

**Install (target):** `pip install quest-ai` → run `quest`

---

## Phase A — Ship the CLI (current)

| Item | Status |
|------|--------|
| PyPI name `quest-ai`, CLI command `quest` | In progress |
| `core/paths.py` — dev repo vs `~/.quest` | In progress |
| Bundle `quest_data` (prompts + default topics) | In progress |
| LangGraph in main dependencies | In progress |
| README + TestPyPI dry run | Ready (see below) |

**Done recently:** replay/`--fresh`, topic generator, search-first picker, clearer Socratic scope, Rich CLI, reset, web UI (Vite).

---

## Phase B — Paid-product core

1. **Session report** — end-of-session summary: concepts touched, scores, gaps, suggested review.
2. **`quest due`** — SM-2 spaced repetition: list concepts due today, start a micro-session.
3. **Eval fixtures** — golden transcripts + expected scores; CI without live API for regressions on prompts.

---

## Phase C — Distribution & polish

1. **TestPyPI → PyPI** — `quest-ai` 0.1.0 with documented `ANTHROPIC_API_KEY`.
2. **Docs site** — BRIEF + ROADMAP + “vs ChatGPT” positioning.
3. **Frontend** — optional hosted UI; API already exists.

---

## Phase D — Later

- **Voice** — thin STT/TTS on the existing turn loop (after report + due).
- **Interview sprint** — timed multi-topic runs.
- **Team / classroom** — shared topics, instructor dashboards.

---

## Differentiators (positioning)

| ChatGPT tutoring | Quest |
|------------------|-------|
| Explains on request | Tutor never explains |
| Same model judges you | Separate Haiku evaluator |
| Flat chat | Concept DAG + prerequisites |
| No durable mastery | Mastery + SM-2 scheduling |
| Ephemeral thread | Resumable LangGraph sessions |

---

## TestPyPI (one-time setup + upload)

```bash
pip install -e ".[dev]"          # includes build + twine
python -m build                    # writes dist/quest_ai-0.1.0.*
```

1. Create accounts: [pypi.org](https://pypi.org) and [test.pypi.org](https://test.pypi.org) (can be same email).
2. Account → API tokens → create token scoped to **entire account** (or project once it exists).
3. Upload to TestPyPI (use `__token__` as username, token as password):

```bash
twine upload --repository testpypi dist/*
```

4. Smoke-test install in a **fresh** venv:

```bash
pip install -i https://test.pypi.org/simple/ --extra-index-url https://pypi.org/simple/ quest-ai
export ANTHROPIC_API_KEY=sk-ant-...
quest
```

When satisfied, `twine upload dist/*` for real PyPI (new token recommended).

---

## Dev commands

```bash
pip install -e ".[dev]"
pytest
quest                          # or: python cli.py
quest topic new "react hooks"
quest closures_in_javascript --fresh
QUEST_DATA_DIR=/tmp/q quest mastery
```

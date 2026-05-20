# Quest roadmap

**Quest** is a Socratic AI tutor: it never explains, only asks the next better question. A separate evaluator scores understanding; concept DAGs, mastery, and SM-2 scheduling drive what you practice next.

**Install:** `pip install -U quest-ai` → `quest` (Python **≥ 3.11**)

---

## Phase A — Ship the CLI ✅ (0.1.1)

| Item | Status |
|------|--------|
| PyPI `quest-ai`, CLI `quest` | **0.1.1** |
| `~/.quest` data dir + `.env` | Done |
| Rich catalog picker + `--fresh` at `›` | Done |
| Tutor history fix | Done |
| Session UI polish | Done |
| Docs: PRODUCT, CHANGELOG | Done |

**Optional:** `QUEST_WIZARD=1` for questionary menus (catalog is default).

---

## Phase B — Paid-product core

1. **Session report** — end-of-session summary: concepts touched, scores, gaps.
2. **`quest due`** — SM-2: concepts due today.
3. **Eval fixtures** — golden transcripts; CI without live API.
4. **Dialogue modes** — explicit probe vs thread (evaluator context).

---

## Phase C — Distribution & polish

1. Publish **0.1.1** to PyPI (maintainer: yuvrxj).
2. Docs site or README polish.
3. Frontend as optional face (API exists).

---

## Phase D — Later

Voice, interview sprint, team/classroom.

---

## Differentiators

| ChatGPT tutoring | Quest |
|------------------|-------|
| Explains on request | Tutor never explains |
| Same model judges you | Separate Haiku evaluator |
| Flat chat | Concept DAG + prerequisites |
| No durable mastery | Mastery + SM-2 |
| Ephemeral thread | Resumable sessions |

---

## Dev commands

```bash
pip install -e ".[dev]"
pytest
quest
quest topic new "react hooks"
quest tool_calling_agents --fresh
QUEST_DATA_DIR=/tmp/q quest mastery
```

## Publish 0.1.1

```bash
python -m build
twine upload dist/*
```

Use a **pypi.org** API token (`__token__` / `pypi-…`). Test install:

```bash
pip install -U quest-ai
quest --help  # or: quest mastery
```

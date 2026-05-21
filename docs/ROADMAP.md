# Quest roadmap

**Quest** is a Socratic AI tutor: it never explains, only asks the next better question. A separate evaluator scores understanding; concept DAGs, mastery, and SM-2 scheduling drive what you practice next.

**Install:** `pip install -U quest-ai` → `quest` (Python **≥ 3.11**)

---

## Phase A — Ship the CLI ✅ (0.1.x)

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

Detailed plan: **[PHASE_B_PLAN.md](PHASE_B_PLAN.md)**.

| Item | Status (0.3.0) |
|------|----------------|
| Session report | ✅ |
| `quest due` | ✅ |
| Eval fixtures | ✅ |
| Cross-session memory | ✅ |
| Baseline assessment | ✅ |
| Dialogue modes | ✅ |

---

## Phase C — Distribution & polish ✅

1. PyPI publish via `./scripts/publish_pypi.sh` (0.3.0).
2. **Web UI redesign** — catalog → live transcript session → structured report; Due + Progress pages.
3. API: `GET /sessions/{id}/turns`, `GET /users/{id}/due`.

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

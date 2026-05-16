# Quest — Project Brief

## What is this?
A Socratic AI tutor built with Python + LangChain + LangGraph.

The core philosophy: **never give the answer, only ask the next
question that forces the student to think harder.**

This is NOT a chatbot. It is a learning engine with:
- State (what does this user know right now?)
- Evaluation (did they actually understand that?)
- Memory (what did we cover last session?)
- Scheduling (when should this concept be reviewed again?)

## The core loop
1. User enters a topic (e.g. "closures in JavaScript")
2. System builds a concept dependency map for that topic
3. Baseline assessment — what does the user already know?
4. Socratic dialogue begins — agent asks, user answers,
   agent never explains, only asks the next better question
5. After each response, a separate Evaluator chain scores
   understanding 1–5 and identifies specific gaps
6. Score updates mastery in SQLite
7. SM-2 spaced repetition calculates next review date
8. Session summary stored, next session picks weakest gap

## Tech stack
- Python 3.11+
- LangChain — chains, prompts, memory
- LangGraph — StateGraph for session flow
- SQLite — user mastery, sessions, concept map
- FastAPI — REST API layer
- React — frontend (designs coming from Stitch)
- Anthropic Claude — Sonnet (tutor) + Haiku (evaluator)

## Key constraints
- The Socratic chain must NEVER directly answer or explain
- Evaluator is a SEPARATE LLM call — not the tutor itself
- Every session must be resumable — state persists in SQLite
- SM-2 algorithm drives review scheduling, fed by LLM scores

## Folder structure
quest/
├── core/
│   ├── graph.py          # LangGraph StateGraph (Phase 3)
│   ├── chains.py         # Socratic + Evaluator chains
│   ├── memory.py         # Session summary (Phase 3)
│   └── sm2.py            # Spaced repetition algorithm (Phase 3)
├── db/
│   ├── schema.sql        # SQLite schema (Phase 2)
│   └── queries.py        # All DB operations (Phase 2)
├── api/
│   └── routes.py         # FastAPI endpoints (Phase 4)
├── prompts/
│   ├── socratic.txt      # Socratic tutor system prompt
│   └── evaluator.txt     # Understanding evaluator prompt (Phase 2)
├── concepts/
│   └── <topic>.yaml      # Hand-curated concept dependency maps
├── frontend/             # React app (Phase 5)
├── tests/
│   └── test_evaluator.py # Eval chain tests (Phase 2)
├── BRIEF.md              # This file
├── PHASES.md             # Build phases
└── main.py               # Entry point

## What Cursor should know
- Never scaffold a phase without asking which phase we're on
- Every function needs a docstring explaining what it does
  and what it returns
- No placeholder logic — if something isn't built yet,
  raise NotImplementedError with a clear message
- DB queries in queries.py only — no raw SQL anywhere else
- Prompts live in /prompts as .txt files — never hardcoded
  in Python files

# Quest — Stitch UI brief (copy-paste prompt)

Use in **Google Stitch** to generate or refine screens. Local references: `stitch_quest_socratic_ai/` (gitignored). Refine `active_session` and `catalog_of_inquiries` first — do not replace with generic chat UI.

---

## Paste this into Stitch

```
PROJECT: Quest — Socratic AI tutor (web app + Python API)

WHAT IT IS
Quest is NOT a chatbot. It is a learning engine that teaches by asking questions only.
- The tutor NEVER explains, never gives the answer, never lectures.
- After each student answer, a separate AI evaluator scores understanding 1–5 and lists specific gaps.
- Progress is stored per concept; spaced repetition (SM-2) schedules what to review next.
- Sessions pause and resume — state lives in SQLite.

WHO IT'S FOR
Developers and serious self-learners doing 20–60 minute "deep work" study sessions on technical topics (e.g. "closures in JavaScript", "binary search", "RAG pipelines").

WHAT'S ALREADY BUILT (design UI against this — backend is real)
- Topic catalog: list of topics with display name + id; Continue (resume) or New session
- Live session: one tutor question at a time; type or dictate answer; submit → evaluator → next question
- Transcript: tutor questions, user answers, evaluation cards per turn
- Session end: structured report (concepts, scores, short narrative)
- Due queue: SM-2 overdue concepts with topic name + last score
- Mastery ledger: all concepts with 1–5 scores, grouped by topic
- CLI works today; React frontend exists but needs proper visual design from Stitch

CORE USER FLOW
1. Open app → topic catalog (+ banner if concepts due)
2. Pick topic → Continue or New → active session
3. Read ONE Socratic question ("Zetetic" voice — monospace editorial block)
4. Type or dictate → Submit ("Synthesize")
5. Evaluation card (score, gaps, reasoning) — visually separate from tutor
6. Next question; repeat until complete
7. Session report → Topics or Progress ledger

DATA THE UI MUST SHOW (API shapes for realistic mocks)
Topics: { id, display_name }
Session live: { topic_display, tutor_message, waiting_for_answer, focus, done, last_evaluation }
Evaluation: { score: 1-5, gaps: string[], reasoning: string }
Transcript: tutor → user → eval → tutor …
Session report: { evaluated_answers, concepts: [{ name, last_score, scores[] }], narrative }
Due: { concept_id, name, topic, score_1_to_5 }
Mastery: { concept_id, name, topic, score_1_to_5 } grouped by topic

SCREENS TO BUILD (5 screens, mobile + desktop)

1) TOPIC CATALOG (/)
- Sidebar: Topics | Due | Progress
- Search topics
- Rows: display name, slug/id, [Continue] [New]
- Banner if N concepts due → links to Due
- Light parchment / folio aesthetic (see light tokens below)

2) ACTIVE SESSION (/session/:id) — HERO SCREEN, DARK THEME
- Full focus on learning — NOT iMessage-style chat
- Top bar: Quest wordmark, topic name, 5-square mastery indicator (current concept)
- Left sidebar ~256px (desktop): Curriculum, Library, Inquiry (active), Progress
- Center max 720px: ONE Zetetic question block
  - Label: "Active Voice: Zetetic"
  - Question: JetBrains Mono, large, readable
  - Left 2px accent border (accent color — see palette)
- Optional: current concept / focus line above question
- Sticky footer: ledger input (bottom border only), mic, "Synthesize", "CMD+Enter"
- Scroll: past turns = Zetetic blocks → user blocks → compact eval cards
- Optional 2–3% grain on dark canvas

3) SESSION COMPLETE (same route, done=true)
- "Session complete"
- Concept table + 5-block mastery bars + scores
- Evaluated answer count + narrative
- [Back to Topics] [View Progress]

4) DUE FOR REVIEW (/due)
- Title: Due today
- Rows: concept name, topic, score badge, [Go]
- Empty: All clear
- Match catalog theme (light) or dark session shell — pick one and stay consistent

5) PROGRESS / MASTERY LEDGER (/mastery)
- Grouped by topic
- Concept name + 5-square mastery bar + score
- Scholarly ledger — no charts, streaks, or gamification

DESIGN SYSTEM: "Socratic Minimalist"
Brand: "Book meets Terminal" — editorial minimalism, serious scholar tone.

Typography:
- Headlines: Playfair Display
- Body: Inter, line-height 1.6–1.7
- Questions, inputs, code: JetBrains Mono 15px
- Labels: JetBrains Mono uppercase, wide letter-spacing

COLORS — fixed neutrals (dark session — use exactly)
- Background: #14130f
- Surface low: #1d1c17
- Surface high: #2b2a25
- Deep panel: #1a1a2e
- Text: #e7e2da
- Muted text: #c8c5cd
- Borders: #47464c
- Voice / labels (lavender): #c6c4df — for "Zetetic" label, nav hints, secondary emphasis

COLORS — accent (pick ONE for CTAs, Zetetic left border, filled mastery squares, active nav, focus rings)
Default recommendation for new mocks: SAGE (calm, not gamified)
- A) Sage (recommended): #7eb8a8 — focus, thinking, long-session calm
- B) Amber (original Stitch): #e6c364 — insight / progression warmth
- C) Lavender-only: #c6c4df — quiet, minimal; strengthen borders so CTAs stay visible
- D) Copper: #c49a6c — warm editorial, less "badge gold"
- E) Monochrome: #e7e2da — accent = typography + borders only, no hue

Do NOT use as brand accent: neon green, pure red, purple/pink SaaS gradients.

COLORS — evaluation scores (separate from brand accent; semantic only)
- Score 4–5: #6ecf9a
- Score 3: same as chosen accent or #c8c5cd
- Score 1–2: #f09090

COLORS — light catalog / ledger (screens 1, 4, 5)
- Background: #faf9f7
- Ink: #1a1a1a
- Muted: #444748
- Border: rgba(26,26,26,0.1)
- Accent on light: #6c5c4c (sepia) OR reuse dark-session accent at darker shade

Layout rules:
- 0px border radius on cards and buttons (sharp, rectilinear)
- No drop shadows — depth via tonal layers + 1px borders
- Reading column max 720px centered; desktop margins 64px+
- Fixed left sidebar ~256px on desktop

Key components:
- Zetetic question block (2px left accent border + lavender label)
- 5-square mastery bar (filled = accent, empty = outline only)
- Evaluation card (distinct panel; score uses semantic colors above)
- Ledger input (underline only, JetBrains Mono)
- Primary button: off-white #e7e2da text on #1a1a1a or inverse; secondary: 1px outline

DO NOT INCLUDE:
Login/signup, streaks, leaderboards, mascots, AI avatar lecturing, rounded chat bubbles, social feed, purple gradient SaaS cards

DELIVERABLES:
- High-fidelity mockups: all 5 screens (mobile + desktop)
- Component specs: Zetetic block, mastery bar, eval card, sidebar, ledger input
- Export HTML + Tailwind per screen
- CSS variables for neutrals + chosen accent
- PRIORITY: Screen 2 (active session) first

Reference (local, refine don't discard): stitch_quest_socratic_ai/active_session, catalog_of_inquiries, mastery_ledger, concept_review
```

---

## Screen map

| Route | Screen | Stitch folder | Theme |
|-------|--------|---------------|--------|
| `/` | Topic catalog | `catalog_of_inquiries/` | Light parchment |
| `/session/:id` | Active session | `active_session/` | Dark |
| `/session/:id` | Session complete | `concept_review/` or new | Dark |
| `/due` | Due queue | `dashboard/` or new | Light (match catalog) |
| `/mastery` | Progress ledger | `mastery_ledger/` | Light |

Tokens: `stitch_quest_socratic_ai/socratic_minimalist/DESIGN.md`

---

## Accent quick reference

| Option | Hex | Mood |
|--------|-----|------|
| Sage (default in prompt) | `#7eb8a8` | Calm deep work |
| Amber | `#e6c364` | Classic Stitch / insight |
| Lavender-only | `#c6c4df` | Quiet scholarly |
| Copper | `#c49a6c` | Warm folio |
| Monochrome | `#e7e2da` | Austere terminal |

---

## API (for mocks)

```
GET  /topics
POST /sessions          body: { topic_id, mode: "resume"|"study" }
GET  /sessions/{id}
GET  /sessions/{id}/turns
POST /sessions/{id}/turn body: { response }
GET  /users/{id}/due
GET  /users/{id}/mastery
```

---

## One-line Stitch project description

Quest — Dark editorial Socratic tutor: one JetBrains Mono question at a time, separate 1–5 scorecard, no AI explanations. Sage accent on charcoal, 720px column, sharp corners, Playfair + Inter. Five screens; active session first.

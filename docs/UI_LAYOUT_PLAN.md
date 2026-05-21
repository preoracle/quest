# Quest — Layout System Plan

**Purpose:** Fix systemic UI structure (viewport, spacing, hierarchy, scroll, alignment, density) without redesigning components, adding features, or changing the visual language.

**Source audit:** Conversation audit (May 2026) — dual viewport, spacing scale, width tiers, alignment grid, header chrome budget, Session layout fork, toolbar stability, hierarchy rules, scroll map, density by task mode.

**Related docs:** [UI_DESIGN.md](./UI_DESIGN.md) (screens + visual direction), [UI_ROADMAP.md](./UI_ROADMAP.md) (feature-level UI work).

---

## Principles (non-negotiable for this effort)

1. **Two viewport modes only**
   - **Marketing** (`/`): document scroll, Lenis optional, `min-h-screen` / full-section height.
   - **Product** (all `AppShell` routes): `h-dvh`, body lock at **router layout**, one primary scroll region per route.

2. **Two content widths only**
   - **Catalog** — topic lists, due queue, progress overview (scan many items).
   - **Reading** — session, baseline, topic detail body copy (read + respond).

3. **One horizontal grid**
   - Same left/right inset for: floating header inner track, `PageScaffold` toolbar, scroll body, session zones.
   - Sidebar (`w-rail`) offsets main column; content aligns to **main column**, not viewport center.

4. **Spacing from tokens, not ad hoc**
   - No new arbitrary `py-*` / `space-y-*` on pages during this work — map to tokens only.

5. **Chrome is budgeted**
   - Header + optional toolbar height declared; list/session area gets the remainder.

---

## Layout tokens (define in Phase 0)

Add to `frontend/src/index.css` `@theme` (names are implementation targets):

| Token | Value | Use |
|-------|-------|-----|
| `--space-tight` | `0.5rem` (8px) | Inline gaps, chip padding |
| `--space-default` | `1rem` (16px) | Row internal gaps |
| `--space-section` | `1.5rem` (24px) | Between blocks in a page |
| `--space-page` | `2rem` (32px) | Page vertical padding (content area) |
| `--gutter-marketing` | `1.5rem` (24px) | Home `px-*` |
| `--gutter-app` | `1.25rem` (20px) → `2rem` (32px) at `lg` | App content horizontal |
| `--width-catalog` | `48rem` (768px) | Topics, Due lists |
| `--width-reading` | `42rem` (existing) | Session, Baseline, detail prose |
| `--width-shell` | `87.5rem` (1400px) | `AppShell` outer cap (unchanged) |
| `--chrome-header` | `3.25rem` + top margin | Floating header total offset |
| `--chrome-toolbar` | min `4.5rem`, max reserved `~12rem` | Topics/Due toolbar (see Phase 3) |

Tailwind utilities (thin wrappers):

- `max-w-catalog`, `max-w-reading` → map to tokens
- `px-gutter-app`, `py-page`, `gap-section`, etc.

**Exit (Phase 0):** Tokens exist; `UI_DESIGN.md` updated with a “Layout contract” subsection; no page behavior change yet.

---

## Route layout map (target end state)

| Route | Viewport | Width tier | Scroll container | Pinned chrome |
|-------|----------|------------|------------------|---------------|
| `/` | Marketing | `max-w-5xl` marketing grid | `document` | `SiteNav` fixed |
| `/topics` | Product | Catalog | `PageScaffold` body | Header + toolbar (stable height) |
| `/topics/:id` | Product | Reading (detail can use catalog width for cards grid — **one** inner `max-w-reading` for prose only) | `PageScaffold` body | Header |
| `/due` | Product | Catalog | `PageScaffold` body | Header + optional toolbar |
| `/mastery` | Product | Catalog | `PageScaffold` body | Header |
| `/baseline/:id` | Product | Reading | `PageScaffold` body | Header |
| `/session/:id` | Product | Reading | **Session scaffold**: pinned question, scroll history, pinned answer | Header |

**Rule:** Exactly one `overflow-y-auto` (or document) scroll per route.

---

## Phases

### Phase 0 — Contract & tokens (0.5 day)

**Goal:** Single source of truth before moving CSS.

**Tasks:**

- [ ] Add layout tokens to `index.css` `@theme`
- [ ] Add utility classes or document Tailwind theme extension in `index.css`
- [ ] Add “Layout contract” section to `docs/UI_DESIGN.md` (link this plan)
- [ ] Add checklist template for PRs: “Which viewport mode? Which width tier? Which scroll root?”

**Files:** `frontend/src/index.css`, `docs/UI_DESIGN.md`

**Exit criterion:** Tokens merged; route map agreed; no visual regressions (no page edits required).

---

### Phase 1 — Viewport boundary at router (0.5 day)

**Goal:** Body lock/unlock is reliable; no flash on navigation.

**Tasks:**

- [ ] Create `AppLayout` route wrapper: sets `data-app-shell` on mount, clears on unmount
- [ ] Remove `useEffect` body dataset from `AppShell.tsx` (shell only renders chrome)
- [ ] Wrap protected routes in `App.tsx` with `AppLayout` + `Outlet` (or per-route wrapper)
- [ ] Verify Home never sets `data-app-shell`
- [ ] Align `ClerkEnvGuard` loading states: `min-h-dvh` where appropriate, no conflicting `overflow` on body

**Files:** `frontend/src/App.tsx`, new `frontend/src/layouts/AppLayout.tsx`, `frontend/src/components/AppShell.tsx`, `frontend/src/components/ClerkEnvGuard.tsx`

**Exit criterion:**

- Navigate `/` → `/topics` → `/` → `/session/...` — no full-page document scroll on product routes; Home scrolls normally.
- No double scrollbars on Topics at `1280px` and `390px` width.

---

### Phase 2 — Shared content grid (1 day)

**Goal:** Header, toolbar, and content share one vertical alignment line.

**Tasks:**

- [ ] Introduce `ContentColumn` (or extend `PageScaffold`) with props: `tier: 'catalog' | 'reading'`, applies `max-w-*` + `px-gutter-app`
- [ ] Refactor `app-header-floating` inner wrapper to use same horizontal padding as content column (account for `lg` sidebar: padding-left = gutter only in main column; header already inside main column)
- [ ] Replace per-page `max-w-3xl` / `max-w-4xl` / `max-w-5xl` / `max-w-2xl` with `catalog` or `reading` tier only
- [ ] Home: set `--gutter-marketing` to match app gutter values (or document intentional delta)

**Files:** `PageScaffold.tsx`, new `ContentColumn.tsx` (optional), `AppShell.tsx`, all `pages/*` using `PageScaffold`

**Mapping:**

| Page | Tier |
|------|------|
| Topics, Due, Mastery | `catalog` |
| Topic detail (outer), Baseline, Session | `reading` |
| Mastery drill-down graph | `catalog` (graph needs width; prose labels stay compact) |

**Exit criterion:**

- At `1440px`, left edge of search input, first topic row title, and header title align within **4px**.
- Topics and Due use same content width.

---

### Phase 3 — Spacing rhythm pass (1 day)

**Goal:** Vertical rhythm feels intentional, not page-by-page.

**Tasks:**

- [ ] Replace toolbar `py-4` / content `py-8` with `py-page` / `gap-section` tokens in `PageScaffold`
- [ ] Standardize section headings: one spec (`font-mono`, `10px`, `tracking`, `mb-2`) in a shared `SectionLabel` utility class (CSS only, not new component if avoiding redesign — a `@utility section-label` is enough)
- [ ] List pages: `space-y-2` between rows, `space-y-section` between sections (Topics “Pick up” / “Library”)
- [ ] Empty states: one `py-page` vertical centering spec (not `py-16` vs `py-20` mix)

**Files:** `PageScaffold.tsx`, `TopicsPage.tsx`, `DuePage.tsx`, `MasteryPage.tsx`, `TopicDetailPage.tsx`, `index.css`

**Exit criterion:**

- Side-by-side screenshot Topics + Due: section gaps and page padding match.
- No new raw `space-y-10` / `mt-10` introduced without token mapping.

---

### Phase 4 — Session scaffold unification (1 day)

**Goal:** Session follows the same gutters, width, and scroll rules as reading routes.

**Tasks:**

- [ ] Add `SessionScaffold` (or `PageScaffold` slots: `pinnedTop`, `scroll`, `pinnedBottom`) using reading tier + gutter tokens
- [ ] Migrate `SessionPage.tsx` off duplicated `px-5 lg:px-8` / `max-w-reading` blocks
- [ ] `AnswerBar`: use `max-w-reading` token class, `shrink-0` footer (drop redundant `sticky` if footer is flex sibling)
- [ ] Document scroll: history pane only; question + answer pinned

**Files:** `SessionPage.tsx`, `AnswerBar.tsx`, new `SessionScaffold.tsx` or extended `PageScaffold.tsx`

**Exit criterion:**

- Session question, transcript, and answer field share the same width at all breakpoints.
- Resizing viewport: answer bar always visible; history scrolls; header does not scroll away.

---

### Phase 5 — Chrome height & toolbar stability (0.5–1 day)

**Goal:** Topics “New topic” and filter wrap do not jump the list.

**Tasks:**

- [ ] Decide toolbar policy: **(A)** reserve `min-height` on toolbar stack for expanded create panel, or **(B)** scroll toolbar+list together (toolbar inside scroll — loses sticky filters). **Recommend (A)** for scan UX.
- [ ] Implement `min-h-toolbar` on toolbar container when create panel can open
- [ ] Filter row: `flex-nowrap` + horizontal scroll on narrow screens instead of wrap (layout only)
- [ ] Header: either add `padding-top` on `PageScaffold` equal to `--chrome-header` if overlay, or keep in-flow but document total chrome in devtools checklist

**Files:** `TopicsPage.tsx`, `PageScaffold.tsx`, `CreateTopicPanel.tsx` (animation only — no visual redesign), `index.css`

**Exit criterion:**

- Open/close “New topic” 10 times: list scroll position stable OR predictable; no layout shift > 8px on search row.
- Filter chips stay on one row at `375px` (horizontal scroll acceptable).

---

### Phase 6 — Hierarchy rules (0.5 day)

**Goal:** One primary title per screen; shell does not compete.

**Tasks:**

- [ ] **Topics / Due / Mastery:** Shell shows wayfinding only — remove duplicate `pageTitle` `h1` OR demote to `sr-only` / breadcrumb; sidebar already indicates section
- [ ] **Topic detail:** Shell `topicLabel` → breadcrumb (`Topics / Binary Search`) at reading size OR hide shell title; page hero owns `h1`
- [ ] **Session:** Shell shows topic name + Live badge only; no second title in content above question
- [ ] Unify section labels via shared utility class

**Files:** `AppShell.tsx`, `TopicDetailPage.tsx`, `TopicsPage.tsx`, `DuePage.tsx`, `MasteryPage.tsx`, `SessionPage.tsx`

**Exit criterion:**

- axe / manual check: one `h1` per route.
- Visual pass: primary focus is always content block, not header strip.

---

### Phase 7 — Density alignment (0.5 day)

**Goal:** Catalog surfaces feel equally dense; reading surfaces stay calm.

**Tasks:**

- [ ] Catalog row height target: document `min-h` for `TopicRow` / Due rows (layout only — e.g. actions in one row vs column if column breaks alignment spec from Phase 2)
- [ ] Widen catalog tier if `48rem` still leaves excessive dead space inside `1400px` shell — tune token, not per-page classes
- [ ] Mastery summary cards: same horizontal padding as catalog lists

**Files:** `TopicRow.tsx`, `DuePage.tsx`, `MasteryPage.tsx`, tokens

**Exit criterion:**

- Topics + Due: ≥1 more visible rows on `900px` tall viewport than before Phase 7 (measure in browser).
- Mastery at same width tier as Topics.

---

### Phase 8 — QA & regression guard (0.5 day)

**Tasks:**

- [ ] Manual matrix: routes × viewports (`390`, `768`, `1280`, `1440`)
- [ ] `npm run build` clean
- [ ] Update `docs/UI_ROADMAP.md` — add “Layout system” shipped section
- [ ] Optional: short `docs/UI_LAYOUT_CHECKLIST.md` for future PRs (or appendix in this file)

**Exit criterion:**

- Matrix signed off.
- No open **High** severity items from audit remaining.

---

## Suggested schedule

| Phase | Effort | Depends on |
|-------|--------|------------|
| 0 Contract & tokens | 0.5d | — |
| 1 Viewport boundary | 0.5d | 0 |
| 2 Content grid | 1d | 0, 1 |
| 3 Spacing rhythm | 1d | 2 |
| 4 Session scaffold | 1d | 2 |
| 5 Toolbar stability | 1d | 2, 3 |
| 6 Hierarchy | 0.5d | 2 |
| 7 Density | 0.5d | 2, 3 |
| 8 QA | 0.5d | all |

**Total:** ~6–7 focused days (can parallelize 4+6 after 2; 5 after 3).

**Recommended order:** `0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8`

---

## Out of scope (explicit)

- New features (modals, recommendations, graphs)
- Color palette, fonts, card style, header gradient redesign
- Component API redesign (TopicRow content, CreateTopicPanel copy)
- Clerk user ID wiring
- Backend session API changes

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Home breaks again (locked scroll) | Phase 1 exit tests include `/` ↔ `/topics` |
| Session regression | Phase 4 dedicated; test active + complete states |
| Token churn conflicts with Tailwind v4 | Define in `@theme` only; thin utilities |
| Scope creep into “redesign” | PR template: layout-only diff; no `variant` / color changes |

---

## Definition of done (program level)

- [x] All routes match **Route layout map** (implemented May 2026)
- [x] Spacing uses **layout tokens** (`py-page`, `gap-section`, `section-label`, etc.)
- [x] **Two widths** + **two viewport modes** documented in `UI_DESIGN.md`
- [x] Audit **High** items addressed in code
- [x] `UI_ROADMAP.md` updated

---

## PR strategy

Prefer **one PR per phase** (or 0+1 combined) for reviewability:

1. `layout/tokens-and-contract`
2. `layout/app-viewport-boundary`
3. `layout/content-grid`
4. `layout/spacing-rhythm`
5. `layout/session-scaffold`
6. `layout/toolbar-stability`
7. `layout/hierarchy`
8. `layout/density-qa`

Each PR description must state: viewport mode, width tier, scroll root, and screenshot at `1280px`.

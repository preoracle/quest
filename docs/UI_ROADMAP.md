# Quest UI — improvement roadmap

## Screens

| Route | Screen |
|-------|--------|
| `/` | Home |
| `/topics` | Topics catalog + create/import |
| `/baseline/:topicId` | Calibrate (≤5 concepts) |
| `/session/:id` | Study (+ summary when done) |
| `/due` | Review queue |
| `/mastery` | Progress overview + graph drill-down (`?topic=`) |

## Shipped

- [x] Session layout: pinned question + answer; scrollable history only
- [x] Topic actions: Resume / New session / Fresh run / Calibrate
- [x] Create topic: `POST /topics/generate` + Upload YAML `POST /topics/import`
- [x] Baseline: `POST /baseline` + `POST /baseline/{id}/answer`
- [x] Progress summary cards: `GET /users/{id}/progress/summary`
- [x] Concept DAG: `GET /topics/{id}/graph` + SVG on Progress drill-down
- [x] Leave session link, expandable eval in history, home copy for Resume vs New session

## Layout system (structural — see [UI_LAYOUT_PLAN.md](./UI_LAYOUT_PLAN.md))

- [x] Phase 0: Layout tokens + contract in `UI_DESIGN.md`
- [x] Phase 1: Router-level viewport boundary (`AppLayout`, body lock)
- [x] Phase 2: Shared content grid (catalog vs reading width; header alignment)
- [x] Phase 3: Spacing rhythm pass (`PageScaffold` + list pages)
- [x] Phase 4: Session scaffold (same gutters/width as reading routes)
- [x] Phase 5: Toolbar stable height (Topics create panel slot)
- [x] Phase 6: Hierarchy rules (breadcrumb / topic session; page owns `h1`)
- [x] Phase 7: Catalog density alignment (Topics, Due, Mastery @ `max-w-catalog`)
- [x] Phase 8: Build verified

## Later

- [ ] Review row opens study focused on that concept (needs `focus_concept_id` in API)
- [ ] Session history timeline chart
- [ ] Baseline optional before first study (prompt on Topics)

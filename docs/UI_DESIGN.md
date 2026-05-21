# Quest — Web UI

Product-first design. **Not a chat app.** The tutor asks; a separate model scores; mastery and SM-2 drive what you study next.

## Screens

| Route | Screen | What the user does |
|-------|--------|-------------------|
| `/` | **Home** | Learn what Quest is; start studying or see due count |
| `/topics` | **Topics** | Search catalog; **Resume** or **New** session per topic |
| `/session/:id` | **Study** | One question in focus; answer; see scorecard; repeat until done |
| `/session/:id` (done) | **Summary** | Same route when complete — concept scores + narrative |
| `/due` | **Review** | SM-2 queue — concepts overdue for review |
| `/baseline/:topicId` | **Calibrate** | Up to 5 baseline probes; seeds mastery |
| `/mastery` | **Progress** | Summary cards → topic graph + concept list (`?topic=id`) |

## Visual direction

**Warm studio dark** — void canvas, gold accent (`#d4a853`), Fraunces + Plus Jakarta Sans + IBM Plex Mono, mesh gradients, rounded cards with soft shadows. Landing: preloader, hero, 3-step “how it works”, feature grid. Study: question card + timeline history + evaluator scorecards (not chat).

## Layout contract (implementation)

Structural work is tracked in **[UI_LAYOUT_PLAN.md](./UI_LAYOUT_PLAN.md)**. Summary:

- **Marketing** (`/`): document scroll; no `data-app-shell`.
- **Product** (`AppShell` routes): `h-dvh`, body lock at router layout, one scroll root per route.
- **Widths:** `catalog` (lists) vs `reading` (session, baseline, prose) — no per-page `max-w-*` variants.
- **Grid:** one horizontal gutter for header, toolbar, and content in the main column.

## Stack

- React + Vite + Tailwind v4
- shadcn-style primitives (`Button`, `Input`, `Badge`, …)
- Framer Motion (entrances, hero text)
- Lenis (smooth scroll on Home only)

## Study view layout

1. **Hero** — current tutor question (large mono, subtle glow)
2. **History** — prior Q → your answer → evaluation cards (compact)
3. **Footer** — answer field + submit (not “chat send”)

Evaluator UI is always a distinct **scorecard**, never styled like the tutor.

## UI skills (Cursor)

Curated design-engineer skills: **[ui-skills.com](https://www.ui-skills.com/)**. Install into `.cursor/skills/<name>/` (or personal `~/.cursor/skills/`) when polishing the frontend.

| Skill | Use on Quest for |
|-------|------------------|
| [frontend-design](https://www.ui-skills.com/skills/anthropics/frontend-design) | Distinct visuals, avoid generic AI UI — **already in** `.cursor/skills/frontend-design/` |
| [shadcn](https://www.ui-skills.com/skills/shadcn-ui/shadcn) | Adding/composing Radix + shadcn components correctly |
| [baseline-ui](https://www.ui-skills.com/skills/ibelick/baseline-ui) | Tailwind consistency, typography scale, motion duration guardrails |
| [fixing-accessibility](https://www.ui-skills.com/skills/ibelick/fixing-accessibility) | Forms, focus, ARIA, contrast on Study + Topics |
| [fixing-motion-performance](https://www.ui-skills.com/skills/ibelick/fixing-motion-performance) | Framer Motion / Lenis jank, compositor-only animations |
| [emil-design-eng](https://www.ui-skills.com/skills/emilkowalski/emil-design-eng) | Micro-interactions, component polish |
| [make-interfaces-feel-better](https://www.ui-skills.com/skills/jakubkrehel/make-interfaces-feel-better) | Typography + tactile feedback passes |
| [12-principles-of-animation](https://www.ui-skills.com/skills/raphaelsalaja/12-principles-of-animation) | Hero / scorecard / list entrance motion |
| [impeccable](https://www.ui-skills.com/skills/pbakaus/impeccable) | Anti-generic production UI audits |
| [wcag-audit-patterns](https://www.ui-skills.com/skills/wshobson/wcag-audit-patterns) | WCAG 2.2 pass before shipping |

**Lower priority for Quest:** `interface-design` (SaaS dashboards), `ui-ux-pro-max` (broad palette explorer), `frontend-slides`, `swiftui-ui-patterns`.

**Deprecated for this repo:** `docs/STITCH_UI_PROMPT.md` — do not use for new UI work.

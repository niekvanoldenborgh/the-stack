# Figma source files

Node ids mapped from the duplicated kits, so a future session can go straight to
the content instead of spending rate-limited calls rediscovering it.

**Read `get_metadata` without a `nodeId` returns only the first page.** Every kit
here puts a Cover on page one, which makes the file look empty. Always query a
known node id directly.

---

## Full charts components (Copy)

`xLXzDXKzpkXIXIYqaXvbu7`

| Node | What it is |
|---|---|
| `1:19` | Cover (page one — ignore) |
| `0:1` | **`🎨 Design`** — the real page |
| `1:3` | `Card-chart-layout-monochromatic` — 35 chart cards, greyscale variant |
| `22:2294` | Same 35 cards, colour variant |
| `22:3690` | `Colors guide` — includes a 9-swatch palette at `1:4` |

The cards are **360px wide**, which is mobile width — directly comparable to
this app's charts rather than desktop dashboard widgets. A representative
sample of individual cards: `1:539`, `1:541`, `1:545`, `1:547`, `1:654`,
`1:1546` (the one double-width card, 745px), `2:1013`, `18:1833`.

Worth pulling next: `22:3690` for the actual palette hexes, and two or three
cards via `get_design_context` for exact padding, label placement and axis
treatment.

---

## Fitness App UI Kit (Copy)

`treWKle8W1gql6wJHPKJGU`

| Node | What it is |
|---|---|
| `3263:101` | Cover (page one — ignore) |
| `3032:2305` | The full 93-screen board, 8357 × 20019 |

Rendered whole it is unreadable — screenshot individual screens instead. Get
its children with `get_metadata` on `3032:2305` first, then target the progress
tracking and workout log screens.

Dark themed, purple with an acid-lime accent very close to this app's own
`#C9F24D`.

---

## Medical / Dermatology UI Kit

`MO25GM6tPq1IvHJE7XtzOM` — fully accessible, page `0:1`, 37 screens at 360×800.

Already mined for the dashboard schedule patterns (see `src/ui/schedule.tsx`).

| Node | Screen | Used |
|---|---|---|
| `37:626` | Home | ✅ week strip, timeline |
| `15:791` | All appointment — Upcoming | ✅ meta chips, compact actions |
| `17:8` | Details | ✅ confirmed our spec-table pattern already matches |
| `13:752` | Schedule | not yet — relevant to the cycle planner |
| `12:5` | Profile | not yet — relevant to the Me tab |
| `22:675` | Settings | not yet |
| `14:299` | Notification | not yet — relevant to dose reminders |
| `42:1424` | Review summary | not yet — relevant to the recommendation screen |

# The Stack

An iOS and Android app for people using peptides, built as a **harm-reduction and protocol-reference tool** rather than a recommendation engine that hands out prescriptions.

It builds a personalised stack from your goals, body data and risk appetite, checks it against anything you are already running, plans the cycle, alarms every dose, and generates a training programme that accounts for what you are on.

---

## Running it

```bash
npm install
```

```bash
npx expo start
```

Then scan the QR code with **Expo Go**, or press `a` for an Android emulator, `i` for an iOS simulator (macOS only), or `w` for the browser.

### Windows / first-run

`node_modules/` is committed to this repo, so a fresh clone *looks* installed — but the committed tree only carries native binaries for the platforms the team develops on (macOS arm64, Linux x64). It does not carry the Windows binary for `lightningcss` (Expo's web CSS transformer). **Run `npm install` before anything else, even on a fresh clone** — it fetches the binary for your platform from `package-lock.json`, which does list every platform.

Skipping this shows up as a Metro error partway into the first bundle rather than at clone time, for any of:

```bash
npm run onboarding
npm run demo
npm run preview
```

`scripts/with-env.mjs`, which all three run through, checks that the current platform's native binary resolves before starting Metro and fails fast with a plain "run `npm install`" message if it doesn't.

Verification:

```bash
npm run typecheck && npm test
```

`npm test` compiles the pure engine modules to `.test-build/` and runs 84 unit tests against them with the Node test runner.

Regenerate app icons after editing `assets/brand/logo.svg`:

```bash
npm run icons
```

### Running the backend

The auth API lives in `server/` — a separate `npm install`, deliberately
kept out of the client bundle (see `AGENTS.md` "Layering"). Bring it up
with Docker Compose from the repo root:

```bash
cp server/.env.example server/.env   # fill in DB_*, JWT_SECRET, SESSION_IP_PEPPER
cp .env.example .env                 # EXPO_PUBLIC_API_BASE_URL for the app
docker compose up --build
```

This applies pending migrations and starts the API against them (never the
other way around); see `server/README.md` for what it still doesn't solve
(a reachable MySQL host, TLS, CORS).

---

## What it does

**Personalised stack generation.** Scores all 31 compounds against your weighted goals, drops anything medically contraindicated, refuses any combination with a high or critical interaction, and caps stack size by experience and risk setting.

**"The stack we recommend."** After onboarding you land on a dedicated results screen with the reasoning, the interaction checks, and a live risk dial. Nothing is saved until you accept it.

**An adjustable risk dial (1–5).** Moves your dose within each compound's published range — level 1 targets the published minimum, level 5 the published maximum. It changes **amounts only**: which compounds you are offered is decided by your goals, health history and the interaction rules, and turning the dial up does not unlock a riskier catalogue. It cannot go past the published maximum, either.

**Current-use awareness.** Tell it what you are already running and everything recommended is checked against it: no duplicate pharmacological classes, no conflicting compounds, and a separate list of interactions between the new stack and your existing one.

**Dose personalisation.** Bodyweight scales per-kg compounds. Experience, age, activity and sleep apply multipliers. Everything is clamped to the published range and then to an absolute ceiling. Each adjustment is shown to the user in plain English.

**Cycle planner.** Titration ramps, on-cycle blocks and washouts per compound, with a visual timeline and a shiftable start date.

**Dose alarms.** A rolling window of local notifications, re-synced whenever the plan changes, carrying the amount, route and fasting instruction.

**Interaction checking.** 18 rules matching on compound id or pharmacological class, at four severities. Critical findings block a stack from being saved.

**Workout planner and tracker.** Split selection, exercise filtering by technical demand and joint stress, sets and reps by goal, session logging, estimated-1RM trends and double-progression load suggestions.

**Analytics.** Weekly training volume, per-lift strength trend, weekly sets per muscle group, dose adherence, and side effects bucketed by week. The last one is the point: plotted against a cycle that titrates upward, it turns "I think the headaches started around week three" into something you can show a doctor.

---

## Safety design

These are deliberate product decisions, not gaps:

| Decision | Why |
|---|---|
| The risk dial **cannot** exceed a published dose | It interpolates between published anchors (minimum → typical → maximum) rather than multiplying past them. There is no data above the published maximum to personalise against, so the engine will not go there |
| The risk dial changes **dose only** | Selection, stack size and exclusion reasons are identical at every setting. A dial that quietly unlocked compounds would mean the safest setting hid information from you, and the boldest one buried a decision inside a slider |
| Age warns rather than blocks | A blanket refusal told younger users nothing except that the app would not talk to them. Instead, under-25 / under-21 / under-18 each produce a graded, specific warning on growth-hormone and IGF compounds, those compounds are ranked down, and the under-18 notice explains that IGF-1 acts directly on open growth plates and the change is permanent |
| Some compounds show **no dose at all** | IGF-1 LR3, somatropin and follistatin-344. `doseGuidanceWithheld` also excludes them from auto-generation and from the reminder schedule, at every risk setting |
| Critical interactions cannot be saved | The one thing the builder will not let you override — including clashes with what you are already taking |
| Every compound is labelled with regulatory status and evidence tier | A→D, from human RCTs down to anecdote — on every card, never buried |
| Goals get a "reality check" | The largest source of harm is chasing an outcome a compound cannot deliver, then escalating the dose |
| Negative goal fit is modelled | GLP-1s score −5 for weight gain; GH secretagogues score −3 for acne control. Treated as penalties, not as neutral |
| Reconstitution calculator | Confusing milligrams with syringe units is a leading cause of real-world 10× overdoses |

---

## Architecture

```
app/                         Expo Router routes
  onboarding/index.tsx       7-step intake: disclaimer, body, lifestyle,
                             goals, current use, health, risk
  recommendation.tsx         "The stack we recommend", with the live risk dial
  (tabs)/                    Today · Stack · Library · Train · Me
  peptide/[id].tsx           Compound detail, dose derivation, reconstitution
  builder.tsx                Custom stack builder with live safety panel
  safety.tsx                 Full safety report
  session/[id].tsx           Workout logger

src/
  domain/                    Data. No logic.
    types.ts                 Every dose carries its unit on the same record
    peptides/                31 compounds across 4 category files
    interactions.ts          Pairwise rules, matched by id or class
    goals.ts                 Goals, health flags, conflicts, risk levels
    exercises.ts             45 exercises
  engine/                    Pure functions. No React, no storage, no RN imports.
    dosing.ts                Risk targeting, personalisation, rounding,
                             titration, reconstitution
    safety.ts                Interactions, contraindications, age notices,
                             stack notices, risk score
    recommend.ts             Constrained greedy generation, current-use aware
    cycle.ts                 Phase timelines and dose scheduling
    workout.ts               Programme generation and progression
  store/useAppStore.ts       Zustand + AsyncStorage (migrating persist schema)
  ui/                        Theme, components, RiskPicker, iconography
  lib/                       Dates, notifications

assets/brand/logo.svg        Single source for every raster icon
scripts/generate-icons.mjs   SVG → app icon, adaptive icons, splash, favicon
```

The `engine/` and `domain/` layers import nothing from React Native. That is what makes them directly unit-testable, and it is worth preserving — these are the modules that produce dose numbers.

---

## Design

The reference points are instrument readouts and safety data sheets, not wellness apps. This is software that shows you microgram figures and tells you when to stop, so it should read like something calibrated.

**Typeface — one family, split by weight, plus a dedicated mono.** All bundled locally, all SIL OFL. Replaces the earlier Bricolage Grotesque + IBM Plex Sans split as of THEA-56 direction A ("Clinical Light").

| Role | Family | Why |
|---|---|---|
| Display & reading text | **Inter** 700 / 600 / 400 | One family from the largest metric to the smallest label — 700 for headings, 600 where the old theme used a "medium" weight, 400 for reading text |
| Every quantity | **IBM Plex Mono** 500 / 600 | Doses, units, syringe counts and section labels. Figures line up in columns and digits do not shift width as a value animates |

Imported per weight, never through a package's barrel entry — those eagerly require every face they ship (Inter's costs ~6 MB) and Metro does not tree-shake them.

Each weight is a separate font family, so **`fontWeight` must never be set alongside `fontFamily`** — doing both makes Android fall back to the system font and makes react-native-web paint a synthetic faux-bold over an already-bold face. Use `fonts.sansMedium` from `src/ui/theme.ts` instead.

**Colour.** Ink (`#14171F`), not black, on white and near-white (`#FFFFFF`/`#F6F7F9`), rather than true black and white — easier over long reading and stays short of #000/#FFF harshness while still reading as unambiguously light. One deep-teal accent (`#0F766E`), deliberately kept clear of the severity scale — colour is load-bearing information here, so the brand colour must never be mistakable for a warning colour. Severity runs rose → orange → amber → sky, re-tuned for AA contrast on white.

**Motion.** One orchestrated cascade per screen (`<Reveal index>`), not micro-interactions everywhere. Built on the core `Animated` API rather than Reanimated layout animations, which are the least reliable part of a single-bundle iOS/Android/web story. Two failure modes are guarded: `useNativeDriver` is platform-gated because it silently no-ops on web, and a hidden browser tab (where `requestAnimationFrame` never fires) resolves straight to the final state — an animation that gates opacity must never be able to strand content invisible.

**Backgrounds.** Faint graph-paper ruling plus an accent wash bleeding down from the header (`src/ui/atmosphere.tsx`). Both sit at very low opacity and are `pointerEvents="none"`, so they add depth without competing with safety-critical text.

**Charts.** Plain Views, no charting library and no SVG dependency — every form is rectangles on a baseline, which layout expresses exactly. Marks are thin with 4px rounded data-ends anchored to the baseline, a 2px surface gap between adjacent marks and stacked segments, recessive axes, and only the peak direct-labelled. A zero renders as a 2px stub so an empty slot reads as "nothing happened" rather than "no data", and every mark carries its own figure as an `accessibilityLabel`.

Charts carry their **denominator**. A `track` prop draws the reference quantity — doses scheduled, sets programmed — as a muted rail behind each bar, because adherence and volume are ratio quantities and scaling to the largest observed value throws the denominator away: 1 of 1 and 1 of 4 would otherwise render identically. A `threshold` prop adds a dashed reference rule labelled inline on the rule itself, so a reference level needs no legend.

**`RangeBar`** plots a derived dose inside its published range. This is the most safety-critical relationship in the app — am I at the bottom of what has been published, the middle, the top, or outside it — and it used to be two separate pieces of text the reader had to compare arithmetically. The unit is repeated at *both* ends rather than stated once in a heading, because compounds here are dosed in mcg, mg, IU and percent and often sit next to each other. Position carries magnitude; severity colour appears only if the dose leaves the interval, which the engine should make impossible.

Strength trends are **small multiples** — one sparkline per lift — rather than one multi-series chart. That was a deliberate reversal: a four-hue categorical palette validated against the dark surface failed on two pairs (orange↔lime at ΔE 0.8 for deuteranopia, violet↔blue below the normal-vision floor). Small multiples need no categorical palette at all, so there is no colourblind collision to design around, and each lift stays directly labelled — which also reads far better at 375px wide.

**Scheduling patterns.** The dashboard's week selector, the time-gutter timeline, the inline metadata chips and the compact confirm/dismiss actions are adapted from the appointment screens of the [Medical Health Mobile App / Dermatology UI Kit](https://www.figma.com/community) (Figma Community), pulled in over the Figma MCP. The layout ideas transferred; the palette did not — that kit is blue-on-white and this app is ink and teal, so every piece is rebuilt on our own tokens in `src/ui/schedule.tsx`.

The one that changed the app most is the week strip. The dashboard previously showed only today, which made it impossible to see a dose coming or check what was missed yesterday without leaving the screen — and it hid the fact that a 5×/week compound simply is not there at the weekend.

**Brand mark.** Three layers widening downward — a stack built from a stable base. Authored once in `assets/brand/logo.svg` and rasterised to every required size by `npm run icons`. In-app it is drawn with plain Views (`<Logo />`), so it stays crisp at any size with no SVG dependency.

**Iconography.** `@expo/vector-icons`, which ships the fonts locally. Route glyphs (needle, pill, lotion, spray) make a dose list scannable in a way the word "subcutaneous" in small grey text never is.

---

## Data model notes

Dose values are never converted implicitly. A `Dose` is `{ value, unit }` and is only ever compared or formatted against the same unit. Topical cosmetics use `pct` rather than an absolute amount.

`goalFit` runs −5 to 5. Absent goals score 0.

Cycle scheduling is date-string based rather than instant-based, so a Tuesday dose stays on Tuesday across DST and timezone changes. Wall-clock times are attached only at notification-scheduling time.

---

## Not medical advice

Dose figures come from published drug labels, trial protocols, or documented community conventions, and each compound lists which. Personalisation adjusts *within* those published ranges — it never extrapolates beyond them. This app does not replace a clinician, and for prescription compounds it is a reference, not a supply route.

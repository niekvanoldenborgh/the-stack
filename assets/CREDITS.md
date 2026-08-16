# Asset credits

Third-party UI/UX assets used in this app, their license, and attribution status.
See THEA-42 (parent: THEA-37 Design) for the sourcing pass this records.

## Icons — Lucide

- **Source:** https://lucide.dev via the `lucide-react-native` npm package
- **License:** ISC — free for commercial use, no attribution required
- **Attribution status:** none required; none given
- **Usage:** the *only* icon family in this app (`src/ui/icons.tsx`). Never mix
  with another icon set or with emoji — see AGENTS.md.

## Illustrations — unDraw

- **Source:** https://undraw.co, pulled from the
  [balazser/undraw-svg-collection](https://github.com/balazser/undraw-svg-collection)
  mirror (raw SVGs, MIT-licensed packaging; the underlying artwork is unDraw's
  own open license — free for commercial use, no attribution required)
- **License:** unDraw open license (no attribution required); mirror
  packaging is MIT
- **Attribution status:** none required; none given
- **Recolor:** every swappable theme fill — the mirror's
  `var(--primary-svg-color)` marker plus any other non-neutral, non-skin-tone
  literal fill — was mapped to the single brand accent `#C9F24D`. Structural
  ink (`#2f2e41` / `#3f3d56`), neutral greys and the inclusive skin-tone
  palette (`#a0616a`, `#ffb8b8`, …) were left untouched, so recoloring never
  erases a figure's skin tone. Optimized with `svgo --multipass` (~30-35%
  size reduction).
- **Files:** `assets/illustrations/*.svg` (source of truth) and
  `src/ui/illustrations.tsx` (runtime copy, rendered via
  `react-native-svg`'s `SvgXml` — there is no `react-native-svg-transformer`
  configured in this project, see AGENTS.md, so raw `.svg` files cannot be
  imported as components without a Metro config change we chose not to make
  for this pass)

| Key (`IllustrationName`) | unDraw source file | Used for |
|---|---|---|
| `onboarding` | `onboarding.svg` | "Complete onboarding" empty states |
| `noStack` | `empty-street.svg` | "No active stack" empty states |
| `logEntries` | `note-list.svg` | "Nothing logged yet" empty states |
| `noMatch` | `progress-tracking.svg` | "Nothing cleared the bar" (filtered-to-empty) states |

Wired into: `app/safety.tsx`, `app/analytics.tsx`, `app/(tabs)/calendar.tsx`,
`app/recommendation.tsx` (both empty states). **Not yet wired** into
`app/(tabs)/index.tsx`, `app/(tabs)/logger.tsx`, `app/(tabs)/results.tsx` —
those files were being actively edited by the concurrent THEA-40 Phase-2
rollout at the time of this pass; `logEntries`/`onboarding`/`noMatch` are
ready for those screens' `EmptyState` call sites once that work lands.

## Evaluated, not adopted this pass

- **Phosphor** (MIT) — considered as an alternative icon family for
  weight/duotone variants. Not adopted: AGENTS.md requires exactly one icon
  family per app, and Lucide was already in place from THEA-38.
- **Open Peeps / Humaaans / Open Doodles** (CC0) — good fit for future
  onboarding/human-moment illustrations. Not pulled in this pass; no
  onboarding screen currently calls for a human figure beyond what unDraw's
  `onboarding.svg` already covers.
- **Servier Medical Art** (CC BY 4.0 — attribution required) — 3,000+
  scientific/anatomy vectors for mechanism diagrams. Not adopted: nothing in
  the current screens needs an anatomy/mechanism diagram, and any future use
  requires (a) a visible credits line and (b) a Product & Safety pass, since
  an anatomy illustration can read as a medical/efficacy claim.
- **Figma Community health/fitness kits** ("Health Dashboard UI Kit", "Goals
  — Fitness App UI Kit", "Free Fitness Tracker UI") — layout/IA reference
  only, per AGENTS.md ("adapt layout from a kit, never its palette"). No
  assets extracted from these; nothing to credit.

## Fonts — no change

IBM Plex Sans (SIL OFL), already shipped. Unchanged by this pass — see
AGENTS.md for the per-weight import rule.

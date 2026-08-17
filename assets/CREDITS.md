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

- **Source:** https://undraw.co. Raw SVG bytes were pulled via the
  [balazser/undraw-svg-collection](https://github.com/balazser/undraw-svg-collection)
  GitHub mirror as a sourcing convenience.
- **License:** governed by unDraw's own artwork license
  (https://undraw.co/license), *not* any license the mirror repo declares
  for itself. Correction (THEA-43 audit): an earlier version of this entry
  said the mirror's MIT license covered "packaging" only, implying the
  artwork was separately unDraw-licensed. That undersold what the mirror
  claims — its README states "The SVGs in this repository are provided
  under the MIT License," i.e. MIT over the artwork files too. We don't
  rely on that claim either way: a redistribution mirror can't unilaterally
  relicense someone else's copyrighted illustrations by declaring its own
  repo MIT, so the license that actually governs our use is unDraw's own,
  quoted next.
  unDraw's license grants "a nonexclusive, worldwide copyright license to
  download, copy, modify, distribute, perform, and use the assets provided
  from unDraw for free, including for commercial purposes," no attribution
  required. It restricts using unDraw assets to replicate/compete with
  unDraw, and restricts redistributing the illustrations as a standalone
  pack — using individual illustrations inside this app's UI, as we do, is
  the permitted case; reselling or repackaging the illustration set itself
  is not. (It also bars AI/ML training use, not relevant here.)
- **Attribution status:** none required; none given
- **Recolor:** every swappable theme fill — the mirror's
  `var(--primary-svg-color)` marker plus any other non-neutral, non-skin-tone
  literal fill — was mapped to the single brand accent `#0F766E` (teal,
  THEA-56 direction A; was `#C9F24D` prior to that pass). Structural
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

## Fonts

- **Inter** (400/500/600/700/800) — the only sans face, used for both body
  and heading, replacing Bricolage Grotesque + IBM Plex Sans as of THEA-56
  direction A. THEA-69 (PULSE) added the 500 and 800 weights on top of the
  400/600/700 THEA-56 shipped with.
  - **Source:** https://rsms.me/inter via the `@expo-google-fonts/inter`
    npm package.
  - **License:** SIL Open Font License 1.1 — free for commercial use, no
    attribution required. Licence text ships in
    `node_modules/@expo-google-fonts/inter/LICENSE_FONT`.
  - **Attribution status:** none required; none given.
- **IBM Plex Mono** — retired by THEA-69 (PULSE). Quantities/units now use
  Inter with `fontVariant: ['tabular-nums']` instead of a separate mono
  face — see `src/ui/theme.ts`. No longer imported in `app/_layout.tsx`.
- **Bricolage Grotesque** — fully removed by THEA-56 direction A; no
  longer shipped or imported.

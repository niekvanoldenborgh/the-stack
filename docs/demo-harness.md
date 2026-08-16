# Demo simulation harness

A dev-only way to launch The Stack fully populated with a realistic scenario, so
a non-technical reviewer can open it in a browser and click through all five tabs
with charts, schedules and history already rendering — no onboarding, no data
entry.

## Reviewing? Use `npm run preview`

```bash
npm run preview
```

This is the one-command path for a non-technical reviewer. It builds a static,
demo-seeded web export and serves it on a fixed local URL:

```
> EXPO_PUBLIC_DEMO=1 expo export --platform web && node scripts/serve-preview.mjs
...
The Stack — reviewer preview

  http://127.0.0.1:4300

Opens straight into a 393×852 phone frame — no DevTools needed.
(App itself serves at true root on port 4301, so expo-router's client-side routing works.)
Ctrl+C to stop.
```

Open the printed URL: it's a phone-bezel wrapper, not the app directly, so a
non-technical reviewer sees a mobile POV with no DevTools required to
simulate one. The wrapper embeds the actual app in an iframe pointed at a
*second* origin (`PORT + 1` by default) — `dist/` is served byte-for-byte at
the root of that origin, not nested under a subpath of the wrapper's. That
matters because expo-router's web route matcher compares
`window.location.pathname` straight against its route table with no
base-path awareness; nesting the app under a subpath (as this used to do,
THEA-44) made every route resolve to `Unmatched Route` instead of the real
screen. There is nothing else to start, no browser to auto-launch, no dev
server to keep alive — both listeners in `scripts/serve-preview.mjs` are a
zero-dependency Node HTTP server (no `serve`/`http-server` package needed).
Client-side routing means any path on the app origin falls back to the app
shell, so refreshing or deep-linking into a tab won't 404.

If port 4300 (or its app-origin sibling, 4301) is taken, override them:
`PREVIEW_PORT=4310 PREVIEW_APP_PORT=4311 npm run preview` (don't use the
plain `PORT` env var — some hosts already reserve it for their own listener,
which is exactly the collision this avoids).

This is why `npm run preview` is preferred over `npm run demo` for review: it
has nothing left to compile or bundle at review time, so there's no live Metro
server, auto-opened browser or open port to fail on the reviewer's machine —
see "Diagnosing `npm run demo` failures" below for the class of failure this
sidesteps.

### Does it actually render?

Yes, for a normal foreground browser tab — but the check is worth spelling
out because of an AGENTS.md gotcha: `useNativeDriver: true` no-ops on
react-native-web, and this app's screen-entrance animation
(`Reveal` in `src/ui/motion.tsx`) drives *opacity*, so a mishandled version of
it would ship invisible content instead of a missing flourish.

`Reveal` already guards this: if `document.hidden` is true (backgrounded/hidden
tab — which is also how headless-browser checks without a focused page report
themselves), it skips straight to `opacity: 1` instead of waiting on a
`requestAnimationFrame` that a hidden tab will never fire. In a normal,
focused reviewer tab the entrance animation runs and settles within ~1.1s
(420ms base + up to 660ms of stagger) — so if you're scripting a screenshot
against the preview, wait for that before capturing, or the shell will be mid
fade-in rather than actually blank.

Verified for this change:
- `curl` against the served preview returns `200` for `/`, the JS entry bundle,
  and an arbitrary unmatched path (SPA fallback) — confirmed with the exact
  `EXPO_PUBLIC_DEMO=1 expo export` output used here.
- Read-through of `Reveal`'s `document.hidden` guard against the AGENTS.md
  gotcha it's meant to cover — it resolves immediately when hidden, so the
  headless-tab failure mode it warns about doesn't reproduce here.
- A pixel screenshot via headless Chromium was **not** obtainable in this dev
  sandbox specifically — Playwright's Chromium downloads fine, but launching it
  needs system shared libraries (`libglib-2.0` and friends) that require root
  to install here, and this sandbox has no root/sudo. If you need a screenshot
  as proof for a PR, run `npx playwright install --with-deps chromium` once on
  a machine where that's available, then navigate to the `npm run preview` URL.

## Running it live instead (dev use, not reviewer use)

```bash
npm run demo
```

That runs `EXPO_PUBLIC_DEMO=1 expo start --web` — a live Metro dev server with
hot reload. Useful while developing the seed itself; not recommended for
handing to a reviewer, since it needs a free port, a browser Metro can open,
and a dev server that stays running for the whole review.

To view the same seeded state on a device/simulator instead of the browser:

```bash
EXPO_PUBLIC_DEMO=1 npx expo start        # then press i (iOS), a (Android), or scan the QR in Expo Go
```

### Diagnosing `npm run demo` failures

If `npm run demo` (or plain `expo start`) dies immediately with something like:

```
Error: EACCES: permission denied, open '.expo/dev/logs/start.log'
```

that's `expo start` trying to append to a log file left behind, owned by a
different user (commonly: it — or a container setup step — ran once as
`root`, and every later run is a non-root user that can't write to a
root-owned file under `.expo/`). Confirm with `stat .expo/dev/logs/start.log`
and compare the owner to `whoami`.

Fix by removing the stale, wrongly-owned log (or the whole cache directory,
which regenerates automatically):

```bash
rm -rf .expo/dev/logs   # or: rm -rf .expo
```

If you don't have permission to remove it either, that confirms the same root
cause — ask whoever has root on that machine to `chown` `.expo/` back to your
user, or just use `npm run preview`, which never touches `.expo/dev/logs/` (it
only runs `expo export`, which logs to `.expo/dev/logs/export.log`, a separate
file) and so isn't affected by this at all.

## What gets seeded

A single deterministic scenario (`src/dev/demoSeed.ts`):

- **Persona** — 34-year-old male, ~88 kg, 182 cm, moderate activity, trains 4
  days/week, some prior peptide experience, goals *fat loss* + *metabolic
  health*, balanced risk dial (3), no health flags. The disclaimer is marked
  accepted so the app routes past onboarding.
- **Stack** — generated by the real recommendation engine
  (`createGeneratedStack`). No dose is hand-written anywhere in the seed; every
  number comes from the engine or an engine-generated schedule.
- **~4 weeks of back-dated history** so every chart has something to draw:
  - Dose adherence — every past scheduled dose logged, mostly *taken* with a
    realistic scattering of *skipped*; today's doses left pending.
  - Injection logs — one per past injectable dose, rotating through all eight
    sites, with varied times and pain levels.
  - Side-effect check-ins — a GLP-1-style arc: nausea/fatigue high in week one,
    tapering off, on the 1–10 self-report scale.
  - Measurements — a gradual bodyweight downtrend (~3 kg over four weeks) and a
    matching waist trend.
  - Workouts — a generated program plus a few recently-logged sessions.

The seed is **idempotent**: it calls `resetAll()` first, so re-running (or a hot
reload) always yields the same clean scenario rather than stacking duplicates.

## Why it can't affect real users

- It only runs when `process.env.EXPO_PUBLIC_DEMO === '1'`. Every normal script
  (`start`, `web`, `ios`, `android`) leaves the flag unset, so the demo branch in
  `useAppStore`'s `onRehydrateStorage` is dead and the seed module is never even
  imported.
- The import is dynamic (`import('../dev/demoSeed')`), so the seed is only pulled
  in under the flag — production behaviour with the flag off is byte-identical to
  today.
- No production dosing or safety logic is touched. `src/dev` imports from
  `src/domain`, `src/engine` and `src/store`; nothing in `engine`/`domain`
  imports the seed (AGENTS.md layering).

# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# The Stack — working notes

## Safety invariants

These are load-bearing. Breaking one is a product defect, not a style choice. All are covered by tests in `tests/engine.test.cjs` — if you change behaviour here, the tests should fail first.

1. **The risk dial cannot produce a dose above the published maximum.** `riskTarget` interpolates between published anchors (low → typical → high) rather than multiplying past them. Do not "improve" this into a multiplier: there is no data above the published maximum to personalise against, so anything up there is invented.
2. **The risk dial affects dose and nothing else.** Selection, stack size and exclusion reasons must be byte-identical at every setting — there is a test that asserts this across 12 goal/experience combinations. Do not reintroduce risk into `stackCaps`, `evidenceAdjustment`, `profileAdjustment` or any candidate filter. A dial that quietly unlocked compounds would mean the safest setting hid information from the user.
2. **Doses are clamped low-first, ceiling-second.** For a per-kg compound a heavy enough user can scale a band minimum above the hard cap (mod GRF at 200 kg → 200 mcg against a 150 mcg cap). The cap must win, so the floor is applied before the ceiling.
3. **Rounding must not escape the cap.** Rounding to the nearest measurable increment can round *upward* past the ceiling — semaglutide's 2.4 mg label maximum rounds to 2.5 mg. When that happens, snap to the published bound itself; published figures are by definition real, measurable doses.
4. **`doseGuidanceWithheld` compounds** are never auto-recommended, never produce a dose number, and never generate a reminder schedule — at *any* risk setting.
5. **Generated stacks contain no `high` or `critical` interactions**, including against `profile.currentPeptides`. The generator checks each candidate against selection *plus* current use before adding it.
6. **Critical findings block saving** in the builder. This is the only non-overridable gate; keep it that way.
7. **Age warns, it does not block.** This was a deliberate change from an earlier hard gate. `isPeptideAllowed` explicitly ignores `under_18`, and `evaluateStack` excludes it from `blocking`. What replaces it: graded notices from `buildAgeNotices` (under 18 / 21 / 25) on GH-axis and IGF compounds, plus a ranking penalty in `profileAdjustment`. If you touch this, keep the warnings specific — the under-18 copy names the actual mechanism (IGF-1 acting on open growth plates, permanently) because that is the part that changes behaviour.
8. **No implicit unit conversion.** A `Dose` carries its unit. Do not add a helper that converts mg↔mcg behind the scenes; unit confusion at the syringe is the most likely route to a real-world overdose.

## Layering

`src/domain/` and `src/engine/` must not import from React Native, the store, or anything in `app/`. That purity is what lets the dose and safety logic be unit-tested directly, and `tsconfig.test.json` compiles exactly those directories.

`app/` uses **relative imports** (`../../src/...`). There is no `@/` path alias — TypeScript 6 deprecates `baseUrl`, so it was removed rather than pinned to a deprecation escape hatch.

Shared components live in `src/ui/`, never in a route file. `RiskPicker` is used by onboarding, the recommendation screen and the Me tab.

## Gotchas

- **Never put a bare string inside a `<View>`.** React Native throws on device while web only logs a warning, so this class of bug ships silently. `Callout` wraps text children automatically, including the array-of-strings case produced by `{'\n\n'}` interpolation.
- **Never set `fontWeight` alongside `fontFamily`.** Each weight is its own family (`IBMPlexSans_600SemiBold`). Setting both makes Android fall back to the system font and react-native-web paint a faux-bold over an already-bold face. Use `fonts.sansMedium` from `src/ui/theme.ts`.
- **Import fonts per weight**, never from a `@expo-google-fonts/*` barrel entry. Barrels eagerly require every face they ship and Metro does not tree-shake them.
- **`useNativeDriver: true` silently no-ops on react-native-web** — it does not fall back, the animation simply never runs. `src/ui/motion.tsx` gates it on `Platform.OS`. Because these animations drive opacity, getting this wrong ships invisible content rather than a missing flourish.
- **`requestAnimationFrame` does not fire in a hidden browser tab**, so JS-driven animations freeze at their initial value. `Reveal` detects `document.hidden` and resolves immediately. Any future animation that gates visibility needs the same guard — and note that this makes automated browser checks report opacity 0 unless the pane is displayed.
- **Figma MCP: `get_metadata` without a `nodeId` returns only the FIRST page**, not a list of all pages. Most UI kits put a Cover on page one, so it looks like the file is empty when it is not. Do not conclude a file is inaccessible from this — get a `node-id` from the user (right-click a frame → *Copy link to selection*) and query that node directly. An earlier note here blamed community-vs-duplicate file keys for this; that was wrong, and duplicating changes nothing about it.
- **Figma MCP calls are rate-limited on the Starter plan** and the limit is low enough to hit in one session. Budget them: map a file with one `get_metadata` on a known node, then spend the rest on the specific nodes you actually need.
- Adapt layout and structure from a kit, never its palette — this app's colour is semantic.
- **Do not add a categorical chart palette without validating it.** A four-hue set for this dark surface failed twice on CVD and normal-vision separation; the charts use small multiples and single hues specifically to avoid needing one. If you ever do need categorical series, validate before shipping rather than eyeballing ΔE, and remember status colours are reserved and ship with an icon or label, never colour alone.
- **The brand accent must stay clear of the severity scale.** Colour carries meaning in this app; an accent in the amber/orange/rose range would be mistakable for a warning.
- **Installing a package while Metro is running** leaves a stale file map — new `.ttf` assets fail to resolve until the bundler restarts. Restart the dev server after any `expo install`.
- There is **no `babel.config.js`**. `babel-preset-expo` is nested under `expo/node_modules` and is not resolvable from the project root, so a custom config breaks bundling. Expo's default handles it.
- **Splash config lives in the `expo-splash-screen` plugin**, not the legacy top-level `splash` key. Do not reintroduce both.
- `formatRange` shows years when a range leaves the current year. Cycle plans routinely run 60 weeks; without this a plan reads as eight weeks.
- The persisted store is at **version 5**. Any new required `UserProfile` field needs a `migrate` branch, and the engine should still tolerate its absence (`profile.riskTolerance ?? 3`).

## Commands

```bash
npm run typecheck
npm test
npm run icons     # regenerate app icons from assets/brand/logo.svg
npx expo start
```

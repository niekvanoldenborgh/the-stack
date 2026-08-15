# Onboarding harness

A dev-only way to boot The Stack as if it were a brand-new install, so the
onboarding flow can be tested without manually clearing app storage or
uninstalling/reinstalling.

## Running it

```bash
npm run onboarding
```

That runs `EXPO_PUBLIC_ONBOARDING=1 expo start --web` — a live Metro dev
server. On startup the store rehydrates from whatever is currently persisted
and then immediately wipes it back to first-run state by calling the store's
existing `resetAll()` action (no hand-rolled clearing). With no `profile` and
no `stacks`, `app/index.tsx` redirects to `/onboarding`, exactly as it would
for someone opening the app for the very first time.

To do the same on a device/simulator instead of the browser:

```bash
EXPO_PUBLIC_ONBOARDING=1 npx expo start        # then press i (iOS), a (Android), or scan the QR in Expo Go
```

Every run wipes state again on rehydrate, so reloading mid-flow (or a hot
reload while iterating on onboarding screens) always drops you back to a
clean first run rather than resuming half-finished data.

## Mutually exclusive with the demo flag

`EXPO_PUBLIC_ONBOARDING` and `EXPO_PUBLIC_DEMO` are mutually exclusive. If
both are set, onboarding wins: the store resets to a clean new-user state and
the demo seed is skipped entirely, so no seeded data survives. There is no
combined "seeded data but also show onboarding" mode — the two harnesses test
opposite ends of the same flow (empty vs. fully populated) and are not meant
to be composed.

## Why it can't affect real users

- It only runs when `process.env.EXPO_PUBLIC_ONBOARDING === '1'`. Every normal
  script (`start`, `web`, `ios`, `android`) leaves the flag unset, so this
  branch in `useAppStore`'s `onRehydrateStorage` is dead — production
  behaviour with the flag off is byte-identical to today.
- It calls the same `resetAll()` action already used elsewhere in the app
  (e.g. the Me tab's reset), rather than a separate clearing path, so there is
  only one place that defines what "clean state" means.
- No production dosing or safety logic is touched — this only clears
  persisted store state before the app renders its first screen.

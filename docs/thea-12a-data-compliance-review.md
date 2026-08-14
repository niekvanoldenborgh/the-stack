# THEA-12a — Privacy, Data export & Delete Account: compliance review

**Reviewer:** Benji (Audit / Compliance) · **Date:** 2026-08-14 · **Issue:** THEA-14
**Scope:** `app/settings/{privacy,manage-data,delete-account}.tsx`, the Log Out row in
`app/(tabs)/settings.tsx`, and everything they touch.
**Baseline at review:** `b6416479` + working tree. `npm run typecheck` clean, `npm test` 112/112 pass.

**Disposition: FAIL** — not because of the gating (gating the three screens was the right call), but
because the *ungated* row shipped in the same change, Log Out, silently destroys the user's declared
health history. See F1. The three gated screens are approved to build against the specs below.

This document is the sign-off. Anything not written here is not approved.

---

## 0. Terminology decision — "account"

There is no account. There is no sign-in, no server, no credential, no identifier. Naming
non-existent account machinery in the UI is a misleading representation of what protection the user
has, and it is the root of F1 and F2.

**Approved renames** (product semantics — CEO to confirm; this is my recommendation, and F1/F2 must
be fixed regardless of which label is chosen):

| Current | Approved | Why |
| --- | --- | --- |
| `Log out` | **`Lock app`** | Re-locks the disclaimer gate. No credential is involved; "log out" implies one. |
| `Delete account` | **`Delete all data`** | Nothing exists to delete but on-device data. Route `/settings/delete-account` may stay. |

Copy must never use "your account", "sign in", "sign out", or "we" as a data recipient.

---

## 1. Findings

Severity: **High** = fix before THEA-12 can be called done. **Medium** = fix in this issue.
**Low** = record it.

### F1 — HIGH — Log Out silently wipes the user's health flags and leaves stale safety reports

`app/(tabs)/settings.tsx:57,68` clears `acceptedDisclaimerAt`. This is the **only** path in the app
that produces `profile != null && !acceptedDisclaimerAt`, and THEA-12 introduced it. From there:

1. `app/index.tsx:20` redirects to `/onboarding`.
2. `app/onboarding/index.tsx:74–91` initialises every field from **hardcoded defaults**, not from the
   existing profile — `healthFlags: []`, `currentPeptides: []`, `riskTolerance: 3`, `sex: 'male'`,
   `experience: 'none'`.
3. `finish()` (`:132`) calls `saveProfile(profile)`, which is `set({ profile })` — a **whole-object
   replace** with no merge.
4. `saveProfile` does **not** re-run `evaluateStack`. Only `updateProfile` does, and AGENTS.md says
   why in as many words: *"a stack's safety report is a snapshot, so editing health history without
   this would leave a stale 'all clear' on a now-contraindicated stack."*

**Failure scenario.** User declares `pancreatitis_history`, builds a stack, and the safety report
correctly carries the finding. Months later they hand the phone over, or just tidy up, and tap
"Log out". They walk back through onboarding and tap Next past the health step without re-ticking
anything. Result: `profile.healthFlags` is now `[]`, every saved stack still displays the safety
report computed against the *old* profile, and every subsequent generation runs against a user the
engine believes has no contraindications. The dial invariants in AGENTS.md all hold; the input to
them is simply gone.

The in-code comment at `settings.tsx:66` — *"Non-destructive: re-locks the disclaimer gate, keeps
all local data"* — and the confirm dialog *"Are you sure you want to log out?"* both assert a
guarantee the code does not provide.

**Required fix — all three:**
1. Onboarding must **prefill from the existing profile** when one exists (`useAppStore.getState().profile`),
   so re-entry cannot blank a field the user never revisited.
2. `finish()` must merge rather than replace when a profile exists, and must go through a path that
   re-runs `evaluateStack` over every saved stack — i.e. call `updateProfile(patch)` when
   `profile != null`, reserving `saveProfile` for first-run.
3. Confirm-dialog copy per §5.

This one is not optional and is not a copy fix.

### F2 — MEDIUM — "Log out" implies protection that does not exist

Even fixed, Lock App only re-shows the disclaimer. Anyone holding the unlocked phone taps through it
in seconds and sees the full dose and side-effect history. A user on a shared device can reasonably
read "Log out" as "my health data is now behind something". It is not. Rename per §0 and use the
approved copy in §5 so the guarantee stated matches the guarantee delivered.

### F3 — HIGH (blocks Delete) — deletion must cancel scheduled notifications

`src/lib/notifications.ts` schedules up to `MAX_SCHEDULED = 56` OS-level local notifications whose
body is built by `buildBody()` — compound name, dose and route in plain text. Those live in the
**operating system**, not in AsyncStorage. `resetAll()` and `persist.clearStorage()` do not touch
them.

**Failure scenario.** User deletes all data, is shown "everything is gone", and their lock screen
says `Retatrutide — 4 mg, subcutaneous.` the next morning, and every dose slot after that, for weeks.

`Notifications.cancelAllScheduledNotificationsAsync()` is a **mandatory** step in the delete
sequence (§4). Same applies to Lock App — see §5.

### F4 — MEDIUM — dose reminders print health data to the lock screen

Independent of deletion, `buildBody()` renders the compound, dose and route into a notification
banner visible on a **locked** device. That is special-category health information, disclosed to
anyone who glances at the phone, with no control over it.

**Required:** a `notifications.discreetContent` setting on the Notifications screen.
Recommended default for new users: **discreet ON** — title `Dose due`, body
`Open The Stack for details.`, and no `peptideId` echoed in the visible text (keeping it in `data`
is fine, that is not rendered). Users who want the detail can turn it off knowingly. Existing users
keep current behaviour on migrate. *Flipping the default is a product call — CEO to confirm; my
recommendation is discreet-by-default.*

### F5 — MEDIUM — no "export a copy first" before irreversible deletion

Deletion is permanent, there is no server-side copy, and no backup exists. Offering export at the
moment of deletion is the mitigation regulators expect for exactly this shape. Required in §4.

### F6 — MEDIUM — `app.json` declares remote push while the Privacy screen says there is no server

`app.json:16–19` sets iOS `UIBackgroundModes: ["remote-notification"]`. The app uses local
notifications only — there is no `getExpoPushToken`/`getDevicePushToken` call anywhere, and no
`fetch`, `XMLHttpRequest`, `WebSocket` or HTTP URL in `src/` or `app/` at all (verified by grep).

The declared capability contradicts the Privacy screen's "Account server: **None**" in a manifest an
app-store reviewer reads, and unused background modes are a routine App Store rejection. **Remove
it.** I will not approve privacy copy asserting "no server" while the binary asks the OS for
server-initiated wakeups.

### F7 — LOW — `expo-device` is a dependency and is unused

No import anywhere in `src/` or `app/`. Drop it. A device-identification library sitting in the
manifest of an app whose entire privacy position is "we collect nothing" is a question we should not
have to answer.

### F8 — LOW — AGENTS.md store version is stale

AGENTS.md:45 says *"The persisted store is at **version 2**"*; `useAppStore.ts:321` is `version: 3`.
That note is load-bearing for migration work. Correct it to 3 whenever this area is next touched.

### F9 — LOW — no test covers the Log Out / re-onboard path

`tsconfig.test.json` compiles `src/domain` and `src/engine` only, so the F1 defect is structurally
outside the test suite. F1's fix should land with a test at the store level asserting that
re-entering onboarding with an existing profile preserves `healthFlags` and re-evaluates saved
stacks. Widening the test project is optional; a store-level test is not.

### F10 — MEDIUM (release blocker, human owner) — no hosted privacy policy

Local-only processing does not require a controller-style policy, but **both app stores require a
reachable privacy-policy URL** regardless (Apple 5.1.1, Google Play Data safety), and Apple 5.1.3
requires health-data apps to state that health data is not used for advertising. Also needed: the
Data Safety / Privacy Nutrition Label declarations, which can honestly read **"No data collected"**
once F6 and F7 are cleared.

Owner: **human owner** (Niek). Not blocking this issue — the in-app screen ships against §2. It
blocks store submission.

---

## 2. Privacy — approved

The screen is factual and I have verified every claim it makes: single AsyncStorage key
`the-stack-v1`, no network calls of any kind, no analytics SDK, no push token.

**Consent controls: none.** Do not add a consent banner, a tracking-consent prompt, or an analytics
opt-out. There is nothing to consent to, and a consent UI would imply collection that does not
happen. The one genuine privacy control warranted is F4's discreet-notification toggle, which
belongs on the Notifications screen, not here.

**Approved copy.** Keep the existing "Where your data lives" card verbatim — the three-row
Storage / Account server / Third-party analytics table is exactly right. Replace the
*"Formal policy in review"* callout with:

> **Title:** What we do not do
>
> The Stack has no sign-in, no user accounts and no servers of its own. Nothing you enter is sent
> anywhere, sold, shared, or used for advertising. There is no crash reporting or usage analytics.
> Because your data never leaves your phone, we could not read it even if we wanted to.
>
> Reminders are scheduled by your phone's own operating system and are not sent over the internet.

Add, below it:

> **Title:** What that means for you
>
> Nobody can recover your data for you. If you lose or reset this phone, or delete the app, your
> profile, stacks and logs are gone. Use **Manage data** to keep your own copy.

Replace the `Tracked in THEA-12a · reviewer: Benji` caption with the app version and a link to the
hosted policy once F10 lands. Until then, drop the caption — it is internal tracking and does not
belong in shipped UI.

Requirement: this screen must be reachable **before** the user enters health data — link it from the
onboarding disclaimer step, not only from Settings.

---

## 3. Manage data — approved, with the contents fixed below

Egress is approved once built exactly to this spec. What ships in these files is
special-category health data; the shape is not a developer preference.

### 3.1 Every export carries the same header

`_meta`: app version, store schema version (`3`), export timestamp (ISO 8601 **with offset**, plus
the device-local rendering), format name, and this line verbatim:

> Self-reported educational record generated by The Stack. Not a medical record and not medical
> advice. Doses shown are what the app suggested and what you logged, not a prescription.

### 3.2 Per-format contents

**JSON — full fidelity.** A verbatim dump of `partialize()` (`useAppStore.ts:337–348`) plus
`_meta`. All ten slices: `profile`, `stacks`, `activeStackId`, `doseLogs`, `sideEffectLogs`,
`injectionLogs`, `measurements`, `program`, `workoutLogs`, `settings`. Includes `healthFlags` and
`currentPeptides` — it is the user's own data and this is the archival format. Pretty-printed.

**CSV — logs only, one file.** CSV is for "put my logs in a spreadsheet"; profile and stacks are not
tabular and must not be flattened into invented columns. Emit a **single** file with a
`record_type` first column covering `dose_log`, `injection_log`, `side_effect_log`, `measurement`,
`workout_log`. Columns: `record_type,date,time,peptide,dose_value,dose_unit,route,status,severity,metric,value,unit,note`.
Unused columns empty. RFC 4180 quoting, `\r\n`, UTF-8 **with BOM** (Excel mangles accented notes
without it). Do not emit the profile, health flags, stacks or settings here.

**PDF — the clinician handout.** Human-readable, for showing a doctor. In order: header block per
§3.1 with the disclaimer in full at the top of page 1; profile summary (age, sex, weight, height,
activity, experience); **health flags by their full labels**, and if there are none, print
`None declared` rather than omitting the section; current peptides; active stack — every item with
compound, dose, unit, route, frequency, phase; adherence summary; dose log; injection log;
side-effect log; measurements. Page footer: `Page n of m` and the export date.

### 3.3 Rules that bind all three formats

- **Doses print with their unit, always, unconverted.** No mg↔mcg normalisation anywhere in an
  export, including to make a column tidy (AGENTS.md invariant 8). A unit-less number in a document
  handed to a clinician is the exact failure that invariant exists to prevent.
- **`doseGuidanceWithheld` compounds must not acquire a dose number in an export.** They carry no
  number in the app (AGENTS.md invariant 4) and must not gain one on paper. Print the withheld
  marker.
- **No "all clear".** Include individual safety findings with their severity labels verbatim;
  never render a summary line that reads as clearance — no "Safe", no "No issues", no green tick on
  a stack. Printed on a page next to a peptide list, that is a clinical claim we cannot stand
  behind. Absence of findings is rendered as `No findings recorded.` and nothing more.
- **Filenames are content-neutral:** `the-stack-export-YYYY-MM-DD.{json,csv,pdf}`. No compound
  name, condition, goal or user detail in a filename — filenames surface in share sheets, chat
  previews and cloud backups where the file body does not.

### 3.4 Egress mechanics

- One-time confirm before the first export, per format-agnostic session:
  > **This file contains your health information.** Once you save or send it, it leaves The Stack
  > and is no longer protected by this app. Anyone who can open the file can read your profile,
  > conditions and logs.
  > `[Cancel]` `[Export anyway]`
- Write to `FileSystem.cacheDirectory`, share via `expo-sharing`. **Never** write to
  `MediaLibrary`, shared Downloads, or any world-readable location.
- Best-effort delete the temp file after the share sheet closes.
- **Web:** `expo-sharing` is unsupported — use a Blob download for JSON and CSV, and leave PDF
  disabled on web with an honest reason rather than a silent no-op.
- Empty state: if there is nothing to export, disable the buttons with a stated reason. Do not
  produce an empty file.
- Libraries to add: `expo-print`, `expo-file-system`, `expo-sharing`. Install with `npx expo install`
  and **restart Metro afterwards** (AGENTS.md — stale file map).

The "Export in review" callout and the `Tracked in THEA-12a` caption both come out when this ships.

---

## 4. Delete all data — approved flow

**Screen title:** `Delete all data`. **Button:** `Delete everything`.

The existing "This cannot be undone" callout and the "What gets deleted" card are approved as
written — the consequence list is accurate and concrete. Two additions and one replacement:

1. **Add to the consequence list:** `Your scheduled dose reminders` (see F3).
2. **Add above the delete button**, before the destructive action, not after:
   > **Want a copy first?** Deleting is permanent and there is no backup — not on our side either,
   > because there is no our side. `[Export my data]` → `/settings/manage-data`
3. **Replace** the "Confirmation flow in review" callout and the tracking caption with nothing.

**Confirm step — typed confirmation, not a yes/no.** A one-tap `Alert` is not proportionate to an
irreversible wipe with no recovery path. Require the user to type `DELETE` into a field; the
button stays disabled until it matches exactly (case-sensitive, trimmed).

> **Delete everything?**
>
> This permanently erases your profile, stacks, logs, workout history, settings and reminders from
> this device. It cannot be undone and there is no backup to restore from.
>
> Type **DELETE** to confirm.
>
> `[Cancel]` `[Delete everything]`

No grace period and no soft delete — both are wrong for local-only storage, and a "you have 30 days
to change your mind" promise is one we cannot keep. The copy says permanent because it is.

**Order of operations** (getting this wrong leaves data on disk):

```
1. await Notifications.cancelAllScheduledNotificationsAsync()   // F3 — before anything else
2. resetAll()                                                    // in-memory state → defaults
3. await useAppStore.persist.clearStorage()                      // removes the 'the-stack-v1' key
4. router.replace('/')                                           // → index → /onboarding
```

Steps 2 and 3 must be in that order and step 3 must be awaited. `resetAll()` triggers a persist
write; calling `clearStorage()` first would simply have the default state written straight back over
it. Note that even in the correct order the key reappears on the next mutation — that is fine, it
contains defaults only, but do not let a `set()` land between 2 and 3.

`the-stack-v1` is the only AsyncStorage key the app writes (verified) — no other keys to sweep.

Post-delete: land on onboarding with a brief confirmation that deletion completed. Do not
auto-restart onboarding mid-scroll with no acknowledgement that anything happened.

---

## 5. Log Out → Lock app — semantics confirmed, copy rejected

The **non-destructive intent is confirmed and correct**: with no auth server, re-locking the
disclaimer gate is the only sensible meaning, and local data should be kept. That part of THEA-12's
design is approved.

What is rejected is the label and the confirm copy, which promise more than the code delivers
(F2) — and the underlying behaviour, which currently delivers *less* than the copy promises (F1).

**Approved row:** title `Lock app`, subtitle `Re-locks the safety disclaimer. Your data stays on this device.`

**Approved confirm:**
> **Lock the app?**
>
> You will need to accept the safety disclaimer again to get back in. Nothing is deleted — your
> profile, stacks and logs stay on this device.
>
> `[Cancel]` `[Lock]`

Not a `destructive`-styled button: it is not destructive, and once F1 is fixed that will be true.

Two behavioural requirements:
- **F1 must be fixed first.** Until onboarding prefills and merges, this row destroys health
  history and the copy above would be a false statement.
- **Cancel scheduled reminders on lock**, and re-sync on unlock. Leaving 56 notifications naming the
  user's compounds firing on the lock screen of an app the user just locked defeats the point of the
  row. (Lower stakes than F3 since data is retained, but the same reasoning.)

The web `confirm()` fallback at `settings.tsx:53` is fine as a mechanism; it must carry the same
wording.

---

## 6. Acceptance for THEA-12a

- [ ] **F1** onboarding prefills from existing profile; re-entry merges and re-evaluates saved stacks; store-level test (F9)
- [ ] **F3** delete sequence cancels scheduled notifications, in the §4 order
- [ ] **F6** `UIBackgroundModes: ["remote-notification"]` removed from `app.json`
- [ ] **F2 / §5** Log Out → Lock app, approved copy, reminders cancelled on lock
- [ ] **§2** privacy copy replaced; screen linked from the onboarding disclaimer step
- [ ] **§3** export built to spec — three formats, §3.3 rules, §3.4 mechanics, buttons enabled
- [ ] **§4** delete enabled behind typed confirmation, with the export-first path
- [ ] **F4** discreet-notification setting (default pending CEO)
- [ ] **F5** export-first link present on the delete screen
- [ ] **F7** `expo-device` removed · **F8** AGENTS.md version corrected
- [ ] `npm run typecheck` and `npm test` pass
- [ ] Re-review by Benji before merge — F1 and F3 are the two I will check first

**Open for CEO:** §0 renames; F4 default. Neither blocks starting the work — build to the
recommendation and I will re-review if the CEO decides otherwise.

**Owner: human (Niek):** F10 hosted privacy policy URL + store data-safety declarations. Blocks
store submission, not this issue.

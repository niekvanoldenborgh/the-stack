/**
 * Demo simulation harness — DEV ONLY.
 *
 * `seedDemoData` populates the store with a realistic, fully-loaded scenario so
 * a non-technical reviewer can open the app in a browser and click through all
 * five tabs with charts, schedules and history already rendering.
 *
 * This module is only ever imported behind the `EXPO_PUBLIC_DEMO === '1'` flag
 * (see `src/store/useAppStore.ts` → `onRehydrateStorage`). With the flag unset
 * it is never executed, so production behaviour is byte-identical to today.
 *
 * Purity / layering (AGENTS.md): `src/dev` may import from `src/domain`,
 * `src/engine` and `src/store` — never the reverse. Nothing in `engine`/`domain`
 * imports this file.
 *
 * Every dose here is produced by the real engine (`createGeneratedStack` →
 * `recommend`/`dosing`) or copied from an engine-generated schedule. Nothing
 * hand-invents a dose number — that is the "the app never suggests dosages
 * itself" rule, and it holds even in the demo seed.
 */
import { SIDE_EFFECT_OPTIONS } from '../domain/sideEffects';
import type {
  DoseLogStatus,
  InjectionSite,
  Route,
  UserProfile,
} from '../domain/types';
import { generateSchedule } from '../engine/cycle';
import { addDays, diffDays, today } from '../lib/date';
import type { useAppStore } from '../store/useAppStore';

/** The zustand store instance (the `useAppStore` hook with `getState`, etc.). */
type Store = typeof useAppStore;

/** Small deterministic PRNG so the seeded scenario is identical run-to-run. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Human label the catalogue stores for a side-effect id (see logger.tsx). */
function labelFor(id: string): string {
  return SIDE_EFFECT_OPTIONS.find((o) => o.id === id)?.label ?? id;
}

/** Nudge a "HH:mm" slot time by a few minutes so logs read as hand-entered. */
function jitterTime(hhmm: string, rng: () => number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h ?? 8) * 60 + (m ?? 0) + Math.floor(rng() * 11) - 5;
  const clamped = Math.max(0, Math.min(24 * 60 - 1, total));
  const hh = `${Math.floor(clamped / 60)}`.padStart(2, '0');
  const mm = `${clamped % 60}`.padStart(2, '0');
  return `${hh}:${mm}`;
}

const INJECTABLE_ROUTES: Route[] = ['subcutaneous', 'intramuscular'];

const INJECTION_SITES: InjectionSite[] = [
  'abdomen_left',
  'abdomen_right',
  'thigh_left',
  'thigh_right',
  'upper_arm_left',
  'upper_arm_right',
  'glute_left',
  'glute_right',
];

/** Weeks of back-dated history to synthesise. */
const WEEKS = 4;

/**
 * Populate the store with a complete demo scenario.
 *
 * Idempotent: always wipes any existing state first, so re-running (e.g. a hot
 * reload with the demo flag on) produces the same clean scenario rather than
 * stacking duplicates.
 *
 * Persona: 34-year-old male, ~88 kg, moderate trainer, goal fat loss +
 * metabolic health, some prior experience, balanced risk dial (3).
 */
export function seedDemoData(store: Store): void {
  const { getState } = store;

  // Idempotency: a single reset guarantees a clean slate whether or not data
  // was already present (resetAll clears profile, stacks, all logs, settings).
  getState().resetAll();

  const createdAt = new Date().toISOString();
  const profile: UserProfile = {
    createdAt,
    age: 34,
    sex: 'male',
    weightKg: 88,
    heightCm: 182,
    bodyFatPct: 22,
    activity: 'moderate',
    sleepHours: 7,
    sleepQuality: 3,
    trainingDays: 4,
    experience: 'some',
    goals: ['lose_fat', 'metabolic_health'],
    healthFlags: [],
    currentPeptides: [],
    riskTolerance: 3,
    // Set so app/index.tsx routes past onboarding straight into the tabs.
    acceptedDisclaimerAt: createdAt,
  };
  getState().saveProfile(profile);

  // Build the stack with the real recommendation engine — this is what respects
  // "we never invent a dose". Bail cleanly if generation returns nothing.
  const stack = getState().createGeneratedStack();
  if (!stack) return;

  // Back-date the cycle start ~4 weeks so schedules, adherence and the charts
  // have real history to render.
  const startDate = addDays(today(), -WEEKS * 7);
  getState().setStackStartDate(stack.id, startDate);

  // Re-read the stack now it has the back-dated start before building its
  // schedule.
  const started = getState().stacks.find((s) => s.id === stack.id) ?? stack;
  const schedule = generateSchedule(started, startDate, today());
  const rng = makeRng(42);

  // --- Dose adherence -------------------------------------------------------
  // Log every past dose taken, with a realistic scattering of skips. Doses
  // dated today stay pending so the dashboard has something live to act on.
  const pastDoses = schedule.filter((d) => diffDays(d.date, today()) > 0);
  pastDoses.forEach((dose, i) => {
    const status: DoseLogStatus = rng() < 0.12 ? 'skipped' : 'taken';
    const note = status === 'skipped' && i % 5 === 0 ? 'Travelling — missed it' : undefined;
    getState().logDose(dose, status, note);
  });

  // --- Injection logs -------------------------------------------------------
  // Built from the engine schedule (dose + peptide are engine-derived, never
  // hand-written), rotating sites so the Logger figure shows real rotation.
  const injectableDoses = pastDoses.filter((d) => INJECTABLE_ROUTES.includes(d.route));
  injectableDoses.forEach((dose, i) => {
    getState().logInjection({
      date: dose.date,
      time: jitterTime(dose.time, rng),
      peptideId: dose.peptideId,
      dose: dose.dose,
      site: INJECTION_SITES[i % INJECTION_SITES.length]!,
      painLevel: Math.floor(rng() * 4), // 0–3
      note: i % 9 === 0 ? 'Slight sting, faded quickly' : undefined,
    });
  });

  // --- Side-effect check-ins ------------------------------------------------
  // A GLP-1-style onboarding arc: nausea/fatigue high in week one, tapering as
  // the body adapts. Severity is on the 1–10 self-report scale (THEA-9).
  const checkins: Array<{ dayOffset: number; entries: Array<{ id: string; severity: number }>; note?: string }> = [
    { dayOffset: 26, entries: [{ id: 'nausea', severity: 7 }, { id: 'fatigue', severity: 5 }], note: 'First days on the GLP-1 — pretty queasy.' },
    { dayOffset: 24, entries: [{ id: 'nausea', severity: 6 }, { id: 'suppressed_appetite', severity: 6 }] },
    { dayOffset: 21, entries: [{ id: 'injection_site_reaction', severity: 3 }] },
    { dayOffset: 18, entries: [{ id: 'nausea', severity: 5 }, { id: 'constipation', severity: 4 }] },
    { dayOffset: 14, entries: [{ id: 'fatigue', severity: 4 }] },
    { dayOffset: 11, entries: [{ id: 'nausea', severity: 3 }] },
    { dayOffset: 7, entries: [{ id: 'nausea', severity: 2 }, { id: 'injection_site_reaction', severity: 2 }] },
    { dayOffset: 3, entries: [{ id: 'fatigue', severity: 2 }] },
    { dayOffset: 1, entries: [{ id: 'nausea', severity: 1 }] },
  ];
  for (const c of checkins) {
    const date = addDays(today(), -c.dayOffset);
    getState().logSideEffects(
      c.entries.map((e) => ({ date, label: labelFor(e.id), severity: e.severity, note: c.note })),
    );
  }

  // --- Measurements ---------------------------------------------------------
  // A gradual downward bodyweight trend (~3 kg over four weeks) plus a matching
  // waist trend. Values only — the app never sets a target or judges them.
  const bwStart = 88.0;
  for (let d = WEEKS * 7; d >= 0; d -= 3) {
    const progress = (WEEKS * 7 - d) / (WEEKS * 7);
    const value = +(bwStart - progress * 3.2 + (rng() - 0.5) * 0.4).toFixed(1);
    getState().addMeasurement({ metricId: 'bodyweight', date: addDays(today(), -d), value });
  }
  const waistStart = 94;
  for (let d = WEEKS * 7; d >= 0; d -= 7) {
    const progress = (WEEKS * 7 - d) / (WEEKS * 7);
    const value = +(waistStart - progress * 3 + (rng() - 0.5) * 0.3).toFixed(1);
    getState().addMeasurement({ metricId: 'waist', date: addDays(today(), -d), value });
  }

  // --- Workouts -------------------------------------------------------------
  // Generate the program from the engine, then log a handful of recent sessions
  // against its planned exercises (reps/RIR mirrored, load filled where the
  // plan left it open).
  const program = getState().createProgram();
  if (program) {
    const trainingSessions = program.sessions.filter((s) => s.exercises.length > 0);
    if (trainingSessions.length > 0) {
      const sessionDays = [2, 5, 9, 12];
      sessionDays.forEach((dayOffset, i) => {
        const planned = trainingSessions[i % trainingSessions.length]!;
        getState().logWorkout({
          programId: program.id,
          sessionId: planned.id,
          date: addDays(today(), -dayOffset),
          exercises: planned.exercises.map((pe) => ({
            exerciseId: pe.exerciseId,
            sets: pe.sets.map((set) => ({
              reps: set.reps,
              // Fill an open plan slot with a plausible 2.5 kg-rounded load.
              weightKg: set.suggestedLoadKg ?? Math.round((20 + rng() * 60) / 2.5) * 2.5,
              rir: set.rir,
            })),
          })),
          durationMinutes: planned.estimatedMinutes,
          perceivedEffort: 3 + (i % 2), // 3–4 of 5
        });
      });
    }
  }
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type {
  DoseLog,
  DoseLogStatus,
  InjectionLog,
  Measurement,
  ScheduledDose,
  SideEffectLog,
  Stack,
  StackItem,
  UserProfile,
  WorkoutProgram,
  WorkoutSessionLog,
} from '../domain/types';
import { generateSchedule } from '../engine/cycle';
import { generateStack } from '../engine/recommend';
import { evaluateStack } from '../engine/safety';
import { generateProgram } from '../engine/workout';
import { addDays, today } from '../lib/date';

/** Body-measurement display units. Dose units are never converted (see AGENTS.md). */
export type MassUnit = 'kg' | 'lb';
export type LengthUnit = 'cm' | 'ft';
/** 'light' is not yet implemented — the palette refactor is tracked separately. */
export type ThemePreference = 'system' | 'dark';

/** Reminder categories the user can silence independently. */
export interface NotificationPurposes {
  /** Per-dose "time to inject" reminders. Master switch is `remindersEnabled`. */
  doseReminders: boolean;
  /** Alerts when a titration step raises the dose. */
  titrationChanges: boolean;
  /** Alerts when a compound moves on/off cycle. */
  cycleTransitions: boolean;
  /** Nudges to log how you are feeling. */
  sideEffectCheckins: boolean;
}

interface Settings {
  remindersEnabled: boolean;
  /** Overrides for the default clock time of each slot, keyed by TimeOfDay. */
  customTimes: Record<string, string>;
  /** Mass unit for display of bodyweight and vial contents. */
  massUnit: MassUnit;
  /** Length unit for display of height. */
  lengthUnit: LengthUnit;
  theme: ThemePreference;
  /**
   * Minutes before each scheduled injection time to fire an alert. `0` means an
   * alert at the injection time itself. Sorted, de-duplicated, non-negative —
   * e.g. `[2, 0]` alerts two minutes before and again at the inject time.
   */
  alarmOffsetsMin: number[];
  notifications: NotificationPurposes;
  /**
   * Order of the Summary screen's sections, id first = shown first. The
   * Summary screen renders whatever ids it doesn't recognise nowhere, so
   * adding a new section is safe without a migration — it just needs adding
   * to `DEFAULT_SUMMARY_ORDER` to appear for new profiles.
   */
  summaryOrder: string[];
  /** ISO timestamp the user acknowledged the PK "before you read this chart" modal. Unset = not yet shown. */
  pkModalAcknowledgedAt?: string;
}

/** THEA-8 Summary screen — see `SUMMARY_SECTIONS` in app/(tabs)/index.tsx. */
export const DEFAULT_SUMMARY_ORDER = ['overview', 'next_injection', 'levels', 'stack'];

interface AppState {
  hydrated: boolean;
  profile: UserProfile | null;
  stacks: Stack[];
  activeStackId: string | null;
  doseLogs: Record<string, DoseLog>;
  sideEffectLogs: SideEffectLog[];
  injectionLogs: InjectionLog[];
  /** Self-reported goal-progress readings (bodyweight, ratings, etc.). */
  measurements: Measurement[];
  program: WorkoutProgram | null;
  workoutLogs: WorkoutSessionLog[];
  settings: Settings;

  setHydrated: (value: boolean) => void;
  saveProfile: (profile: UserProfile) => void;
  /**
   * Patches the profile and re-runs the safety engine over every saved stack.
   * A stack's safety report is a snapshot, so editing health history without
   * this would leave a stale "all clear" on a now-contraindicated stack.
   */
  updateProfile: (patch: Partial<UserProfile>) => void;

  createGeneratedStack: () => Stack | null;
  saveStack: (stack: Stack) => void;
  createCustomStack: (name: string, items: StackItem[]) => Stack | null;
  deleteStack: (id: string) => void;
  setActiveStack: (id: string) => void;
  setStackStartDate: (id: string, date: string) => void;

  logDose: (dose: ScheduledDose, status: DoseLogStatus, note?: string) => void;
  clearDoseLog: (scheduledDoseId: string) => void;
  logSideEffect: (entry: Omit<SideEffectLog, 'id'>) => void;
  /**
   * Log several symptoms from one check-in. One `SideEffectLog` per symptom
   * (they share date/severity/note) so the existing per-severity Results trend
   * keeps counting each one, rather than a new multi-label shape it can't read.
   */
  logSideEffects: (entries: Omit<SideEffectLog, 'id'>[]) => void;
  removeSideEffect: (id: string) => void;

  logInjection: (entry: Omit<InjectionLog, 'id'>) => void;
  removeInjection: (id: string) => void;

  addMeasurement: (entry: Omit<Measurement, 'id'>) => void;
  removeMeasurement: (id: string) => void;

  createProgram: () => WorkoutProgram | null;
  logWorkout: (log: Omit<WorkoutSessionLog, 'id'>) => void;
  deleteWorkoutLog: (id: string) => void;

  setSetting: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  resetAll: () => void;
}

const DEFAULT_SETTINGS: Settings = {
  remindersEnabled: false,
  customTimes: {},
  massUnit: 'kg',
  lengthUnit: 'cm',
  theme: 'dark',
  // Alert once, at the injection time. The alarm screen lets the user add
  // lead-in offsets (e.g. two minutes before).
  alarmOffsetsMin: [0],
  notifications: {
    doseReminders: true,
    titrationChanges: true,
    cycleTransitions: true,
    sideEffectCheckins: false,
  },
  summaryOrder: DEFAULT_SUMMARY_ORDER,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      profile: null,
      stacks: [],
      activeStackId: null,
      doseLogs: {},
      sideEffectLogs: [],
      injectionLogs: [],
      program: null,
      workoutLogs: [],
      measurements: [],
      settings: DEFAULT_SETTINGS,

      setHydrated: (value) => set({ hydrated: value }),

      saveProfile: (profile) => set({ profile }),

      updateProfile: (patch) => {
        const current = get().profile;
        if (!current) return;
        const profile = { ...current, ...patch };
        set({
          profile,
          stacks: get().stacks.map((stack) => ({
            ...stack,
            safety: evaluateStack(
              stack.items.map((i) => i.peptideId),
              profile,
            ),
          })),
        });
      },

      createGeneratedStack: () => {
        const profile = get().profile;
        if (!profile) return null;
        const stack = generateStack(profile);
        set((state) => ({ stacks: [...state.stacks, stack], activeStackId: stack.id }));
        return stack;
      },

      saveStack: (stack) =>
        set((state) => {
          const index = state.stacks.findIndex((s) => s.id === stack.id);
          const stacks = index >= 0 ? state.stacks.map((s) => (s.id === stack.id ? stack : s)) : [...state.stacks, stack];
          return { stacks, activeStackId: stack.id };
        }),

      createCustomStack: (name, items) => {
        const profile = get().profile;
        if (!profile) return null;
        const stack: Stack = {
          id: `stack_${Date.now().toString(36)}`,
          name: name.trim() || 'Custom stack',
          origin: 'custom',
          createdAt: new Date().toISOString(),
          startDate: today(),
          items,
          goals: profile.goals,
          safety: evaluateStack(
            items.map((i) => i.peptideId),
            profile,
          ),
        };
        set((state) => ({ stacks: [...state.stacks, stack], activeStackId: stack.id }));
        return stack;
      },

      deleteStack: (id) =>
        set((state) => {
          const stacks = state.stacks.filter((s) => s.id !== id);
          // Dose logs belong to a stack; drop them with it rather than leaving
          // orphans that would resurface if an id were ever reused.
          const doseLogs = Object.fromEntries(
            Object.entries(state.doseLogs).filter(([key]) => !key.startsWith(`${id}:`)),
          );
          return {
            stacks,
            doseLogs,
            activeStackId: state.activeStackId === id ? (stacks[0]?.id ?? null) : state.activeStackId,
          };
        }),

      setActiveStack: (id) => set({ activeStackId: id }),

      setStackStartDate: (id, date) =>
        set((state) => ({
          stacks: state.stacks.map((s) => (s.id === id ? { ...s, startDate: date } : s)),
        })),

      logDose: (dose, status, note) =>
        set((state) => ({
          doseLogs: {
            ...state.doseLogs,
            [dose.id]: {
              scheduledDoseId: dose.id,
              status,
              loggedAt: new Date().toISOString(),
              note,
            },
          },
        })),

      clearDoseLog: (scheduledDoseId) =>
        set((state) => {
          const next = { ...state.doseLogs };
          delete next[scheduledDoseId];
          return { doseLogs: next };
        }),

      logSideEffect: (entry) =>
        set((state) => ({
          sideEffectLogs: [
            { ...entry, id: `se_${Date.now().toString(36)}_${state.sideEffectLogs.length}` },
            ...state.sideEffectLogs,
          ],
        })),

      logSideEffects: (entries) =>
        set((state) => {
          const stamp = Date.now().toString(36);
          const created = entries.map((entry, i) => ({ ...entry, id: `se_${stamp}_${state.sideEffectLogs.length + i}` }));
          return { sideEffectLogs: [...created, ...state.sideEffectLogs] };
        }),

      removeSideEffect: (id) =>
        set((state) => ({ sideEffectLogs: state.sideEffectLogs.filter((e) => e.id !== id) })),

      addMeasurement: (entry) =>
        set((state) => ({
          measurements: [
            { ...entry, id: `m_${Date.now().toString(36)}_${state.measurements.length}` },
            ...state.measurements,
          ],
        })),

      removeMeasurement: (id) =>
        set((state) => ({ measurements: state.measurements.filter((m) => m.id !== id) })),

      logInjection: (entry) =>
        set((state) => ({
          injectionLogs: [
            { ...entry, id: `inj_${Date.now().toString(36)}_${state.injectionLogs.length}` },
            ...state.injectionLogs,
          ],
        })),

      removeInjection: (id) =>
        set((state) => ({ injectionLogs: state.injectionLogs.filter((e) => e.id !== id) })),

      createProgram: () => {
        const { profile, stacks, activeStackId } = get();
        if (!profile) return null;
        const stack = stacks.find((s) => s.id === activeStackId) ?? null;
        const program = generateProgram(profile, stack);
        set({ program });
        return program;
      },

      logWorkout: (log) =>
        set((state) => ({
          workoutLogs: [
            { ...log, id: `wl_${Date.now().toString(36)}_${state.workoutLogs.length}` },
            ...state.workoutLogs,
          ],
        })),

      deleteWorkoutLog: (id) => set((state) => ({ workoutLogs: state.workoutLogs.filter((l) => l.id !== id) })),

      setSetting: (key, value) => set((state) => ({ settings: { ...state.settings, [key]: value } })),

      resetAll: () =>
        set({
          profile: null,
          stacks: [],
          activeStackId: null,
          doseLogs: {},
          sideEffectLogs: [],
          injectionLogs: [],
          measurements: [],
          program: null,
          workoutLogs: [],
          settings: DEFAULT_SETTINGS,
        }),
    }),
    {
      name: 'the-stack-v1',
      version: 5,
      storage: createJSONStorage(() => AsyncStorage),
      /**
       * v1 profiles predate the risk dial and current-use tracking. Default to
       * the balanced setting and no current use rather than leaving the fields
       * undefined, so the UI never has to render an unset dial.
       *
       * v2→v3 adds display units, theme, alarm offsets and per-purpose
       * notification toggles. Merge over DEFAULT_SETTINGS so a partial persisted
       * `settings` from v2 (only `remindersEnabled`/`customTimes`) gains the new
       * fields rather than leaving the settings screens rendering undefined.
       *
       * v3→v4 (THEA-8) adds `summaryOrder`. Same merge-over-DEFAULT_SETTINGS
       * approach — `pkModalAcknowledgedAt` is optional so it needs no branch.
       *
       * v4→v5 (THEA-9 P&S sign-off) changes `SideEffectLog.severity` from the
       * mild/moderate/severe band to a 1–10 self-reported number. Old entries
       * are remapped to the midpoint of their old band (matching the cut
       * points in `domain/sideEffects.ts#severityBand`) rather than dropped,
       * so a symptom logged before this change still renders and buckets
       * correctly.
       */
      migrate: (persisted, version) => {
        const state = persisted as {
          profile?: UserProfile | null;
          settings?: Partial<Settings>;
          sideEffectLogs?: Array<{ severity: unknown } & Record<string, unknown>>;
        } | null;
        if (version < 2 && state?.profile) {
          state.profile = {
            ...state.profile,
            currentPeptides: state.profile.currentPeptides ?? [],
            riskTolerance: state.profile.riskTolerance ?? 3,
          };
        }
        if (version < 3 && state) {
          state.settings = {
            ...DEFAULT_SETTINGS,
            ...(state.settings ?? {}),
            notifications: { ...DEFAULT_SETTINGS.notifications, ...(state.settings?.notifications ?? {}) },
          };
        }
        if (version < 4 && state) {
          state.settings = { ...DEFAULT_SETTINGS, ...(state.settings ?? {}) };
        }
        if (version < 5 && state?.sideEffectLogs) {
          const legacyMidpoint: Record<string, number> = { mild: 3, moderate: 5, severe: 8 };
          state.sideEffectLogs = state.sideEffectLogs.map((log) =>
            typeof log.severity === 'string' ? { ...log, severity: legacyMidpoint[log.severity] ?? 5 } : log,
          );
        }
        return state as never;
      },
      partialize: (state) => ({
        profile: state.profile,
        stacks: state.stacks,
        activeStackId: state.activeStackId,
        doseLogs: state.doseLogs,
        sideEffectLogs: state.sideEffectLogs,
        injectionLogs: state.injectionLogs,
        measurements: state.measurements,
        program: state.program,
        workoutLogs: state.workoutLogs,
        settings: state.settings,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function useActiveStack(): Stack | null {
  return useAppStore((state) => state.stacks.find((s) => s.id === state.activeStackId) ?? null);
}

export function useHasOnboarded(): boolean {
  return useAppStore((state) => Boolean(state.profile?.acceptedDisclaimerAt));
}

/** The next 14 days of scheduled doses across the active stack. */
export function useUpcomingDoses(days = 14): ScheduledDose[] {
  const stack = useActiveStack();
  if (!stack) return [];
  const from = today();
  return generateSchedule(stack, from, addDays(from, days));
}

export function selectAdherence(
  doses: ScheduledDose[],
  logs: Record<string, DoseLog>,
): { taken: number; skipped: number; pending: number; pct: number } {
  let taken = 0;
  let skipped = 0;
  for (const dose of doses) {
    const log = logs[dose.id];
    if (log?.status === 'taken') taken++;
    else if (log?.status === 'skipped') skipped++;
  }
  const pending = doses.length - taken - skipped;
  const decided = taken + skipped;
  return { taken, skipped, pending, pct: decided === 0 ? 0 : Math.round((taken / decided) * 100) };
}

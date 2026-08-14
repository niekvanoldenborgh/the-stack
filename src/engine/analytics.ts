import { getExercise } from '../domain/exercises';
import { severityBand } from '../domain/sideEffects';
import type { DoseLog, MuscleGroup, ScheduledDose, SideEffectLog, WorkoutSessionLog } from '../domain/types';
import { addDays, diffDays, startOfWeek, today } from '../lib/date';
import { estimatedOneRepMax } from './workout';

/**
 * Analytics.
 *
 * Everything here is a pure transform from logs to plotted series, so the
 * numbers on a chart can be asserted in a test rather than eyeballed on a
 * screen. Each function returns a dense series — weeks with no training still
 * appear, with zero — because a gap in a bar chart has to mean "nothing
 * happened", not "no data point was emitted".
 */

export interface WeeklyVolumePoint {
  /** Monday of the week. */
  weekStart: string;
  /** Total load moved: sum of reps × kg. */
  volumeKg: number;
  sessions: number;
}

export function weeklyVolume(logs: WorkoutSessionLog[], weeks = 8, from = today()): WeeklyVolumePoint[] {
  const currentWeek = startOfWeek(from);
  const series: WeeklyVolumePoint[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(currentWeek, -i * 7);
    const weekEnd = addDays(weekStart, 6);
    const inWeek = logs.filter((log) => log.date >= weekStart && log.date <= weekEnd);
    const volumeKg = inWeek.reduce(
      (total, log) =>
        total +
        log.exercises.reduce(
          (sum, exercise) => sum + exercise.sets.reduce((s, set) => s + set.reps * set.weightKg, 0),
          0,
        ),
      0,
    );
    series.push({ weekStart, volumeKg: Math.round(volumeKg), sessions: inWeek.length });
  }

  return series;
}

export interface StrengthPoint {
  date: string;
  /** Best estimated one-rep max across the session's sets. */
  estimatedMax: number;
}

export interface StrengthTrend {
  exerciseId: string;
  name: string;
  points: StrengthPoint[];
  /** Percentage change from first to last session. Null with fewer than two. */
  changePct: number | null;
}

/**
 * Per-exercise strength trend, most-trained first.
 *
 * Returned as separate series rather than one multi-series chart on purpose:
 * small multiples need no categorical palette, so there is no colourblind
 * collision to design around, and each lift stays directly labelled.
 */
export function strengthTrends(logs: WorkoutSessionLog[], limit = 4): StrengthTrend[] {
  const byExercise = new Map<string, StrengthPoint[]>();

  for (const log of [...logs].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const exercise of log.exercises) {
      const best = exercise.sets.reduce(
        (max, set) => Math.max(max, estimatedOneRepMax(set.weightKg, set.reps)),
        0,
      );
      if (best <= 0) continue;
      const points = byExercise.get(exercise.exerciseId) ?? [];
      points.push({ date: log.date, estimatedMax: best });
      byExercise.set(exercise.exerciseId, points);
    }
  }

  return [...byExercise.entries()]
    .map(([exerciseId, points]) => {
      const first = points[0]?.estimatedMax;
      const last = points[points.length - 1]?.estimatedMax;
      const changePct =
        points.length >= 2 && first && last ? Math.round(((last - first) / first) * 1000) / 10 : null;
      return { exerciseId, name: getExercise(exerciseId)?.name ?? exerciseId, points, changePct };
    })
    .sort((a, b) => b.points.length - a.points.length)
    .slice(0, limit);
}

export interface MuscleLoadPoint {
  muscle: MuscleGroup;
  /** Weekly working sets. Secondary involvement counts as half a set. */
  sets: number;
}

/**
 * Sets per muscle group per week.
 *
 * Counted in sets rather than tonnage because sets-per-muscle-per-week is the
 * metric training research actually uses for hypertrophy, and because tonnage
 * flatters whichever lift happens to use the heaviest load.
 */
export function muscleLoad(logs: WorkoutSessionLog[], days = 7, from = today()): MuscleLoadPoint[] {
  const since = addDays(from, -(days - 1));
  const totals = new Map<MuscleGroup, number>();

  for (const log of logs.filter((l) => l.date >= since && l.date <= from)) {
    for (const logged of log.exercises) {
      const exercise = getExercise(logged.exerciseId);
      if (!exercise) continue;
      const setCount = logged.sets.length;
      for (const muscle of exercise.primary) {
        totals.set(muscle, (totals.get(muscle) ?? 0) + setCount);
      }
      for (const muscle of exercise.secondary) {
        totals.set(muscle, (totals.get(muscle) ?? 0) + setCount * 0.5);
      }
    }
  }

  return [...totals.entries()]
    .map(([muscle, sets]) => ({ muscle, sets: Math.round(sets * 10) / 10 }))
    .sort((a, b) => b.sets - a.sets);
}

export interface AdherencePoint {
  date: string;
  taken: number;
  skipped: number;
  scheduled: number;
}

export function adherenceSeries(
  doses: ScheduledDose[],
  logs: Record<string, DoseLog>,
  days = 14,
  from = today(),
): AdherencePoint[] {
  const series: AdherencePoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(from, -i);
    const onDate = doses.filter((dose) => dose.date === date);
    let taken = 0;
    let skipped = 0;
    for (const dose of onDate) {
      const status = logs[dose.id]?.status;
      if (status === 'taken') taken++;
      else if (status === 'skipped') skipped++;
    }
    series.push({ date, taken, skipped, scheduled: onDate.length });
  }

  return series;
}

export interface SideEffectPoint {
  weekStart: string;
  mild: number;
  moderate: number;
  severe: number;
  total: number;
}

/**
 * Side effects bucketed by week.
 *
 * This is the chart that earns its place in a harm-reduction app: plotted
 * against a cycle that titrates upward, it is what makes "the headaches started
 * when I hit full dose" visible rather than remembered.
 */
export function sideEffectsByWeek(entries: SideEffectLog[], weeks = 8, from = today()): SideEffectPoint[] {
  const currentWeek = startOfWeek(from);
  const series: SideEffectPoint[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(currentWeek, -i * 7);
    const weekEnd = addDays(weekStart, 6);
    const inWeek = entries.filter((e) => e.date >= weekStart && e.date <= weekEnd);
    const point: SideEffectPoint = {
      weekStart,
      mild: inWeek.filter((e) => severityBand(e.severity) === 'mild').length,
      moderate: inWeek.filter((e) => severityBand(e.severity) === 'moderate').length,
      severe: inWeek.filter((e) => severityBand(e.severity) === 'severe').length,
      total: inWeek.length,
    };
    series.push(point);
  }

  return series;
}

export interface TrainingSummary {
  sessionsLogged: number;
  totalVolumeKg: number;
  /** Sessions in the last 7 days versus what the programme plans. */
  sessionsThisWeek: number;
  plannedPerWeek: number;
  /** Consecutive weeks with at least one logged session, counting back. */
  streakWeeks: number;
}

export function trainingSummary(
  logs: WorkoutSessionLog[],
  plannedPerWeek: number,
  from = today(),
): TrainingSummary {
  const weekStart = startOfWeek(from);
  const sessionsThisWeek = logs.filter((l) => l.date >= weekStart && l.date <= from).length;

  let streakWeeks = 0;
  for (let i = 0; i < 52; i++) {
    const start = addDays(weekStart, -i * 7);
    const end = addDays(start, 6);
    const trained = logs.some((l) => l.date >= start && l.date <= end);
    // The current week is still in progress, so an empty one does not break a
    // streak until it has actually elapsed.
    if (!trained) {
      if (i === 0) continue;
      break;
    }
    streakWeeks++;
  }

  return {
    sessionsLogged: logs.length,
    totalVolumeKg: Math.round(
      logs.reduce(
        (total, log) =>
          total +
          log.exercises.reduce(
            (sum, exercise) => sum + exercise.sets.reduce((s, set) => s + set.reps * set.weightKg, 0),
            0,
          ),
        0,
      ),
    ),
    sessionsThisWeek,
    plannedPerWeek,
    streakWeeks,
  };
}

/** Compact label for a week bucket, e.g. "12 Aug". */
export function weekLabel(weekStart: string, from = today()): string {
  const delta = diffDays(weekStart, startOfWeek(from));
  if (delta === 0) return 'This wk';
  if (delta === 7) return 'Last wk';
  return `${Math.round(delta / 7)}w ago`;
}

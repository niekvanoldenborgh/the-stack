import { getPeptide } from '../domain/peptides';
import type { CyclePhase, PhaseKind, ScheduledDose, Stack, StackItem, TimeOfDay } from '../domain/types';
import { addDays, addWeeks, dateRange, diffDays, weekdayIndex } from '../lib/date';
import { doseForWeek } from './dosing';

/**
 * Cycle planning and dose scheduling.
 *
 * A stack item's timeline is a repeating block of `onWeeks` on and `offWeeks`
 * off, starting from the stack's start date, capped at `maxConsecutiveCycles`.
 * The first `titrationWeeks` of each on-block is marked as a titration phase so
 * the UI can show the ramp and the scheduler can lower the dose accordingly.
 */

/** Default wall-clock times for each slot. Users can override per stack item. */
export const DEFAULT_TIMES: Record<TimeOfDay, string> = {
  waking: '07:00',
  morning: '08:30',
  pre_workout: '17:00',
  post_workout: '19:00',
  evening: '20:30',
  bedtime: '22:30',
};

export const TIME_OF_DAY_LABELS: Record<TimeOfDay, string> = {
  waking: 'On waking',
  morning: 'Morning',
  pre_workout: 'Pre-workout',
  post_workout: 'Post-workout',
  evening: 'Evening',
  bedtime: 'Bedtime',
};

/**
 * Which weekdays a compound is taken on, when the schedule is not pinned to
 * specific days. Spreads doses out rather than clustering them.
 */
export function spreadDays(daysPerWeek: number): number[] {
  switch (Math.max(1, Math.min(7, Math.round(daysPerWeek)))) {
    case 7:
      return [0, 1, 2, 3, 4, 5, 6];
    case 6:
      return [0, 1, 2, 3, 4, 5];
    case 5:
      return [0, 1, 2, 3, 4];
    case 4:
      return [0, 1, 3, 4];
    case 3:
      return [0, 2, 4];
    case 2:
      return [0, 3];
    default:
      return [0];
  }
}

function activeWeekdays(item: StackItem): number[] {
  const peptide = getPeptide(item.peptideId);
  const fixed = peptide?.frequency.fixedDays;
  if (fixed && fixed.length > 0) return fixed;
  return spreadDays(item.daysPerWeek);
}

function slotsForItem(item: StackItem): TimeOfDay[] {
  const preferred = item.preferredTimes.length > 0 ? item.preferredTimes : (['morning'] as TimeOfDay[]);
  const slots: TimeOfDay[] = [];
  for (let i = 0; i < item.timesPerDay; i++) {
    slots.push(preferred[i % preferred.length]!);
  }
  return slots;
}

/**
 * How many full on/off cycles to plan. `maxConsecutiveCycles` of null means
 * continuous therapy — we plan a year and let the UI describe it as ongoing.
 */
function plannedCycles(item: StackItem): number {
  const peptide = getPeptide(item.peptideId);
  const max = peptide?.cycle.maxConsecutiveCycles;
  if (max === null || max === undefined) return 1;
  return Math.max(1, max);
}

/** Groups a flat phase list (from `buildCyclePhases`) by peptide, preserving chronological order. */
export function groupPhasesByPeptide(phases: CyclePhase[]): Map<string, CyclePhase[]> {
  const map = new Map<string, CyclePhase[]>();
  for (const phase of phases) {
    const list = map.get(phase.peptideId);
    if (list) list.push(phase);
    else map.set(phase.peptideId, [phase]);
  }
  return map;
}

/**
 * Percent complete through one compound's full planned timeline — titration
 * through the last washout — given that peptide's own phases (already
 * filtered/grouped, e.g. via `groupPhasesByPeptide`). Clamped to [0, 100], so
 * a plan that has already ended reads as 100% rather than overshooting it.
 * Returns null when there is no phase data to measure against.
 */
export function cyclePlanProgressPct(phases: CyclePhase[], date: string): number | null {
  if (phases.length === 0) return null;
  const start = phases[0]!.startDate;
  const end = phases[phases.length - 1]!.endDate;
  const totalDays = diffDays(start, end) + 1;
  if (totalDays <= 0) return null;
  const elapsedDays = diffDays(start, date) + 1;
  return Math.max(0, Math.min(100, (elapsedDays / totalDays) * 100));
}

export function buildCyclePhases(stack: Stack): CyclePhase[] {
  const phases: CyclePhase[] = [];

  for (const item of stack.items) {
    const peptide = getPeptide(item.peptideId);
    if (!peptide) continue;

    const titrationWeeks = Math.min(peptide.dosing.titrationWeeks, item.onWeeks);
    const cycles = plannedCycles(item);
    let cursor = stack.startDate;

    for (let cycle = 0; cycle < cycles; cycle++) {
      if (titrationWeeks > 0) {
        const end = addDays(addWeeks(cursor, titrationWeeks), -1);
        phases.push({
          peptideId: item.peptideId,
          kind: 'titration',
          startDate: cursor,
          endDate: end,
          label: `Titration — building to the target dose over ${titrationWeeks} week${titrationWeeks === 1 ? '' : 's'}`,
        });
        cursor = addDays(end, 1);
      }

      const onRemaining = item.onWeeks - titrationWeeks;
      if (onRemaining > 0) {
        const end = addDays(addWeeks(cursor, onRemaining), -1);
        phases.push({
          peptideId: item.peptideId,
          kind: 'on',
          startDate: cursor,
          endDate: end,
          label:
            item.offWeeks === 0
              ? 'Ongoing — this compound is used continuously rather than cycled'
              : `On cycle — week ${titrationWeeks + 1} to ${item.onWeeks}`,
        });
        cursor = addDays(end, 1);
      }

      if (item.offWeeks > 0) {
        const end = addDays(addWeeks(cursor, item.offWeeks), -1);
        phases.push({
          peptideId: item.peptideId,
          kind: 'washout',
          startDate: cursor,
          endDate: end,
          label: `Off cycle — ${item.offWeeks} week${item.offWeeks === 1 ? '' : 's'} washout`,
        });
        cursor = addDays(end, 1);
      }
    }
  }

  return phases.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** The phase a compound is in on a given date, or null if the plan has ended. */
export function phaseOn(item: StackItem, startDate: string, date: string): PhaseKind | null {
  const daysIn = diffDays(startDate, date);
  if (daysIn < 0) return null;

  const cycleWeeks = item.onWeeks + item.offWeeks;
  if (cycleWeeks <= 0) return null;

  const weeksIn = Math.floor(daysIn / 7);
  const cycleIndex = Math.floor(weeksIn / cycleWeeks);
  if (cycleIndex >= plannedCycles(item)) return null;

  const weekInCycle = weeksIn % cycleWeeks;
  if (weekInCycle >= item.onWeeks) return 'washout';

  const peptide = getPeptide(item.peptideId);
  const titrationWeeks = Math.min(peptide?.dosing.titrationWeeks ?? 0, item.onWeeks);
  return weekInCycle < titrationWeeks ? 'titration' : 'on';
}

/** 1-indexed week number within the current on-block, used for the dose ramp. */
function weekWithinOnBlock(item: StackItem, startDate: string, date: string): number {
  const daysIn = diffDays(startDate, date);
  const cycleWeeks = item.onWeeks + item.offWeeks;
  const weeksIn = Math.floor(daysIn / 7);
  const weekInCycle = cycleWeeks > 0 ? weeksIn % cycleWeeks : weeksIn;
  return weekInCycle + 1;
}

export function generateSchedule(stack: Stack, from: string, to: string): ScheduledDose[] {
  const doses: ScheduledDose[] = [];
  const dates = dateRange(from, to);

  for (const item of stack.items) {
    const peptide = getPeptide(item.peptideId);
    if (!peptide) continue;
    // A compound with no dose guidance gets no schedule — the app will not
    // generate reminders to inject an amount it refused to specify.
    if (item.doseWithheld) continue;

    const weekdays = new Set(activeWeekdays(item));
    const slots = slotsForItem(item);
    const titrationWeeks = Math.min(peptide.dosing.titrationWeeks, item.onWeeks);

    for (const date of dates) {
      const phase = phaseOn(item, stack.startDate, date);
      if (phase === null || phase === 'washout') continue;
      if (!weekdays.has(weekdayIndex(date))) continue;

      const week = weekWithinOnBlock(item, stack.startDate, date);
      const dose = doseForWeek(item.startDose, item.dose, titrationWeeks, week);

      slots.forEach((slot, index) => {
        doses.push({
          id: `${stack.id}:${item.peptideId}:${date}:${index}`,
          stackId: stack.id,
          peptideId: item.peptideId,
          date,
          time: DEFAULT_TIMES[slot],
          timeOfDay: slot,
          dose,
          route: peptide.routes[0]!,
          phase,
        });
      });
    }
  }

  return doses.sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
}

export function dosesOn(stack: Stack, date: string): ScheduledDose[] {
  return generateSchedule(stack, date, date);
}

export interface CycleSummary {
  peptideId: string;
  name: string;
  phase: PhaseKind | 'ended';
  /** Days until the current phase changes; null when the plan has ended. */
  daysUntilChange: number | null;
  nextChangeLabel: string;
}

export function summariseCycle(stack: Stack, date: string): CycleSummary[] {
  return stack.items.map((item) => {
    const peptide = getPeptide(item.peptideId);
    const phase = phaseOn(item, stack.startDate, date);

    if (phase === null) {
      return {
        peptideId: item.peptideId,
        name: peptide?.name ?? item.peptideId,
        phase: 'ended' as const,
        daysUntilChange: null,
        nextChangeLabel: 'Plan complete — reassess before starting another cycle',
      };
    }

    // Walk forward to the next phase transition. A year is a hard stop so a
    // continuous-therapy item cannot spin here.
    let days = 1;
    while (days <= 366) {
      const next = phaseOn(item, stack.startDate, addDays(date, days));
      if (next !== phase) break;
      days++;
    }

    const upcoming = phaseOn(item, stack.startDate, addDays(date, days));
    const label =
      upcoming === null
        ? 'Plan ends'
        : upcoming === 'washout'
          ? 'Washout starts'
          : upcoming === 'on'
            ? 'Reaches full dose'
            : 'Next cycle starts';

    return {
      peptideId: item.peptideId,
      name: peptide?.name ?? item.peptideId,
      phase,
      daysUntilChange: days > 366 ? null : days,
      nextChangeLabel: label,
    };
  });
}

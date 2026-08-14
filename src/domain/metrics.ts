import type { GoalId } from './types';

/**
 * The catalogue of things a user can measure to track a goal.
 *
 * A metric is deliberately *descriptive only*: it names a quantity and how to
 * record it consistently. It carries no target, no "healthy range" and no
 * judgement about a value — the app charts what the user enters and nothing
 * more. Inventing a target here would be medical advice the app cannot give.
 *
 * Each metric is offered under one or more goals from `goals.ts`, so the
 * Results screen can surface the relevant measures for the goals a user
 * actually picked. A metric may serve several goals (bodyweight matters to fat
 * loss and to muscle gain alike); the direction that counts as progress depends
 * on the goal, so it is intentionally not encoded here.
 */

export type MetricInputKind =
  /** A free numeric value with a unit — weight, circumference, a top set. */
  | 'number'
  /** A 1–5 self-rating, for qualities that have no instrument. */
  | 'scale';

export interface Metric {
  id: string;
  label: string;
  /** Unit shown beside the figure. Empty for unitless 1–5 scales. */
  unit: string;
  /** Goals this metric is offered under. */
  goals: GoalId[];
  kind: MetricInputKind;
  /** Decimal places kept on a numeric value. Ignored for scales. */
  precision: number;
  /** One-line, non-prescriptive note on how to record it consistently. */
  hint: string;
}

/** Metric id used for a user-defined measure that isn't in the catalogue. */
export const CUSTOM_METRIC_ID = 'custom';

export const SCALE_MIN = 1;
export const SCALE_MAX = 5;

export const METRICS: Metric[] = [
  {
    id: 'bodyweight',
    label: 'Bodyweight',
    unit: 'kg',
    goals: ['lose_fat', 'gain_weight', 'build_muscle', 'metabolic_health', 'bone_density'],
    kind: 'number',
    precision: 1,
    hint: 'Weigh at the same time each day — first thing, after the toilet, before food.',
  },
  {
    id: 'waist',
    label: 'Waist',
    unit: 'cm',
    goals: ['lose_fat', 'metabolic_health'],
    kind: 'number',
    precision: 1,
    hint: 'Measured at the navel, relaxed. Useful when the scale stalls but shape keeps changing.',
  },
  {
    id: 'body_fat',
    label: 'Body fat',
    unit: '%',
    goals: ['lose_fat', 'build_muscle', 'metabolic_health'],
    kind: 'number',
    precision: 1,
    hint: 'However you usually estimate it — just keep the method the same each time.',
  },
  {
    id: 'arm',
    label: 'Arm',
    unit: 'cm',
    goals: ['build_muscle'],
    kind: 'number',
    precision: 1,
    hint: 'Flexed, at the peak. Same arm, same tension each time.',
  },
  {
    id: 'squat_top_set',
    label: 'Squat top set',
    unit: 'kg',
    goals: ['build_muscle'],
    kind: 'number',
    precision: 1,
    hint: 'The heaviest working set you hit that day.',
  },
  {
    id: 'bench_top_set',
    label: 'Bench top set',
    unit: 'kg',
    goals: ['build_muscle'],
    kind: 'number',
    precision: 1,
    hint: 'The heaviest working set you hit that day.',
  },
  {
    id: 'deadlift_top_set',
    label: 'Deadlift top set',
    unit: 'kg',
    goals: ['build_muscle'],
    kind: 'number',
    precision: 1,
    hint: 'The heaviest working set you hit that day.',
  },
  {
    id: 'hair_density',
    label: 'Hair density',
    unit: '',
    goals: ['hair_growth'],
    kind: 'scale',
    precision: 0,
    hint: 'Your own read on thickness and shedding — 1 (worst) to 5 (best).',
  },
  {
    id: 'skin_clarity',
    label: 'Skin clarity',
    unit: '',
    goals: ['acne_control'],
    kind: 'scale',
    precision: 0,
    hint: 'Fewer, calmer breakouts scores higher — 1 (worst) to 5 (clear).',
  },
  {
    id: 'skin_smoothness',
    label: 'Skin smoothness',
    unit: '',
    goals: ['skin_quality'],
    kind: 'scale',
    precision: 0,
    hint: 'Texture and fine lines — 1 (worst) to 5 (best).',
  },
  {
    id: 'sleep_quality',
    label: 'Sleep quality',
    unit: '',
    goals: ['sleep_quality'],
    kind: 'scale',
    precision: 0,
    hint: 'How rested you feel — 1 (worst) to 5 (best).',
  },
  {
    id: 'soreness',
    label: 'Injury comfort',
    unit: '',
    goals: ['injury_recovery'],
    kind: 'scale',
    precision: 0,
    hint: 'How the area feels day to day — 1 (painful) to 5 (pain-free).',
  },
];

export const METRIC_BY_ID: Record<string, Metric> = Object.fromEntries(
  METRICS.map((m) => [m.id, m]),
);

/** Catalogue metrics offered under any of the given goals, in catalogue order. */
export function metricsForGoals(goals: GoalId[]): Metric[] {
  const wanted = new Set(goals);
  return METRICS.filter((m) => m.goals.some((g) => wanted.has(g)));
}

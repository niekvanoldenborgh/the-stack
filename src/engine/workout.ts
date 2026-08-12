import { EXERCISES, getExercise } from '../domain/exercises';
import { getPeptide } from '../domain/peptides';
import type {
  Exercise,
  ExercisePattern,
  GoalId,
  MuscleGroup,
  PlannedExercise,
  PlannedSession,
  PlannedSet,
  SessionFocus,
  Stack,
  UserProfile,
  WorkoutProgram,
  WorkoutSessionLog,
} from '../domain/types';

/**
 * Programme generation.
 *
 * The generator is deterministic: same profile and stack in, same programme
 * out. It works by filling a per-session list of movement-pattern slots from
 * the exercise library, filtered by what the user can safely handle, then
 * prescribing sets and reps from the goal.
 *
 * Where the peptide stack matters, it changes *how* you train rather than
 * *what* you train — a GLP-1 user needs intensity preserved in a deficit; a
 * GH-axis user needs conservative load progression because connective tissue
 * adapts more slowly than muscle. Those show up as session adjustments.
 */

interface Slot {
  pattern: ExercisePattern;
  role: 'primary' | 'secondary' | 'accessory';
  prefer?: MuscleGroup;
}

const TEMPLATES: Record<Exclude<SessionFocus, 'rest'>, { name: string; slots: Slot[] }> = {
  full_body: {
    name: 'Full Body',
    slots: [
      { pattern: 'squat', role: 'primary' },
      { pattern: 'horizontal_push', role: 'primary' },
      { pattern: 'horizontal_pull', role: 'primary' },
      { pattern: 'hinge', role: 'secondary' },
      { pattern: 'isolation', role: 'accessory', prefer: 'shoulders' },
      { pattern: 'carry', role: 'accessory', prefer: 'core' },
    ],
  },
  upper: {
    name: 'Upper Body',
    slots: [
      { pattern: 'horizontal_push', role: 'primary' },
      { pattern: 'horizontal_pull', role: 'primary' },
      { pattern: 'vertical_push', role: 'secondary' },
      { pattern: 'vertical_pull', role: 'secondary' },
      { pattern: 'isolation', role: 'accessory', prefer: 'shoulders' },
      { pattern: 'isolation', role: 'accessory', prefer: 'biceps' },
      { pattern: 'isolation', role: 'accessory', prefer: 'triceps' },
    ],
  },
  lower: {
    name: 'Lower Body',
    slots: [
      { pattern: 'squat', role: 'primary' },
      { pattern: 'hinge', role: 'primary' },
      { pattern: 'lunge', role: 'secondary' },
      { pattern: 'isolation', role: 'accessory', prefer: 'hamstrings' },
      { pattern: 'isolation', role: 'accessory', prefer: 'quads' },
      { pattern: 'isolation', role: 'accessory', prefer: 'calves' },
    ],
  },
  push: {
    name: 'Push',
    slots: [
      { pattern: 'horizontal_push', role: 'primary' },
      { pattern: 'vertical_push', role: 'primary' },
      { pattern: 'horizontal_push', role: 'secondary' },
      { pattern: 'isolation', role: 'accessory', prefer: 'chest' },
      { pattern: 'isolation', role: 'accessory', prefer: 'shoulders' },
      { pattern: 'isolation', role: 'accessory', prefer: 'triceps' },
    ],
  },
  pull: {
    name: 'Pull',
    slots: [
      { pattern: 'vertical_pull', role: 'primary' },
      { pattern: 'horizontal_pull', role: 'primary' },
      { pattern: 'horizontal_pull', role: 'secondary' },
      { pattern: 'isolation', role: 'accessory', prefer: 'shoulders' },
      { pattern: 'isolation', role: 'accessory', prefer: 'biceps' },
      { pattern: 'isolation', role: 'accessory', prefer: 'core' },
    ],
  },
  legs: {
    name: 'Legs',
    slots: [
      { pattern: 'squat', role: 'primary' },
      { pattern: 'hinge', role: 'primary' },
      { pattern: 'lunge', role: 'secondary' },
      { pattern: 'isolation', role: 'accessory', prefer: 'quads' },
      { pattern: 'isolation', role: 'accessory', prefer: 'hamstrings' },
      { pattern: 'isolation', role: 'accessory', prefer: 'calves' },
    ],
  },
  conditioning: {
    name: 'Conditioning',
    slots: [
      { pattern: 'conditioning', role: 'primary' },
      { pattern: 'carry', role: 'accessory', prefer: 'core' },
    ],
  },
};

function splitFor(profile: UserProfile): { focuses: SessionFocus[]; dayIndices: number[]; label: string } {
  const beginner = profile.experience === 'none';

  switch (profile.trainingDays) {
    case 2:
      return { focuses: ['full_body', 'full_body'], dayIndices: [0, 3], label: 'Full body ×2' };
    case 3:
      return beginner
        ? { focuses: ['full_body', 'full_body', 'full_body'], dayIndices: [0, 2, 4], label: 'Full body ×3' }
        : { focuses: ['push', 'pull', 'legs'], dayIndices: [0, 2, 4], label: 'Push / Pull / Legs' };
    case 4:
      return { focuses: ['upper', 'lower', 'upper', 'lower'], dayIndices: [0, 1, 3, 4], label: 'Upper / Lower ×2' };
    case 5:
      return {
        focuses: ['upper', 'lower', 'push', 'pull', 'legs'],
        dayIndices: [0, 1, 2, 4, 5],
        label: 'Upper / Lower + Push / Pull / Legs',
      };
    case 6:
      return {
        focuses: ['push', 'pull', 'legs', 'push', 'pull', 'legs'],
        dayIndices: [0, 1, 2, 3, 4, 5],
        label: 'Push / Pull / Legs ×2',
      };
  }
}

interface Constraints {
  maxTechnicalDemand: 1 | 2 | 3;
  maxJointStress: 1 | 2 | 3;
  maxFatiguePerSession: number;
  setAdjustment: number;
  rirAdjustment: number;
  restBonus: number;
}

function buildConstraints(profile: UserProfile): { constraints: Constraints; notes: string[] } {
  const notes: string[] = [];
  const constraints: Constraints = {
    maxTechnicalDemand: 3,
    maxJointStress: 3,
    maxFatiguePerSession: 14,
    setAdjustment: 0,
    rirAdjustment: 0,
    restBonus: 0,
  };

  if (profile.experience === 'none') {
    constraints.maxTechnicalDemand = 2;
    constraints.setAdjustment -= 1;
    constraints.rirAdjustment += 1;
    notes.push(
      'Exercise selection is limited to movements you can learn without coaching, and every set stops well short of failure. Technique first — load follows.',
    );
  } else if (profile.experience === 'some') {
    constraints.maxTechnicalDemand = 3;
  }

  if (profile.goals.includes('injury_recovery')) {
    constraints.maxJointStress = 2;
    constraints.rirAdjustment += 1;
    notes.push(
      'Injury recovery is one of your goals, so high joint-stress movements are excluded and the reps stay further from failure. Progressive loading is what remodels tendon — not rest, and not the peptide.',
    );
  }

  if (profile.sleepHours < 6.5 || profile.sleepQuality <= 2) {
    constraints.setAdjustment -= 1;
    constraints.maxFatiguePerSession = 11;
    notes.push(
      `You reported ${profile.sleepHours} hours of sleep at quality ${profile.sleepQuality}/5. Volume is cut by roughly a fifth — training you cannot recover from is training that does not count.`,
    );
  }

  if (profile.age >= 50) {
    constraints.restBonus += 30;
    constraints.maxJointStress = Math.min(constraints.maxJointStress, 2) as 1 | 2 | 3;
    notes.push('Rest periods are extended and joint-stressful movements limited, which matters more than total volume from your fifties onward.');
  }

  if (profile.activity === 'sedentary' && profile.experience === 'none') {
    constraints.setAdjustment -= 1;
    notes.push('Starting from a sedentary baseline — the first four weeks are deliberately easy so you can build the habit before you build the volume.');
  }

  return { constraints, notes };
}

interface Prescription {
  sets: number;
  reps: number;
  rir: number;
  restSeconds: number;
}

function prescribe(goals: GoalId[], role: Slot['role'], constraints: Constraints): Prescription {
  const primaryGoal = goals[0];
  let base: Prescription;

  if (role === 'primary') {
    if (primaryGoal === 'bone_density') base = { sets: 4, reps: 5, rir: 2, restSeconds: 180 };
    else if (primaryGoal === 'build_muscle' || primaryGoal === 'gain_weight') base = { sets: 4, reps: 7, rir: 2, restSeconds: 150 };
    else if (primaryGoal === 'injury_recovery') base = { sets: 3, reps: 12, rir: 3, restSeconds: 90 };
    else if (primaryGoal === 'lose_fat') base = { sets: 3, reps: 8, rir: 2, restSeconds: 120 };
    else base = { sets: 3, reps: 8, rir: 2, restSeconds: 120 };
  } else if (role === 'secondary') {
    base = { sets: 3, reps: 10, rir: 2, restSeconds: 90 };
  } else {
    base = { sets: 3, reps: 13, rir: 1, restSeconds: 60 };
  }

  return {
    sets: Math.max(2, base.sets + constraints.setAdjustment),
    reps: base.reps,
    rir: Math.min(4, base.rir + constraints.rirAdjustment),
    restSeconds: base.restSeconds + constraints.restBonus,
  };
}

function eligible(exercise: Exercise, slot: Slot, constraints: Constraints): boolean {
  if (exercise.pattern !== slot.pattern) return false;
  if (exercise.technicalDemand > constraints.maxTechnicalDemand) return false;
  if (exercise.jointStress > constraints.maxJointStress) return false;
  if (slot.prefer && !exercise.primary.includes(slot.prefer)) return false;
  return true;
}

/**
 * Picks an exercise for a slot, preferring ones used least often so far in the
 * programme. Falls back progressively: exact preference, then any exercise in
 * the pattern, then null.
 */
function pickExercise(
  slot: Slot,
  constraints: Constraints,
  usage: Map<string, number>,
  usedThisSession: Set<string>,
): Exercise | null {
  const tiers: Array<(e: Exercise) => boolean> = [
    (e) => eligible(e, slot, constraints),
    (e) => eligible(e, { ...slot, prefer: undefined }, constraints),
    (e) => e.pattern === slot.pattern && e.technicalDemand <= constraints.maxTechnicalDemand,
  ];

  for (const test of tiers) {
    const candidates = EXERCISES.filter((e) => test(e) && !usedThisSession.has(e.id));
    if (candidates.length === 0) continue;
    candidates.sort((a, b) => {
      const usageDelta = (usage.get(a.id) ?? 0) - (usage.get(b.id) ?? 0);
      if (usageDelta !== 0) return usageDelta;
      if (a.compound !== b.compound) return a.compound ? -1 : 1;
      return EXERCISES.indexOf(a) - EXERCISES.indexOf(b);
    });
    return candidates[0]!;
  }
  return null;
}

/** Training-relevant guidance derived from what is in the peptide stack. */
export function stackTrainingNotes(stack: Stack | null): string[] {
  if (!stack) return [];
  const notes: string[] = [];
  const peptides = stack.items.map((i) => getPeptide(i.peptideId)).filter(Boolean);
  const has = (predicate: (id: string, classes: string[]) => boolean) =>
    peptides.some((p) => p && predicate(p.id, p.classes));

  if (has((_, classes) => classes.includes('incretin'))) {
    notes.push(
      'You are running a GLP-1 drug. Muscle retention in a deficit is driven by training intensity and protein, not by extra volume — keep the loads heavy and aim for at least 1.6 g of protein per kg. Expect strength to stall; that is normal in a deficit and is not a reason to add sets.',
    );
  }

  if (has((_, classes) => classes.includes('ghrh_analog') || classes.includes('ghrp_secretagogue') || classes.includes('growth_hormone'))) {
    notes.push(
      'GH-axis compounds increase fluid retention, which can both mask and mimic joint pain. Progress load conservatively — muscle adapts faster than tendon, and the gap is where injuries happen. If your grip or hands feel numb, that is the compound, not the training.',
    );
  }

  if (has((id) => id === 'mk-677')) {
    notes.push(
      'MK-677 will add several kilograms of water in the first fortnight. Do not read that as muscle, and do not chase it by adding volume.',
    );
  }

  if (has((_, classes) => classes.includes('healing_repair'))) {
    notes.push(
      'You are running healing peptides. The evidence that actually supports tendon and soft-tissue remodelling is progressive mechanical loading. Treat the peptide as the adjunct and the rehab loading as the treatment.',
    );
  }

  return notes;
}

export function generateProgram(profile: UserProfile, stack: Stack | null = null): WorkoutProgram {
  const { focuses, dayIndices, label } = splitFor(profile);
  const { constraints, notes } = buildConstraints(profile);

  const usage = new Map<string, number>();
  const wantsConditioning = profile.goals.includes('lose_fat') || profile.goals.includes('metabolic_health');
  const wantsImpact = profile.goals.includes('bone_density');

  const sessions: PlannedSession[] = focuses.map((focus, index) => {
    const template = TEMPLATES[focus as Exclude<SessionFocus, 'rest'>];
    const usedThisSession = new Set<string>();
    const exercises: PlannedExercise[] = [];
    const adjustments: string[] = [];
    let fatigue = 0;

    for (const slot of template.slots) {
      const exercise = pickExercise(slot, constraints, usage, usedThisSession);
      if (!exercise) continue;

      if (fatigue + exercise.fatigueCost > constraints.maxFatiguePerSession) {
        adjustments.push('Session trimmed to keep total fatigue within what your recovery can support.');
        break;
      }

      const rx = prescribe(profile.goals, slot.role, constraints);
      const sets: PlannedSet[] = Array.from({ length: rx.sets }, () => ({ reps: rx.reps, rir: rx.rir }));

      exercises.push({ exerciseId: exercise.id, sets, restSeconds: rx.restSeconds });
      usedThisSession.add(exercise.id);
      usage.set(exercise.id, (usage.get(exercise.id) ?? 0) + 1);
      fatigue += exercise.fatigueCost;
    }

    // Conditioning finisher rather than an extra training day — respects the
    // number of days the user actually said they can train.
    if (wantsConditioning && index % 2 === 0) {
      const conditioning = getExercise('incline-walk');
      if (conditioning && !usedThisSession.has(conditioning.id)) {
        exercises.push({
          exerciseId: conditioning.id,
          sets: [{ reps: 1, rir: 4 }],
          restSeconds: 0,
          note: '20 minutes at a brisk pace on an incline. Low interference with lifting recovery.',
        });
        adjustments.push('Conditioning finisher added for your fat-loss and metabolic goals.');
      }
    }

    if (wantsImpact && (focus === 'legs' || focus === 'lower' || focus === 'full_body') && constraints.maxJointStress >= 3) {
      const impact = getExercise('jump-rope');
      if (impact && !usedThisSession.has(impact.id)) {
        exercises.push({
          exerciseId: impact.id,
          sets: [{ reps: 1, rir: 4 }],
          restSeconds: 60,
          note: '3 rounds of 60 seconds. Bone responds to impact and load rate — heavy lifting plus impact beats either alone.',
        });
        adjustments.push('Impact work added for bone density. Skip it if you have any current lower-limb injury.');
      }
    }

    const estimatedMinutes = Math.round(
      exercises.reduce((total, ex) => total + ex.sets.length * (ex.restSeconds + 45), 0) / 60 + 8,
    );

    return {
      id: `session_${index}`,
      dayIndex: dayIndices[index]!,
      focus,
      name: template.name,
      exercises,
      estimatedMinutes,
      adjustments,
    };
  });

  const deloadEveryWeeks = profile.sleepHours < 6.5 ? 4 : profile.experience === 'experienced' ? 6 : 5;

  return {
    id: `program_${Date.now().toString(36)}`,
    name: `${label} — ${profile.trainingDays} days`,
    createdAt: new Date().toISOString(),
    daysPerWeek: profile.trainingDays,
    split: label,
    goals: profile.goals,
    deloadEveryWeeks,
    sessions,
    rationale: [
      `${label} chosen for ${profile.trainingDays} training days a week.`,
      ...notes,
      ...stackTrainingNotes(stack),
      `Deload every ${deloadEveryWeeks} weeks: same exercises, half the sets, stop 4 reps short of failure.`,
    ],
  };
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

export function sessionVolume(log: WorkoutSessionLog): number {
  return log.exercises.reduce(
    (total, exercise) => total + exercise.sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0),
    0,
  );
}

/** Epley estimate of a one-rep max. Reliable enough under about 10 reps. */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

export interface ExerciseProgress {
  exerciseId: string;
  name: string;
  bestEstimatedMax: number;
  lastVolume: number;
  sessions: number;
  /** Percentage change in estimated max between first and most recent session. */
  trendPct: number | null;
}

export function progressByExercise(logs: WorkoutSessionLog[]): ExerciseProgress[] {
  const byExercise = new Map<string, { maxes: number[]; volumes: number[]; count: number }>();

  const ordered = [...logs].sort((a, b) => a.date.localeCompare(b.date));

  for (const log of ordered) {
    for (const exercise of log.exercises) {
      const entry = byExercise.get(exercise.exerciseId) ?? { maxes: [], volumes: [], count: 0 };
      const best = exercise.sets.reduce((max, set) => Math.max(max, estimatedOneRepMax(set.weightKg, set.reps)), 0);
      const volume = exercise.sets.reduce((sum, set) => sum + set.reps * set.weightKg, 0);
      if (best > 0) entry.maxes.push(best);
      entry.volumes.push(volume);
      entry.count += 1;
      byExercise.set(exercise.exerciseId, entry);
    }
  }

  return [...byExercise.entries()]
    .map(([exerciseId, entry]) => {
      const first = entry.maxes[0];
      const last = entry.maxes[entry.maxes.length - 1];
      const trendPct = first && last && first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : null;
      return {
        exerciseId,
        name: getExercise(exerciseId)?.name ?? exerciseId,
        bestEstimatedMax: entry.maxes.length > 0 ? Math.max(...entry.maxes) : 0,
        lastVolume: entry.volumes[entry.volumes.length - 1] ?? 0,
        sessions: entry.count,
        trendPct,
      };
    })
    .sort((a, b) => b.sessions - a.sessions);
}

/**
 * Suggests the next working load from the last logged session using a simple
 * double-progression rule: if you hit the top of the rep range with reps left
 * in reserve, add load; if you missed the bottom, take load off.
 */
export function suggestNextLoad(
  lastSets: Array<{ reps: number; weightKg: number; rir?: number }>,
  targetReps: number,
): { weightKg: number; note: string } | null {
  if (lastSets.length === 0) return null;
  const top = lastSets.reduce((best, set) => (set.weightKg > best.weightKg ? set : best), lastSets[0]!);
  if (top.weightKg <= 0) return null;

  const hitTarget = top.reps >= targetReps;
  const hadReserve = (top.rir ?? 0) >= 2;

  if (hitTarget && hadReserve) {
    const increment = top.weightKg >= 60 ? 5 : 2.5;
    return {
      weightKg: top.weightKg + increment,
      note: `You hit ${top.reps} reps with reps left over. Add ${increment} kg.`,
    };
  }
  if (hitTarget) {
    return { weightKg: top.weightKg, note: 'Target reps hit but close to failure. Repeat this load and add reps.' };
  }
  if (top.reps < targetReps - 2) {
    const decrement = top.weightKg >= 60 ? 5 : 2.5;
    return {
      weightKg: Math.max(0, top.weightKg - decrement),
      note: `You fell ${targetReps - top.reps} reps short. Drop ${decrement} kg and rebuild.`,
    };
  }
  return { weightKg: top.weightKg, note: 'Stay at this load until you reach the top of the rep range.' };
}

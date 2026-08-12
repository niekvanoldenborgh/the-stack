import { PEPTIDES, getPeptide } from '../domain/peptides';
import type {
  GoalId,
  Peptide,
  PeptideClass,
  RiskTolerance,
  Stack,
  StackItem,
  UserProfile,
} from '../domain/types';
import { computeDose } from './dosing';
import { evaluateStack, findInteractions, isPeptideAllowed } from './safety';

/**
 * Stack generation.
 *
 * The engine is a constrained greedy selection: score every eligible compound
 * against the user's weighted goals, then build the stack goal-by-goal in
 * priority order, rejecting any candidate that would introduce a high or
 * critical interaction with what has already been picked.
 *
 * Two rules are absolute and sit outside the scoring:
 *   1. Compounds with an absolute contraindication for this user are never
 *      candidates.
 *   2. Compounds whose dose guidance is withheld are never auto-recommended.
 *      A user can still add them by hand in the builder, with the warnings —
 *      but the app will not put them in front of someone who did not ask.
 */

export interface GenerationOptions {
  /** Overrides the experience-derived cap on injectable compounds. */
  maxInjectables?: number;
  maxTopicals?: number;
  /** Exclude compounds requiring a prescription. */
  excludePrescription?: boolean;
  /** Exclude anything not approved for human use. */
  excludeResearchChemicals?: boolean;
  startDate?: string;
}

interface ScoredCandidate {
  peptide: Peptide;
  raw: number;
  servesGoals: GoalId[];
  reasons: string[];
}

/** Classes where stacking two members is never productive. */
const EXCLUSIVE_CLASSES: PeptideClass[] = [
  'ghrp_secretagogue',
  'ghrh_analog',
  'incretin',
  'melanocortin',
  'growth_hormone',
  'igf',
  'thymic_immune',
];

/**
 * Goals are weighted by the order the user ranked them. The first goal carries
 * full weight and later ones decay, so a stack built for "lose fat, then skin"
 * is not the same as one built for "skin, then lose fat".
 */
function goalWeights(goals: GoalId[]): Map<GoalId, number> {
  const weights = new Map<GoalId, number>();
  goals.forEach((goal, index) => {
    weights.set(goal, 1 / (1 + 0.3 * index));
  });
  return weights;
}

/**
 * How thin evidence is penalised in ranking.
 *
 * Deliberately independent of the risk dial: which compounds you are shown is a
 * function of your goals, your health history and the interaction rules, and
 * nothing else. The dial moves the dose only.
 */
function evidenceAdjustment(peptide: Peptide): { delta: number; reason?: string } {
  switch (peptide.evidence) {
    case 'A':
      return { delta: 3, reason: 'Backed by randomised human trials.' };
    case 'B':
      return { delta: 1.5, reason: 'Some human trial evidence.' };
    case 'C':
      return { delta: -0.5 };
    case 'D':
      return { delta: -2.5 };
  }
}

function statusAdjustment(peptide: Peptide): { delta: number; reason?: string } {
  switch (peptide.legalStatus) {
    case 'cosmetic_otc':
      return { delta: 1.5, reason: 'Regulated cosmetic ingredient — low systemic risk.' };
    case 'supplement':
      return { delta: 0.5 };
    case 'prescription':
      return { delta: -0.5, reason: 'Requires a prescription and clinical supervision.' };
    case 'research_chemical':
      return { delta: -1.5, reason: 'Not approved for human use; supply is unregulated.' };
  }
}

function profileAdjustment(peptide: Peptide, profile: UserProfile): { delta: number; reason?: string } {
  let delta = 0;
  let reason: string | undefined;

  const severeCount = peptide.sideEffects.filter((s) => s.severity === 'severe').length;
  delta -= severeCount * 0.6;

  // Age is no longer a gate, so it has to show up in the ranking instead:
  // steer younger users away from the growth-hormone axis rather than
  // silently offering it as though nothing were different.
  if (profile.age < 21 && peptide.classes.some((c) => c === 'ghrh_analog' || c === 'ghrp_secretagogue' || c === 'growth_hormone' || c === 'igf')) {
    delta -= profile.age < 18 ? 4 : 2;
    reason =
      profile.age < 18
        ? 'Heavily downweighted — you are under 18 and this acts on growth plates that have not closed.'
        : 'Downweighted — your growth plates may not be fully closed yet.';
  }

  if (profile.experience === 'none') {
    // Steer beginners away from the more demanding end of the catalogue.
    if (peptide.evidence === 'D' || peptide.evidence === 'C') delta -= 1.5;
    if (severeCount >= 2) {
      delta -= 2;
      reason = 'Held back because this is your first cycle and this compound has serious documented risks.';
    }
    if (peptide.routes.includes('topical') && !peptide.routes.includes('subcutaneous')) {
      delta += 1;
      reason = 'Topical and low-risk — a sensible place to start.';
    }
  }

  if (profile.activity === 'sedentary' && peptide.classes.some((c) => c === 'ghrh_analog' || c === 'ghrp_secretagogue')) {
    delta -= 1.5;
    reason = 'Downweighted — GH-axis compounds have little to act on without a training stimulus.';
  }

  if (profile.sleepHours < 6 && peptide.classes.some((c) => c === 'ghrh_analog' || c === 'ghrp_secretagogue')) {
    delta -= 1.5;
    reason = 'Downweighted — most GH release happens in deep sleep, and you are not getting enough of it for this to work well.';
  }

  return { delta, reason };
}

function scoreCandidate(peptide: Peptide, profile: UserProfile, weights: Map<GoalId, number>): ScoredCandidate {
  let raw = 0;
  const servesGoals: GoalId[] = [];
  const reasons: string[] = [];

  for (const [goal, weight] of weights) {
    const fit = peptide.goalFit[goal] ?? 0;
    if (fit === 0) continue;
    raw += fit * weight * 2;
    if (fit > 0) servesGoals.push(goal);
  }

  // A compound that does nothing for any stated goal is not a candidate.
  if (servesGoals.length === 0) {
    return { peptide, raw: -Infinity, servesGoals: [], reasons: [] };
  }

  const evidence = evidenceAdjustment(peptide);
  raw += evidence.delta;
  if (evidence.reason) reasons.push(evidence.reason);

  const status = statusAdjustment(peptide);
  raw += status.delta;
  if (status.reason) reasons.push(status.reason);

  const profileAdj = profileAdjustment(peptide, profile);
  raw += profileAdj.delta;
  if (profileAdj.reason) reasons.push(profileAdj.reason);

  return { peptide, raw, servesGoals, reasons };
}

function isInjectable(peptide: Peptide): boolean {
  return peptide.routes.includes('subcutaneous') || peptide.routes.includes('intramuscular');
}

/**
 * Stack width, set by experience alone. The risk dial does not widen or narrow
 * the stack — it only moves the dose.
 */
function stackCaps(profile: UserProfile): { injectables: number; topicals: number } {
  return {
    injectables: { none: 2, some: 3, experienced: 4 }[profile.experience],
    topicals: profile.experience === 'experienced' ? 3 : 2,
  };
}

/** Would adding this peptide create a high or critical interaction? */
function conflictsWithSelection(candidate: Peptide, selected: Peptide[]): string | null {
  const findings = findInteractions([...selected.map((p) => p.id), candidate.id]);
  const blocking = findings.find(
    (f) => (f.severity === 'critical' || f.severity === 'high') && f.peptideIds.includes(candidate.id),
  );
  return blocking ? blocking.title : null;
}

function violatesClassCap(candidate: Peptide, selected: Peptide[]): boolean {
  for (const cls of EXCLUSIVE_CLASSES) {
    if (!candidate.classes.includes(cls)) continue;
    if (selected.some((p) => p.classes.includes(cls))) return true;
  }
  return false;
}

function buildRationale(candidate: ScoredCandidate, profile: UserProfile): string {
  const goalNames = candidate.servesGoals.map((g) => GOAL_LABELS[g]).join(' and ');
  const lead = `Selected for ${goalNames}.`;
  const extra = candidate.reasons.slice(0, 2).join(' ');
  const reality =
    candidate.peptide.evidence === 'C' || candidate.peptide.evidence === 'D'
      ? ' Note that the evidence for this is animal or anecdotal, not human trials.'
      : '';
  void profile;
  return `${lead} ${extra}${reality}`.trim();
}

const GOAL_LABELS: Record<GoalId, string> = {
  lose_fat: 'fat loss',
  gain_weight: 'weight gain',
  build_muscle: 'muscle gain',
  metabolic_health: 'metabolic health',
  bone_density: 'bone strength',
  hair_growth: 'hair growth',
  acne_control: 'acne control',
  skin_quality: 'skin quality',
  injury_recovery: 'injury recovery',
  sleep_quality: 'sleep quality',
};

export function generateStack(profile: UserProfile, options: GenerationOptions = {}): Stack {
  const weights = goalWeights(profile.goals);
  const caps = stackCaps(profile);
  const maxInjectables = options.maxInjectables ?? caps.injectables;
  const maxTopicals = options.maxTopicals ?? caps.topicals;

  // What the user is already running is treated as fixed context: never
  // re-recommended, and every candidate is checked against it for interactions
  // and duplicate classes exactly as if it were already in the stack.
  const currentIds = new Set(profile.currentPeptides ?? []);
  const currentPeptides = [...currentIds]
    .map(getPeptide)
    .filter((p): p is Peptide => Boolean(p));

  const candidates = PEPTIDES.filter((peptide) => {
    if (peptide.doseGuidanceWithheld) return false;
    if (currentIds.has(peptide.id)) return false;
    if (options.excludePrescription && peptide.legalStatus === 'prescription') return false;
    if (options.excludeResearchChemicals && peptide.legalStatus === 'research_chemical') return false;
    return isPeptideAllowed(peptide, profile).allowed;
  })
    .map((peptide) => scoreCandidate(peptide, profile, weights))
    .filter((c) => Number.isFinite(c.raw) && c.raw > 0)
    .sort((a, b) => b.raw - a.raw);

  const selected: ScoredCandidate[] = [];
  let injectableCount = 0;
  let topicalCount = 0;

  const tryAdd = (candidate: ScoredCandidate): boolean => {
    const peptide = candidate.peptide;
    if (selected.some((s) => s.peptide.id === peptide.id)) return false;

    const injectable = isInjectable(peptide);
    if (injectable && injectableCount >= maxInjectables) return false;
    if (!injectable && topicalCount >= maxTopicals) return false;

    const context = [...selected.map((s) => s.peptide), ...currentPeptides];
    if (violatesClassCap(peptide, context)) return false;
    if (conflictsWithSelection(peptide, context)) return false;

    selected.push(candidate);
    if (injectable) injectableCount++;
    else topicalCount++;
    return true;
  };

  // Pass 1 — cover each goal in the user's priority order, so the top goal is
  // guaranteed representation rather than being crowded out by a compound that
  // scores well across several lower-priority goals.
  for (const goal of profile.goals) {
    const covered = selected.some((s) => s.servesGoals.includes(goal));
    if (covered) continue;
    const best = candidates.find((c) => c.servesGoals.includes(goal));
    if (best) tryAdd(best);
  }

  // Pass 2 — fill remaining capacity with the highest scorers.
  for (const candidate of candidates) {
    if (injectableCount >= maxInjectables && topicalCount >= maxTopicals) break;
    tryAdd(candidate);
  }

  const maxRaw = selected.reduce((max, c) => Math.max(max, c.raw), 1);

  const items: StackItem[] = selected.map((candidate) => {
    const peptide = candidate.peptide;
    const computation = computeDose(peptide, profile);
    return {
      peptideId: peptide.id,
      dose: computation.dose,
      startDose: computation.startDose,
      timesPerDay: peptide.frequency.timesPerDay,
      daysPerWeek: peptide.frequency.daysPerWeek,
      preferredTimes: peptide.frequency.preferredTimes,
      onWeeks: peptide.cycle.onWeeks,
      offWeeks: peptide.cycle.offWeeks,
      rationale: buildRationale(candidate, profile),
      score: Math.max(1, Math.round((candidate.raw / maxRaw) * 100)),
      servesGoals: candidate.servesGoals,
      doseWithheld: computation.withheld,
    };
  });

  const startDate = options.startDate ?? new Date().toISOString().slice(0, 10);
  const safety = evaluateStack(
    items.map((i) => i.peptideId),
    profile,
  );

  return {
    id: `stack_${Date.now().toString(36)}`,
    name: buildStackName(profile.goals),
    origin: 'generated',
    createdAt: new Date().toISOString(),
    startDate,
    items,
    goals: profile.goals,
    safety,
  };
}

function buildStackName(goals: GoalId[]): string {
  if (goals.length === 0) return 'My Stack';
  const primary = goals[0]!;
  const label = GOAL_LABELS[primary];
  return `${label.charAt(0).toUpperCase()}${label.slice(1)} stack`;
}

/**
 * Explains why a compound the user might expect to see is absent. Powers the
 * "why isn't X here?" list, which is often more informative than the stack.
 */
export interface Exclusion {
  peptideId: string;
  name: string;
  reason: string;
}

export function explainExclusions(profile: UserProfile, stack: Stack): Exclusion[] {
  const included = new Set(stack.items.map((i) => i.peptideId));
  const currentIds = new Set(profile.currentPeptides ?? []);
  const risk = profile.riskTolerance ?? 3;

  const context = [
    ...stack.items.map((i) => getPeptide(i.peptideId)),
    ...[...currentIds].map(getPeptide),
  ].filter((p): p is Peptide => Boolean(p));

  const exclusions: Exclusion[] = [];

  for (const peptide of PEPTIDES) {
    if (included.has(peptide.id)) continue;

    const servesAGoal = profile.goals.some((g) => (peptide.goalFit[g] ?? 0) > 0);
    if (!servesAGoal) continue;

    if (currentIds.has(peptide.id)) {
      exclusions.push({
        peptideId: peptide.id,
        name: peptide.name,
        reason: 'You told us you are already running this, so it was not re-recommended.',
      });
      continue;
    }

    if (peptide.doseGuidanceWithheld) {
      exclusions.push({
        peptideId: peptide.id,
        name: peptide.name,
        reason: 'Never auto-recommended — the app withholds dose guidance for this compound.',
      });
      continue;
    }

    const allowed = isPeptideAllowed(peptide, profile);
    if (!allowed.allowed) {
      exclusions.push({ peptideId: peptide.id, name: peptide.name, reason: allowed.reason ?? 'Contraindicated for you.' });
      continue;
    }

    const conflict = conflictsWithSelection(peptide, context);
    if (conflict) {
      exclusions.push({ peptideId: peptide.id, name: peptide.name, reason: `Would conflict with your stack: ${conflict}.` });
      continue;
    }

    if (violatesClassCap(peptide, context)) {
      exclusions.push({
        peptideId: peptide.id,
        name: peptide.name,
        reason: 'You already have a compound from the same class — a second adds side effects without adding effect.',
      });
      continue;
    }

    exclusions.push({
      peptideId: peptide.id,
      name: peptide.name,
      reason: 'Scored below the compounds that were selected for your goals.',
    });
  }

  return exclusions;
}

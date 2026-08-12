import { GOAL_CONFLICTS } from '../domain/goals';
import { INTERACTION_RULES } from '../domain/interactions';
import { getPeptide } from '../domain/peptides';
import type {
  ContraindicationFinding,
  GoalConflictFinding,
  GoalId,
  InteractionFinding,
  InteractionSeverity,
  Matcher,
  Peptide,
  RedFlag,
  SafetyNotice,
  SafetyReport,
  SideEffect,
  UserProfile,
} from '../domain/types';

/**
 * The safety engine.
 *
 * Everything here is pure: given a set of peptide ids and a profile, produce a
 * report. No UI, no storage. That makes it directly testable, which matters
 * more here than anywhere else in the app.
 */

const SEVERITY_ORDER: Record<InteractionSeverity, number> = {
  critical: 0,
  high: 1,
  moderate: 2,
  info: 3,
};

function matches(matcher: Matcher, peptide: Peptide): boolean {
  return matcher.kind === 'peptide'
    ? matcher.id === peptide.id
    : peptide.classes.includes(matcher.value);
}

/**
 * Evaluates interaction rules over every unordered pair in the stack.
 *
 * A rule fires when the pair matches (a,b) in either direction. `selfPairing`
 * rules — "two of this class" — additionally require that both peptides match
 * the same matcher, which is how they differ from ordinary cross-class rules.
 */
export function findInteractions(peptideIds: string[]): InteractionFinding[] {
  const peptides = peptideIds.map(getPeptide).filter((p): p is Peptide => Boolean(p));
  const findings: InteractionFinding[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < peptides.length; i++) {
    for (let j = i + 1; j < peptides.length; j++) {
      const first = peptides[i]!;
      const second = peptides[j]!;

      for (const rule of INTERACTION_RULES) {
        const forward = matches(rule.a, first) && matches(rule.b, second);
        const backward = matches(rule.a, second) && matches(rule.b, first);
        if (!forward && !backward) continue;

        // A self-pairing rule such as "two GHRPs" must not fire for a pair
        // that only satisfies it because one peptide matches both sides.
        if (rule.selfPairing) {
          const bothMatchA = matches(rule.a, first) && matches(rule.a, second);
          if (!bothMatchA) continue;
        }

        const key = `${rule.id}:${[first.id, second.id].sort().join('+')}`;
        if (seen.has(key)) continue;
        seen.add(key);

        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          title: rule.title,
          detail: rule.detail,
          guidance: rule.guidance,
          peptideIds: [first.id, second.id],
        });
      }
    }
  }

  return findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/**
 * Compounds that act on the growth-hormone / IGF-1 axis. These are the ones
 * where age genuinely changes the risk rather than just the dose, because
 * IGF-1 drives epiphyseal (growth plate) activity.
 */
const DEVELOPMENTAL_CLASSES = ['ghrh_analog', 'ghrp_secretagogue', 'growth_hormone', 'igf'] as const;

export function affectsDevelopment(peptide: Peptide): boolean {
  return peptide.classes.some((c) => (DEVELOPMENTAL_CLASSES as readonly string[]).includes(c));
}

export function findContraindications(
  peptideIds: string[],
  profile: Pick<UserProfile, 'healthFlags' | 'age'>,
): ContraindicationFinding[] {
  const flags = new Set(profile.healthFlags);
  // Age is authoritative — an under-18 user is under 18 whether or not they
  // ticked the box. This surfaces as a prominent warning rather than a block;
  // see `buildAgeNotices`.
  if (profile.age < 18) flags.add('under_18');

  const findings: ContraindicationFinding[] = [];

  for (const id of peptideIds) {
    const peptide = getPeptide(id);
    if (!peptide) continue;
    for (const c of peptide.contraindications) {
      if (!flags.has(c.flag)) continue;
      findings.push({ peptideId: peptide.id, flag: c.flag, kind: c.kind, reason: c.reason });
    }
  }

  return findings.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'absolute' ? -1 : 1));
}

export function findGoalConflicts(goals: GoalId[]): GoalConflictFinding[] {
  const set = new Set(goals);
  return GOAL_CONFLICTS.filter((c) => set.has(c.goals[0]) && set.has(c.goals[1])).map((c) => ({
    goals: c.goals,
    detail: c.detail,
    guidance: c.guidance,
  }));
}

const LIKELIHOOD_ORDER = { common: 0, uncommon: 1, rare: 2 } as const;
const SIDE_EFFECT_SEVERITY_ORDER = { severe: 0, moderate: 1, mild: 2 } as const;

/**
 * Merges side effects across a stack. Effects reported by more than one
 * compound are surfaced once, with every contributing peptide attached — that
 * co-occurrence is the useful signal ("three things in this stack cause fluid
 * retention").
 */
export function aggregateSideEffects(
  peptideIds: string[],
): Array<SideEffect & { peptideIds: string[] }> {
  const merged = new Map<string, SideEffect & { peptideIds: string[] }>();

  for (const id of peptideIds) {
    const peptide = getPeptide(id);
    if (!peptide) continue;
    for (const effect of peptide.sideEffects) {
      const key = effect.label.toLowerCase();
      const existing = merged.get(key);
      if (existing) {
        existing.peptideIds.push(peptide.id);
        // Keep the worst characterisation across contributing compounds.
        if (SIDE_EFFECT_SEVERITY_ORDER[effect.severity] < SIDE_EFFECT_SEVERITY_ORDER[existing.severity]) {
          existing.severity = effect.severity;
        }
        if (LIKELIHOOD_ORDER[effect.likelihood] < LIKELIHOOD_ORDER[existing.likelihood]) {
          existing.likelihood = effect.likelihood;
        }
      } else {
        merged.set(key, { ...effect, peptideIds: [peptide.id] });
      }
    }
  }

  return [...merged.values()].sort((a, b) => {
    // Effects shared by several compounds rank above one-offs of equal severity.
    const bySeverity =
      SIDE_EFFECT_SEVERITY_ORDER[a.severity] - SIDE_EFFECT_SEVERITY_ORDER[b.severity];
    if (bySeverity !== 0) return bySeverity;
    const byCount = b.peptideIds.length - a.peptideIds.length;
    if (byCount !== 0) return byCount;
    return LIKELIHOOD_ORDER[a.likelihood] - LIKELIHOOD_ORDER[b.likelihood];
  });
}

export function aggregateRedFlags(peptideIds: string[]): Array<RedFlag & { peptideIds: string[] }> {
  const merged = new Map<string, RedFlag & { peptideIds: string[] }>();
  for (const id of peptideIds) {
    const peptide = getPeptide(id);
    if (!peptide) continue;
    for (const flag of peptide.redFlags) {
      const key = flag.symptom.toLowerCase();
      const existing = merged.get(key);
      if (existing) existing.peptideIds.push(peptide.id);
      else merged.set(key, { ...flag, peptideIds: [peptide.id] });
    }
  }
  return [...merged.values()];
}

/**
 * Age-related warnings.
 *
 * These replace what used to be a hard age gate. A blanket refusal told a
 * younger user nothing except that the app would not talk to them; these tell
 * them the specific, concrete reason the GH axis is the wrong thing to touch
 * while it is still developing. Growth plate closure is a range, not a
 * birthday, so the warning is graded rather than binary.
 */
function buildAgeNotices(peptides: Peptide[], profile: UserProfile): SafetyNotice[] {
  const developmental = peptides.filter(affectsDevelopment);
  if (developmental.length === 0) return [];

  const names = developmental.map((p) => p.name).join(', ');
  const notices: SafetyNotice[] = [];

  if (profile.age < 18) {
    notices.push({
      id: 'age-under-18',
      severity: 'critical',
      title: `You are ${profile.age} — this stack acts on a system that is still developing`,
      detail:
        `${names} raise growth hormone and IGF-1. Before your growth plates close, IGF-1 does not just build muscle — it acts directly on the plates themselves. Getting this wrong can permanently change your adult height and bone proportions, and it cannot be undone once it happens.\n\n` +
        'There is also no safety data for any of these compounds in under-18s, because those trials are not run. Every dose figure in this app is extrapolated from adults.\n\n' +
        'If you want to change how you look at your age, resistance training, enough protein and enough sleep genuinely do work, and your own natural GH output is already at its lifetime peak. Please talk to a doctor before starting any of this.',
    });
  } else if (profile.age < 21) {
    notices.push({
      id: 'age-under-21',
      severity: 'high',
      title: `You are ${profile.age} — your growth plates may not be fully closed`,
      detail:
        `${names} act on the growth-hormone axis. Epiphyseal plates typically finish closing between roughly 18 and 21, later in males than females, so skeletal changes are still possible at your age. A hand or wrist X-ray is the only way to actually know where you are.\n\n` +
        'Your own GH output is also near its lifetime peak right now, which means there is less headroom to gain and side effects tend to appear at lower doses.',
    });
  } else if (profile.age < 25) {
    notices.push({
      id: 'age-under-25',
      severity: 'moderate',
      title: 'Your natural GH output is near its peak',
      detail:
        `Under about 25, endogenous growth hormone and IGF-1 are close to their lifetime maximum. ${names} therefore add less than they would for an older user, while fluid retention, joint pain and acne tend to show up at lower doses. The engine has already reduced your dose to account for this.`,
    });
  }

  return notices;
}

/**
 * Stack-level observations that no single pairwise rule would catch.
 */
function buildNotices(peptides: Peptide[], profile: UserProfile): SafetyNotice[] {
  const notices: SafetyNotice[] = [...buildAgeNotices(peptides, profile)];

  const ghAxis = peptides.filter((p) =>
    p.classes.some((c) => c === 'ghrh_analog' || c === 'ghrp_secretagogue' || c === 'growth_hormone' || c === 'igf'),
  );
  if (ghAxis.length >= 2) {
    notices.push({
      id: 'igf1-load',
      severity: ghAxis.length >= 3 ? 'high' : 'moderate',
      title: `${ghAxis.length} compounds in this stack raise IGF-1`,
      detail:
        'IGF-1 is the shared endpoint of the whole GH axis. Fluid retention, carpal tunnel symptoms, acne, joint pain and reduced insulin sensitivity all scale with total IGF-1, not with the number of separate compounds. Get a baseline IGF-1 blood test and recheck at 8 weeks — it is the only way to know where you actually are.',
    });
  }

  const research = peptides.filter((p) => p.legalStatus === 'research_chemical');
  if (research.length > 0) {
    notices.push({
      id: 'research-chemicals',
      severity: 'high',
      title: `${research.length} compound${research.length === 1 ? '' : 's'} sold "for research use only"`,
      detail:
        `${research.map((p) => p.name).join(', ')} ${research.length === 1 ? 'is' : 'are'} not approved for human use anywhere mainstream. That means no manufacturing standards, no purity guarantee, and no dose verification — independent testing of grey-market peptides regularly finds vials that are underdosed, overdosed, or contain something else entirely. Third-party lab testing of your specific batch is the only way to reduce this risk.`,
    });
  }

  const prescription = peptides.filter((p) => p.legalStatus === 'prescription');
  if (prescription.length > 0) {
    notices.push({
      id: 'prescription-required',
      severity: 'high',
      title: `${prescription.length} compound${prescription.length === 1 ? ' is' : 's are'} prescription-only`,
      detail: `${prescription.map((p) => p.name).join(', ')} ${prescription.length === 1 ? 'requires' : 'require'} a prescription and clinical supervision. This app can show you what the protocols are; it cannot replace the monitoring that comes with them.`,
    });
  }

  const banned = peptides.filter((p) => p.bannedInSport);
  if (banned.length > 0) {
    notices.push({
      id: 'banned-in-sport',
      severity: 'moderate',
      title: 'Prohibited in tested competition',
      detail: `${banned.map((p) => p.name).join(', ')} ${banned.length === 1 ? 'is' : 'are'} on the WADA prohibited list. If you compete in a tested sport, this stack will cause a positive test.`,
    });
  }

  // Injection burden — a practical adherence and infection-risk signal.
  const weeklyInjections = peptides
    .filter((p) => p.routes.includes('subcutaneous') || p.routes.includes('intramuscular'))
    .reduce((sum, p) => sum + p.frequency.timesPerDay * p.frequency.daysPerWeek, 0);
  if (weeklyInjections >= 14) {
    notices.push({
      id: 'injection-burden',
      severity: 'moderate',
      title: `${weeklyInjections} injections per week`,
      detail:
        'That is a high injection load. Rotate sites systematically to avoid lipohypertrophy — lumpy scar tissue that changes absorption unpredictably. Use a fresh needle every time; reusing needles is the main cause of injection-site infection.',
    });
  }

  if (profile.sleepHours < 6.5 && ghAxis.length > 0) {
    notices.push({
      id: 'sleep-undermines-gh',
      severity: 'moderate',
      title: 'Your sleep is working against this stack',
      detail: `You reported ${profile.sleepHours} hours a night. The majority of growth hormone is released during deep sleep, so GH-axis compounds have much less to amplify. Getting to 7+ hours would likely do more for these goals than the stack will.`,
    });
  }

  const withheld = peptides.filter((p) => p.doseGuidanceWithheld);
  if (withheld.length > 0) {
    notices.push({
      id: 'dose-withheld',
      severity: 'high',
      title: 'No dose is shown for some compounds here',
      detail: `${withheld.map((p) => p.name).join(', ')} — the app deliberately does not suggest a number. Open the compound to see why.`,
    });
  }

  return notices.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function computeRiskScore(
  peptides: Peptide[],
  interactions: InteractionFinding[],
  contraindications: ContraindicationFinding[],
): number {
  let score = 0;

  for (const p of peptides) {
    if (p.legalStatus === 'research_chemical') score += 8;
    if (p.legalStatus === 'prescription') score += 5;
    if (p.evidence === 'D') score += 6;
    else if (p.evidence === 'C') score += 4;
    else if (p.evidence === 'B') score += 2;
    score += p.sideEffects.filter((s) => s.severity === 'severe').length * 3;
    if (p.doseGuidanceWithheld) score += 10;
  }

  for (const i of interactions) {
    if (i.severity === 'critical') score += 30;
    else if (i.severity === 'high') score += 15;
    else if (i.severity === 'moderate') score += 6;
  }

  for (const c of contraindications) {
    score += c.kind === 'absolute' ? 35 : 10;
  }

  return Math.min(100, Math.round(score));
}

export function evaluateStack(peptideIds: string[], profile: UserProfile): SafetyReport {
  const peptides = peptideIds.map(getPeptide).filter((p): p is Peptide => Boolean(p));

  const inStack = new Set(peptideIds);
  // Anything the user is already running that is not also in this stack.
  const currentOnly = (profile.currentPeptides ?? []).filter((id) => !inStack.has(id));

  // Evaluate the union, then split the findings by whether they are internal
  // to the proposed stack or arise from what the user is already taking.
  const allFindings = findInteractions([...peptideIds, ...currentOnly]);
  const interactions = allFindings.filter(
    (f) => inStack.has(f.peptideIds[0]) && inStack.has(f.peptideIds[1]),
  );
  const interactionsWithCurrent = allFindings.filter(
    (f) => !inStack.has(f.peptideIds[0]) || !inStack.has(f.peptideIds[1]),
  );

  const contraindications = findContraindications(peptideIds, profile);
  const goalConflicts = findGoalConflicts(profile.goals);
  const notices = buildNotices(peptides, profile);

  const monitoring = [...new Set(peptides.flatMap((p) => p.monitoring))];

  // Age no longer blocks — it warns. Medical contraindications and critical
  // interactions still do, including against compounds already in use.
  const blocking =
    contraindications.some((c) => c.kind === 'absolute' && c.flag !== 'under_18') ||
    interactions.some((i) => i.severity === 'critical') ||
    interactionsWithCurrent.some((i) => i.severity === 'critical');

  return {
    interactions,
    interactionsWithCurrent,
    contraindications,
    goalConflicts,
    notices,
    sideEffects: aggregateSideEffects(peptideIds),
    redFlags: aggregateRedFlags(peptideIds),
    monitoring,
    blocking,
    riskScore: computeRiskScore(peptides, [...interactions, ...interactionsWithCurrent], contraindications),
  };
}

/**
 * Can this single compound be recommended to this user at all?
 * Used by the generator to filter before scoring.
 */
/**
 * Whether a compound can be recommended to this user.
 *
 * Age is deliberately NOT a blocker here — it produces prominent warnings
 * instead (see `buildAgeNotices`), so a younger user still sees the specific
 * reason a compound is a bad idea for them rather than an opaque refusal.
 * Medical contraindications remain hard blocks.
 */
export function isPeptideAllowed(
  peptide: Peptide,
  profile: Pick<UserProfile, 'healthFlags' | 'age'>,
): { allowed: boolean; reason?: string } {
  const findings = findContraindications([peptide.id], profile);
  const absolute = findings.find((f) => f.kind === 'absolute' && f.flag !== 'under_18');
  if (absolute) return { allowed: false, reason: absolute.reason };
  return { allowed: true };
}

export function riskBand(score: number): { label: string; tone: 'low' | 'moderate' | 'high' | 'severe' } {
  if (score >= 70) return { label: 'Very high risk', tone: 'severe' };
  if (score >= 45) return { label: 'High risk', tone: 'high' };
  if (score >= 22) return { label: 'Moderate risk', tone: 'moderate' };
  return { label: 'Lower risk', tone: 'low' };
}

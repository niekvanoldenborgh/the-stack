/**
 * Core domain types for The Stack.
 *
 * Design note: every number that represents a dose is stored together with its
 * unit on the same record. We never do implicit unit conversion — a dose of
 * `{ value: 250, unit: 'mcg' }` is formatted, compared and summed only against
 * other doses in `mcg`. Unit mixing is the single most likely source of a
 * real-world overdose in an app like this, so it is made structurally hard.
 */

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

export type GoalId =
  | 'lose_fat'
  | 'gain_weight'
  | 'build_muscle'
  | 'metabolic_health'
  | 'bone_density'
  | 'hair_growth'
  | 'acne_control'
  | 'skin_quality'
  | 'injury_recovery'
  | 'sleep_quality';

export interface Goal {
  id: GoalId;
  label: string;
  blurb: string;
  icon: string;
  /** Realistic expectation setting shown before a user commits to the goal. */
  reality: string;
}

// ---------------------------------------------------------------------------
// User profile
// ---------------------------------------------------------------------------

export type Sex = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'high' | 'athlete';
export type Experience = 'none' | 'some' | 'experienced';
export type TrainingDaysPerWeek = 2 | 3 | 4 | 5 | 6;

/**
 * How much risk the user is willing to accept, 1 (most cautious) to 5.
 *
 * This moves the dose *within* each compound's published range and widens or
 * narrows which compounds are eligible. It can never push a dose past the
 * published upper bound or the compound's `hardMax` — the highest setting
 * means "top of the published range", not "beyond it".
 */
export type RiskTolerance = 1 | 2 | 3 | 4 | 5;

export interface RiskToleranceMeta {
  level: RiskTolerance;
  label: string;
  blurb: string;
  /** What this setting does to the numbers, in plain language. */
  effect: string;
}

export type HealthFlag =
  | 'under_18'
  | 'pregnant_or_breastfeeding'
  | 'active_cancer'
  | 'cancer_history'
  | 'thyroid_cancer_family'
  | 'men2'
  | 'melanoma_or_atypical_moles'
  | 'diabetes_t1'
  | 'diabetes_t2'
  | 'prediabetes'
  | 'pancreatitis_history'
  | 'gallbladder_disease'
  | 'cardiac_disease'
  | 'hypertension'
  | 'kidney_disease'
  | 'liver_disease'
  | 'retinopathy'
  | 'sleep_apnea'
  | 'carpal_tunnel'
  | 'seizure_disorder'
  | 'eating_disorder_history'
  | 'on_prescription_meds';

export interface HealthFlagMeta {
  id: HealthFlag;
  label: string;
  group: 'absolute' | 'metabolic' | 'cardio_renal' | 'other';
}

export interface UserProfile {
  /** ISO date the profile was created. */
  createdAt: string;
  age: number;
  sex: Sex;
  /** Kilograms. */
  weightKg: number;
  /** Centimetres. */
  heightCm: number;
  /** Optional; used to refine fat-loss vs recomposition guidance. */
  bodyFatPct?: number;
  activity: ActivityLevel;
  /** Average nightly sleep in hours. */
  sleepHours: number;
  /** Self-reported sleep quality 1–5. */
  sleepQuality: number;
  trainingDays: TrainingDaysPerWeek;
  experience: Experience;
  goals: GoalId[];
  healthFlags: HealthFlag[];
  /**
   * Compounds the user is already running. These are not part of a generated
   * stack, but everything recommended is checked against them for interactions
   * and duplicate pharmacological classes.
   */
  currentPeptides: string[];
  riskTolerance: RiskTolerance;
  /** User confirmed they read and accepted the safety disclaimer. */
  acceptedDisclaimerAt?: string;
  /**
   * User confirmed they read the Terms of Service / liability agreement
   * (THEA-93). Stamped alongside `acceptedDisclaimerAt` in onboarding, but
   * tracked separately: it answers a distinct question ("did the user
   * accept this specific document") that compliance sign-off checks against
   * independently of the general safety disclaimer.
   */
  acceptedTermsAt?: string;
  /**
   * A numeric target for one tracked metric, set entirely by the user on the
   * Results screen. The app never suggests or judges a value here — see the
   * doc comment on `Metric` in `domain/metrics.ts` — it only measures the
   * distance already logged readings have covered toward a number the user
   * chose themselves.
   */
  goalTarget?: GoalTarget;
}

/**
 * `baseline` is a snapshot of the metric's latest reading at the moment the
 * target was set, so progress is measured from where the user actually
 * started rather than recomputed if they later edit or delete that reading.
 */
export interface GoalTarget {
  /** Must match a `Metric.id` from `domain/metrics.ts` — targets are not offered for custom measures. */
  metricId: string;
  /** The number the user is aiming for, in the metric's native unit. */
  value: number;
  baseline: number;
  /** ISO date the target was set. */
  setAt: string;
}

// ---------------------------------------------------------------------------
// Peptides
// ---------------------------------------------------------------------------

/**
 * `pct` is used for topical cosmetics, where the meaningful quantity is the
 * concentration in the formulation rather than an absolute amount applied.
 */
export type DoseUnit = 'mcg' | 'mg' | 'iu' | 'pct';

export type Route =
  | 'subcutaneous'
  | 'intramuscular'
  | 'oral'
  | 'topical'
  | 'nasal';

export type PeptideClass =
  | 'ghrh_analog'
  | 'ghrp_secretagogue'
  | 'growth_hormone'
  | 'igf'
  | 'incretin'
  | 'amylin'
  | 'mitochondrial'
  | 'healing_repair'
  | 'thymic_immune'
  | 'melanocortin'
  | 'bone_anabolic'
  | 'cosmetic_topical'
  | 'sleep_neuro'
  | 'metabolic_oral';

/**
 * Regulatory reality of a compound. This drives hard UI treatment — a
 * `research_chemical` can never be presented as a routine consumer option.
 */
export type LegalStatus =
  /** Approved medicine. Requires a prescription and clinician supervision. */
  | 'prescription'
  /** Sold as "for research use only"; no human approval anywhere mainstream. */
  | 'research_chemical'
  /** Regulated cosmetic ingredient, topical use. */
  | 'cosmetic_otc'
  /** Available as a dietary/food supplement in some markets. */
  | 'supplement';

/**
 * Evidence tiers. Deliberately coarse — users need "how much should I trust
 * this", not a systematic review.
 */
export type EvidenceTier =
  /** Randomised controlled human trials; approved indication. */
  | 'A'
  /** Small or limited human trials, or long clinical use. */
  | 'B'
  /** Animal or in-vitro data only. */
  | 'C'
  /** Anecdote and community reports only. */
  | 'D';

export interface DosingModel {
  unit: DoseUnit;
  /**
   * `per_kg` values are per kilogram of bodyweight per administration.
   * `fixed` values are absolute per administration.
   */
  basis: 'per_kg' | 'fixed';
  low: number;
  typical: number;
  high: number;
  /** Absolute ceiling per administration; scaling never exceeds this. */
  hardMax: number;
  /** Weeks spent ramping from `low` to target. 0 = no titration. */
  titrationWeeks: number;
  /** Human-readable description of how published protocols express the dose. */
  note: string;
}

export type TimeOfDay = 'waking' | 'morning' | 'pre_workout' | 'post_workout' | 'evening' | 'bedtime';

export interface FrequencyModel {
  timesPerDay: number;
  /** How many days in a 7-day week the compound is taken. */
  daysPerWeek: number;
  /**
   * Specific weekday indices (0 = Monday) when `daysPerWeek < 7` and the
   * schedule is fixed rather than user-chosen. Used for weekly compounds.
   */
  fixedDays?: number[];
  preferredTimes: TimeOfDay[];
  /** Why these timings — e.g. GH pulse, fasting state, sleep onset. */
  timingRationale: string;
}

export interface CycleModel {
  onWeeks: number;
  /** 0 means continuous use under supervision (e.g. approved chronic therapy). */
  offWeeks: number;
  /** Cycles before an extended break is advised. `null` = not applicable. */
  maxConsecutiveCycles: number | null;
  rationale: string;
}

export type Severity = 'mild' | 'moderate' | 'severe';
export type Likelihood = 'common' | 'uncommon' | 'rare';

export interface SideEffect {
  label: string;
  severity: Severity;
  likelihood: Likelihood;
  detail?: string;
}

export interface Contraindication {
  flag: HealthFlag;
  /** `absolute` blocks recommendation entirely; `relative` warns loudly. */
  kind: 'absolute' | 'relative';
  reason: string;
}

/** Symptoms that mean "stop and seek medical care", per compound. */
export interface RedFlag {
  symptom: string;
  action: string;
}

export interface Peptide {
  id: string;
  name: string;
  aliases: string[];
  classes: PeptideClass[];
  legalStatus: LegalStatus;
  evidence: EvidenceTier;
  /** One-line plain-English summary. */
  summary: string;
  /** How it is believed to work. */
  mechanism: string;
  routes: Route[];
  dosing: DosingModel;
  frequency: FrequencyModel;
  cycle: CycleModel;
  /**
   * Goal fit, −5 to 5. 5 = primary, well-supported use for that goal.
   * Negative values mean the compound actively works against the goal
   * (e.g. GLP-1 agonists vs. gaining weight) and are used as penalties.
   * Absent goals score 0.
   */
  goalFit: Partial<Record<GoalId, number>>;
  sideEffects: SideEffect[];
  contraindications: Contraindication[];
  redFlags: RedFlag[];
  /** Monitoring a user should arrange with a clinician. */
  monitoring: string[];
  /** Banned in tested sport. */
  bannedInSport: boolean;
  /**
   * When true the app deliberately shows no numeric dose. Used for compounds
   * where the risk/evidence ratio makes any suggested number irresponsible.
   */
  doseGuidanceWithheld?: {
    reason: string;
  };
  /** Descriptive source labels — no fabricated identifiers. */
  sources: string[];
  /** Myths worth correcting on the detail page. */
  notes?: string[];
  /**
   * Parameters for the estimated-medication-levels PK model
   * (docs/pk-estimated-levels-spec.md). Presence of this field is what makes a
   * compound Tier 1 eligible for a "levels" curve on the Summary screen; its
   * absence is deliberately the "no model available" state (§4) — a new
   * compound is safe by default. Every field here is traced to a cited
   * parameter in the spec; nothing here is fitted or invented.
   */
  pk?: PkModel;
}

/**
 * One-compartment, first-order absorption + elimination — semaglutide (§1.1).
 * Parameters are apparent (`CL/F`, `V/F`); the dose is used as administered,
 * with no separate bioavailability factor (D3 in the spec — applying one on
 * top would double-count it).
 */
export interface OneCompartmentPk {
  kind: 'one_compartment_first_order';
  /** h⁻¹, absorption rate constant. */
  ka: number;
  /** L/h, apparent clearance at `refWeightKg`. */
  clRef: number;
  /** L, apparent volume of distribution — no weight covariate per the source paper. */
  vd: number;
  refWeightKg: number;
  /** Allometric exponent applied to clearance only. */
  weightExponent: number;
}

/**
 * Two-compartment, first-order absorption + elimination — tirzepatide (§1.2).
 * Parameters are true (not apparent); `f` must be applied explicitly (D3).
 */
export interface TwoCompartmentPk {
  kind: 'two_compartment_first_order';
  ka: number;
  /** Absolute bioavailability, fixed. */
  f: number;
  /** L/h per `refWeightKg`. */
  clRef: number;
  /** L/h per `refWeightKg`, intercompartmental clearance. */
  qRef: number;
  /** L per `refWeightKg`, central volume. */
  vcRef: number;
  /** L per `refWeightKg`, peripheral volume. */
  vpRef: number;
  refWeightKg: number;
  /** Allometric exponent for CL and Q. */
  clExponent: number;
  /** Allometric exponent for Vc and Vp (1.0 = linear scaling). */
  volExponent: number;
}

export type PkModel = OneCompartmentPk | TwoCompartmentPk;

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

export type InteractionSeverity = 'critical' | 'high' | 'moderate' | 'info';

export type Matcher =
  | { kind: 'peptide'; id: string }
  | { kind: 'class'; value: PeptideClass };

export interface InteractionRule {
  id: string;
  a: Matcher;
  b: Matcher;
  severity: InteractionSeverity;
  title: string;
  detail: string;
  guidance: string;
  /** When true, two members of the same matcher also trigger the rule. */
  selfPairing?: boolean;
}

export interface InteractionFinding {
  ruleId: string;
  severity: InteractionSeverity;
  title: string;
  detail: string;
  guidance: string;
  peptideIds: [string, string];
}

export interface ContraindicationFinding {
  peptideId: string;
  flag: HealthFlag;
  kind: 'absolute' | 'relative';
  reason: string;
}

export interface GoalConflictFinding {
  goals: [GoalId, GoalId];
  detail: string;
  guidance: string;
}

/** Whole-stack observations that are not tied to a single pair of compounds. */
export interface SafetyNotice {
  id: string;
  severity: InteractionSeverity;
  title: string;
  detail: string;
}

export interface SafetyReport {
  /** Interactions between compounds inside this stack. */
  interactions: InteractionFinding[];
  /**
   * Interactions between something in this stack and something the user is
   * already running. Kept separate so "this stack is fine on its own, but not
   * on top of what you are already taking" stays legible.
   */
  interactionsWithCurrent: InteractionFinding[];
  contraindications: ContraindicationFinding[];
  goalConflicts: GoalConflictFinding[];
  notices: SafetyNotice[];
  /** Aggregated side effects across the stack, deduped and ranked. */
  sideEffects: Array<SideEffect & { peptideIds: string[] }>;
  redFlags: Array<RedFlag & { peptideIds: string[] }>;
  monitoring: string[];
  /** True when at least one absolute contraindication or critical interaction. */
  blocking: boolean;
  /** 0–100, higher = riskier. */
  riskScore: number;
}

// ---------------------------------------------------------------------------
// Stacks
// ---------------------------------------------------------------------------

export interface Dose {
  value: number;
  unit: DoseUnit;
}

export interface StackItem {
  peptideId: string;
  /** Suggested dose per administration, after personalisation. */
  dose: Dose;
  /** Starting dose when a titration ramp applies. */
  startDose: Dose;
  timesPerDay: number;
  daysPerWeek: number;
  preferredTimes: TimeOfDay[];
  onWeeks: number;
  offWeeks: number;
  /** Why this compound was suggested for this user. */
  rationale: string;
  /** Score from the recommendation engine, 0–100. */
  score: number;
  /** Goals this item primarily serves. */
  servesGoals: GoalId[];
  doseWithheld?: boolean;
}

export type StackOrigin = 'generated' | 'custom';

export interface Stack {
  id: string;
  name: string;
  origin: StackOrigin;
  createdAt: string;
  /** ISO date the cycle starts. */
  startDate: string;
  items: StackItem[];
  goals: GoalId[];
  /** Snapshot of the safety report at creation time. */
  safety: SafetyReport;
  notes?: string;
}

// ---------------------------------------------------------------------------
// Cycle planning & scheduling
// ---------------------------------------------------------------------------

export type PhaseKind = 'titration' | 'on' | 'washout';

export interface CyclePhase {
  peptideId: string;
  kind: PhaseKind;
  /** Inclusive ISO date. */
  startDate: string;
  /** Inclusive ISO date. */
  endDate: string;
  label: string;
}

export interface ScheduledDose {
  id: string;
  stackId: string;
  peptideId: string;
  /** ISO date (no time) the dose falls on. */
  date: string;
  /** Local 24h time, "HH:mm". */
  time: string;
  timeOfDay: TimeOfDay;
  dose: Dose;
  route: Route;
  phase: PhaseKind;
}

export type DoseLogStatus = 'taken' | 'skipped';

export interface DoseLog {
  scheduledDoseId: string;
  status: DoseLogStatus;
  loggedAt: string;
  /** Actual dose if the user deviated. */
  actualDose?: Dose;
  note?: string;
}

export interface SideEffectLog {
  id: string;
  date: string;
  label: string;
  /**
   * Self-reported severity, 1 (least) – 10 (most), for this symptom. Numeric
   * rather than the `Severity` band used for catalogue data — the user picks a
   * number, nothing is defaulted (THEA-9 P&S sign-off). See
   * `severityBand` in `domain/sideEffects.ts` for the display bucketing.
   */
  severity: number;
  note?: string;
}

/**
 * A single self-reported progress reading against a goal, e.g. a bodyweight in
 * kg or a 1–5 skin-clarity rating.
 *
 * These are the user's own measurements: the app charts what is entered and
 * computes the change between readings, but never sets a target or judges a
 * value as normal or abnormal. That would be medical advice the app is not in a
 * position to give.
 */
export interface Measurement {
  id: string;
  /** References a `Metric.id` from the catalogue, or `'custom'`. */
  metricId: string;
  /** Present only when `metricId === 'custom'`. */
  customLabel?: string;
  customUnit?: string;
  /** ISO date (no time) the reading was taken. */
  date: string;
  value: number;
  note?: string;
}

/**
 * Front-of-body injection sites the user can mark on the figure in the Logger.
 * Left/right are the user's own left/right. Kept coarse on purpose — this is a
 * rotation aid, not a clinical map, and finer granularity would imply a
 * precision the figure does not have.
 */
export type InjectionSite =
  | 'abdomen_left'
  | 'abdomen_right'
  | 'thigh_left'
  | 'thigh_right'
  | 'upper_arm_left'
  | 'upper_arm_right'
  | 'glute_left'
  | 'glute_right';

/**
 * A record of an injection the user has already given themselves.
 *
 * Everything numeric here is the user's own entry. The app never suggests,
 * prefills or computes the dose — this is an instrument surface under the
 * THEA-6 no-dosage boundary (docs/pk-estimated-levels-spec.md §3), so a `Dose`
 * only ever exists here because the user typed it, and it carries its own unit
 * (AGENTS.md invariant 8 — no implicit unit conversion).
 */
export interface InjectionLog {
  id: string;
  /** ISO date (no time) of the injection. */
  date: string;
  /** Local 24h time, "HH:mm". */
  time: string;
  peptideId: string;
  /** User-entered dose. Never suggested by the app. */
  dose: Dose;
  /** Volume drawn on the syringe as the user measured it. Recorded, never computed. */
  drawnUnits?: number;
  site: InjectionSite;
  /** Self-reported injection pain, 0 (none) – 10 (worst). */
  painLevel: number;
  note?: string;
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'biceps'
  | 'triceps'
  | 'core'
  | 'full_body';

export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'none';

export type ExercisePattern =
  | 'squat'
  | 'hinge'
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'lunge'
  | 'carry'
  | 'isolation'
  | 'conditioning';

export interface Exercise {
  id: string;
  name: string;
  pattern: ExercisePattern;
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  equipment: Equipment[];
  /** 1 = beginner-safe, 3 = needs coaching. */
  technicalDemand: 1 | 2 | 3;
  /** Systemic fatigue cost, 1–3. Used to cap sessions on low-sleep users. */
  fatigueCost: 1 | 2 | 3;
  compound: boolean;
  /** Loading on connective tissue; downweighted during injury-recovery goals. */
  jointStress: 1 | 2 | 3;
  cues: string[];
}

export type SessionFocus =
  | 'full_body'
  | 'upper'
  | 'lower'
  | 'push'
  | 'pull'
  | 'legs'
  | 'conditioning'
  | 'rest';

export interface PlannedSet {
  reps: number;
  /** Reps in reserve target. */
  rir: number;
  /** Optional prescribed load; undefined until the user has history. */
  suggestedLoadKg?: number;
}

export interface PlannedExercise {
  exerciseId: string;
  sets: PlannedSet[];
  restSeconds: number;
  note?: string;
}

export interface PlannedSession {
  id: string;
  /** 0 = Monday. */
  dayIndex: number;
  focus: SessionFocus;
  name: string;
  exercises: PlannedExercise[];
  estimatedMinutes: number;
  /** Adjustments made because of sleep, recovery or stack context. */
  adjustments: string[];
}

export interface WorkoutProgram {
  id: string;
  name: string;
  createdAt: string;
  daysPerWeek: number;
  split: string;
  goals: GoalId[];
  /** Weeks before a deload is advised. */
  deloadEveryWeeks: number;
  sessions: PlannedSession[];
  rationale: string[];
}

export interface LoggedSet {
  reps: number;
  weightKg: number;
  rir?: number;
}

export interface LoggedExercise {
  exerciseId: string;
  sets: LoggedSet[];
}

export interface WorkoutSessionLog {
  id: string;
  programId: string;
  sessionId: string;
  date: string;
  exercises: LoggedExercise[];
  durationMinutes?: number;
  /** 1–5 self-reported. */
  perceivedEffort?: number;
  note?: string;
}

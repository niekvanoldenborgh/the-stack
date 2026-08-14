import type { Dose, InjectionLog, OneCompartmentPk, Peptide, PkModel, TwoCompartmentPk } from '../domain/types';
import { fromISODate } from '../lib/date';

/**
 * Estimated medication levels (PK).
 *
 * Implements docs/pk-estimated-levels-spec.md (THEA-6) exactly — every
 * equation and parameter here is traced to a cited source in that document.
 * This module is an **instrument surface** under the spec's no-dosage
 * boundary (§3): it does arithmetic on doses the user already logged and
 * never originates a number. In particular it must stay free of any import
 * from `./dosing` or `./recommend` (T10) — that separation is what makes
 * "this module cannot suggest a dose" a structural fact rather than a promise.
 *
 * D1 (superposition over logged injections, not a schedule) and D4 (body
 * weight is the only personalisation — never the risk dial) apply throughout.
 */

// ---------------------------------------------------------------------------
// Guard rails (§1.3)
// ---------------------------------------------------------------------------

const WEIGHT_MIN_KG = 40;
const WEIGHT_MAX_KG = 200;
/** Never draw the curve beyond this many terminal half-lives past the last dose. */
const MAX_HALF_LIVES = 5;
/** ×/÷ 1.25 uncertainty band — MED-SIGNOFF-5, PK variability only. */
const UNCERTAINTY_MULTIPLIER = 1.25;
/** Numerical guard: evaluate at >= 1 sample/hour so a weekly grid cannot miss the peak. */
const SAMPLE_STEP_HOURS = 1;
/** How far back the drawn window looks even when the log history is much longer. */
const DISPLAY_LOOKBACK_DAYS = 84;
/** Downsampled point budget for the UI; each bucket keeps its own peak. */
const MAX_RENDER_POINTS = 120;

// ---------------------------------------------------------------------------
// Eligibility (§4)
// ---------------------------------------------------------------------------

/** E3 (not withheld) + E4 (mg/mcg dosing) + a published `pk` model present. */
export function peptideHasLevelModel(peptide: Peptide): boolean {
  if (!peptide.pk) return false;
  if (peptide.doseGuidanceWithheld) return false;
  if (peptide.dosing.unit !== 'mg' && peptide.dosing.unit !== 'mcg') return false;
  return true;
}

// ---------------------------------------------------------------------------
// Units (D2 / invariant 8 — conversion only at the boundary, from an explicit unit)
// ---------------------------------------------------------------------------

/** mg is the canonical internal dose unit. Returns null for iu/pct — never guessed. */
export function doseToMg(dose: Dose): number | null {
  if (dose.unit === 'mg') return dose.value;
  if (dose.unit === 'mcg') return dose.value / 1000;
  return null;
}

// ---------------------------------------------------------------------------
// Weight (D4 + §1.3 guard rail)
// ---------------------------------------------------------------------------

function resolveWeightKg(pk: PkModel, weightKg: number | undefined): { weightKg: number; fallback: boolean } {
  if (weightKg === undefined || !Number.isFinite(weightKg) || weightKg < WEIGHT_MIN_KG || weightKg > WEIGHT_MAX_KG) {
    return { weightKg: pk.refWeightKg, fallback: true };
  }
  return { weightKg, fallback: false };
}

// ---------------------------------------------------------------------------
// Model equations (§1.1, §1.2)
// ---------------------------------------------------------------------------

function oneCompartmentParams(pk: OneCompartmentPk, weightKg: number) {
  const cl = pk.clRef * Math.pow(weightKg / pk.refWeightKg, pk.weightExponent);
  const v = pk.vd;
  return { cl, v, ke: cl / v, ka: pk.ka };
}

function twoCompartmentParams(pk: TwoCompartmentPk, weightKg: number) {
  const ratio = weightKg / pk.refWeightKg;
  const cl = pk.clRef * Math.pow(ratio, pk.clExponent);
  const q = pk.qRef * Math.pow(ratio, pk.clExponent);
  const vc = pk.vcRef * Math.pow(ratio, pk.volExponent);
  const vp = pk.vpRef * Math.pow(ratio, pk.volExponent);
  const k10 = cl / vc;
  const k12 = q / vc;
  const k21 = q / vp;
  const sum = k10 + k12 + k21;
  const disc = Math.sqrt(sum * sum - 4 * k10 * k21);
  return { cl, q, vc, vp, k10, k12, k21, alpha: (sum + disc) / 2, beta: (sum - disc) / 2, ka: pk.ka, f: pk.f };
}

/** Terminal half-life at the given (already resolved) weight. */
export function terminalHalfLifeHours(pk: PkModel, weightKg: number): number {
  if (pk.kind === 'one_compartment_first_order') {
    return Math.log(2) / oneCompartmentParams(pk, weightKg).ke;
  }
  return Math.log(2) / twoCompartmentParams(pk, weightKg).beta;
}

export interface TwoCompartmentCoefficients {
  A: number;
  B: number;
  K: number;
  alpha: number;
  beta: number;
  ka: number;
}

/**
 * The A/B/K coefficients for a single tirzepatide dose. Exported so the test
 * suite can assert `A + B + K ≈ 0` (§1.2 implementation self-check, T4) — the
 * cheapest catch for a transcription error in the equations.
 */
export function twoCompartmentCoefficients(pk: TwoCompartmentPk, doseMg: number, weightKg: number): TwoCompartmentCoefficients {
  const { vc, k21, alpha, beta, ka, f } = twoCompartmentParams(pk, weightKg);
  const scale = (f * doseMg * ka) / vc;
  return {
    A: (scale * (k21 - alpha)) / ((ka - alpha) * (beta - alpha)),
    B: (scale * (k21 - beta)) / ((ka - beta) * (alpha - beta)),
    K: (scale * (k21 - ka)) / ((alpha - ka) * (beta - ka)),
    alpha,
    beta,
    ka,
  };
}

/** Single-dose concentration at `hoursSinceDose` — 0 before the dose is given. */
export function singleDoseConcentrationMgPerL(pk: PkModel, doseMg: number, hoursSinceDose: number, weightKg: number): number {
  if (hoursSinceDose < 0 || doseMg <= 0) return 0;
  if (pk.kind === 'one_compartment_first_order') {
    const { v, ke, ka } = oneCompartmentParams(pk, weightKg);
    return ((doseMg * ka) / (v * (ka - ke))) * (Math.exp(-ke * hoursSinceDose) - Math.exp(-ka * hoursSinceDose));
  }
  const { A, B, K, alpha, beta, ka } = twoCompartmentCoefficients(pk, doseMg, weightKg);
  return A * Math.exp(-alpha * hoursSinceDose) + B * Math.exp(-beta * hoursSinceDose) + K * Math.exp(-ka * hoursSinceDose);
}

/** `Cavg,ss = D/(CL·τ)`, with `F` applied explicitly for true (not apparent) parameters. */
export function steadyStateAverageMgPerL(pk: PkModel, doseMg: number, tauHours: number, weightKg: number): number {
  if (pk.kind === 'one_compartment_first_order') {
    return doseMg / (oneCompartmentParams(pk, weightKg).cl * tauHours);
  }
  const { cl, f } = twoCompartmentParams(pk, weightKg);
  return (f * doseMg) / (cl * tauHours);
}

/**
 * Dosing interval implied by the compound's own published frequency — e.g.
 * once weekly → 168 h. This is reportage of `Peptide.frequency`, not a new
 * number the app invents.
 */
export function dosingIntervalHours(peptide: Peptide): number {
  const perWeek = Math.max(1, peptide.frequency.daysPerWeek * peptide.frequency.timesPerDay);
  return (7 * 24) / perWeek;
}

// ---------------------------------------------------------------------------
// Superposition over logged injections (D1)
// ---------------------------------------------------------------------------

/** Hours since the Unix epoch for a logged injection's date + local time. */
function injectionEpochHours(log: Pick<InjectionLog, 'date' | 'time'>): number {
  const base = fromISODate(log.date).getTime();
  const [h, m] = log.time.split(':').map(Number);
  return (base + ((h ?? 0) * 60 + (m ?? 0)) * 60_000) / 3_600_000;
}

export interface LevelPoint {
  /** Hours since `anchorEpochHours`. */
  hoursFromStart: number;
  /** % of the user's own predicted steady-state average (U1/MED-SIGNOFF-4). */
  pct: number;
  pctLow: number;
  pctHigh: number;
}

export interface LevelSeriesResult {
  eligible: boolean;
  /** Empty when there is no logged history — never a projection from the schedule (T6). */
  points: LevelPoint[];
  weightKgUsed: number | null;
  weightFallback: boolean;
  halfLifeHours: number | null;
  cavgSsMgPerL: number | null;
  /** Epoch hours corresponding to `hoursFromStart = 0`, for mapping back to real dates. */
  anchorEpochHours: number | null;
}

const INELIGIBLE_RESULT: LevelSeriesResult = {
  eligible: false,
  points: [],
  weightKgUsed: null,
  weightFallback: false,
  halfLifeHours: null,
  cavgSsMgPerL: null,
  anchorEpochHours: null,
};

/**
 * Builds the "estimated medication levels" series for one peptide from the
 * user's own logged injections. `nowEpochHours` is passed in rather than read
 * from `Date.now()` internally so the function stays a pure, testable
 * function of its inputs.
 */
export function buildLevelSeries(
  peptide: Peptide,
  injectionLogs: InjectionLog[],
  weightKg: number | undefined,
  nowEpochHours: number,
): LevelSeriesResult {
  if (!peptideHasLevelModel(peptide) || !peptide.pk) return INELIGIBLE_RESULT;
  const pk = peptide.pk;

  const relevant = injectionLogs
    .filter((log) => log.peptideId === peptide.id)
    .map((log) => {
      const doseMg = doseToMg(log.dose);
      return doseMg === null || doseMg <= 0 ? null : { doseMg, atHours: injectionEpochHours(log) };
    })
    .filter((v): v is { doseMg: number; atHours: number } => v !== null)
    .sort((a, b) => a.atHours - b.atHours);

  const { weightKg: resolvedWeight, fallback } = resolveWeightKg(pk, weightKg);
  const halfLifeHours = terminalHalfLifeHours(pk, resolvedWeight);

  if (relevant.length === 0) {
    return {
      eligible: true,
      points: [],
      weightKgUsed: resolvedWeight,
      weightFallback: fallback,
      halfLifeHours,
      cavgSsMgPerL: null,
      anchorEpochHours: null,
    };
  }

  const lastDoseHours = relevant[relevant.length - 1]!.atHours;
  const firstDoseHours = relevant[0]!.atHours;
  // Never draw beyond 5 terminal half-lives past the last logged dose, and
  // never past "now" — this is a level estimate, not a forecast (U7).
  const windowEnd = Math.min(Math.max(nowEpochHours, lastDoseHours), lastDoseHours + MAX_HALF_LIVES * halfLifeHours);
  const windowStart = Math.max(firstDoseHours, windowEnd - DISPLAY_LOOKBACK_DAYS * 24);

  const latestDoseMg = relevant[relevant.length - 1]!.doseMg;
  const tauHours = dosingIntervalHours(peptide);
  const cavgSs = steadyStateAverageMgPerL(pk, latestDoseMg, tauHours, resolvedWeight);

  if (!(cavgSs > 0) || windowEnd <= windowStart) {
    return {
      eligible: true,
      points: [],
      weightKgUsed: resolvedWeight,
      weightFallback: fallback,
      halfLifeHours,
      cavgSsMgPerL: cavgSs > 0 ? cavgSs : null,
      anchorEpochHours: windowStart,
    };
  }

  const totalHours = windowEnd - windowStart;
  const sampleCount = Math.max(1, Math.floor(totalHours / SAMPLE_STEP_HOURS));
  const samples: { t: number; c: number }[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const t = windowStart + i * SAMPLE_STEP_HOURS;
    let concentration = 0;
    for (const dose of relevant) {
      concentration += singleDoseConcentrationMgPerL(pk, dose.doseMg, t - dose.atHours, resolvedWeight);
    }
    samples.push({ t, c: concentration });
  }

  // Downsample for the UI, keeping the peak of each bucket rather than an
  // average, so a fast rise between two coarse grid points is never lost.
  const bucketSize = Math.max(1, Math.ceil(samples.length / MAX_RENDER_POINTS));
  const points: LevelPoint[] = [];
  for (let i = 0; i < samples.length; i += bucketSize) {
    const bucket = samples.slice(i, i + bucketSize);
    const peak = bucket.reduce((best, s) => (s.c > best.c ? s : best), bucket[0]!);
    const pct = (peak.c / cavgSs) * 100;
    points.push({
      hoursFromStart: peak.t - windowStart,
      pct,
      pctLow: pct / UNCERTAINTY_MULTIPLIER,
      pctHigh: pct * UNCERTAINTY_MULTIPLIER,
    });
  }

  return {
    eligible: true,
    points,
    weightKgUsed: resolvedWeight,
    weightFallback: fallback,
    halfLifeHours,
    cavgSsMgPerL: cavgSs,
    anchorEpochHours: windowStart,
  };
}

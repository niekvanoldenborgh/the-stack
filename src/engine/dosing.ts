import type { Dose, DoseUnit, Peptide, RiskTolerance, UserProfile } from '../domain/types';

/**
 * Dose personalisation.
 *
 * The rules here are deliberately conservative and only use modifiers we can
 * actually justify. Where a variable has no defensible effect on dose it is
 * used to produce advice instead of quietly nudging a number — inventing
 * precision is the failure mode to avoid in this file.
 *
 * The pipeline is:
 *   base (per-kg scaled, or fixed)
 *     → multiplied by experience / age / activity / sleep factors
 *     → clamped to the compound's published low..high band
 *     → clamped to its absolute hardMax
 *     → rounded to something you can actually measure in a syringe
 */

export interface DoseComputation {
  dose: Dose;
  /** Where titration applies, the week-1 dose. Equals `dose` when it does not. */
  startDose: Dose;
  /** Human-readable explanation of each adjustment that was applied. */
  factors: string[];
  /** Advice that does not change the number but changes how you use it. */
  advisories: string[];
  withheld: boolean;
}

/** Compounds whose effect depends on the nocturnal GH pulse. */
const GH_AXIS_CLASSES = ['ghrh_analog', 'ghrp_secretagogue', 'growth_hormone'] as const;

function isGhAxis(p: Peptide): boolean {
  return p.classes.some((c) => (GH_AXIS_CLASSES as readonly string[]).includes(c));
}

/**
 * Rounds a dose to a value that can realistically be measured.
 * A suggestion of 187.3 mcg is not usable information.
 */
export function roundDose(value: number, unit: DoseUnit): number {
  switch (unit) {
    case 'mcg':
      if (value >= 100) return Math.round(value / 25) * 25;
      if (value >= 20) return Math.round(value / 5) * 5;
      return Math.round(value);
    case 'mg':
      if (value < 1) return Math.round(value * 100) / 100;
      if (value < 5) return Math.round(value * 4) / 4;
      if (value < 20) return Math.round(value * 2) / 2;
      return Math.round(value);
    case 'iu':
      return Math.round(value * 2) / 2;
    case 'pct':
      if (value < 1) return Math.round(value * 20) / 20;
      return Math.round(value * 2) / 2;
  }
}

export function formatDose(dose: Dose): string {
  const { value, unit } = dose;
  if (unit === 'pct') return `${value}%`;
  if (unit === 'iu') return `${value} IU`;
  return `${value} ${unit}`;
}

/**
 * Experience is the single biggest determinant of a safe starting point. A
 * first cycle should never open at a seasoned user's dose, regardless of
 * bodyweight.
 */
function experienceFactor(profile: UserProfile): { factor: number; note?: string } {
  switch (profile.experience) {
    case 'none':
      return {
        factor: 0.7,
        note: 'First cycle — starting 30% below the typical dose so you can find out how you react before you find out how much you can tolerate.',
      };
    case 'some':
      return { factor: 0.85, note: 'Limited experience — starting 15% below the typical dose.' };
    case 'experienced':
      return { factor: 1 };
  }
}

function ageFactor(profile: UserProfile): { factor: number; note?: string } {
  if (profile.age < 25) {
    return {
      factor: 0.85,
      note: 'Under 25 — your own GH and IGF-1 output is near its lifetime peak, so less is needed and side effects come on sooner.',
    };
  }
  if (profile.age >= 60) {
    return {
      factor: 0.85,
      note: 'Age 60+ — reduced dose. Fluid retention, joint pain and glucose effects are more pronounced and less well tolerated with age.',
    };
  }
  if (profile.age >= 50) {
    return { factor: 0.9, note: 'Age 50+ — slightly reduced to account for greater sensitivity to fluid retention and glucose effects.' };
  }
  return { factor: 1 };
}

function activityFactor(profile: UserProfile): { factor: number; note?: string } {
  switch (profile.activity) {
    case 'sedentary':
      return {
        factor: 0.85,
        note: 'Sedentary — recovery-oriented compounds have less to act on without a training stimulus, so the dose is kept low.',
      };
    case 'light':
      return { factor: 0.95 };
    case 'moderate':
      return { factor: 1 };
    case 'high':
      return { factor: 1.05, note: 'High training load — slightly increased within the published band to match recovery demand.' };
    case 'athlete':
      return { factor: 1.1, note: 'Very high training load — at the upper end of the published band.' };
  }
}

/**
 * Sleep only modifies GH-axis compounds, and only downward. Most GH release
 * happens during slow-wave sleep; if you are sleeping five hours, a larger dose
 * does not recover the lost pulse — it just adds side effects.
 */
function sleepFactor(profile: UserProfile, peptide: Peptide): { factor: number; note?: string } {
  if (!isGhAxis(peptide)) return { factor: 1 };
  if (profile.sleepHours < 6) {
    return {
      factor: 0.75,
      note: 'Under 6 hours of sleep — held well below the typical dose. Most GH release happens in deep sleep, so a bigger dose cannot buy back the pulse you are not having. Fixing sleep will do more than this compound will.',
    };
  }
  if (profile.sleepHours < 7 || profile.sleepQuality <= 2) {
    return {
      factor: 0.9,
      note: 'Short or poor-quality sleep reduces how much this compound can do. Dose held slightly back.',
    };
  }
  return { factor: 1 };
}

/**
 * Maps the risk dial onto a target inside the compound's published band.
 *
 * Level 3 sits at the typical dose, level 1 at the published minimum, level 5
 * at the published maximum. Interpolating between published anchors — rather
 * than multiplying past them — is what makes it structurally impossible for the
 * dial to invent a dose. There is no data above the published maximum to
 * personalise against, so the engine will not go there.
 */
function riskTarget(
  level: RiskTolerance,
  bandLow: number,
  typical: number,
  bandHigh: number,
): { value: number; note: string } {
  if (level <= 2) {
    const t = (level - 1) / 2; // 0 at level 1, 0.5 at level 2
    return {
      value: bandLow + (typical - bandLow) * t,
      note:
        level === 1
          ? 'Risk setting "Minimal" — targeting the bottom of the published range.'
          : 'Risk setting "Cautious" — below the typical dose, inside the published range.',
    };
  }
  if (level === 3) {
    return { value: typical, note: 'Risk setting "Balanced" — the typical published dose.' };
  }
  const t = (level - 3) / 2; // 0.5 at level 4, 1 at level 5
  return {
    value: typical + (bandHigh - typical) * t,
    note:
      level === 5
        ? 'Risk setting "Maximum" — the top of the published range. The engine will not go above this, because there is no published data up there to personalise against.'
        : 'Risk setting "Assertive" — above typical, still inside the published range.',
  };
}

export function computeDose(peptide: Peptide, profile: UserProfile): DoseComputation {
  const unit = peptide.dosing.unit;

  if (peptide.doseGuidanceWithheld) {
    return {
      dose: { value: 0, unit },
      startDose: { value: 0, unit },
      factors: [],
      advisories: [peptide.doseGuidanceWithheld.reason],
      withheld: true,
    };
  }

  const perKg = peptide.dosing.basis === 'per_kg';
  const scale = perKg ? profile.weightKg : 1;

  const baseTypical = peptide.dosing.typical * scale;
  const bandLow = peptide.dosing.low * scale;
  const bandHigh = peptide.dosing.high * scale;

  const factors: string[] = [];
  const advisories: string[] = [];

  if (perKg) {
    factors.push(
      `Scaled to your bodyweight: ${peptide.dosing.typical} ${unit}/kg × ${profile.weightKg} kg = ${Math.round(baseTypical)} ${unit}.`,
    );
  } else {
    factors.push(`Fixed dose — this compound is not scaled by bodyweight.`);
  }

  const mods = [
    experienceFactor(profile),
    ageFactor(profile),
    activityFactor(profile),
    sleepFactor(profile, peptide),
  ];

  // The risk dial sets the target inside the published band; the personal
  // modifiers then adjust around it. Both are re-clamped to the band below.
  const risk = riskTarget(profile.riskTolerance ?? 3, bandLow, baseTypical, bandHigh);
  factors.push(risk.note);

  let multiplier = 1;
  for (const m of mods) {
    multiplier *= m.factor;
    if (m.note) factors.push(m.note);
  }

  let value = risk.value * multiplier;

  // Clamp into the published band, then to the absolute ceiling.
  const ceiling = Math.min(bandHigh, peptide.dosing.hardMax);

  const clampedToBand = Math.min(Math.max(value, bandLow), bandHigh);
  if (clampedToBand !== value) {
    factors.push(
      `Held inside the published range for this compound (${peptide.dosing.low}–${peptide.dosing.high} ${unit}${perKg ? '/kg' : ''}).`,
    );
    value = clampedToBand;
  }

  if (value > peptide.dosing.hardMax) {
    factors.push(
      `Capped at ${peptide.dosing.hardMax} ${unit}. Above this, the response plateaus and only the side effects keep scaling.`,
    );
    value = peptide.dosing.hardMax;
  }

  // Round to a measurable increment, then re-apply the bounds.
  //
  // Rounding to the *nearest* increment can round upward past the ceiling —
  // semaglutide's 2.4 mg label maximum rounds to 2.5 mg — which would quietly
  // hand back a dose above the published maximum. When that happens we snap to
  // the published bound itself rather than a rounded value, because published
  // figures are by definition real, measurable doses.
  //
  // Order matters: the floor is applied first and the ceiling second, so the
  // absolute cap always wins. For a per-kg compound a heavy enough user can
  // have a scaled band minimum above the cap (mod GRF at 200 kg scales to
  // 200 mcg against a 150 mcg cap) — that is exactly the case the cap exists
  // for, and the floor must not be allowed to undo it.
  let finalValue = roundDose(value, unit);
  if (finalValue < bandLow) finalValue = bandLow;
  if (finalValue > ceiling) finalValue = ceiling;

  let startValue = finalValue;
  if (peptide.dosing.titrationWeeks > 0) {
    const rawStart = Math.min(bandLow, finalValue);
    startValue = Math.min(roundDose(Math.min(rawStart, peptide.dosing.hardMax), unit), finalValue);
    advisories.push(
      `Titrate: start at ${formatDose({ value: startValue, unit })} and build to ${formatDose({ value: finalValue, unit })} over ${peptide.dosing.titrationWeeks} week${peptide.dosing.titrationWeeks === 1 ? '' : 's'}. Escalating faster is the most common cause of severe side effects with this compound.`,
    );
  }

  if (isGhAxis(peptide) && peptide.routes.includes('subcutaneous')) {
    advisories.push(
      'Inject fasted — at least 2 hours after eating and 20–30 minutes before your next meal. Carbohydrate and fat blunt the GH pulse, which is the whole point of the injection.',
    );
  }

  if (profile.bodyFatPct !== undefined && perKg && profile.bodyFatPct > 30) {
    advisories.push(
      'Your dose is scaled to total bodyweight. At higher body-fat percentages some clinicians scale to lean mass instead, which would give a lower number. Consider the lower end of the range.',
    );
  }

  return {
    dose: { value: finalValue, unit },
    startDose: { value: startValue, unit },
    factors,
    advisories,
    withheld: false,
  };
}

/**
 * The dose for a given week of a cycle, accounting for the titration ramp.
 * `week` is 1-indexed.
 */
export function doseForWeek(
  startDose: Dose,
  targetDose: Dose,
  titrationWeeks: number,
  week: number,
): Dose {
  if (titrationWeeks <= 0 || week >= titrationWeeks) return targetDose;
  if (week <= 1) return startDose;

  const span = targetDose.value - startDose.value;
  const stepped = startDose.value + (span * (week - 1)) / titrationWeeks;
  return { value: roundDose(stepped, targetDose.unit), unit: targetDose.unit };
}

/**
 * The concentration a reconstituted vial reaches — the peptide:water ratio,
 * expressed in the two units a user re-derives at the syringe.
 *
 * This depends on nothing but the two numbers the user typed (vial mass and
 * water), so it is an instrument-surface calculation under the THEA-6 no-dosage
 * boundary (docs/pk-estimated-levels-spec.md §3.2, C1/C3): pure arithmetic on
 * user inputs, no dose originated. Every returned figure is meant to be shown
 * with its unit spelled out — see §3.4(b).
 */
export interface Concentration {
  /** Peptide mass per millilitre of solution. */
  mgPerMl: number;
  /** Mass per unit on a U-100 insulin syringe (100 units = 1 mL). */
  mcgPerUnit: number;
}

export function concentration(vialAmountMg: number, bacWaterMl: number): Concentration | null {
  if (vialAmountMg <= 0 || bacWaterMl <= 0) return null;
  const mgPerMl = vialAmountMg / bacWaterMl;
  // A U-100 syringe has 100 units per millilitre.
  const mcgPerUnit = (vialAmountMg * 1000) / (bacWaterMl * 100);
  return {
    mgPerMl: Math.round(mgPerMl * 100) / 100,
    mcgPerUnit: Math.round(mcgPerUnit * 100) / 100,
  };
}

/**
 * Reconstitution helper: how much bacteriostatic water to add, and how many
 * insulin-syringe units a dose corresponds to.
 *
 * This exists because unit-conversion mistakes at the syringe are one of the
 * most common real-world causes of accidental overdose in this space.
 */
export interface ReconstitutionResult {
  /** Concentration in mcg per unit on a U-100 insulin syringe. */
  mcgPerUnit: number;
  /** Units to draw for the requested dose. */
  unitsForDose: number;
  warning?: string;
}

export function reconstitute(
  vialAmountMg: number,
  bacWaterMl: number,
  dose: Dose,
): ReconstitutionResult | null {
  if (dose.unit === 'pct' || dose.unit === 'iu') return null;
  if (vialAmountMg <= 0 || bacWaterMl <= 0) return null;

  // Divide on the unrounded ratio; `concentration()` supplies the rounded
  // figure for display only, so the syringe maths keeps full precision.
  const mcgPerUnit = (vialAmountMg * 1000) / (bacWaterMl * 100);

  const doseMcg = dose.unit === 'mg' ? dose.value * 1000 : dose.value;
  const unitsForDose = doseMcg / mcgPerUnit;

  let warning: string | undefined;
  if (unitsForDose < 2) {
    warning =
      'This works out to under 2 units on the syringe, which is very hard to measure accurately. Add more bacteriostatic water to dilute it further.';
  } else if (unitsForDose > 100) {
    warning =
      'This exceeds the capacity of a 1 ml U-100 syringe. Use less bacteriostatic water so the dose fits in one injection.';
  }

  return {
    mcgPerUnit: Math.round(mcgPerUnit * 100) / 100,
    unitsForDose: Math.round(unitsForDose * 10) / 10,
    warning,
  };
}

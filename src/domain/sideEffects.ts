/**
 * The curated list of side effects the Logger offers (THEA-9).
 *
 * This list is a Product & Safety artefact, not an engineering one — it is the
 * set a user can pick from when logging how they feel, and it doubles as the
 * vocabulary the side-effect trend on the Results page counts against. Keep it
 * here in the domain layer (pure, testable, reviewable) rather than inline in a
 * route file so a change to it is a visible, diffable decision.
 *
 * The IDs are stable slugs; the `label` is what the user reads. A user can also
 * log a free-text "other" symptom, which is why the store stores a plain
 * `label` string rather than one of these IDs.
 */
export interface SideEffectOption {
  id: string;
  label: string;
}

/** Bounds of the user-entered severity scale (THEA-9 P&S sign-off): 1 = least, 10 = most severe. No default. */
export const SEVERITY_MIN = 1;
export const SEVERITY_MAX = 10;

/**
 * Buckets a 1–10 self-reported severity into the mild/moderate/severe bands
 * the app already uses for chart colour and badges. Cut points follow the
 * standard clinical Numeric Rating Scale convention (1–3 mild, 4–6 moderate,
 * 7–10 severe) — same convention as the existing 0–10 injection pain scale.
 * Flagged for Product & Safety to confirm; not a dosing decision, only a
 * display grouping.
 */
export function severityBand(score: number): 'mild' | 'moderate' | 'severe' {
  if (score >= 7) return 'severe';
  if (score >= 4) return 'moderate';
  return 'mild';
}

export const SIDE_EFFECT_OPTIONS: SideEffectOption[] = [
  { id: 'nausea', label: 'Nausea' },
  { id: 'heartburn', label: 'Heartburn' },
  { id: 'food_noise', label: 'Food noise' },
  { id: 'suppressed_appetite', label: 'Suppressed appetite' },
  { id: 'rash', label: 'Rash' },
  { id: 'injection_site_reaction', label: 'Injection-site reaction' },
  { id: 'constipation', label: 'Constipation' },
  { id: 'belching', label: 'Belching' },
  { id: 'mood_swings', label: 'Mood swings' },
  { id: 'indigestion', label: 'Indigestion' },
  { id: 'metallic_taste', label: 'Metallic taste' },
  { id: 'stomach_pain', label: 'Stomach pain' },
  { id: 'hair_loss', label: 'Hair loss' },
  { id: 'fatigue', label: 'Fatigue' },
  { id: 'migraine', label: 'Migraine' },
];

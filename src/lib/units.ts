/**
 * Body-measurement unit formatting.
 *
 * IMPORTANT: this file converts **bodyweight and height only** — never a dose.
 * Dose units (`mcg`/`mg`/`iu`/`pct`) carry their unit on the record and are
 * never converted behind the scenes, because unit confusion at the syringe is
 * the most likely route to a real-world overdose (see AGENTS.md, safety
 * invariant #8). The profile always stores metric (`weightKg`, `heightCm`); the
 * user's unit preference is a presentation choice applied at the edge.
 */

import type { LengthUnit, MassUnit } from '../store/useAppStore';

const KG_PER_LB = 0.45359237;
const CM_PER_IN = 2.54;

export function formatMass(weightKg: number, unit: MassUnit): string {
  if (unit === 'lb') return `${Math.round(weightKg / KG_PER_LB)} lb`;
  return `${Math.round(weightKg * 10) / 10} kg`;
}

export function formatLength(heightCm: number, unit: LengthUnit): string {
  if (unit === 'ft') {
    const totalInches = Math.round(heightCm / CM_PER_IN);
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${feet}′ ${inches}″`;
  }
  return `${Math.round(heightCm)} cm`;
}

export const MASS_UNIT_LABELS: Record<MassUnit, string> = {
  kg: 'Kilograms (kg)',
  lb: 'Pounds (lb)',
};

export const LENGTH_UNIT_LABELS: Record<LengthUnit, string> = {
  cm: 'Centimetres (cm)',
  ft: 'Feet & inches',
};

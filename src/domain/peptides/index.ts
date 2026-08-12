import type { GoalId, Peptide, PeptideClass } from '../types';
import { COSMETIC_PEPTIDES } from './cosmetic';
import { GROWTH_PEPTIDES } from './growth';
import { METABOLIC_PEPTIDES } from './metabolic';
import { REPAIR_PEPTIDES } from './repair';

export const PEPTIDES: Peptide[] = [
  ...METABOLIC_PEPTIDES,
  ...GROWTH_PEPTIDES,
  ...REPAIR_PEPTIDES,
  ...COSMETIC_PEPTIDES,
];

const BY_ID = new Map<string, Peptide>(PEPTIDES.map((p) => [p.id, p]));

export function getPeptide(id: string): Peptide | undefined {
  return BY_ID.get(id);
}

/** Throws for unknown ids — use where a missing peptide is a programming error. */
export function requirePeptide(id: string): Peptide {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown peptide id: ${id}`);
  return found;
}

export function peptidesForGoal(goal: GoalId): Peptide[] {
  return PEPTIDES.filter((p) => (p.goalFit[goal] ?? 0) > 0).sort(
    (a, b) => (b.goalFit[goal] ?? 0) - (a.goalFit[goal] ?? 0),
  );
}

export function peptidesInClass(cls: PeptideClass): Peptide[] {
  return PEPTIDES.filter((p) => p.classes.includes(cls));
}

export function searchPeptides(query: string): Peptide[] {
  const q = query.trim().toLowerCase();
  if (!q) return PEPTIDES;
  return PEPTIDES.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.id.includes(q) ||
      p.aliases.some((a) => a.toLowerCase().includes(q)) ||
      p.summary.toLowerCase().includes(q),
  );
}

export { COSMETIC_PEPTIDES, GROWTH_PEPTIDES, METABOLIC_PEPTIDES, REPAIR_PEPTIDES };

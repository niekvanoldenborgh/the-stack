import { CUSTOM_METRIC_ID, METRIC_BY_ID } from '../domain/metrics';
import type { GoalTarget, Measurement } from '../domain/types';

/**
 * Progress tracking.
 *
 * A pure transform from a flat list of measurements to per-metric series, so
 * the figures on the Results screen — the plotted trend and the change since
 * the first reading — can be asserted in a test rather than eyeballed.
 *
 * It reports only what was recorded: the change is arithmetic between two of
 * the user's own readings. It never labels a value good or bad, because which
 * direction counts as progress depends on the goal, and judging a value at all
 * would be medical advice.
 */

export interface MetricPoint {
  date: string;
  value: number;
}

export interface MetricSummary {
  /** Stable key for the series — the metric id, or a per-label key for custom. */
  key: string;
  metricId: string;
  label: string;
  unit: string;
  /** Readings sorted oldest to newest. */
  points: MetricPoint[];
  count: number;
  first: number | null;
  latest: number | null;
  /** `latest − first`. Null with fewer than two readings. */
  change: number | null;
  /** Percentage change, one decimal. Null with fewer than two, or first = 0. */
  changePct: number | null;
}

/**
 * Custom measures are keyed by their (case-folded) label so two differently
 * named user metrics stay separate while repeated readings of the same one
 * collect into a single series.
 */
export function seriesKey(m: Measurement): string {
  if (m.metricId !== CUSTOM_METRIC_ID) return m.metricId;
  return `custom:${(m.customLabel ?? '').trim().toLowerCase()}`;
}

function resolveLabelUnit(sample: Measurement): { label: string; unit: string } {
  if (sample.metricId === CUSTOM_METRIC_ID) {
    return { label: sample.customLabel?.trim() || 'Custom measure', unit: sample.customUnit?.trim() ?? '' };
  }
  const metric = METRIC_BY_ID[sample.metricId];
  return { label: metric?.label ?? sample.metricId, unit: metric?.unit ?? '' };
}

/** Every metric that has at least one reading, most recently updated first. */
export function summariseMeasurements(measurements: Measurement[]): MetricSummary[] {
  const groups = new Map<string, Measurement[]>();
  for (const m of measurements) {
    const key = seriesKey(m);
    const bucket = groups.get(key) ?? [];
    bucket.push(m);
    groups.set(key, bucket);
  }

  const summaries: MetricSummary[] = [];
  for (const [key, group] of groups) {
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    const points = sorted.map((m) => ({ date: m.date, value: m.value }));
    const first = points[0]?.value ?? null;
    const latest = points[points.length - 1]?.value ?? null;
    const change = points.length >= 2 && first !== null && latest !== null ? round(latest - first, 2) : null;
    const changePct =
      points.length >= 2 && first !== null && first !== 0 && latest !== null
        ? round(((latest - first) / Math.abs(first)) * 100, 1)
        : null;
    const { label, unit } = resolveLabelUnit(sorted[0]!);
    summaries.push({
      key,
      metricId: sorted[0]!.metricId,
      label,
      unit,
      points,
      count: points.length,
      first,
      latest,
      change,
      changePct,
    });
  }

  return summaries.sort((a, b) => {
    const aDate = a.points[a.points.length - 1]?.date ?? '';
    const bDate = b.points[b.points.length - 1]?.date ?? '';
    return bDate.localeCompare(aDate);
  });
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * Percent of the way from a target's baseline reading to its target value,
 * based on the metric's latest reading. A straight-line fraction between two
 * points the user chose — it works whether the target sits above or below
 * the baseline (gaining toward a higher number, losing toward a lower one)
 * without needing to know which direction "progress" means for this user's
 * goal. Clamped to [0, 100]: a reading that overshoots the target still reads
 * as "there", not over 100%.
 */
export function goalTargetProgressPct(target: GoalTarget, latestValue: number | null): number | null {
  if (latestValue === null) return null;
  const span = target.value - target.baseline;
  if (span === 0) return latestValue === target.value ? 100 : 0;
  const pct = ((latestValue - target.baseline) / span) * 100;
  return Math.max(0, Math.min(100, pct));
}

/** Formats a metric value with its unit, matching the Results screen's own convention. */
export function formatMetricValue(value: number, unit: string, precision: number): string {
  const num = precision > 0 ? value.toFixed(precision) : `${Math.round(value)}`;
  if (!unit) return num;
  if (unit === '%') return `${num}%`;
  return `${num} ${unit}`;
}

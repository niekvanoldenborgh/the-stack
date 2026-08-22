import { useRouter } from 'expo-router';
import { Activity, MapPin, Repeat } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  CUSTOM_METRIC_ID,
  METRIC_BY_ID,
  SCALE_MAX,
  SCALE_MIN,
  metricsForGoals,
  type MetricInputKind,
} from '../../src/domain/metrics';
import { getPeptide } from '../../src/domain/peptides';
import { SEVERITY_MAX } from '../../src/domain/sideEffects';
import type {
  CyclePhase,
  DoseLog,
  GoalTarget,
  InjectionLog,
  InjectionSite,
  Measurement,
  PhaseKind,
  SideEffectLog,
  Stack,
} from '../../src/domain/types';
import { buildCyclePhases, cyclePlanProgressPct, generateSchedule, groupPhasesByPeptide } from '../../src/engine/cycle';
import { goalTargetProgressPct, seriesKey, summariseMeasurements, type MetricSummary } from '../../src/engine/progress';
import { addDays, diffDays, formatRange, formatShort, relativeLabel, startOfWeek, today } from '../../src/lib/date';
import { selectAdherence, useActiveStack, useAppStore } from '../../src/store/useAppStore';
import { INJECTION_SITE_LABELS } from '../../src/ui/BodyFigure';
import { Sparkbars } from '../../src/ui/charts';
import {
  Button,
  Caption,
  Data,
  Display,
  EmptyState,
  Heading,
  ProgressBar,
  Row,
  Screen,
  Small,
  Spacer,
  TextField,
} from '../../src/ui/components';
import { DeltaBadge, PhaseBar, Tile, type PhaseBarSegment } from '../../src/ui/nocturne';
import { Disclosure, List, ListItem, Section } from '../../src/ui/primitives';
import { fonts, radius, spacing, typography, useTheme, withOpacity } from '../../src/ui/theme';

/**
 * Results — the goal tracker, redesigned THEA-38b, retinted NOCTURNE.
 *
 * This is the app's one coherent "how am I doing" surface: overview stats
 * (adherence, active compounds, logged injections), the measurements you log
 * against your goals, cycle position, side-effect trend and injection-site
 * rotation all live here. Calendar keeps the day-to-day schedule; Analytics
 * keeps the training-specific deep dive.
 *
 * The focal measure — the first goal's — gets the hero `Tile` at the top:
 * value, `DeltaBadge`, target (if set) and its own chart, all on the face.
 * Everything else, including entry history and the add-a-reading form, sits
 * behind a `Disclosure`. Previously this screen also carried a full-sentence
 * callout explaining what the chart does, sitting directly above the chart
 * itself, plus a near-duplicate sentence at the bottom — both deleted in
 * favour of trusting the graphic; what caveat remains lives once, collapsed,
 * in "About your data".
 *
 * It never sets a target or judges a value itself: the app is not a
 * clinician. The one exception — owner feedback, THEA-40 round 2 — is that
 * the focal metric can carry a target the user typed in themselves; the app
 * only measures distance already-logged readings have covered toward that
 * number, the same way it reports change since the first reading. Because a
 * DeltaBadge needs a "good" direction to tint, and the app has no basis to
 * judge one without a target (which direction of, say, bodyweight is
 * "better" depends on the goal, not the metric — see `engine/progress.ts`),
 * `neutralGoodDirection` picks a direction guaranteed to render untoned.
 */

interface Descriptor {
  key: string;
  metricId: string;
  label: string;
  unit: string;
  kind: MetricInputKind;
  precision: number;
  hint: string;
}

function formatNumber(value: number, precision: number): string {
  return precision > 0 ? value.toFixed(precision) : `${Math.round(value)}`;
}

/** A value with its unit, e.g. "82.5 kg", "18.0%", "3 / 5". */
function valueLabel(value: number, d: Pick<Descriptor, 'kind' | 'unit' | 'precision'>): string {
  const num = formatNumber(value, d.precision);
  if (d.kind === 'scale') return `${num} / ${SCALE_MAX}`;
  if (!d.unit) return num;
  if (d.unit === '%') return `${num}%`;
  return `${num} ${d.unit}`;
}

/** Splits a value into the pieces the hero figure wants — a number and a trailing unit. */
function focalValue(value: number, d: Descriptor): { value: string; unit?: string } {
  const num = formatNumber(value, d.precision);
  if (d.kind === 'scale') return { value: num, unit: `/ ${SCALE_MAX}` };
  if (!d.unit || d.unit === '%') return { value: d.unit === '%' ? `${num}%` : num };
  return { value: num, unit: d.unit };
}

function changeLineText(descriptor: Descriptor, summary: MetricSummary): string {
  const change = summary.change ?? 0;
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  const magnitude = valueLabel(Math.abs(change), descriptor);
  const since = formatShort(summary.points[0]!.date);
  // Percentage is only meaningful for a measured quantity, not a 1–5 rating.
  const pct =
    descriptor.kind === 'number' && summary.changePct !== null
      ? ` (${summary.changePct > 0 ? '+' : ''}${summary.changePct}%)`
      : '';
  return change === 0 ? `No change since ${since}` : `${arrow} ${magnitude}${pct} since ${since}`;
}

/** Direction toward the user's own stated target — not a value judgement, just which way they said they want to move. */
function targetGoodDirection(target: GoalTarget): 'up' | 'down' {
  return target.value >= target.baseline ? 'up' : 'down';
}

/**
 * Without a target the app has no basis to call either direction of a raw
 * metric "good" (engine/progress.ts never judges one). Passing the direction
 * opposite the observed change guarantees `DeltaBadge` renders its neutral,
 * untoned style rather than an unearned green.
 */
function neutralGoodDirection(change: number): 'up' | 'down' {
  return change > 0 ? 'down' : 'up';
}

/** Copy for a series with fewer than two points — never drawn as a chart. */
function chartEmptyMessage(count: number): string {
  return count === 0 ? 'Log two readings to see a trend.' : 'Log one more reading to see a trend.';
}

/**
 * The chart every measure gets — a single-hue `Sparkbars` series against the
 * tile's own neutral surface. Below two points there is nothing to show a
 * trend with, so this renders a plain empty state naming how many more
 * readings are needed rather than a chart that would only ever draw one bar.
 */
function MetricChart({
  descriptor,
  summary,
  height = 34,
}: {
  descriptor: Descriptor;
  summary?: MetricSummary;
  height?: number;
}) {
  const theme = useTheme();
  const { color } = theme;
  const count = summary?.count ?? 0;

  if (!summary || count < 2) {
    return <Small>{chartEmptyMessage(count)}</Small>;
  }

  return (
    <View>
      <Sparkbars
        values={summary.points.map((p) => p.value)}
        height={height}
        accessibilityLabel={`${descriptor.label} over ${summary.count} readings: ${summary.points
          .map((p) => valueLabel(p.value, descriptor))
          .join(', ')}`}
      />
      <Row justify="space-between" style={{ marginTop: spacing.sm }}>
        <Caption color={color.textTertiary}>{formatShort(summary.points[0]!.date)}</Caption>
        <Caption color={color.textTertiary}>{formatShort(summary.points[summary.points.length - 1]!.date)}</Caption>
      </Row>
    </View>
  );
}

export default function ResultsScreen() {
  const theme = useTheme();
  const { color } = theme;
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const measurements = useAppStore((s) => s.measurements);
  const addMeasurement = useAppStore((s) => s.addMeasurement);
  const removeMeasurement = useAppStore((s) => s.removeMeasurement);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const stack = useActiveStack();
  const doseLogs = useAppStore((s) => s.doseLogs);
  const injectionLogs = useAppStore((s) => s.injectionLogs);
  const sideEffectLogs = useAppStore((s) => s.sideEffectLogs);

  const summaries = useMemo(() => summariseMeasurements(measurements), [measurements]);
  const summaryByKey = useMemo(() => new Map(summaries.map((s) => [s.key, s])), [summaries]);

  // Readings for each series, newest first, for the recent-entries list.
  const entriesByKey = useMemo(() => {
    const map = new Map<string, Measurement[]>();
    for (const m of measurements) {
      const key = seriesKey(m);
      const list = map.get(key);
      if (list) list.push(m);
      else map.set(key, [m]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
    }
    return map;
  }, [measurements]);

  const descriptors = useMemo<Descriptor[]>(() => {
    const goalMetrics = profile ? metricsForGoals(profile.goals) : [];
    const goalDescriptors: Descriptor[] = goalMetrics.map((m) => ({
      key: m.id,
      metricId: m.id,
      label: m.label,
      unit: m.unit,
      kind: m.kind,
      precision: m.precision,
      hint: m.hint,
    }));
    const covered = new Set(goalDescriptors.map((d) => d.key));

    // Anything logged that isn't already surfaced by a goal — a metric outside
    // the current goals, or a custom measure — still gets a row.
    const extra: Descriptor[] = summaries
      .filter((s) => !covered.has(s.key))
      .map((s) => {
        const metric = METRIC_BY_ID[s.metricId];
        return {
          key: s.key,
          metricId: s.metricId,
          label: s.label,
          unit: s.unit,
          kind: metric?.kind ?? 'number',
          precision: metric?.precision ?? 1,
          hint: metric?.hint ?? '',
        };
      });

    return [...goalDescriptors, ...extra];
  }, [profile, summaries]);

  const [primary, ...rest] = descriptors;

  if (!profile) {
    return (
      <Screen>
        <Spacer size={spacing.xl} />
        <Display>Results</Display>
        <Spacer size={spacing.lg} />
        <EmptyState
          title="No profile yet"
          body="Complete onboarding to pick goals, then track your progress here."
          illustration="onboarding"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Spacer size={spacing.md} />
      <Caption color={color.primary}>Progress</Caption>
      <Display style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Results</Display>

      <Disclosure label="About your data" summary="What this screen tracks, and what it doesn't">
        <Small>
          The app charts what you enter and shows the change between readings. It never sets a target or judges a
          value — that&apos;s between you and a clinician. A gap in your readings shows up as a gap in the chart;
          nothing is filled in for you.
        </Small>
      </Disclosure>
      <Spacer size={spacing.lg} />

      {primary ? (
        <PrimaryMetricSection
          descriptor={primary}
          summary={summaryByKey.get(primary.key)}
          entries={entriesByKey.get(primary.key) ?? []}
          target={profile.goalTarget?.metricId === primary.metricId ? profile.goalTarget : undefined}
          onAdd={addMeasurement}
          onRemove={removeMeasurement}
          onSetTarget={(value, baseline) =>
            updateProfile({ goalTarget: { metricId: primary.metricId, value, baseline, setAt: today() } })
          }
          onClearTarget={() => updateProfile({ goalTarget: undefined })}
        />
      ) : (
        <Section tone={2}>
          <Caption color={color.primary}>Progress</Caption>
          <Small style={{ marginTop: spacing.sm }}>
            Pick a goal in onboarding to see a tracked measure here, or add a custom one below.
          </Small>
        </Section>
      )}
      <Spacer size={spacing.lg} />

      <CyclePhaseSection stack={stack} />
      <Spacer size={spacing.lg} />

      <SideEffectTrendTile logs={sideEffectLogs} />
      <Spacer size={spacing.lg} />

      <SiteRotationTile logs={injectionLogs} />
      <Spacer size={spacing.lg} />

      <OverviewSection
        stack={stack}
        doseLogs={doseLogs}
        injectionLogs={injectionLogs}
        onOpenAnalytics={() => router.push('/analytics')}
      />
      <Spacer size={spacing.xxl} />

      {rest.length > 0 ? (
        <Section title="Other measures" gap={spacing.lg}>
          {rest.map((d) => (
            <MetricRow
              key={d.key}
              descriptor={d}
              summary={summaryByKey.get(d.key)}
              entries={entriesByKey.get(d.key) ?? []}
              onAdd={addMeasurement}
              onRemove={removeMeasurement}
            />
          ))}
        </Section>
      ) : null}

      <CustomMeasureSection onAdd={addMeasurement} />

      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Primary metric — the one hero figure on this screen
// ---------------------------------------------------------------------------

function PrimaryMetricSection({
  descriptor,
  summary,
  entries,
  target,
  onAdd,
  onRemove,
  onSetTarget,
  onClearTarget,
}: {
  descriptor: Descriptor;
  summary?: MetricSummary;
  entries: Measurement[];
  target?: GoalTarget;
  onAdd: (entry: Omit<Measurement, 'id'>) => void;
  onRemove: (id: string) => void;
  onSetTarget: (value: number, baseline: number) => void;
  onClearTarget: () => void;
}) {
  const theme = useTheme();
  const { color } = theme;
  const latest = summary?.latest ?? null;
  const figure = latest != null ? focalValue(latest, descriptor) : { value: '—' };
  const change = summary?.change ?? null;
  const sinceLabel = summary && change !== null ? `since ${formatShort(summary.points[0]!.date)}` : undefined;
  const historySummary = entries.length > 0 ? `${entries.length} reading${entries.length === 1 ? '' : 's'} logged` : 'No readings yet';
  const progressPct = target ? goalTargetProgressPct(target, latest) : null;
  const goodDirection = target ? targetGoodDirection(target) : change !== null ? neutralGoodDirection(change) : undefined;

  return (
    <Tile elevation="hero" caption={descriptor.label}>
      <Row justify="space-between" align="flex-end" wrap gap={spacing.sm}>
        <Text style={[typography.metric, { color: color.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit>
          {figure.value}
          {figure.unit ? <Text style={[typography.heading, { color: color.textTertiary }]}>{` ${figure.unit}`}</Text> : null}
        </Text>
        {change !== null && goodDirection ? (
          <DeltaBadge
            value={change}
            goodDirection={goodDirection}
            unit={descriptor.kind === 'scale' ? undefined : descriptor.unit || undefined}
            decimals={descriptor.precision}
          />
        ) : null}
      </Row>
      {sinceLabel ? (
        <Caption color={color.textTertiary} style={{ marginTop: spacing.xs }}>
          {sinceLabel}
        </Caption>
      ) : null}

      {target && progressPct !== null ? (
        <View style={{ marginTop: spacing.md }}>
          <ProgressBar value={progressPct} tone="accent" />
          <Caption color={color.textTertiary} style={{ marginTop: spacing.xs }}>
            {`${Math.round(progressPct)}% of the way to your target of ${valueLabel(target.value, descriptor)}`}
          </Caption>
        </View>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        <MetricChart descriptor={descriptor} summary={summary} height={120} />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <GoalTargetEditor descriptor={descriptor} target={target} latest={latest} onSet={onSetTarget} onClear={onClearTarget} />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <Disclosure label="History & log a reading" summary={historySummary}>
          <ReadingsAndAddForm descriptor={descriptor} entries={entries} onAdd={onAdd} onRemove={onRemove} />
        </Disclosure>
      </View>
    </Tile>
  );
}

/**
 * Lets the user set, edit or clear a target for the focal metric — the only
 * metric a target can be attached to, matching this screen's "one focal
 * measure" treatment. Only offered for `number`-kind metrics: a 1–5
 * self-rating has no natural "target" the way a weight or a lift does. The
 * value is entirely the user's; nothing here suggests or validates it as
 * healthy (see `domain/metrics.ts`).
 */
function GoalTargetEditor({
  descriptor,
  target,
  latest,
  onSet,
  onClear,
}: {
  descriptor: Descriptor;
  target?: GoalTarget;
  latest: number | null;
  onSet: (value: number, baseline: number) => void;
  onClear: () => void;
}) {
  const theme = useTheme();
  const { color } = theme;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  if (descriptor.kind !== 'number') return null;

  const numericValue = Number(text);
  const valid = text.trim() !== '' && Number.isFinite(numericValue) && numericValue > 0;

  const startEditing = () => {
    setText(target ? `${target.value}` : '');
    setOpen(true);
  };

  const save = () => {
    if (!valid || latest === null) return;
    onSet(numericValue, latest);
    setOpen(false);
  };

  if (open) {
    return (
      <View>
        <TextField
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          placeholder={`Target value${descriptor.unit ? ` (${descriptor.unit})` : ''}`}
          returnKeyType="done"
          onSubmitEditing={save}
          suffix={descriptor.unit ? <Small style={{ marginLeft: spacing.sm }}>{descriptor.unit}</Small> : undefined}
        />
        <Spacer size={spacing.sm} />
        <Row gap={spacing.sm}>
          <Button label="Save target" onPress={save} disabled={!valid} style={{ flex: 1 }} />
          <Button label="Cancel" variant="ghost" onPress={() => setOpen(false)} style={{ flex: 1 }} />
        </Row>
      </View>
    );
  }

  if (target) {
    return (
      <Row justify="space-between">
        <Small>{`Target: ${valueLabel(target.value, descriptor)}`}</Small>
        <Row gap={spacing.lg}>
          <Pressable accessibilityRole="button" accessibilityLabel="Edit target" hitSlop={8} onPress={startEditing}>
            <Small style={{ color: color.primary }}>Edit</Small>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Clear target" hitSlop={8} onPress={onClear}>
            <Small style={{ color: color.textTertiary }}>Clear</Small>
          </Pressable>
        </Row>
      </Row>
    );
  }

  // Nothing logged yet — there is no baseline to measure a target against.
  if (latest === null) return null;

  return <Button label="Set a target" variant="ghost" onPress={startEditing} />;
}

// ---------------------------------------------------------------------------
// Secondary metrics — one Disclosure row per measure
// ---------------------------------------------------------------------------

function MetricRow({
  descriptor,
  summary,
  entries,
  onAdd,
  onRemove,
}: {
  descriptor: Descriptor;
  summary?: MetricSummary;
  entries: Measurement[];
  onAdd: (entry: Omit<Measurement, 'id'>) => void;
  onRemove: (id: string) => void;
}) {
  const summaryText =
    summary?.latest != null
      ? `${valueLabel(summary.latest, descriptor)} · latest${
          summary.change !== null && summary.first !== null ? ` · ${changeLineText(descriptor, summary)}` : ''
        }`
      : 'No readings yet';

  return (
    <Disclosure label={descriptor.label} summary={summaryText}>
      <MetricDetail descriptor={descriptor} summary={summary} entries={entries} onAdd={onAdd} onRemove={onRemove} />
    </Disclosure>
  );
}

/** Chart + recent entries + add-a-reading form, used by every secondary measure's Disclosure. */
function MetricDetail({
  descriptor,
  summary,
  entries,
  onAdd,
  onRemove,
}: {
  descriptor: Descriptor;
  summary?: MetricSummary;
  entries: Measurement[];
  onAdd: (entry: Omit<Measurement, 'id'>) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <View>
      <MetricChart descriptor={descriptor} summary={summary} />
      <ReadingsAndAddForm descriptor={descriptor} entries={entries} onAdd={onAdd} onRemove={onRemove} />
    </View>
  );
}

/** Recent-entries list + add-a-reading form. Shared by the hero's own disclosure and `MetricDetail`. */
function ReadingsAndAddForm({
  descriptor,
  entries,
  onAdd,
  onRemove,
}: {
  descriptor: Descriptor;
  entries: Measurement[];
  onAdd: (entry: Omit<Measurement, 'id'>) => void;
  onRemove: (id: string) => void;
}) {
  const theme = useTheme();
  const { color } = theme;
  const [adding, setAdding] = useState(false);

  return (
    <View>
      {entries.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <List>
            {entries.slice(0, 3).map((entry) => (
              <ListItem
                key={entry.id}
                title={relativeLabel(entry.date)}
                meta={
                  <Row gap={spacing.md}>
                    <Data small color={color.textSecondary}>
                      {valueLabel(entry.value, descriptor)}
                    </Data>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${descriptor.label} reading from ${formatShort(entry.date)}`}
                      hitSlop={8}
                      onPress={() => onRemove(entry.id)}
                    >
                      <Text style={{ color: color.textTertiary, fontFamily: fonts.regular, fontSize: 15 }}>✕</Text>
                    </Pressable>
                  </Row>
                }
              />
            ))}
          </List>
          {entries.length > 3 ? (
            <Caption color={color.textTertiary} style={{ marginTop: spacing.sm }}>
              +{entries.length - 3} earlier
            </Caption>
          ) : null}
        </View>
      ) : null}

      <Spacer size={spacing.lg} />
      {adding ? (
        <AddForm
          descriptor={descriptor}
          onCancel={() => setAdding(false)}
          onSave={(value, date) => {
            onAdd({ metricId: descriptor.metricId, date, value });
            setAdding(false);
          }}
        />
      ) : (
        <Button label="Add measurement" variant="secondary" onPress={() => setAdding(true)} />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cycle phase — where the current week sits, per compound in the active stack
// ---------------------------------------------------------------------------

const PHASE_KIND_LABEL: Record<PhaseKind, string> = {
  titration: 'Loading',
  on: 'Maintenance',
  washout: 'Off cycle',
};

interface CyclePhaseSummary {
  peptideId: string;
  peptideName: string;
  segments: PhaseBarSegment[];
  /** 0–1 fraction of the whole plan elapsed, for `PhaseBar`'s marker. */
  position: number;
  currentWeek: number;
  totalWeeks: number;
  currentLabel: string;
}

/**
 * Reshapes one compound's `CyclePhase` blocks (from `buildCyclePhases`) into
 * what the `PhaseBar` tile needs. Nothing here recomputes a schedule — it
 * only derives a week count and a "now" fraction from dates the engine
 * already produced, reusing `cyclePlanProgressPct` for the fraction so the
 * bar's marker and the segment widths agree on the same total span.
 */
function summariseCyclePhases(peptideId: string, peptideName: string, phases: CyclePhase[], date: string): CyclePhaseSummary | null {
  if (phases.length === 0) return null;
  const start = phases[0]!.startDate;
  const end = phases[phases.length - 1]!.endDate;
  const totalDays = diffDays(start, end) + 1;
  if (totalDays <= 0) return null;

  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const clampedDate = date < start ? start : date > end ? end : date;
  const currentWeek = Math.min(totalWeeks, Math.max(1, Math.ceil((diffDays(start, clampedDate) + 1) / 7)));
  const pct = cyclePlanProgressPct(phases, date);
  const current = phases.find((p) => date >= p.startDate && date <= p.endDate) ?? (date < start ? phases[0]! : phases[phases.length - 1]!);

  const segments: PhaseBarSegment[] = phases.map((phase, index) => ({
    key: `${phase.kind}-${index}`,
    label: PHASE_KIND_LABEL[phase.kind],
    length: Math.max(1, diffDays(phase.startDate, phase.endDate) + 1),
    detail: formatRange(phase.startDate, phase.endDate),
  }));

  return {
    peptideId,
    peptideName,
    segments,
    position: pct === null ? 0 : pct / 100,
    currentWeek,
    totalWeeks,
    currentLabel: PHASE_KIND_LABEL[current.kind],
  };
}

function CyclePhaseSection({ stack }: { stack: Stack | null }) {
  const theme = useTheme();
  const { color } = theme;
  const date = today();

  const items = useMemo(() => {
    if (!stack) return [];
    const byPeptide = groupPhasesByPeptide(buildCyclePhases(stack));
    const summaries: CyclePhaseSummary[] = [];
    for (const item of stack.items) {
      const phases = byPeptide.get(item.peptideId);
      if (!phases || phases.length === 0) continue;
      const summary = summariseCyclePhases(item.peptideId, getPeptide(item.peptideId)?.name ?? item.peptideId, phases, date);
      if (summary) summaries.push(summary);
    }
    return summaries;
  }, [stack, date]);

  if (items.length === 0) {
    return (
      <Tile elevation="mid" icon={<Repeat size={14} color={color.textSecondary} />} caption="Cycle phase">
        <Small>No active stack cycle to show yet.</Small>
      </Tile>
    );
  }

  const primary = items[0]!;
  const others = items.slice(1);

  return (
    <Tile elevation="mid" icon={<Repeat size={14} color={color.textSecondary} />} caption="Cycle phase">
      <CyclePhaseRow summary={primary} showName={items.length > 1} />
      {others.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <Disclosure label="Other compounds' cycles" summary={`${others.length} more`}>
            {others.map((summary, index) => (
              <View key={summary.peptideId} style={{ marginTop: index === 0 ? 0 : spacing.lg }}>
                <CyclePhaseRow summary={summary} showName />
              </View>
            ))}
          </Disclosure>
        </View>
      ) : null}
    </Tile>
  );
}

function CyclePhaseRow({ summary, showName }: { summary: CyclePhaseSummary; showName: boolean }) {
  const theme = useTheme();
  const { color, mode } = theme;
  const pctLabel = `${Math.round(summary.position * 100)}%`;
  const heading = `${showName ? `${summary.peptideName} · ` : ''}Week ${summary.currentWeek} of ${summary.totalWeeks} · ${summary.currentLabel}`;

  return (
    <View>
      <Row justify="space-between" align="center" gap={spacing.sm}>
        <Heading style={{ flex: 1 }}>{heading}</Heading>
        <View style={[styles.pillBadge, { backgroundColor: withOpacity(color.primary, mode === 'dark' ? 0.24 : 0.14) }]}>
          <Data small color={color.textPrimary}>
            {pctLabel}
          </Data>
        </View>
      </Row>
      <View style={{ marginTop: spacing.md }}>
        <PhaseBar segments={summary.segments} position={summary.position} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Side-effect trend — the most recently logged symptom, gauge + direction
// ---------------------------------------------------------------------------

interface SideEffectTrend {
  label: string;
  latestSeverity: number;
  /** latest − previous reading, for this label only. Null with fewer than two. */
  change: number | null;
  countThisWeek: number;
}

/** Reads only the featured label's own history — a symptom's trend is only meaningful against itself. */
function summariseSideEffectTrend(logs: SideEffectLog[], date: string): SideEffectTrend | null {
  if (logs.length === 0) return null;
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const label = sorted[0]!.label;
  const forLabel = sorted.filter((entry) => entry.label === label);
  const latestSeverity = forLabel[0]!.severity;
  const change = forLabel.length >= 2 ? latestSeverity - forLabel[1]!.severity : null;
  const weekStart = startOfWeek(date);
  const countThisWeek = forLabel.filter((entry) => entry.date >= weekStart && entry.date <= date).length;
  return { label, latestSeverity, change, countThisWeek };
}

function SeverityDots({ value, max }: { value: number; max: number }) {
  const theme = useTheme();
  const { color } = theme;
  const filled = Math.max(0, Math.min(max, value));
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', gap: spacing.xs }}
    >
      {Array.from({ length: max }, (_, i) => (
        <View
          key={i}
          style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: i < filled ? color.chartInk : color.chartTrack }}
        />
      ))}
    </View>
  );
}

function SideEffectTrendTile({ logs }: { logs: SideEffectLog[] }) {
  const theme = useTheme();
  const { color } = theme;
  const date = today();
  const trend = useMemo(() => summariseSideEffectTrend(logs, date), [logs, date]);

  return (
    <Tile elevation="mid" icon={<Activity size={14} color={color.textSecondary} />} caption="Side effects · this week">
      {!trend ? (
        <Small>No side effects logged yet.</Small>
      ) : (
        <View>
          <Row justify="space-between" align="center">
            <Heading>{trend.label}</Heading>
            {/* Lower severity is unambiguously better, unlike a goal metric —
             *  no target needed to know which direction to tint. */}
            {trend.change !== null ? <DeltaBadge value={trend.change} goodDirection="down" decimals={0} /> : null}
          </Row>
          <View style={{ marginTop: spacing.md }}>
            <SeverityDots value={trend.latestSeverity} max={SEVERITY_MAX} />
          </View>
          <Caption color={color.textTertiary} style={{ marginTop: spacing.sm }}>
            {`Severity ${trend.latestSeverity}/${SEVERITY_MAX} · ${trend.countThisWeek} logged this week`}
          </Caption>
        </View>
      )}
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// Injection-site rotation — a compact grid, not a sentence
// ---------------------------------------------------------------------------

const SITE_SHORT_LABEL: Record<InjectionSite, string> = {
  abdomen_left: 'Abdomen L',
  abdomen_right: 'Abdomen R',
  thigh_left: 'Thigh L',
  thigh_right: 'Thigh R',
  upper_arm_left: 'Arm L',
  upper_arm_right: 'Arm R',
  glute_left: 'Glute L',
  glute_right: 'Glute R',
};

interface SiteRotationSummary {
  counts: Array<{ site: InjectionSite; count: number }>;
  /** How many of the requested window were actually available. */
  windowSize: number;
  note: string;
}

function summariseSiteRotation(logs: InjectionLog[], windowSize: number): SiteRotationSummary | null {
  if (logs.length === 0) return null;
  const recent = [...logs].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, windowSize);

  const tally = new Map<InjectionSite, number>();
  for (const log of recent) tally.set(log.site, (tally.get(log.site) ?? 0) + 1);
  const counts = [...tally.entries()].map(([site, count]) => ({ site, count })).sort((a, b) => b.count - a.count);

  const values = counts.map((c) => c.count);
  const spread = Math.max(...values) - Math.min(...values);
  const note =
    counts.length <= 1
      ? 'Only one site used — rotating reduces irritation.'
      : spread <= 1
        ? 'Evenly rotated.'
        : `${SITE_SHORT_LABEL[counts[0]!.site]} used most — rotate to the others too.`;

  return { counts, windowSize: recent.length, note };
}

function SiteRotationTile({ logs }: { logs: InjectionLog[] }) {
  const theme = useTheme();
  const { color, mode } = theme;
  const rotation = useMemo(() => summariseSiteRotation(logs, 8), [logs]);

  return (
    <Tile
      elevation="mid"
      icon={<MapPin size={14} color={color.textSecondary} />}
      caption={rotation ? `Site rotation · last ${rotation.windowSize}` : 'Site rotation'}
    >
      {!rotation ? (
        <Small>No injections logged yet.</Small>
      ) : (
        <View>
          <Row gap={spacing.sm} wrap>
            {rotation.counts.map(({ site, count }) => (
              <View
                key={site}
                accessible
                accessibilityLabel={`${INJECTION_SITE_LABELS[site]}: ${count} time${count === 1 ? '' : 's'} in the last ${rotation.windowSize}`}
                style={[styles.siteCell, { borderColor: color.border, backgroundColor: color.surface }]}
              >
                <View style={[styles.siteCount, { backgroundColor: withOpacity(color.primary, mode === 'dark' ? 0.3 : 0.16) }]}>
                  <Data small color={color.textPrimary}>{`×${count}`}</Data>
                </View>
                <Caption color={color.textTertiary} style={{ marginTop: spacing.xs }}>
                  {SITE_SHORT_LABEL[site]}
                </Caption>
              </View>
            ))}
          </Row>
          <Caption color={color.textTertiary} style={{ marginTop: spacing.md }}>
            {rotation.note}
          </Caption>
        </View>
      )}
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// Overview — moved from Summary (THEA-38b): the adherence/compound counters
// belong with the rest of "how am I doing", not the "what's next" screen.
// ---------------------------------------------------------------------------

function OverviewSection({
  stack,
  doseLogs,
  injectionLogs,
  onOpenAnalytics,
}: {
  stack: Stack | null;
  doseLogs: Record<string, DoseLog>;
  injectionLogs: InjectionLog[];
  onOpenAnalytics: () => void;
}) {
  const adherencePct = useMemo(() => {
    if (!stack) return null;
    const doses = generateSchedule(stack, addDays(today(), -13), today());
    const { pct, taken, skipped } = selectAdherence(doses, doseLogs);
    return taken + skipped === 0 ? null : pct;
  }, [stack, doseLogs]);

  return (
    <View>
      <Caption>Overview</Caption>
      <Spacer size={spacing.sm} />
      <Row gap={spacing.md}>
        <Tile elevation="low" caption="Adherence · 14d" value={adherencePct === null ? '—' : `${adherencePct}%`} style={{ flex: 1 }} />
        <Tile elevation="low" caption="Active compounds" value={`${stack?.items.length ?? 0}`} style={{ flex: 1 }} />
        <Tile elevation="low" caption="Logged injections" value={`${injectionLogs.length}`} style={{ flex: 1 }} />
      </Row>
      <Spacer size={spacing.md} />
      <Button label="Open full analytics" variant="ghost" onPress={onOpenAnalytics} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Add-measurement form
// ---------------------------------------------------------------------------

function AddForm({
  descriptor,
  onSave,
  onCancel,
}: {
  descriptor: Descriptor;
  onSave: (value: number, date: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [date, setDate] = useState(today());

  const numericValue = Number(text);
  const valid =
    descriptor.kind === 'scale'
      ? rating !== null
      : text.trim() !== '' && Number.isFinite(numericValue) && numericValue > 0;

  const save = () => {
    if (!valid) return;
    onSave(descriptor.kind === 'scale' ? rating! : numericValue, date);
  };

  return (
    <View>
      <DateField date={date} onChange={setDate} />
      <Spacer size={spacing.md} />
      {descriptor.kind === 'scale' ? (
        <ScaleField value={rating} onChange={setRating} />
      ) : (
        <TextField
          value={text}
          onChangeText={setText}
          keyboardType="decimal-pad"
          placeholder={`Value${descriptor.unit ? ` (${descriptor.unit})` : ''}`}
          returnKeyType="done"
          onSubmitEditing={save}
          suffix={descriptor.unit ? <Small style={{ marginLeft: spacing.sm }}>{descriptor.unit}</Small> : undefined}
        />
      )}
      <Spacer size={spacing.md} />
      <Row gap={spacing.sm}>
        <Button label="Save" onPress={save} disabled={!valid} style={{ flex: 1 }} />
        <Button label="Cancel" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
      </Row>
    </View>
  );
}

/** Day stepper, capped at today — you cannot log a reading in the future. */
function DateField({ date, onChange }: { date: string; onChange: (next: string) => void }) {
  const theme = useTheme();
  const { color } = theme;
  const atToday = date >= today();
  return (
    <Row justify="space-between">
      <Caption color={color.textSecondary}>Date</Caption>
      <Row gap={spacing.md}>
        <StepButton label="‹" accessibilityLabel="Previous day" onPress={() => onChange(addDays(date, -1))} />
        <View style={{ minWidth: 96, alignItems: 'center' }}>
          <Data small>{relativeLabel(date)}</Data>
        </View>
        <StepButton
          label="›"
          accessibilityLabel="Next day"
          disabled={atToday}
          onPress={() => onChange(addDays(date, 1))}
        />
      </Row>
    </Row>
  );
}

function StepButton({
  label,
  accessibilityLabel,
  onPress,
  disabled = false,
}: {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const { color } = theme;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      style={[
        styles.stepButton,
        { borderColor: color.borderStrong, backgroundColor: color.surfaceMuted },
        { opacity: disabled ? 0.35 : 1 },
      ]}
    >
      <Text style={[typography.title, { color: color.textPrimary }]}>{label}</Text>
    </Pressable>
  );
}

function ScaleField({ value, onChange }: { value: number | null; onChange: (next: number) => void }) {
  const theme = useTheme();
  const { color } = theme;
  const levels = Array.from({ length: SCALE_MAX - SCALE_MIN + 1 }, (_, i) => SCALE_MIN + i);
  return (
    <Row gap={spacing.sm}>
      {levels.map((level) => {
        const selected = value === level;
        return (
          <Pressable
            key={level}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`Rate ${level} of ${SCALE_MAX}`}
            onPress={() => onChange(level)}
            style={[
              styles.scaleCell,
              {
                borderColor: selected ? color.primary : color.border,
                backgroundColor: selected ? color.primarySoft : color.surface,
              },
            ]}
          >
            <Data color={selected ? color.primary : color.textSecondary}>{level}</Data>
          </Pressable>
        );
      })}
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Custom measure
// ---------------------------------------------------------------------------

function CustomMeasureSection({ onAdd }: { onAdd: (entry: Omit<Measurement, 'id'>) => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [unit, setUnit] = useState('');
  const [text, setText] = useState('');
  const [date, setDate] = useState(today());

  const numericValue = Number(text);
  const valid = label.trim() !== '' && text.trim() !== '' && Number.isFinite(numericValue) && numericValue > 0;

  const reset = () => {
    setOpen(false);
    setLabel('');
    setUnit('');
    setText('');
    setDate(today());
  };

  const save = () => {
    if (!valid) return;
    onAdd({
      metricId: CUSTOM_METRIC_ID,
      customLabel: label.trim(),
      customUnit: unit.trim(),
      date,
      value: numericValue,
    });
    reset();
  };

  return (
    <Section title="Track something else" last gap={spacing.md}>
      <Small>Any other measure you want to follow — energy, mood, a lift, a lab value.</Small>
      {open ? (
        <View>
          <TextField value={label} onChangeText={setLabel} placeholder="Name (e.g. Resting heart rate)" />
          <Spacer size={spacing.sm} />
          <TextField value={unit} onChangeText={setUnit} placeholder="Unit (optional, e.g. bpm)" autoCapitalize="none" />
          <Spacer size={spacing.sm} />
          <TextField
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            placeholder="Value"
            onSubmitEditing={save}
          />
          <Spacer size={spacing.md} />
          <DateField date={date} onChange={setDate} />
          <Spacer size={spacing.md} />
          <Row gap={spacing.sm}>
            <Button label="Save" onPress={save} disabled={!valid} style={{ flex: 1 }} />
            <Button label="Cancel" variant="ghost" onPress={reset} style={{ flex: 1 }} />
          </Row>
        </View>
      ) : (
        <Button label="Add a custom measure" variant="secondary" onPress={() => setOpen(true)} />
      )}
    </Section>
  );
}

const styles = StyleSheet.create({
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleCell: {
    flex: 1,
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  siteCell: {
    minWidth: 76,
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  siteCount: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

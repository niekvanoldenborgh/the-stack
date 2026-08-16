import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  CUSTOM_METRIC_ID,
  METRIC_BY_ID,
  SCALE_MAX,
  SCALE_MIN,
  metricsForGoals,
  type MetricInputKind,
} from '../../src/domain/metrics';
import type { DoseLog, Measurement, Stack } from '../../src/domain/types';
import { generateSchedule } from '../../src/engine/cycle';
import { seriesKey, summariseMeasurements, type MetricSummary } from '../../src/engine/progress';
import { addDays, formatShort, relativeLabel, today } from '../../src/lib/date';
import { selectAdherence, useActiveStack, useAppStore } from '../../src/store/useAppStore';
import { Sparkbars } from '../../src/ui/charts';
import {
  Button,
  Callout,
  Caption,
  Data,
  Display,
  EmptyState,
  Row,
  Screen,
  Small,
  Spacer,
  StatTile,
} from '../../src/ui/components';
import { Disclosure, FocalMetric, List, ListItem, Section } from '../../src/ui/primitives';
import { colors, fonts, radius, spacing, typography } from '../../src/ui/theme';

/**
 * Results — the goal tracker, redesigned THEA-38b.
 *
 * This is now the app's one coherent "how am I doing" surface: the overview
 * stats that used to sit on Summary (adherence, active compounds, logged
 * injections) live here instead, next to the measurements you log against
 * your goals. Calendar keeps the day-to-day schedule; Analytics keeps the
 * training-specific deep dive; this screen is where progress across all of it
 * gets summarised.
 *
 * One measure — the first goal's — gets the `FocalMetric` treatment at the
 * top of the screen. Everything else, including that measure's own chart and
 * entry history, sits behind `Disclosure` rather than as an always-open card:
 * the old layout put N identical bordered cards on screen at once regardless
 * of how many goals were picked, which read as a wall of near-duplicate
 * blocks rather than one screen with a point of view.
 *
 * It never sets a target or judges a value: the app is not a clinician, so it
 * reports the numbers and leaves the meaning to the user.
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

/** Splits a value into the pieces `FocalMetric` wants — a figure and a trailing unit. */
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

export default function ResultsScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const measurements = useAppStore((s) => s.measurements);
  const addMeasurement = useAppStore((s) => s.addMeasurement);
  const removeMeasurement = useAppStore((s) => s.removeMeasurement);
  const stack = useActiveStack();
  const doseLogs = useAppStore((s) => s.doseLogs);
  const injectionLogs = useAppStore((s) => s.injectionLogs);

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
        <EmptyState title="No profile yet" body="Complete onboarding to pick goals, then track your progress here." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Spacer size={spacing.md} />
      <Caption color={colors.accent}>Progress</Caption>
      <Display style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Results</Display>

      <Callout tone="info" title="Your own measurements">
        The app charts what you enter and shows the change between readings. It does not set targets or say what a
        value should be — that is between you and a clinician.
      </Callout>
      <Spacer size={spacing.lg} />

      {primary ? (
        <PrimaryMetricSection
          descriptor={primary}
          summary={summaryByKey.get(primary.key)}
          entries={entriesByKey.get(primary.key) ?? []}
          onAdd={addMeasurement}
          onRemove={removeMeasurement}
        />
      ) : (
        <Section tone={2}>
          <Caption color={colors.accent}>Progress</Caption>
          <Small style={{ marginTop: spacing.sm }}>
            Pick a goal in onboarding to see a tracked measure here, or add a custom one below.
          </Small>
        </Section>
      )}

      <OverviewSection
        stack={stack}
        doseLogs={doseLogs}
        injectionLogs={injectionLogs}
        onOpenAnalytics={() => router.push('/analytics')}
      />

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

      <Small style={{ marginTop: spacing.sm }}>
        Everything here is what you logged. A gap in your readings shows up as a gap in the chart — nothing is filled
        in for you.
      </Small>
      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Primary metric — the one focal figure on this screen
// ---------------------------------------------------------------------------

function PrimaryMetricSection({
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
  const latest = summary?.latest ?? null;
  const figure = latest != null ? focalValue(latest, descriptor) : { value: '—' };
  const changeText = summary && summary.change !== null && summary.first !== null ? changeLineText(descriptor, summary) : undefined;
  const historySummary = entries.length > 0 ? `${entries.length} reading${entries.length === 1 ? '' : 's'} logged` : 'No readings yet';

  return (
    <Section tone={2} gap={spacing.lg}>
      <FocalMetric eyebrow={descriptor.label} value={figure.value} unit={figure.unit} meta={changeText ?? descriptor.hint} />
      <Disclosure label="History & log a reading" summary={historySummary}>
        <MetricDetail descriptor={descriptor} summary={summary} entries={entries} onAdd={onAdd} onRemove={onRemove} />
      </Disclosure>
    </Section>
  );
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

/** Shared chart + recent entries + add-a-reading form, used by both the primary and secondary metrics. */
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
  const [adding, setAdding] = useState(false);
  const hasData = Boolean(summary && summary.count >= 1);

  return (
    <View>
      {hasData && summary ? (
        <>
          <Sparkbars
            values={summary.points.map((p) => p.value)}
            accessibilityLabel={`${descriptor.label} over ${summary.count} reading${summary.count === 1 ? '' : 's'}: ${summary.points
              .map((p) => valueLabel(p.value, descriptor))
              .join(', ')}`}
          />
          <Row justify="space-between" style={{ marginTop: spacing.sm }}>
            <Caption color={colors.textFaint}>{formatShort(summary.points[0]!.date)}</Caption>
            <Caption color={colors.textFaint}>{formatShort(summary.points[summary.points.length - 1]!.date)}</Caption>
          </Row>
        </>
      ) : (
        <Small>No readings yet — add your first below.</Small>
      )}

      {entries.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          <List>
            {entries.slice(0, 3).map((entry) => (
              <ListItem
                key={entry.id}
                title={relativeLabel(entry.date)}
                meta={
                  <Row gap={spacing.md}>
                    <Data small color={colors.textMuted}>
                      {valueLabel(entry.value, descriptor)}
                    </Data>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${descriptor.label} reading from ${formatShort(entry.date)}`}
                      hitSlop={8}
                      onPress={() => onRemove(entry.id)}
                    >
                      <Text style={{ color: colors.textFaint, fontFamily: fonts.sans, fontSize: 15 }}>✕</Text>
                    </Pressable>
                  </Row>
                }
              />
            ))}
          </List>
          {entries.length > 3 ? (
            <Caption color={colors.textFaint} style={{ marginTop: spacing.sm }}>
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
  injectionLogs: unknown[];
  onOpenAnalytics: () => void;
}) {
  const adherencePct = useMemo(() => {
    if (!stack) return null;
    const doses = generateSchedule(stack, addDays(today(), -13), today());
    const { pct, taken, skipped } = selectAdherence(doses, doseLogs);
    return taken + skipped === 0 ? null : pct;
  }, [stack, doseLogs]);

  return (
    <Section title="Overview">
      <Row gap={spacing.md}>
        <StatTile label="Adherence · 14d" value={adherencePct === null ? '—' : `${adherencePct}%`} />
        <StatTile label="Active compounds" value={`${stack?.items.length ?? 0}`} />
        <StatTile label="Logged injections" value={`${injectionLogs.length}`} />
      </Row>
      <Button label="Open full analytics" variant="ghost" onPress={onOpenAnalytics} />
    </Section>
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
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            placeholder={`Value${descriptor.unit ? ` (${descriptor.unit})` : ''}`}
            placeholderTextColor={colors.textFaint}
            returnKeyType="done"
            onSubmitEditing={save}
          />
          {descriptor.unit ? <Small style={{ marginLeft: spacing.sm }}>{descriptor.unit}</Small> : null}
        </View>
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
  const atToday = date >= today();
  return (
    <Row justify="space-between">
      <Caption color={colors.textMuted}>Date</Caption>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPress={disabled ? undefined : onPress}
      style={[styles.stepButton, { opacity: disabled ? 0.35 : 1 }]}
    >
      <Text style={[typography.title, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function ScaleField({ value, onChange }: { value: number | null; onChange: (next: number) => void }) {
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
                borderColor: selected ? colors.accent : colors.border,
                backgroundColor: selected ? colors.accentDim : colors.surface,
              },
            ]}
          >
            <Data color={selected ? colors.accent : colors.textMuted}>{level}</Data>
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
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Name (e.g. Resting heart rate)"
              placeholderTextColor={colors.textFaint}
            />
          </View>
          <Spacer size={spacing.sm} />
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={unit}
              onChangeText={setUnit}
              placeholder="Unit (optional, e.g. bpm)"
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
            />
          </View>
          <Spacer size={spacing.sm} />
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              placeholder="Value"
              placeholderTextColor={colors.textFaint}
              onSubmitEditing={save}
            />
          </View>
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
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderBright,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderBright,
    backgroundColor: colors.surfaceHigh,
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
});

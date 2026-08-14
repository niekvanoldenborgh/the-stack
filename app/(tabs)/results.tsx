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
import type { Measurement } from '../../src/domain/types';
import { seriesKey, summariseMeasurements, type MetricSummary } from '../../src/engine/progress';
import { addDays, formatShort, relativeLabel, today } from '../../src/lib/date';
import { useAppStore } from '../../src/store/useAppStore';
import { Sparkbars } from '../../src/ui/charts';
import {
  Body,
  Button,
  Callout,
  Caption,
  Card,
  Data,
  Display,
  Divider,
  EmptyState,
  Heading,
  Row,
  Screen,
  Small,
  Spacer,
} from '../../src/ui/components';
import { colors, fonts, radius, spacing, typography } from '../../src/ui/theme';

/**
 * Results — the goal tracker.
 *
 * Surfaces a measure for each of the user's goals (bodyweight for fat loss, a
 * 1–5 rating for skin, top sets for strength …), charts what they log over
 * time and shows the change between the first and latest reading. It never
 * sets a target or judges a value: the app is not a clinician, so it reports
 * the numbers and leaves the meaning to the user.
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

export default function ResultsScreen() {
  const profile = useAppStore((s) => s.profile);
  const measurements = useAppStore((s) => s.measurements);
  const addMeasurement = useAppStore((s) => s.addMeasurement);
  const removeMeasurement = useAppStore((s) => s.removeMeasurement);

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
    // the current goals, or a custom measure — still gets a card.
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
      <Display style={{ marginTop: spacing.sm }}>Results</Display>

      <Spacer size={spacing.lg} />
      <Callout tone="info" title="Your own measurements">
        The app charts what you enter and shows the change between readings. It does not set targets or say what a value
        should be — that is between you and a clinician.
      </Callout>

      {descriptors.map((descriptor) => (
        <MetricCard
          key={descriptor.key}
          descriptor={descriptor}
          summary={summaryByKey.get(descriptor.key)}
          entries={entriesByKey.get(descriptor.key) ?? []}
          onAdd={addMeasurement}
          onRemove={removeMeasurement}
        />
      ))}

      <CustomCard onAdd={addMeasurement} />

      <Spacer size={spacing.lg} />
      <Body muted>
        Everything here is what you logged. A gap in your readings shows up as a gap in the chart — nothing is filled in
        for you.
      </Body>
      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Metric card
// ---------------------------------------------------------------------------

function MetricCard({
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
  const [open, setOpen] = useState(false);
  const hasData = Boolean(summary && summary.count >= 1);

  return (
    <Card>
      <Row justify="space-between" align="flex-start">
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Heading>{descriptor.label}</Heading>
          {descriptor.hint ? <Small style={{ marginTop: 2 }}>{descriptor.hint}</Small> : null}
        </View>
        {summary?.latest != null ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Data>{valueLabel(summary.latest, descriptor)}</Data>
            <Caption color={colors.textFaint}>Latest</Caption>
          </View>
        ) : null}
      </Row>

      {summary && summary.change !== null && summary.first !== null ? (
        <ChangeLine descriptor={descriptor} summary={summary} />
      ) : null}

      {hasData && summary ? (
        <>
          <Spacer size={spacing.md} />
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
        <Small style={{ marginTop: spacing.md }}>No readings yet — add your first below.</Small>
      )}

      {entries.length > 0 ? (
        <>
          <Divider />
          {entries.slice(0, 3).map((entry) => (
            <Row key={entry.id} justify="space-between" style={{ marginBottom: spacing.xs }}>
              <Small muted={false}>{relativeLabel(entry.date)}</Small>
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
            </Row>
          ))}
          {entries.length > 3 ? (
            <Caption color={colors.textFaint}>+{entries.length - 3} earlier</Caption>
          ) : null}
        </>
      ) : null}

      <Divider />
      {open ? (
        <AddForm
          descriptor={descriptor}
          onCancel={() => setOpen(false)}
          onSave={(value, date) => {
            onAdd({ metricId: descriptor.metricId, date, value });
            setOpen(false);
          }}
        />
      ) : (
        <Button label="Add measurement" variant="secondary" onPress={() => setOpen(true)} />
      )}
    </Card>
  );
}

function ChangeLine({ descriptor, summary }: { descriptor: Descriptor; summary: MetricSummary }) {
  const change = summary.change ?? 0;
  const arrow = change > 0 ? '↑' : change < 0 ? '↓' : '→';
  const magnitude = valueLabel(Math.abs(change), descriptor);
  const since = formatShort(summary.points[0]!.date);
  // Percentage is only meaningful for a measured quantity, not a 1–5 rating.
  const pct =
    descriptor.kind === 'number' && summary.changePct !== null
      ? ` (${summary.changePct > 0 ? '+' : ''}${summary.changePct}%)`
      : '';
  return (
    <Small style={{ marginTop: spacing.sm }} muted>
      {change === 0 ? `No change since ${since}` : `${arrow} ${magnitude}${pct} since ${since}`}
    </Small>
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

function CustomCard({ onAdd }: { onAdd: (entry: Omit<Measurement, 'id'>) => void }) {
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

  if (!open) {
    return (
      <Card>
        <Heading>Track something else</Heading>
        <Small style={{ marginTop: 2 }}>Any other measure you want to follow — energy, mood, a lift, a lab value.</Small>
        <Spacer size={spacing.md} />
        <Button label="Add a custom measure" variant="secondary" onPress={() => setOpen(true)} />
      </Card>
    );
  }

  return (
    <Card>
      <Heading>New custom measure</Heading>
      <Spacer size={spacing.md} />
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
    </Card>
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

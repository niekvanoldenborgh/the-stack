import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { getPeptide } from '../../src/domain/peptides';
import type { DoseLog, Peptide, PhaseKind, Stack } from '../../src/domain/types';
import { generateSchedule, summariseCycle } from '../../src/engine/cycle';
import { formatDose } from '../../src/engine/dosing';
import { buildLevelSeries, peptideHasLevelModel, type LevelSeriesResult } from '../../src/engine/pk';
import { addDays, formatShort, relativeLabel, timeToMinutes, today } from '../../src/lib/date';
import { DEFAULT_SUMMARY_ORDER, selectAdherence, useActiveStack, useAppStore, useUpcomingDoses } from '../../src/store/useAppStore';
import { LevelCurve } from '../../src/ui/charts';
import {
  Badge,
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
  ListRow,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
  StatTile,
} from '../../src/ui/components';
import { colors, radius, spacing, type SeverityTone } from '../../src/ui/theme';

/**
 * Summary (page 1) — THEA-8.
 *
 * Four things share this screen: a quick overview, the next scheduled
 * injection with its configured alarm, the "estimated medication levels"
 * curves (THEA-6, docs/pk-estimated-levels-spec.md), and a compact current
 * stack summary. Which shows first vs. lower on scroll is user-adjustable
 * (`settings.summaryOrder`) via the "Reorder" toggle.
 *
 * The levels section is the only part of this screen with hard rules — see
 * the PK spec's no-dosage boundary (§3). It reads exactly what §1–§2 hand it
 * back from `src/engine/pk.ts` and never computes a dose of its own.
 */

// ---------------------------------------------------------------------------
// Section registry
// ---------------------------------------------------------------------------

const SECTION_META: Record<string, { title: string }> = {
  overview: { title: 'Overview' },
  next_injection: { title: 'Next injection' },
  levels: { title: 'Estimated medication levels' },
  stack: { title: 'Current stack' },
};

function orderedSectionIds(persisted: string[]): string[] {
  const known = Object.keys(SECTION_META);
  const kept = persisted.filter((id) => known.includes(id));
  const missing = known.filter((id) => !kept.includes(id));
  return [...kept, ...missing];
}

function moveSection(order: string[], id: string, direction: -1 | 1): string[] {
  const index = order.indexOf(id);
  const swapWith = index + direction;
  if (index < 0 || swapWith < 0 || swapWith >= order.length) return order;
  const next = [...order];
  [next[index], next[swapWith]] = [next[swapWith]!, next[index]!];
  return next;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SummaryScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const stack = useActiveStack();
  const doseLogs = useAppStore((s) => s.doseLogs);
  const injectionLogs = useAppStore((s) => s.injectionLogs);
  const settings = useAppStore((s) => s.settings);
  const setSetting = useAppStore((s) => s.setSetting);
  const upcomingDoses = useUpcomingDoses(14);

  const [reordering, setReordering] = useState(false);

  const order = useMemo(() => orderedSectionIds(settings.summaryOrder ?? DEFAULT_SUMMARY_ORDER), [settings.summaryOrder]);

  if (!profile) {
    return (
      <Screen>
        <Spacer size={spacing.xl} />
        <Display>Summary</Display>
        <Spacer size={spacing.lg} />
        <EmptyState title="No profile yet" body="Complete onboarding to see your overview, schedule and stack here." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Spacer size={spacing.md} />
      <Row justify="space-between" align="flex-start">
        <View>
          <Caption color={colors.accent}>Today</Caption>
          <Display style={{ marginTop: spacing.sm }}>Summary</Display>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={reordering ? 'Finish reordering sections' : 'Reorder sections'}
          onPress={() => setReordering((v) => !v)}
          style={({ pressed }) => ({
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.pill,
            borderWidth: 1,
            borderColor: reordering ? colors.accent : colors.border,
            backgroundColor: reordering ? colors.accentDim : colors.surface,
            opacity: pressed ? 0.75 : 1,
            marginTop: spacing.sm,
          })}
        >
          <Small muted={false} style={{ color: reordering ? colors.accent : colors.textMuted }}>
            {reordering ? 'Done' : 'Reorder'}
          </Small>
        </Pressable>
      </Row>

      {order.map((id, index) => (
        <View key={id}>
          <SectionTitle
            action={
              reordering ? (
                <Row gap={spacing.xs}>
                  <ReorderArrow
                    direction="up"
                    disabled={index === 0}
                    onPress={() => setSetting('summaryOrder', moveSection(order, id, -1))}
                  />
                  <ReorderArrow
                    direction="down"
                    disabled={index === order.length - 1}
                    onPress={() => setSetting('summaryOrder', moveSection(order, id, 1))}
                  />
                </Row>
              ) : undefined
            }
          >
            {SECTION_META[id]!.title}
          </SectionTitle>

          {id === 'overview' ? (
            <OverviewSection stack={stack} doseLogs={doseLogs} injectionLogs={injectionLogs} onOpenAnalytics={() => router.push('/analytics')} />
          ) : id === 'next_injection' ? (
            <NextInjectionSection
              upcomingDoses={upcomingDoses}
              doseLogs={doseLogs}
              alarmOffsetsMin={settings.alarmOffsetsMin}
              remindersEnabled={settings.remindersEnabled}
              onOpenAlarmSettings={() => router.push('/settings/alarm')}
            />
          ) : id === 'levels' ? (
            <LevelsSection
              stack={stack}
              injectionLogs={injectionLogs}
              weightKg={profile.weightKg}
              acknowledgedAt={settings.pkModalAcknowledgedAt}
              onAcknowledge={() => setSetting('pkModalAcknowledgedAt', new Date().toISOString())}
            />
          ) : (
            <StackSection stack={stack} onBuildStack={() => router.push('/builder')} onOpenPeptide={(id2) => router.push(`/peptide/${id2}`)} />
          )}
        </View>
      ))}

      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

function ReorderArrow({
  direction,
  disabled,
  onPress,
}: {
  direction: 'up' | 'down';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={direction === 'up' ? 'Move section up' : 'Move section down'}
      accessibilityState={{ disabled }}
      hitSlop={8}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        width: 28,
        height: 28,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.borderBright,
        backgroundColor: colors.surfaceHigh,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={direction === 'up' ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Overview
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
    <Card>
      <Row gap={spacing.md}>
        <StatTile label="Adherence · 14d" value={adherencePct === null ? '—' : `${adherencePct}%`} />
        <StatTile label="Active compounds" value={`${stack?.items.length ?? 0}`} />
        <StatTile label="Logged injections" value={`${injectionLogs.length}`} />
      </Row>
      <Spacer size={spacing.md} />
      <Button label="Open full analytics" variant="ghost" onPress={onOpenAnalytics} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Next injection
// ---------------------------------------------------------------------------

/** Mirrors app/settings/alarm.tsx's offset phrasing, so the two screens read the same. */
function offsetLabel(min: number): string {
  if (min === 0) return 'at injection time';
  if (min >= 60) return `${min / 60} hour${min === 60 ? '' : 's'} before`;
  return `${min} min before`;
}

/** Subtracts minutes from a "HH:mm" time, wrapping across midnight. */
function subtractMinutes(time: string, minutes: number): string {
  const total = ((timeToMinutes(time) - minutes) % 1440 + 1440) % 1440;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function NextInjectionSection({
  upcomingDoses,
  doseLogs,
  alarmOffsetsMin,
  remindersEnabled,
  onOpenAlarmSettings,
}: {
  upcomingDoses: ReturnType<typeof useUpcomingDoses>;
  doseLogs: Record<string, DoseLog>;
  alarmOffsetsMin: number[];
  remindersEnabled: boolean;
  onOpenAlarmSettings: () => void;
}) {
  const next = upcomingDoses.find((dose) => !doseLogs[dose.id]);

  if (!next) {
    return (
      <Card>
        <Small>Nothing scheduled in the next two weeks.</Small>
      </Card>
    );
  }

  const peptide = getPeptide(next.peptideId);
  const sortedOffsets = [...alarmOffsetsMin].sort((a, b) => b - a);

  return (
    <Card>
      <Caption color={colors.accent}>{relativeLabel(next.date)}</Caption>
      <Heading style={{ marginTop: spacing.xs }}>{peptide?.name ?? next.peptideId}</Heading>
      <Row gap={spacing.sm} style={{ marginTop: spacing.xs }} align="center">
        <Data color={colors.textMuted}>{formatDose(next.dose)}</Data>
        <Small>· {next.time}</Small>
      </Row>

      {remindersEnabled ? (
        <>
          <Divider />
          <Caption color={colors.textFaint}>Alerts, from settings</Caption>
          <Spacer size={spacing.sm} />
          {sortedOffsets.map((min) => (
            <Row key={min} justify="space-between" style={{ marginBottom: spacing.xs }}>
              <Small muted={false}>{offsetLabel(min)}</Small>
              <Data small color={colors.textMuted}>
                {subtractMinutes(next.time, min)}
              </Data>
            </Row>
          ))}
        </>
      ) : (
        <Callout tone="moderate" title="Reminders are off">
          <Body>Turn on dose reminders to be alerted for this injection.</Body>
          <Spacer size={spacing.sm} />
          <Button label="Open alarm settings" variant="secondary" onPress={onOpenAlarmSettings} />
        </Callout>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Estimated medication levels (THEA-6)
// ---------------------------------------------------------------------------

const PK_SHORT_DISCLAIMER = 'Estimate from population-average study data — not a measurement of your blood.';
const PK_CAPTION =
  "Modelled from the injections you logged, scaled to your body weight. Real levels vary between people, and vary a lot more if your vial's contents are not what the label says.";

function LevelsSection({
  stack,
  injectionLogs,
  weightKg,
  acknowledgedAt,
  onAcknowledge,
}: {
  stack: Stack | null;
  injectionLogs: Parameters<typeof buildLevelSeries>[1];
  weightKg: number | undefined;
  acknowledgedAt: string | undefined;
  onAcknowledge: () => void;
}) {
  const nowEpochHours = useMemo(() => Date.now() / 3_600_000, []);

  const rows = useMemo(() => {
    if (!stack) return [];
    const seen = new Set<string>();
    const out: { peptide: Peptide; eligible: boolean; series: LevelSeriesResult | null }[] = [];
    for (const item of stack.items) {
      if (seen.has(item.peptideId)) continue;
      seen.add(item.peptideId);
      const peptide = getPeptide(item.peptideId);
      if (!peptide) continue;
      const eligible = peptideHasLevelModel(peptide);
      out.push({
        peptide,
        eligible,
        series: eligible ? buildLevelSeries(peptide, injectionLogs, weightKg, nowEpochHours) : null,
      });
    }
    return out;
  }, [stack, injectionLogs, weightKg, nowEpochHours]);

  if (!stack) {
    return (
      <Card>
        <Small>No active stack — start one to see estimated levels here.</Small>
      </Card>
    );
  }

  const withModel = rows.filter((r) => r.eligible);
  const withoutModel = rows.filter((r) => !r.eligible);
  const needsAcknowledgement = withModel.length > 0 && !acknowledgedAt;

  return (
    <>
      {needsAcknowledgement ? (
        <Card tone="info">
          <Heading>Before you read this chart</Heading>
          <Small style={{ marginTop: spacing.sm }}>
            This is a model, not a measurement. It shows what a population average would look like on your logged
            injections and your body weight.
          </Small>
          <Small style={{ marginTop: spacing.sm }}>
            It cannot tell you whether your dose is right, and we will never use it to suggest one. If you are deciding
            anything about your dose, that is a conversation with a prescriber, with a blood test in hand.
          </Small>
          <Spacer size={spacing.md} />
          <Button label="I understand" onPress={onAcknowledge} />
        </Card>
      ) : (
        withModel.map((row) => <LevelChartCard key={row.peptide.id} peptide={row.peptide} series={row.series!} />)
      )}

      {withoutModel.map((row) => (
        <Callout key={row.peptide.id} tone="info" title={`No level estimate for ${row.peptide.name}`}>
          We only draw this chart where published human pharmacokinetic data exists to build it from — which currently
          means semaglutide and tirzepatide. For {row.peptide.name} we would have to invent the numbers, so we don't.
          Your injections are still logged and still shown on the calendar.
        </Callout>
      ))}
    </>
  );
}

function LevelChartCard({ peptide, series }: { peptide: Peptide; series: LevelSeriesResult }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const hasPoints = series.points.length > 0;

  const startLabel = hasPoints && series.anchorEpochHours !== null ? formatShort(epochHoursToISODate(series.anchorEpochHours)) : null;
  const endLabel =
    hasPoints && series.anchorEpochHours !== null
      ? formatShort(epochHoursToISODate(series.anchorEpochHours + series.points[series.points.length - 1]!.hoursFromStart))
      : null;

  return (
    <Card>
      <Heading>{peptide.name}</Heading>

      {!hasPoints ? (
        <Small style={{ marginTop: spacing.sm }}>No injections logged yet — log one on the Logger to see an estimate here.</Small>
      ) : (
        <>
          <Spacer size={spacing.md} />
          <LevelCurve points={series.points.map((p) => ({ value: p.pct, low: p.pctLow, high: p.pctHigh }))} />
          <Row justify="space-between" style={{ marginTop: spacing.sm }}>
            <Caption color={colors.textFaint}>{startLabel}</Caption>
            <Caption color={colors.textFaint}>{endLabel}</Caption>
          </Row>
          <Spacer size={spacing.xs} />
          <Caption color={colors.textFaint}>% of your predicted steady-state average</Caption>
          {series.weightFallback ? (
            <Small style={{ marginTop: spacing.sm }}>
              No usable weight on file — using the {series.weightKgUsed} kg study-reference weight instead of yours.
            </Small>
          ) : null}
        </>
      )}

      <Divider />
      <Small muted={false} style={{ color: colors.text }}>
        {PK_SHORT_DISCLAIMER}
      </Small>
      <Pressable accessibilityRole="button" onPress={() => setInfoOpen((v) => !v)} style={{ marginTop: spacing.xs }}>
        <Small style={{ textDecorationLine: 'underline' }}>{PK_CAPTION}</Small>
      </Pressable>
      {infoOpen ? <PkInfoSheet /> : null}
    </Card>
  );
}

function PkInfoSheet() {
  return (
    <View style={{ marginTop: spacing.md }}>
      <Divider />
      <Heading>How this estimate is made</Heading>
      <Small style={{ marginTop: spacing.sm }}>
        We take the injections you logged and run them through a pharmacokinetic model built from published clinical-trial
        data — the same kind of model used to choose the dosing intervals on the label. For semaglutide and tirzepatide,
        the parameters come from peer-reviewed population analyses of thousands of trial participants. The only thing
        about you that goes into it is your body weight, because that is the only personal factor those studies found to
        have a meaningful effect.
      </Small>

      <Heading style={{ marginTop: spacing.lg }}>What it is not</Heading>
      <Small style={{ marginTop: spacing.sm }}>
        It is not a blood test. It is the average behaviour of a large group of people, drawn as if it were yours. Two
        people at the same dose and the same weight can genuinely differ by 25% or more, and this chart cannot tell you
        where in that spread you sit. Only a blood test can.
      </Small>

      <Heading style={{ marginTop: spacing.lg }}>The biggest source of error is not the model</Heading>
      <Small style={{ marginTop: spacing.sm }}>
        If your product did not come from a pharmacy, nobody has verified how much peptide is actually in the vial. If it
        contains less than the label says — or more — this chart is wrong by that amount, and no amount of modelling can
        detect it.
      </Small>

      <Heading style={{ marginTop: spacing.lg }}>What this chart is for</Heading>
      <Small style={{ marginTop: spacing.sm }}>
        Seeing the shape: how long a compound takes to build up, what a missed or late injection does to it, and how long
        it stays in you after you stop. It is not for deciding a dose. We do not suggest doses.
      </Small>

      <Heading style={{ marginTop: spacing.lg }}>Sources</Heading>
      <Small style={{ marginTop: spacing.sm }}>
        Semaglutide: Carlsson Petri et al., Diabetes Ther 2018;9(4):1533–1547; Ozempic and Wegovy US prescribing
        information, §12.3.
      </Small>
      <Small style={{ marginTop: spacing.xs }}>
        Tirzepatide: Schneck &amp; Urva, CPT Pharmacometrics Syst Pharmacol 2024;13(3):494–503; Zepbound US prescribing
        information, §12.3.
      </Small>
    </View>
  );
}

/** Converts hours-since-epoch back to a local `YYYY-MM-DD`, for chart axis labels. */
function epochHoursToISODate(hours: number): string {
  const d = new Date(hours * 3_600_000);
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ---------------------------------------------------------------------------
// Current stack
// ---------------------------------------------------------------------------

const PHASE_LABELS: Record<PhaseKind | 'ended', string> = {
  titration: 'Loading',
  on: 'Fully on',
  washout: 'Rotating off',
  ended: 'Plan complete',
};

const PHASE_TONE: Record<PhaseKind | 'ended', SeverityTone> = {
  titration: 'info',
  on: 'accent',
  washout: 'info',
  ended: 'info',
};

function StackSection({
  stack,
  onBuildStack,
  onOpenPeptide,
}: {
  stack: Stack | null;
  onBuildStack: () => void;
  onOpenPeptide: (peptideId: string) => void;
}) {
  // Hooks must run unconditionally, so this is computed before the early
  // return below — an empty map when there is no stack to summarise.
  const cycleByPeptide = useMemo(() => {
    const map = new Map<string, ReturnType<typeof summariseCycle>[number]>();
    if (!stack) return map;
    for (const summary of summariseCycle(stack, today())) map.set(summary.peptideId, summary);
    return map;
  }, [stack]);

  if (!stack) {
    return (
      <EmptyState
        title="No active stack"
        body="Build a stack to see it summarised here."
        action={<Button label="Build a stack" onPress={onBuildStack} />}
      />
    );
  }

  return (
    <Card>
      {stack.items.map((item) => {
        const peptide = getPeptide(item.peptideId);
        const cycle = cycleByPeptide.get(item.peptideId);
        return (
          <ListRow
            key={item.peptideId}
            title={peptide?.name ?? item.peptideId}
            subtitle={item.doseWithheld ? 'Dose guidance withheld' : `${formatDose(item.dose)} · ${item.daysPerWeek}x/week`}
            onPress={() => onOpenPeptide(item.peptideId)}
            right={cycle ? <Badge label={PHASE_LABELS[cycle.phase]} tone={PHASE_TONE[cycle.phase]} /> : undefined}
          />
        );
      })}
    </Card>
  );
}

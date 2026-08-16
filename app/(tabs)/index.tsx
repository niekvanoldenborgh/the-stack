import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { getPeptide } from '../../src/domain/peptides';
import type { DoseLog, Peptide, PhaseKind, Stack } from '../../src/domain/types';
import { summariseCycle } from '../../src/engine/cycle';
import { formatDose } from '../../src/engine/dosing';
import { buildLevelSeries, peptideHasLevelModel, pkShortHalfLifeClearance, type LevelSeriesResult } from '../../src/engine/pk';
import { formatShort, relativeLabel, timeToMinutes, today } from '../../src/lib/date';
import { useActiveStack, useAppStore, useUpcomingDoses } from '../../src/store/useAppStore';
import { LevelCurve } from '../../src/ui/charts';
import {
  Badge,
  Button,
  Caption,
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
import { RouteIcon } from '../../src/ui/icons';
import { Disclosure, FocalMetric, List, ListItem, Section } from '../../src/ui/primitives';
import { colors, spacing, type SeverityTone } from '../../src/ui/theme';

/**
 * Summary (page 1) — THEA-8, redesigned THEA-38, THEA-40.
 *
 * One focal block — the next scheduled injection — carries the top of the
 * screen; everything else (estimated levels, current stack) steps down into
 * borderless, tone-shifted sections below it. The old four-equal-cards
 * layout and its up/down reorder toggle are gone: this is a fixed hierarchy
 * now, not a shelf of homogeneous widgets.
 *
 * This screen answers "what's next"; "how am I doing" (adherence, active
 * compounds, injections logged, the per-goal measurements) now lives on
 * Results instead — it used to be duplicated as an Overview block here too
 * (THEA-40 consolidation).
 *
 * The levels section is the only part of this screen with hard rules — see
 * the PK spec's no-dosage boundary (§3). It reads exactly what §1–§2 hand it
 * back from `src/engine/pk.ts` and never computes a dose of its own. The
 * short disclaimer under each chart stays visible unconditionally; only the
 * longer methodology note is behind a tap (`Disclosure`).
 */

export default function SummaryScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const stack = useActiveStack();
  const doseLogs = useAppStore((s) => s.doseLogs);
  const injectionLogs = useAppStore((s) => s.injectionLogs);
  const settings = useAppStore((s) => s.settings);
  const setSetting = useAppStore((s) => s.setSetting);
  const upcomingDoses = useUpcomingDoses(14);

  if (!profile) {
    return (
      <Screen>
        <Spacer size={spacing.xl} />
        <Display>Summary</Display>
        <Spacer size={spacing.lg} />
        <EmptyState
          title="No profile yet"
          body="Complete onboarding to see your overview, schedule and stack here."
          illustration="onboarding"
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Spacer size={spacing.md} />
      <Caption color={colors.accent}>Today</Caption>
      <Display style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}>Summary</Display>

      <NextInjectionSection
        upcomingDoses={upcomingDoses}
        doseLogs={doseLogs}
        alarmOffsetsMin={settings.alarmOffsetsMin}
        remindersEnabled={settings.remindersEnabled}
        onOpenAlarmSettings={() => router.push('/settings/alarm')}
      />

      <LevelsSection
        stack={stack}
        injectionLogs={injectionLogs}
        weightKg={profile.weightKg}
        acknowledgedAt={settings.pkModalAcknowledgedAt}
        onAcknowledge={() => setSetting('pkModalAcknowledgedAt', new Date().toISOString())}
      />

      <StackSection
        stack={stack}
        last
        onBuildStack={() => router.push('/builder')}
        onOpenPeptide={(id2) => router.push(`/peptide/${id2}`)}
      />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Next injection — the focal block
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

function doseUnitLabel(unit: string): string {
  if (unit === 'pct') return '%';
  if (unit === 'iu') return 'IU';
  return unit;
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
      <Section tone={2}>
        <Caption color={colors.accent}>Next injection</Caption>
        <Small style={{ marginTop: spacing.sm }}>Nothing scheduled in the next two weeks.</Small>
      </Section>
    );
  }

  const peptide = getPeptide(next.peptideId);
  const sortedOffsets = [...alarmOffsetsMin].sort((a, b) => b - a);

  return (
    <Section tone={2} gap={spacing.lg}>
      <FocalMetric
        eyebrow={relativeLabel(next.date)}
        value={`${next.dose.value}`}
        unit={doseUnitLabel(next.dose.unit)}
        meta={`${peptide?.name ?? next.peptideId} · ${next.time}`}
      />

      {remindersEnabled ? (
        sortedOffsets.length > 0 ? (
          <List>
            {sortedOffsets.map((min) => (
              <ListItem
                key={min}
                title={offsetLabel(min)}
                meta={<Data small color={colors.textMuted}>{subtractMinutes(next.time, min)}</Data>}
              />
            ))}
          </List>
        ) : null
      ) : (
        <View>
          <Small muted={false} style={{ color: colors.moderate }}>
            Reminders are off — you will not be alerted for this injection.
          </Small>
          <Button label="Open alarm settings" variant="secondary" onPress={onOpenAlarmSettings} style={{ marginTop: spacing.md }} />
        </View>
      )}
    </Section>
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
      <Section title="Estimated medication levels">
        <Small>No active stack — start one to see estimated levels here.</Small>
      </Section>
    );
  }

  const withModel = rows.filter((r) => r.eligible);
  const withoutModel = rows.filter((r) => !r.eligible);
  const needsAcknowledgement = withModel.length > 0 && !acknowledgedAt;

  return (
    <Section title="Estimated medication levels" gap={spacing.lg}>
      {needsAcknowledgement ? (
        <View>
          <Small muted={false} style={{ color: colors.text }}>
            This is a model, not a measurement — the population average on your logged injections and body weight. It
            cannot tell you whether your dose is right, and we will never use it to suggest one.
          </Small>
          <Button label="I understand" onPress={onAcknowledge} style={{ marginTop: spacing.md }} />
        </View>
      ) : (
        withModel.map((row) => <LevelChartCard key={row.peptide.id} peptide={row.peptide} series={row.series!} />)
      )}

      {withoutModel.map((row) => {
        const clearsIn = pkShortHalfLifeClearance(row.peptide.id);
        return (
          <View key={row.peptide.id}>
            <Heading>{row.peptide.name}</Heading>
            <Small style={{ marginTop: spacing.xs }}>
              {clearsIn
                ? `Clears in ${clearsIn} — out of your system long before the next dose, so a level chart would be a ` +
                  `flat line with a spike on it. What matters here is the response it triggers, not the peptide level.`
                : `We only draw this chart where published human pharmacokinetic data exists — currently semaglutide and ` +
                  `tirzepatide. Your injections are still logged and shown on the calendar.`}
            </Small>
          </View>
        );
      })}
    </Section>
  );
}

function LevelChartCard({ peptide, series }: { peptide: Peptide; series: LevelSeriesResult }) {
  const hasPoints = series.points.length > 0;

  const startLabel = hasPoints && series.anchorEpochHours !== null ? formatShort(epochHoursToISODate(series.anchorEpochHours)) : null;
  const endLabel =
    hasPoints && series.anchorEpochHours !== null
      ? formatShort(epochHoursToISODate(series.anchorEpochHours + series.points[series.points.length - 1]!.hoursFromStart))
      : null;

  return (
    <View>
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
      <Disclosure label="How this estimate is made" summary={PK_CAPTION}>
        <PkInfoBody />
      </Disclosure>
    </View>
  );
}

function PkInfoBody() {
  return (
    <View>
      <Small muted={false} style={{ color: colors.text }}>{PK_CAPTION}</Small>

      <Caption color={colors.textMuted} style={{ marginTop: spacing.lg }}>
        How this estimate is made
      </Caption>
      <Small style={{ marginTop: spacing.sm }}>
        We take the injections you logged and run them through a pharmacokinetic model built from published clinical-trial
        data — the same kind of model used to choose the dosing intervals on the label. For semaglutide and tirzepatide,
        the parameters come from peer-reviewed population analyses of thousands of trial participants. The only thing
        about you that goes into it is your body weight, because that is the only personal factor those studies found to
        have a meaningful effect.
      </Small>

      <Caption color={colors.textMuted} style={{ marginTop: spacing.lg }}>
        What it is not
      </Caption>
      <Small style={{ marginTop: spacing.sm }}>
        It is not a blood test. It is the average behaviour of a large group of people, drawn as if it were yours. Two
        people at the same dose and the same weight can genuinely differ by 25% or more, and this chart cannot tell you
        where in that spread you sit. Only a blood test can.
      </Small>

      <Caption color={colors.textMuted} style={{ marginTop: spacing.lg }}>
        The biggest source of error is not the model
      </Caption>
      <Small style={{ marginTop: spacing.sm }}>
        If your product did not come from a pharmacy, nobody has verified how much peptide is actually in the vial. If it
        contains less than the label says — or more — this chart is wrong by that amount, and no amount of modelling can
        detect it.
      </Small>

      <Caption color={colors.textMuted} style={{ marginTop: spacing.lg }}>
        What this chart is for
      </Caption>
      <Small style={{ marginTop: spacing.sm }}>
        Seeing the shape: how long a compound takes to build up, what a missed or late injection does to it, and how long
        it stays in you after you stop. It is not for deciding a dose. We do not suggest doses.
      </Small>

      <Caption color={colors.textMuted} style={{ marginTop: spacing.lg }}>
        Sources
      </Caption>
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
  last,
  onBuildStack,
  onOpenPeptide,
}: {
  stack: Stack | null;
  last?: boolean;
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
      <Section title="Current stack" last={last}>
        <EmptyState
          title="No active stack"
          body="Build a stack to see it summarised here."
          action={<Button label="Build a stack" onPress={onBuildStack} />}
          illustration="noStack"
        />
      </Section>
    );
  }

  return (
    <Section title="Current stack" last={last}>
      <List>
        {stack.items.map((item) => {
          const peptide = getPeptide(item.peptideId);
          const cycle = cycleByPeptide.get(item.peptideId);
          return (
            <ListItem
              key={item.peptideId}
              icon={peptide ? <RouteIcon route={peptide.routes[0]!} /> : undefined}
              title={peptide?.name ?? item.peptideId}
              detail={item.doseWithheld ? 'Dose guidance withheld' : `${formatDose(item.dose)} · ${item.daysPerWeek}x/week`}
              onPress={() => onOpenPeptide(item.peptideId)}
              meta={cycle ? <Badge label={PHASE_LABELS[cycle.phase]} tone={PHASE_TONE[cycle.phase]} /> : undefined}
            />
          );
        })}
      </List>
    </Section>
  );
}

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { METRIC_BY_ID } from '../../src/domain/metrics';
import { getPeptide } from '../../src/domain/peptides';
import type { DoseLog, GoalTarget, InjectionLog, Measurement, PhaseKind, Stack } from '../../src/domain/types';
import { buildCyclePhases, cyclePlanProgressPct, groupPhasesByPeptide, summariseCycle } from '../../src/engine/cycle';
import { formatDose } from '../../src/engine/dosing';
import { formatMetricValue, goalTargetProgressPct, summariseMeasurements } from '../../src/engine/progress';
import { relativeLabel, timeToMinutes, today } from '../../src/lib/date';
import { useActiveStack, useAppStore, useUpcomingDoses } from '../../src/store/useAppStore';
import {
  Badge,
  Button,
  Caption,
  Data,
  Display,
  EmptyState,
  ProgressBar,
  Row,
  Screen,
  Small,
  Spacer,
} from '../../src/ui/components';
import { RouteIcon } from '../../src/ui/icons';
import { FocalMetric, List, ListItem, Section } from '../../src/ui/primitives';
import { colors, spacing, type SeverityTone } from '../../src/ui/theme';

/**
 * Summary (page 1) — THEA-8, redesigned THEA-38, THEA-40, THEA-49.
 *
 * One focal block — the next scheduled injection — carries the top of the
 * screen; everything else (today's to-do list, current stack) steps down
 * into borderless, tone-shifted sections below it. The old four-equal-cards
 * layout and its up/down reorder toggle are gone: this is a fixed hierarchy
 * now, not a shelf of homogeneous widgets.
 *
 * This screen answers "what's next"; "how am I doing" (adherence, active
 * compounds, injections logged, the per-goal measurements) now lives on
 * Results instead — it used to be duplicated as an Overview block here too
 * (THEA-40 consolidation). The one deliberate exception is `GoalProgressSection`
 * below: owner feedback (THEA-40 round 2) asked for a glanceable progress
 * infographic here too, alongside the cycle progress bar. It surfaces only
 * the single target the user set on Results, not a dashboard — the target
 * number is entirely theirs, same as everywhere else in this app.
 *
 * `TodayInjectionsSection` replaces the old "estimated medication levels"
 * block (THEA-6, THEA-49): a plain checklist of today's schedule, ticked
 * strictly by whether a matching log exists — see `isLoggedToday` below.
 * The PK levels engine (`src/engine/pk.ts`) is untouched and still tested;
 * this screen just no longer renders it.
 */

export default function SummaryScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const stack = useActiveStack();
  const doseLogs = useAppStore((s) => s.doseLogs);
  const injectionLogs = useAppStore((s) => s.injectionLogs);
  const measurements = useAppStore((s) => s.measurements);
  const settings = useAppStore((s) => s.settings);
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

      <GoalProgressSection target={profile.goalTarget} measurements={measurements} />

      <TodayInjectionsSection upcomingDoses={upcomingDoses} injectionLogs={injectionLogs} />

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
// Goal progress — the target the user set on Results, if any (THEA-40 round 2)
// ---------------------------------------------------------------------------

function GoalProgressSection({ target, measurements }: { target?: GoalTarget; measurements: Measurement[] }) {
  const pct = useMemo(() => {
    if (!target) return null;
    const summary = summariseMeasurements(measurements).find((s) => s.key === target.metricId);
    return goalTargetProgressPct(target, summary?.latest ?? null);
  }, [target, measurements]);

  if (!target || pct === null) return null;

  const metric = METRIC_BY_ID[target.metricId];
  const targetLabel = formatMetricValue(target.value, metric?.unit ?? '', metric?.precision ?? 1);
  const label = (metric?.label ?? 'tracked measure').toLowerCase();

  return (
    <Section title="Goal progress">
      <ProgressBar value={pct} tone="accent" />
      <Caption color={colors.textFaint} style={{ marginTop: spacing.xs }}>
        {`${Math.round(pct)}% of the way to your ${label} target · ${targetLabel}`}
      </Caption>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Today's injections — THEA-49
// ---------------------------------------------------------------------------

/**
 * A row is ticked only because a matching `InjectionLog` exists for today —
 * never by tapping it. The match is the same plain peptideId equality
 * `src/engine/pk.ts` uses to pick a compound's own logs out of the list,
 * extended with a same-day date check; no fuzzy time-window or dose-size
 * heuristic. Ticking is a statement of fact ("you logged this"), not a
 * to-do the user can fake, so `ListItem` gets no `onPress` here.
 */
function isLoggedToday(peptideId: string, injectionLogs: InjectionLog[], todayISO: string): boolean {
  return injectionLogs.some((log) => log.peptideId === peptideId && log.date === todayISO);
}

function TodayInjectionsSection({
  upcomingDoses,
  injectionLogs,
}: {
  upcomingDoses: ReturnType<typeof useUpcomingDoses>;
  injectionLogs: InjectionLog[];
}) {
  const todayISO = today();

  const rows = useMemo(
    () =>
      upcomingDoses
        .filter((dose) => dose.date === todayISO)
        .map((dose) => ({ dose, logged: isLoggedToday(dose.peptideId, injectionLogs, todayISO) })),
    [upcomingDoses, injectionLogs, todayISO],
  );

  if (rows.length === 0) {
    return (
      <Section title="Today's injections">
        <Small>Nothing scheduled for today.</Small>
      </Section>
    );
  }

  return (
    <Section title="Today's injections">
      <List>
        {rows.map(({ dose, logged }) => {
          const peptide = getPeptide(dose.peptideId);
          return (
            <ListItem
              key={dose.id}
              title={peptide?.name ?? dose.peptideId}
              detail={`${formatDose(dose.dose)} · ${dose.time}`}
              checked={logged}
            />
          );
        })}
      </List>
    </Section>
  );
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

/** "Washout starts in 12 days" / "Reaches full dose in 3 days" / the ended-plan sentence as-is. */
function cycleCaption(cycle: ReturnType<typeof summariseCycle>[number]): string {
  if (cycle.daysUntilChange === null) return cycle.nextChangeLabel;
  const days = cycle.daysUntilChange;
  return `${cycle.nextChangeLabel} in ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * How far through the compound's full planned timeline today sits — owner
 * feedback (THEA-40 review) asked for this to be visible at a glance, to keep
 * people motivated to finish a cycle rather than drift off it partway.
 */
function CycleProgress({ pct, caption }: { pct: number; caption: string }) {
  return (
    <View>
      <ProgressBar value={pct} tone="accent" />
      <Caption color={colors.textFaint} style={{ marginTop: spacing.xs }}>
        {`${Math.round(pct)}% through this cycle · ${caption}`}
      </Caption>
    </View>
  );
}

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
  // Hooks must run unconditionally, so these are computed before the early
  // return below — empty maps when there is no stack to summarise.
  const cycleByPeptide = useMemo(() => {
    const map = new Map<string, ReturnType<typeof summariseCycle>[number]>();
    if (!stack) return map;
    for (const summary of summariseCycle(stack, today())) map.set(summary.peptideId, summary);
    return map;
  }, [stack]);

  const phasesByPeptide = useMemo(
    () => (stack ? groupPhasesByPeptide(buildCyclePhases(stack)) : new Map()),
    [stack],
  );

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
          const progressPct = cyclePlanProgressPct(phasesByPeptide.get(item.peptideId) ?? [], today());
          return (
            <ListItem
              key={item.peptideId}
              icon={peptide ? <RouteIcon route={peptide.routes[0]!} /> : undefined}
              title={peptide?.name ?? item.peptideId}
              detail={item.doseWithheld ? 'Dose guidance withheld' : `${formatDose(item.dose)} · ${item.daysPerWeek}x/week`}
              onPress={() => onOpenPeptide(item.peptideId)}
              meta={cycle ? <Badge label={PHASE_LABELS[cycle.phase]} tone={PHASE_TONE[cycle.phase]} /> : undefined}
            >
              {cycle && progressPct !== null ? <CycleProgress pct={progressPct} caption={cycleCaption(cycle)} /> : null}
            </ListItem>
          );
        })}
      </List>
    </Section>
  );
}

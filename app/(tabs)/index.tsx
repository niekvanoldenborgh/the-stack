import { useRouter } from 'expo-router';
import { User } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';

import { METRIC_BY_ID } from '../../src/domain/metrics';
import { getPeptide } from '../../src/domain/peptides';
import type { DoseLog, GoalTarget, InjectionLog, Measurement, PhaseKind, Stack } from '../../src/domain/types';
import {
  buildCyclePhases,
  cyclePlanProgressPct,
  generateSchedule,
  groupPhasesByPeptide,
  summariseCycle,
} from '../../src/engine/cycle';
import { formatDose } from '../../src/engine/dosing';
import { formatMetricValue, goalTargetProgressPct, summariseMeasurements } from '../../src/engine/progress';
import { addDays, relativeLabel, timeToMinutes, today, WEEKDAY_LABELS, weekdayIndex, formatShort } from '../../src/lib/date';
import { selectAdherence, useActiveStack, useAppStore, useUpcomingDoses } from '../../src/store/useAppStore';
import {
  Badge,
  Button,
  Callout,
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
import { Avatar, DoseRow, DuoRow, FocalMetric, List, ListItem, PulseDot, Section, StatCard } from '../../src/ui/primitives';
import { spacing, useTheme, type SeverityTone } from '../../src/ui/theme';

/**
 * Summary (page 1) — THEA-8, redesigned THEA-38/40/49, rebuilt to
 * pulse-design-spec-v2 §4 (THEA-69 v2).
 *
 * Order (top to bottom), matching KIMI's reference screen A: header row
 * (date + greeting + avatar) → hero card (next injection, countdown, white
 * CTA) → duo row (adherence ring, active compounds) → today's injections
 * checklist → current stack → goal progress. The old four-equal-cards shelf
 * is gone; hierarchy comes from scale and card shape, not a uniform stack of
 * identical panels.
 *
 * `TodayInjectionsSection` still ticks a row strictly by whether a matching
 * log exists for today (see `countLoggedToday` below) — that derivation is
 * unchanged from v1, just rendered through `DoseRow` now instead of
 * `ListItem`.
 */

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function SummaryScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { color } = theme;
  const profile = useAppStore((s) => s.profile);
  const stack = useActiveStack();
  const doseLogs = useAppStore((s) => s.doseLogs);
  const injectionLogs = useAppStore((s) => s.injectionLogs);
  const measurements = useAppStore((s) => s.measurements);
  const settings = useAppStore((s) => s.settings);
  const upcomingDoses = useUpcomingDoses(14);

  const adherencePct = useMemo(() => {
    if (!stack) return null;
    const doses = generateSchedule(stack, addDays(today(), -13), today());
    const { pct, taken, skipped } = selectAdherence(doses, doseLogs);
    return taken + skipped === 0 ? null : pct;
  }, [stack, doseLogs]);

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
      <Spacer size={spacing.lg} />
      <HeaderRow />

      <NextInjectionSection
        upcomingDoses={upcomingDoses}
        doseLogs={doseLogs}
        alarmOffsetsMin={settings.alarmOffsetsMin}
        remindersEnabled={settings.remindersEnabled}
        onOpenAlarmSettings={() => router.push('/settings/alarm')}
        onLogInjection={() => router.push('/logger')}
      />

      <DuoRow>
        <StatCard label="Adherence · 14d" ring={adherencePct ?? 0} hint={adherencePct === null ? 'No doses logged yet' : undefined} />
        <StatCard label="Active compounds" value={`${stack?.items.length ?? 0}`} />
      </DuoRow>
      <Spacer size={spacing.xl} />

      <TodayInjectionsSection upcomingDoses={upcomingDoses} injectionLogs={injectionLogs} />

      <StackSection stack={stack} onBuildStack={() => router.push('/builder')} onOpenPeptide={(id2) => router.push(`/peptide/${id2}`)} />

      <GoalProgressSection target={profile.goalTarget} measurements={measurements} last />
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Header row — date + greeting + avatar (spec-v2 §4.1)
// ---------------------------------------------------------------------------

function HeaderRow() {
  const theme = useTheme();
  const { color } = theme;
  // `UserProfile` carries no display-name field today — a neutral, time-based
  // greeting and a generic avatar mark rather than inventing one (spec-v2
  // §4.1/§8.2; that's a product decision, not this rebuild's to make).
  const greeting = greetingForHour(new Date().getHours());
  const dateLabel = `${WEEKDAY_LABELS[weekdayIndex(today())]} ${formatShort(today())}`;

  return (
    <Row justify="space-between" align="center" style={{ marginBottom: spacing.xl }}>
      <View>
        <Caption color={color.textSecondary}>{dateLabel}</Caption>
        <Display style={{ fontSize: 26, lineHeight: 32, marginTop: spacing.xs }}>{greeting}</Display>
      </View>
      <Avatar icon={<User size={20} color={color.onPrimary} strokeWidth={2} />} />
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Next injection — the hero block
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
  onLogInjection,
}: {
  upcomingDoses: ReturnType<typeof useUpcomingDoses>;
  doseLogs: Record<string, DoseLog>;
  alarmOffsetsMin: number[];
  remindersEnabled: boolean;
  onOpenAlarmSettings: () => void;
  onLogInjection: () => void;
}) {
  const theme = useTheme();
  const { color } = theme;
  const next = upcomingDoses.find((dose) => !doseLogs[dose.id]);

  if (!next) {
    return (
      <Section tone={1}>
        <Caption color={color.primary}>Next injection</Caption>
        <Small style={{ marginTop: spacing.sm }}>Nothing scheduled.</Small>
      </Section>
    );
  }

  const peptide = getPeptide(next.peptideId);
  const sortedOffsets = [...alarmOffsetsMin].sort((a, b) => b - a);
  const firstOffset = sortedOffsets[0];

  return (
    <Section tone={3} gradient gap={spacing.lg}>
      <FocalMetric
        eyebrow={relativeLabel(next.date)}
        value={`${next.dose.value}`}
        unit={doseUnitLabel(next.dose.unit)}
        meta={`${peptide?.name ?? next.peptideId} · ${next.time}`}
        tone={color.onPrimary}
        metaTone={color.onPrimary}
        eyebrowTone={color.onPrimary}
      />

      {remindersEnabled ? (
        sortedOffsets.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {sortedOffsets.map((min) => (
              <Row key={min} justify="space-between" gap={spacing.sm}>
                <Row gap={spacing.sm}>
                  {min === firstOffset ? <PulseDot /> : <View style={{ width: 7 }} />}
                  <Small muted={false} style={{ color: color.onPrimary }}>
                    {offsetLabel(min)}
                  </Small>
                </Row>
                <Data small color={color.onPrimary}>
                  {subtractMinutes(next.time, min)}
                </Data>
              </Row>
            ))}
          </View>
        ) : null
      ) : (
        <View>
          <Callout tone="moderate">
            Reminders are off — you will not be alerted for this injection.
          </Callout>
          <Button label="Open alarm settings" variant="secondary" onPress={onOpenAlarmSettings} style={{ marginTop: spacing.md }} />
        </View>
      )}

      <Button label="Log this injection" onPress={onLogInjection} variant="onGradient" />
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Goal progress — the target the user set on Results, if any (THEA-40 round 2)
// ---------------------------------------------------------------------------

function GoalProgressSection({ target, measurements, last }: { target?: GoalTarget; measurements: Measurement[]; last?: boolean }) {
  const theme = useTheme();
  const { color } = theme;
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
    <Section title="Goal progress" last={last}>
      <ProgressBar value={pct} tone="accent" />
      <Caption color={color.textTertiary} style={{ marginTop: spacing.xs }}>
        {`${Math.round(pct)}% of the way to your ${label} target · ${targetLabel}`}
      </Caption>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Today's injections — THEA-49, rendered as DoseRow (spec-v2 §3.5/§4.4)
// ---------------------------------------------------------------------------

/**
 * A row is ticked only because a matching `InjectionLog` exists for today —
 * never by tapping it. Matching is by count, not existence: some catalog
 * peptides schedule twice a day (e.g. ipamorelin: bedtime + post-workout),
 * so a boolean peptideId+date match would tick *both* rows off a single
 * logged shot. Instead, the Nth scheduled slot for a peptide today ticks
 * only once N logs exist for that peptide today (P&S review, THEA-49) —
 * still plain equality on peptideId + same-day date, no fuzzy time-window
 * or dose-size heuristic. Ticking is a statement of fact ("you logged
 * this"), not a to-do the user can fake, so `DoseRow` gets no `onPress`
 * here.
 */
function countLoggedToday(peptideId: string, injectionLogs: InjectionLog[], todayISO: string): number {
  return injectionLogs.filter((log) => log.peptideId === peptideId && log.date === todayISO).length;
}

function TodayInjectionsSection({
  upcomingDoses,
  injectionLogs,
}: {
  upcomingDoses: ReturnType<typeof useUpcomingDoses>;
  injectionLogs: InjectionLog[];
}) {
  const todayISO = today();

  const rows = useMemo(() => {
    const todaysDoses = upcomingDoses.filter((dose) => dose.date === todayISO);
    // upcomingDoses is schedule-ordered (date, then time) — so the count of
    // a peptide's rows seen so far as we walk this list is its index among
    // that peptide's scheduled slots today.
    const seenByPeptide: Record<string, number> = {};
    const withLogged = todaysDoses.map((dose) => {
      const indexForPeptide = seenByPeptide[dose.peptideId] ?? 0;
      seenByPeptide[dose.peptideId] = indexForPeptide + 1;
      const loggedCount = countLoggedToday(dose.peptideId, injectionLogs, todayISO);
      return { dose, logged: indexForPeptide < loggedCount };
    });
    // First unlogged row reads as "next"; every other unlogged row is "todo".
    // Pure derivation from data already computed above — no new domain logic.
    let nextAssigned = false;
    return withLogged.map((row) => {
      if (row.logged) return { ...row, status: 'done' as const };
      if (!nextAssigned) {
        nextAssigned = true;
        return { ...row, status: 'next' as const };
      }
      return { ...row, status: 'todo' as const };
    });
  }, [upcomingDoses, injectionLogs, todayISO]);

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
        {rows.map(({ dose, status }) => {
          const peptide = getPeptide(dose.peptideId);
          return (
            <DoseRow
              key={dose.id}
              time={dose.time}
              name={peptide?.name ?? dose.peptideId}
              detail={formatDose(dose.dose)}
              status={status}
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
  const theme = useTheme();
  return (
    <View>
      <ProgressBar value={pct} tone="accent" />
      <Caption color={theme.color.textTertiary} style={{ marginTop: spacing.xs }}>
        {`${Math.round(pct)}% through this cycle · ${caption}`}
      </Caption>
    </View>
  );
}

function StackSection({
  stack,
  onBuildStack,
  onOpenPeptide,
}: {
  stack: Stack | null;
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
      <Section title="Current stack">
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
    <Section title="Current stack">
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

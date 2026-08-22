import { useRouter } from 'expo-router';
import { Repeat, User } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';

import { HEALTH_FLAGS_BY_ID } from '../../src/domain/goals';
import { getPeptide } from '../../src/domain/peptides';
import type {
  CyclePhase,
  InjectionLog,
  PhaseKind,
  SafetyReport,
  ScheduledDose,
  Stack,
} from '../../src/domain/types';
import { buildCyclePhases, cyclePlanProgressPct, generateSchedule, groupPhasesByPeptide } from '../../src/engine/cycle';
import { formatDose } from '../../src/engine/dosing';
import { routeLabel } from '../../src/ui/icons';
import {
  addDays,
  diffDays,
  fromISODate,
  relativeLabel,
  timeToMinutes,
  today,
  WEEKDAY_LABELS,
  weekdayIndex,
  formatShort,
} from '../../src/lib/date';
import { selectAdherence, useActiveStack, useAppStore, useUpcomingDoses } from '../../src/store/useAppStore';
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
} from '../../src/ui/components';
import { Avatar, DoseRow } from '../../src/ui/primitives';
import { CountdownRing, PhaseBar, SafetyTile, Tile, type PhaseBarSegment, type SafetyFinding } from '../../src/ui/nocturne';
import { radius, spacing, useTheme } from '../../src/ui/theme';

/**
 * Today (THEA-8, redesigned THEA-38/40/49, rebuilt to NOCTURNE — THEA-69 v3).
 *
 * This is the one screen the owner asked to answer "what do I take, and
 * when" inside three seconds: a compact greeting, one glowing hero (next
 * dose, via `CountdownRing`), today's checklist, then a demoted two-up row
 * (cycle progress + `SafetyTile`). Adherence is a small pill, not a card —
 * it was the hero on the old design and that was exactly the complaint.
 *
 * "Current stack" and "Goal progress" — both on the pre-NOCTURNE version of
 * this screen — are deliberately gone from here, not lost: the full
 * per-compound cycle breakdown and goal-target editor now live on Progress
 * (`app/(tabs)/results.tsx`), which already rebuilds them in more detail than
 * a glance screen has room for. Every number this screen *does* show is
 * computed exactly the way the pre-redesign screen computed it — next dose,
 * adherence, today's list, cycle progress and safety all read the same
 * selectors as before, just rendered through NOCTURNE's tiles.
 */

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function SummaryScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const stack = useActiveStack();
  const doseLogs = useAppStore((s) => s.doseLogs);
  const injectionLogs = useAppStore((s) => s.injectionLogs);
  const settings = useAppStore((s) => s.settings);
  const upcomingDoses = useUpcomingDoses(14);

  const adherencePct = useMemo(() => {
    if (!stack) return null;
    const doses = generateSchedule(stack, addDays(today(), -13), today());
    const { pct, taken, skipped } = selectAdherence(doses, doseLogs);
    return taken + skipped === 0 ? null : pct;
  }, [stack, doseLogs]);

  // The one dose this whole screen is organised around — computed once here
  // (same expression the pre-redesign hero used) and shared by the hero and
  // the cycle tile, so "what's next" stays one answer, not two.
  const next = useMemo(() => upcomingDoses.find((dose) => !doseLogs[dose.id]), [upcomingDoses, doseLogs]);

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

      <Row gap={spacing.sm} style={{ marginBottom: spacing.lg }}>
        {adherencePct !== null ? <MiniChip label={`${adherencePct}% adherence`} /> : null}
        <MiniChip label={`${stack?.items.length ?? 0} active`} />
      </Row>

      <NextDoseHero
        next={next}
        settings={settings}
        onOpenAlarmSettings={() => router.push('/settings/alarm')}
        onLogInjection={() => router.push('/logger')}
        onBuildStack={() => router.push('/builder')}
      />

      <TodayInjectionsSection upcomingDoses={upcomingDoses} injectionLogs={injectionLogs} />

      <Row gap={spacing.md} align="stretch" style={{ marginBottom: spacing.xxl }}>
        <View style={{ flex: 1 }}>
          <CycleTile stack={stack} focusPeptideId={next?.peptideId ?? null} />
        </View>
        <View style={{ flex: 1 }}>
          <SafetyTile
            title="Safety"
            findings={stack ? buildSafetyFindings(stack.safety) : []}
            emptyLabel={stack ? 'No critical' : 'No active stack'}
          />
        </View>
      </Row>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Header row — date + greeting + avatar
// ---------------------------------------------------------------------------

function HeaderRow() {
  const theme = useTheme();
  const { color } = theme;
  // `UserProfile` carries no display-name field today — a neutral, time-based
  // greeting and a generic avatar mark rather than inventing one.
  const greeting = greetingForHour(new Date().getHours());
  const dateLabel = `${WEEKDAY_LABELS[weekdayIndex(today())]} ${formatShort(today())}`;

  return (
    <Row justify="space-between" align="center" style={{ marginBottom: spacing.lg }}>
      <View>
        <Caption color={color.textSecondary}>{dateLabel}</Caption>
        <Display style={{ fontSize: 26, lineHeight: 32, marginTop: spacing.xs }}>{greeting}</Display>
      </View>
      <Avatar icon={<User size={20} color={color.onPrimary} strokeWidth={2} />} />
    </Row>
  );
}

/** Small pill for a secondary stat — deliberately the smallest treatment on
 *  this screen. Adherence was the previous design's hero card; the owner's
 *  brief was explicit that it should not be here. */
function MiniChip({ label }: { label: string }) {
  const theme = useTheme();
  const { color } = theme;
  return (
    <Row
      gap={spacing.xs}
      align="center"
      style={{
        backgroundColor: color.surface,
        borderWidth: 1,
        borderColor: color.border,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color.textTertiary }} />
      <Data small>{label}</Data>
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Next dose — the hero
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

/** Minutes from `now` until a scheduled dose's date+time. Can be negative for an overdue dose. */
function minutesUntilDose(dose: ScheduledDose, now: Date): number {
  const target = fromISODate(dose.date);
  target.setMinutes(target.getMinutes() + timeToMinutes(dose.time));
  return Math.round((target.getTime() - now.getTime()) / 60000);
}

function formatCountdown(minutesUntil: number): string {
  if (minutesUntil <= 0) return 'Now';
  const days = Math.floor(minutesUntil / 1440);
  const hours = Math.floor((minutesUntil % 1440) / 60);
  const mins = minutesUntil % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

/**
 * `CountdownRing`'s `pct` is a decorative 0–100 fill, never rendered as a
 * number (nocturne.tsx) — it is not a domain figure, so a flat 24h horizon
 * (dose imminent → full ring, a day+ out → empty) needs no data beyond the
 * dose's own scheduled time. An overdue, still-unlogged dose reads as full.
 */
function countdownFillPct(minutesUntil: number): number {
  const HORIZON_MINUTES = 24 * 60;
  return 100 - (Math.max(0, minutesUntil) / HORIZON_MINUTES) * 100;
}

function NextDoseHero({
  next,
  settings,
  onOpenAlarmSettings,
  onLogInjection,
  onBuildStack,
}: {
  next: ScheduledDose | undefined;
  settings: { alarmOffsetsMin: number[]; remindersEnabled: boolean };
  onOpenAlarmSettings: () => void;
  onLogInjection: () => void;
  onBuildStack: () => void;
}) {
  if (!next) {
    return (
      <Tile elevation="mid" style={{ alignItems: 'center', marginBottom: spacing.xl }}>
        <Caption>Next dose</Caption>
        <Small style={{ marginTop: spacing.sm, marginBottom: spacing.lg, textAlign: 'center' }}>Nothing scheduled.</Small>
        <Button label="Add a compound" onPress={onBuildStack} />
      </Tile>
    );
  }

  const peptide = getPeptide(next.peptideId);
  const minutesUntil = minutesUntilDose(next, new Date());
  const sortedOffsets = [...settings.alarmOffsetsMin].sort((a, b) => b - a);

  return (
    <Tile elevation="hero" style={{ marginBottom: spacing.xl }}>
      <CountdownRing
        caption="Next dose"
        timeLabel={formatCountdown(minutesUntil)}
        pct={countdownFillPct(minutesUntil)}
        subtitle={`${peptide?.name ?? next.peptideId} · ${formatDose(next.dose)} · ${routeLabel(next.route)}`}
      >
        <Small style={{ marginTop: spacing.md, textAlign: 'center' }}>{`${relativeLabel(next.date)} · ${next.time}`}</Small>

        {/*
         * TODO(nocturne): the mockup also shows a predicted injection site
         * here ("left abdomen, rotates from right thigh"). `ScheduledDose`
         * carries no site — a site only exists once logged, on
         * `InjectionLog.site`, after the fact. Showing a "next site" would
         * mean inventing a rotation prediction the engine does not compute.
         * Needs real site-rotation logic in src/engine before this can ship.
         */}

        {settings.remindersEnabled ? (
          sortedOffsets.length > 0 ? (
            <View style={{ marginTop: spacing.lg, width: '100%', gap: spacing.sm }}>
              {sortedOffsets.map((min) => (
                <Row key={min} justify="space-between" gap={spacing.sm}>
                  <Small muted={false}>{offsetLabel(min)}</Small>
                  <Data small>{subtractMinutes(next.time, min)}</Data>
                </Row>
              ))}
            </View>
          ) : null
        ) : (
          <View style={{ marginTop: spacing.lg, width: '100%' }}>
            <Callout tone="moderate">Reminders are off — you will not be alerted for this injection.</Callout>
            <Button label="Open alarm settings" variant="secondary" onPress={onOpenAlarmSettings} style={{ marginTop: spacing.md }} />
          </View>
        )}

        <Button label="Log this injection" onPress={onLogInjection} gradient style={{ marginTop: spacing.lg, width: '100%' }} />
      </CountdownRing>
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// Today's injections
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

  const doneCount = rows.filter((row) => row.status === 'done').length;

  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Caption style={{ marginBottom: spacing.md }}>
        {rows.length === 0 ? 'Today' : `Today · ${doneCount} of ${rows.length} logged`}
      </Caption>
      {rows.length === 0 ? (
        <Tile elevation="low">
          <Small>Nothing scheduled for today.</Small>
        </Tile>
      ) : (
        <View style={{ gap: spacing.sm }}>
          {rows.map(({ dose, status }) => {
            const peptide = getPeptide(dose.peptideId);
            return (
              <Tile key={dose.id} elevation="low">
                <DoseRow time={dose.time} name={peptide?.name ?? dose.peptideId} detail={formatDose(dose.dose)} status={status} />
              </Tile>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Cycle tile — demoted, secondary (BRIEF.md: "cycle progress and safety are
// demoted to secondary tiles")
// ---------------------------------------------------------------------------

const PHASE_LABELS: Record<PhaseKind, string> = {
  titration: 'Loading',
  on: 'Fully on',
  washout: 'Rotating off',
};

interface CycleTileSummary {
  segments: PhaseBarSegment[];
  /** 0–1 fraction of the whole plan elapsed, for `PhaseBar`'s "now" marker. */
  position: number;
  currentWeek: number;
  totalWeeks: number;
  currentLabel: string;
}

/**
 * Reshapes one compound's `CyclePhase` blocks into what `PhaseBar` needs.
 * Nothing here recomputes a schedule — it only derives a week count and a
 * "now" fraction from dates the engine already produced, reusing
 * `cyclePlanProgressPct` for the fraction so the bar's marker and the
 * segment widths agree on the same total span. (Same shape as Progress's
 * own `summariseCyclePhases` — kept local rather than shared across route
 * files, matching how this file already keeps its own small helpers.)
 */
function summariseCycleForTile(phases: CyclePhase[], date: string): CycleTileSummary | null {
  if (phases.length === 0) return null;
  const start = phases[0]!.startDate;
  const end = phases[phases.length - 1]!.endDate;
  const totalDays = diffDays(start, end) + 1;
  if (totalDays <= 0) return null;

  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  const clampedDate = date < start ? start : date > end ? end : date;
  const currentWeek = Math.min(totalWeeks, Math.max(1, Math.ceil((diffDays(start, clampedDate) + 1) / 7)));
  const pct = cyclePlanProgressPct(phases, date);
  const current =
    phases.find((p) => date >= p.startDate && date <= p.endDate) ?? (date < start ? phases[0]! : phases[phases.length - 1]!);

  const segments: PhaseBarSegment[] = phases.map((phase, index) => ({
    key: `${phase.kind}-${index}`,
    label: PHASE_LABELS[phase.kind],
    length: Math.max(1, diffDays(phase.startDate, phase.endDate) + 1),
  }));

  return {
    segments,
    position: pct === null ? 0 : pct / 100,
    currentWeek,
    totalWeeks,
    currentLabel: PHASE_LABELS[current.kind],
  };
}

/**
 * One representative compound's cycle, not the whole stack — a 2-up tile has
 * no room for a per-compound breakdown (that's Progress's job). Prefers
 * whichever compound the hero card is about, since that keeps the screen's
 * two "what's happening" answers (next dose, cycle stage) telling one story;
 * falls back to the stack's first item when nothing is scheduled.
 */
function CycleTile({ stack, focusPeptideId }: { stack: Stack | null; focusPeptideId: string | null }) {
  const theme = useTheme();
  const { color } = theme;

  const summary = useMemo(() => {
    if (!stack) return null;
    const byPeptide = groupPhasesByPeptide(buildCyclePhases(stack));
    const peptideId = focusPeptideId && byPeptide.has(focusPeptideId) ? focusPeptideId : stack.items[0]?.peptideId;
    if (!peptideId) return null;
    return summariseCycleForTile(byPeptide.get(peptideId) ?? [], today());
  }, [stack, focusPeptideId]);

  return (
    <Tile elevation="mid" icon={<Repeat size={14} color={color.textSecondary} />} caption="Cycle">
      {summary ? (
        <View style={{ marginTop: spacing.xs }}>
          <Data>{`Week ${summary.currentWeek} of ${summary.totalWeeks}`}</Data>
          <View style={{ marginTop: spacing.sm }}>
            <PhaseBar segments={summary.segments} position={summary.position} />
          </View>
          <Small style={{ marginTop: spacing.sm }}>{`${summary.currentLabel} · ${Math.round(summary.position * 100)}%`}</Small>
        </View>
      ) : (
        <Small style={{ marginTop: spacing.xs }}>No active cycle</Small>
      )}
    </Tile>
  );
}

// ---------------------------------------------------------------------------
// Safety findings — reshapes the stack's already-computed `SafetyReport`
// (the same snapshot app/safety.tsx renders in full) into `SafetyFinding[]`
// for `SafetyTile`. Side effects and goal conflicts are left out: neither
// feeds `SafetyReport.blocking` (see src/engine/safety.ts), so they are
// documented properties / soft advice, not the kind of alert this face
// should ever lead with.
// ---------------------------------------------------------------------------

function peptideName(id: string): string {
  return getPeptide(id)?.name ?? id;
}

function buildSafetyFindings(report: SafetyReport): SafetyFinding[] {
  const findings: SafetyFinding[] = [];

  for (const c of report.contraindications) {
    findings.push({
      id: `contra-${c.peptideId}-${c.flag}`,
      severity: c.kind === 'absolute' ? 'critical' : 'high',
      label: `${peptideName(c.peptideId)} — ${HEALTH_FLAGS_BY_ID[c.flag]?.label ?? c.flag}`,
      detail: c.reason,
    });
  }

  for (const i of [...report.interactionsWithCurrent, ...report.interactions]) {
    findings.push({
      id: `int-${i.ruleId}-${i.peptideIds.join('-')}`,
      severity: i.severity,
      label: i.title,
      detail: `${i.peptideIds.map(peptideName).join(' + ')} — ${i.detail}`,
    });
  }

  for (const flag of report.redFlags) {
    findings.push({
      id: `flag-${flag.symptom}`,
      severity: 'critical',
      label: flag.symptom,
      detail: flag.action,
    });
  }

  for (const notice of report.notices) {
    findings.push({
      id: `notice-${notice.id}`,
      severity: notice.severity,
      label: notice.title,
      detail: notice.detail,
    });
  }

  return findings;
}

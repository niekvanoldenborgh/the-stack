import { Check, Clock, Minus, X } from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { getPeptide } from '../../src/domain/peptides';
import { severityBand } from '../../src/domain/sideEffects';
import type { PhaseKind, ScheduledDose } from '../../src/domain/types';
import {
  buildCyclePhases,
  cyclePlanProgressPct,
  generateSchedule,
  groupPhasesByPeptide,
  summariseCycle,
} from '../../src/engine/cycle';
import { formatDose } from '../../src/engine/dosing';
import {
  addDays,
  diffDays,
  formatLong,
  formatRange,
  startOfWeek,
  today,
  WEEKDAY_LABELS,
  weekdayIndex,
} from '../../src/lib/date';
import { useActiveStack, useAppStore } from '../../src/store/useAppStore';
import {
  Badge,
  Body,
  Callout,
  Caption,
  Data,
  Display,
  Divider,
  EmptyState,
  Row,
  Screen,
  Small,
  Spacer,
} from '../../src/ui/components';
import { routeLabel } from '../../src/ui/icons';
import { PhaseBar, type PhaseBarSegment } from '../../src/ui/nocturne';
import { Section } from '../../src/ui/primitives';
import { MetaChip, TimelineRow } from '../../src/ui/schedule';
import type { DayMarker } from '../../src/ui/schedule';
import { radius, spacing, useTheme, type SeverityTone } from '../../src/ui/theme';

/**
 * Calendar (page 4), redesigned THEA-40, retinted NOCTURNE.
 *
 * The timeline primitives (`TimelineRow`, `MetaChip`) are untouched — they
 * were already the "real timeline" this design language asks for. What
 * changed is the four separately-bordered `Card`s around them: the cycle
 * overview, the show/hide filters, the week strip and the selected day now
 * each sit in one borderless `Section` instead, so the screen reads as four
 * grouped decisions rather than four boxes stacked on top of a fifth (the
 * timeline itself).
 *
 * Three things share one timeline: injections you have already logged, the
 * injections still coming, and the side effects you have recorded. A week
 * selector scrubs between days; filters hide any of the three streams, and a
 * per-compound filter narrows the injection streams to one peptide at a time.
 * Filters, week strip and the selected day sit first — that is what a user
 * opens this tab to do (THEA-40 owner feedback: this screen is for "what's
 * happening", not reference material).
 *
 * Below the day-to-day, each compound's cycle is drawn with the shared
 * `PhaseBar` (`src/ui/nocturne.tsx`) — loading, fully on, rotating off — so
 * the shape of a plan that can run past new year is visible at a glance
 * rather than reconstructed from a list of dates. This replaces the screen's
 * former local `CyclePhaseBar`, which coloured phases by *type* using a
 * severity tone decoratively; `PhaseBar` colours by *state* (done / current /
 * upcoming) at one hue instead, per AGENTS.md's severity-scale reservation.
 *
 * Below that, "Cycle overview" lines every active compound up on one shared
 * week axis with a single current-week marker and a callout for whatever
 * changes next in the plan — `summariseCycle` already computes that "next
 * change" fact per compound, so the callout states a real number rather than
 * a guess.
 */

// ---------------------------------------------------------------------------
// Phase presentation
// ---------------------------------------------------------------------------

/**
 * Phase labels only — no colour. The old version of this file coloured
 * titration/on with `theme.tone('info')`/`theme.tone('accent')`, which reads
 * straight off `color.severity` for a non-severity fact (AGENTS.md: severity
 * colour is reserved for danger, never decorative). The phase name is stated
 * in text everywhere it appears instead.
 */
const PHASE_META: Record<PhaseKind, { label: string }> = {
  titration: { label: 'Loading' },
  on: { label: 'Fully on' },
  washout: { label: 'Rotating off' },
};

const SEVERITY_BAND_TONE: Record<'mild' | 'moderate' | 'severe', SeverityTone> = {
  mild: 'info',
  moderate: 'moderate',
  severe: 'high',
};

// ---------------------------------------------------------------------------
// Day events
// ---------------------------------------------------------------------------

type DoseStatus = 'taken' | 'skipped' | 'missed' | 'due';

const DOSE_STATUS_META: Record<DoseStatus, { label: string; tone: SeverityTone; dimmed: boolean }> = {
  taken: { label: 'Taken', tone: 'accent', dimmed: false },
  skipped: { label: 'Skipped', tone: 'moderate', dimmed: true },
  missed: { label: 'Missed', tone: 'high', dimmed: true },
  due: { label: 'Due', tone: 'info', dimmed: false },
};

/** Taken/due/missed/skipped are never colour-only — each also gets its own icon shape. */
const STATUS_ICON: Record<DoseStatus, typeof Check> = {
  taken: Check,
  due: Clock,
  missed: X,
  skipped: Minus,
};

interface DoseEvent {
  kind: 'dose';
  key: string;
  time: string;
  dose: ScheduledDose;
  status: DoseStatus;
  /** True for anything not yet done — drives the "hide upcoming" filter. */
  upcoming: boolean;
}

interface SideEffectEvent {
  kind: 'side-effect';
  key: string;
  time: string;
  label: string;
  /** Self-reported 1–10, see `severityBand` for the display bucketing. */
  severity: number;
  note?: string;
}

type CalEvent = DoseEvent | SideEffectEvent;

function classifyDose(dose: ScheduledDose, logged: 'taken' | 'skipped' | undefined, ref: string): DoseStatus {
  if (logged === 'taken') return 'taken';
  if (logged === 'skipped') return 'skipped';
  return diffDays(ref, dose.date) < 0 ? 'missed' : 'due';
}

export default function CalendarScreen() {
  const theme = useTheme();
  const { color, mode } = theme;
  // Dark reads emphasis as a glow (brand primary itself); light has no
  // visible glow, so emphasis is the same hue pushed darker instead. Shared
  // by the day strip's selected cell and the cycle overview's current-week
  // marker — see the identical rule in `src/ui/nocturne.tsx`.
  const emphasis = mode === 'dark' ? color.primary : color.primaryPressed;

  const stack = useActiveStack();
  const doseLogs = useAppStore((s) => s.doseLogs);
  const sideEffectLogs = useAppStore((s) => s.sideEffectLogs);

  const now = today();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now));
  const [selected, setSelected] = useState(now);

  // Filters. Each flag is "show this stream"; toggling it off hides the stream.
  const [showPast, setShowPast] = useState(true);
  const [showUpcoming, setShowUpcoming] = useState(true);
  const [showSideEffects, setShowSideEffects] = useState(true);
  const [hiddenPeptides, setHiddenPeptides] = useState<Set<string>>(() => new Set());

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // Schedule is generated for the visible week only — a full plan can be 60+
  // weeks across several compounds, and the timeline only ever shows one day.
  const weekDoses = useMemo(
    () => (stack ? generateSchedule(stack, weekStart, weekDates[6]!) : []),
    [stack, weekStart, weekDates],
  );

  const cyclePhases = useMemo(() => (stack ? buildCyclePhases(stack) : []), [stack]);

  const phasesByPeptide = useMemo(() => groupPhasesByPeptide(cyclePhases), [cyclePhases]);

  // Per-compound "what changes next" — same real fact the cycle-overview
  // callout states, computed once here.
  const cycleSummaries = useMemo(() => (stack ? summariseCycle(stack, now) : []), [stack, now]);

  if (!stack) {
    return (
      <Screen>
        <Display>Calendar</Display>
        <Spacer size={spacing.lg} />
        <EmptyState
          title="No active stack"
          body="Once you start a stack, your injections, upcoming doses and logged side effects will show up here."
          illustration="noStack"
        />
      </Screen>
    );
  }

  const stackPeptideIds = stack.items.map((item) => item.peptideId);

  /** Every visible event on a given date, sorted by time. */
  const eventsOn = (date: string): CalEvent[] => {
    const events: CalEvent[] = [];

    for (const dose of weekDoses) {
      if (dose.date !== date) continue;
      if (hiddenPeptides.has(dose.peptideId)) continue;
      const status = classifyDose(dose, doseLogs[dose.id]?.status, now);
      const upcoming = status === 'due';
      if (upcoming ? !showUpcoming : !showPast) continue;
      events.push({ kind: 'dose', key: dose.id, time: dose.time, dose, status, upcoming });
    }

    if (showSideEffects) {
      for (const log of sideEffectLogs) {
        if (log.date !== date) continue;
        // Side effects carry no time; sort them after the day's injections.
        events.push({
          kind: 'side-effect',
          key: log.id,
          time: '23:59',
          label: log.label,
          severity: log.severity,
          note: log.note,
        });
      }
    }

    return events.sort((a, b) => (a.time === b.time ? a.key.localeCompare(b.key) : a.time.localeCompare(b.time)));
  };

  const dayMarkers: DayMarker[] = weekDates.map((date) => {
    const events = eventsOn(date);
    const doseEvents = events.filter((e): e is DoseEvent => e.kind === 'dose');
    return {
      date,
      count: events.length,
      complete: doseEvents.length > 0 && doseEvents.every((e) => e.status !== 'due'),
    };
  });

  const selectedEvents = eventsOn(selected);

  const shiftWeek = (weeks: number) => {
    const nextStart = addDays(weekStart, weeks * 7);
    setWeekStart(nextStart);
    // Keep the same weekday selected as the user pages through weeks.
    setSelected(addDays(nextStart, weekdayIndex(selected)));
  };

  const togglePeptide = (id: string) => {
    setHiddenPeptides((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Cycle overview — every active compound on one shared week axis.
  //
  // `buildCyclePhases` starts every item's timeline on the same
  // `stack.startDate`, so the axis start never needs padding — only a
  // compound whose plan finishes early needs a trailing "Ended" segment to
  // keep every track's total width equal (that's what makes the bars line up
  // as one shared axis instead of each stretching to fill its own row).
  // -------------------------------------------------------------------------
  const axisStart = cyclePhases[0]?.startDate ?? null;
  const axisEnd =
    cyclePhases.length > 0
      ? cyclePhases.reduce((max, phase) => (phase.endDate > max ? phase.endDate : max), cyclePhases[0]!.endDate)
      : null;
  const axisTotalDays = axisStart && axisEnd ? diffDays(axisStart, axisEnd) + 1 : 0;
  const axisTotalWeeks = axisTotalDays > 0 ? Math.max(1, Math.ceil(axisTotalDays / 7)) : 0;
  const axisPosition =
    axisStart && axisTotalDays > 0 ? Math.max(0, Math.min(1, (diffDays(axisStart, now) + 1) / axisTotalDays)) : null;
  const currentWeekNumber =
    axisStart && axisTotalWeeks > 0
      ? Math.min(axisTotalWeeks, Math.max(1, Math.ceil((diffDays(axisStart, now) + 1) / 7)))
      : null;

  const overviewTracks =
    axisStart && axisEnd
      ? stackPeptideIds
          .map((id) => {
            const phases = phasesByPeptide.get(id);
            if (!phases || phases.length === 0) return null;
            const trackEnd = phases[phases.length - 1]!.endDate;
            const activeDays = Math.max(1, diffDays(axisStart, trackEnd) + 1);
            const segments: PhaseBarSegment[] = [{ key: 'active', label: 'Active', length: activeDays }];
            const remainingDays = diffDays(trackEnd, axisEnd);
            if (remainingDays > 0) {
              segments.push({ key: 'ended', label: 'Ended', length: remainingDays });
            }
            return { peptideId: id, name: getPeptide(id)?.name ?? id, segments };
          })
          .filter((track): track is { peptideId: string; name: string; segments: PhaseBarSegment[] } => track !== null)
      : [];

  const upcomingChanges = cycleSummaries.filter((s) => s.daysUntilChange !== null);
  const nextChange =
    upcomingChanges.length > 0
      ? upcomingChanges.reduce((soonest, s) => (s.daysUntilChange! < soonest.daysUntilChange! ? s : soonest))
      : null;

  return (
    <Screen>
      <Caption color={color.primary}>Schedule</Caption>
      <Display style={{ marginTop: spacing.sm }}>Calendar</Display>
      <Body muted style={{ marginTop: spacing.xs }}>
        {stack.name}
      </Body>
      <Spacer size={spacing.lg} />

      {/* Filters — first thing you see: what to look at before how the cycle's going. */}
      <Section title="Show" gap={spacing.sm}>
        <Row gap={spacing.xs} wrap>
          <FilterPill icon="checkmark-done" label="Injections" active={showPast} onPress={() => setShowPast((v) => !v)} />
          <FilterPill icon="time-outline" label="Upcoming" active={showUpcoming} onPress={() => setShowUpcoming((v) => !v)} />
          <FilterPill
            icon="pulse-outline"
            label="Side effects"
            active={showSideEffects}
            onPress={() => setShowSideEffects((v) => !v)}
          />
        </Row>
        {stackPeptideIds.length > 1 ? (
          <Row gap={spacing.xs} wrap>
            {stackPeptideIds.map((id) => (
              <FilterPill
                key={id}
                label={getPeptide(id)?.name ?? id}
                active={!hiddenPeptides.has(id)}
                onPress={() => togglePeptide(id)}
              />
            ))}
          </Row>
        ) : null}
      </Section>

      {/* Week strip — selected day + how many doses fall on each day. -------- */}
      <Section
        title={formatRange(weekDates[0]!, weekDates[6]!)}
        action={
          <Row gap={spacing.xs}>
            <StepArrow icon="chevron-back" label="Previous week" onPress={() => shiftWeek(-1)} />
            <StepArrow icon="chevron-forward" label="Next week" onPress={() => shiftWeek(1)} />
          </Row>
        }
      >
        <DayStrip days={dayMarkers} selected={selected} onSelect={setSelected} />
      </Section>

      {/* Selected day ------------------------------------------------------- */}
      <Section title={formatLong(selected)}>
        {selectedEvents.some((e) => e.kind === 'dose') ? <DoseStatusLegend /> : null}
        {selectedEvents.length === 0 ? (
          <Small style={{ textAlign: 'center' }}>Nothing on this day with the current filters.</Small>
        ) : (
          selectedEvents.map((event, index) =>
            event.kind === 'dose' ? (
              <DoseTimelineRow
                key={event.key}
                event={event}
                first={index === 0}
                last={index === selectedEvents.length - 1}
              />
            ) : (
              <SideEffectTimelineRow
                key={event.key}
                event={event}
                first={index === 0}
                last={index === selectedEvents.length - 1}
              />
            ),
          )
        )}
      </Section>

      {/* Per-compound cycle — loading / fully on / rotating off. ------------ */}
      <Section title="Stack cycle" gap={spacing.xl}>
        {stackPeptideIds.map((id, index) => {
          const phases = phasesByPeptide.get(id);
          if (!phases || phases.length === 0) return null;
          const pct = cyclePlanProgressPct(phases, now);
          const segments: PhaseBarSegment[] = phases.map((phase, i) => ({
            key: `${phase.kind}-${i}`,
            label: PHASE_META[phase.kind].label,
            length: Math.max(1, diffDays(phase.startDate, phase.endDate) + 1),
            detail: formatRange(phase.startDate, phase.endDate),
          }));
          return (
            <View key={id}>
              {index > 0 ? <Divider style={{ marginBottom: spacing.xl }} /> : null}
              <Body style={{ marginBottom: spacing.md }}>{getPeptide(id)?.name ?? id}</Body>
              <PhaseBar segments={segments} position={pct === null ? undefined : pct / 100} />
            </View>
          );
        })}
      </Section>

      {/* Cycle overview — every compound, one shared axis, one marker. ------ */}
      {overviewTracks.length > 0 ? (
        <Section
          title="Cycle overview"
          gap={spacing.lg}
          action={currentWeekNumber !== null ? <Caption color={emphasis}>{`Week ${currentWeekNumber} of ${axisTotalWeeks}`}</Caption> : undefined}
          last
        >
          <View style={{ position: 'relative', gap: spacing.lg }}>
            {overviewTracks.map((track) => (
              <View key={track.peptideId}>
                <Data small color={color.textPrimary} style={{ marginBottom: spacing.sm }}>
                  {track.name}
                </Data>
                <PhaseBar segments={track.segments} position={axisPosition ?? undefined} />
              </View>
            ))}
            {/* One shared current-week marker across every track, not one per row. */}
            {axisPosition !== null ? (
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${axisPosition * 100}%`,
                  width: 2,
                  marginLeft: -1,
                  borderRadius: 1,
                  backgroundColor: emphasis,
                }}
              />
            ) : null}
          </View>

          <Row justify="space-between">
            <Small>Week 1</Small>
            <Small>{`Week ${axisTotalWeeks}`}</Small>
          </Row>

          {nextChange ? (
            <Callout tone="accent" title={`Next: ${nextChange.nextChangeLabel}`}>
              {`${nextChange.name} · in ${nextChange.daysUntilChange} day${nextChange.daysUntilChange === 1 ? '' : 's'}`}
            </Callout>
          ) : (
            <Small>Every compound in this stack has finished its planned cycle.</Small>
          )}
        </Section>
      ) : null}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Week strip
// ---------------------------------------------------------------------------

/**
 * Local, not the shared `WeekStrip` (`src/ui/schedule.tsx`): that component's
 * per-day marker is a plain presence dot, not a count, and this screen needs
 * an actual "how many doses" figure per day. Selection/date logic is
 * untouched — only the per-day visual is new.
 */
function DayStrip({ days, selected, onSelect }: { days: DayMarker[]; selected: string; onSelect: (date: string) => void }) {
  const theme = useTheme();
  const { color, mode } = theme;
  const emphasis = mode === 'dark' ? color.primary : color.primaryPressed;

  return (
    <Row gap={spacing.xs} justify="space-between">
      {days.map((day) => {
        const isSelected = day.date === selected;
        const dayNumber = Number(day.date.slice(8, 10));
        return (
          <Pressable
            key={day.date}
            onPress={() => onSelect(day.date)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${WEEKDAY_LABELS[weekdayIndex(day.date)]} ${dayNumber}, ${day.count} dose${day.count === 1 ? '' : 's'}`}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              paddingVertical: spacing.sm,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: isSelected ? emphasis : 'transparent',
              backgroundColor: isSelected ? color.primarySoft : 'transparent',
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Caption color={color.textTertiary}>{WEEKDAY_LABELS[weekdayIndex(day.date)]}</Caption>
            <Data color={isSelected ? emphasis : color.textPrimary} style={{ fontSize: 17 }}>
              {dayNumber}
            </Data>
            {/* Density indicator — the real per-day dose count, not a plain dot. */}
            {day.count > 0 ? (
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: emphasis,
                }}
              >
                <Data small color={color.background} style={{ fontSize: 10 }}>
                  {day.count}
                </Data>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Dose status legend — icon + label per state, colour is never the only cue.
// ---------------------------------------------------------------------------

const LEGEND_ORDER: DoseStatus[] = ['taken', 'due', 'missed', 'skipped'];

function DoseStatusLegend() {
  const theme = useTheme();
  return (
    <Row gap={spacing.md} wrap style={{ marginBottom: spacing.md }}>
      {LEGEND_ORDER.map((status) => {
        const meta = DOSE_STATUS_META[status];
        const Icon = STATUS_ICON[status];
        return (
          <Row key={status} gap={spacing.xs} align="center">
            <Icon size={13} color={theme.tone(meta.tone).fg} />
            <Small>{meta.label}</Small>
          </Row>
        );
      })}
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Timeline rows
// ---------------------------------------------------------------------------

// TODO(nocturne): the mockup's timeline row shows an injection *site* per
// dose. `ScheduledDose` carries no site — sites are only recorded on
// `InjectionLog` entries (`src/domain/types.ts`), which have no
// `scheduledDoseId` back-reference, so a scheduled dose here can't be
// reliably matched to the site the user actually used for it. `route` is
// shown instead — it's known ahead of time and never invented. Wiring a real
// site would need that back-reference added to `InjectionLog` or `DoseLog`.
function DoseTimelineRow({ event, first, last }: { event: DoseEvent; first: boolean; last: boolean }) {
  const theme = useTheme();
  const { color } = theme;
  const peptide = getPeptide(event.dose.peptideId);
  const meta = DOSE_STATUS_META[event.status];
  const StatusIcon = STATUS_ICON[event.status];
  return (
    <TimelineRow time={event.time} tone={meta.tone} first={first} last={last} dimmed={meta.dimmed}>
      <Row justify="space-between" align="flex-start">
        <View style={{ flex: 1 }}>
          <Body>{peptide?.name ?? event.dose.peptideId}</Body>
          <Row gap={spacing.xs} align="center" wrap style={{ marginTop: spacing.xs }}>
            <Data small color={color.textSecondary}>
              {formatDose(event.dose.dose)} · {routeLabel(event.dose.route)}
            </Data>
            <MetaChip icon="repeat" label={PHASE_META[event.dose.phase].label} />
          </Row>
        </View>
        <Row gap={spacing.xs} align="center">
          <StatusIcon size={14} color={theme.tone(meta.tone).fg} />
          <Badge label={meta.label} tone={meta.tone} />
        </Row>
      </Row>
    </TimelineRow>
  );
}

function SideEffectTimelineRow({ event, first, last }: { event: SideEffectEvent; first: boolean; last: boolean }) {
  const tone = SEVERITY_BAND_TONE[severityBand(event.severity)];
  return (
    <TimelineRow time="" tone={tone} first={first} last={last}>
      <Row justify="space-between" align="flex-start">
        <View style={{ flex: 1 }}>
          <Body>{event.label}</Body>
          {event.note ? <Small style={{ marginTop: 2 }}>{event.note}</Small> : null}
        </View>
        <Badge label={`${event.severity}/10`} tone={tone} />
      </Row>
    </TimelineRow>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

function FilterPill({
  icon,
  label,
  active,
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${active ? 'Hide' : 'Show'} ${label}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: active ? color.primary : color.border,
        backgroundColor: active ? color.primarySoft : color.surfaceMuted,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={12} color={active ? color.primary : color.textTertiary} /> : null}
      <Small muted={false} style={{ color: active ? color.primary : color.textSecondary }}>
        {label}
      </Small>
    </Pressable>
  );
}

function StepArrow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: color.border,
        backgroundColor: color.surfaceMuted,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={16} color={color.textSecondary} />
    </Pressable>
  );
}

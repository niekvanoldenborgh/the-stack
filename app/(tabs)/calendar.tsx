import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { getPeptide } from '../../src/domain/peptides';
import { severityBand } from '../../src/domain/sideEffects';
import type { PhaseKind, ScheduledDose } from '../../src/domain/types';
import { buildCyclePhases, generateSchedule, groupPhasesByPeptide } from '../../src/engine/cycle';
import { formatDose } from '../../src/engine/dosing';
import {
  addDays,
  diffDays,
  formatLong,
  formatRange,
  startOfWeek,
  today,
  weekdayIndex,
} from '../../src/lib/date';
import { useActiveStack, useAppStore } from '../../src/store/useAppStore';
import {
  Badge,
  Body,
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
import { Section } from '../../src/ui/primitives';
import { MetaChip, TimelineRow, WeekStrip } from '../../src/ui/schedule';
import type { DayMarker } from '../../src/ui/schedule';
import { radius, spacing, useTheme, type SeverityTone } from '../../src/ui/theme';

/**
 * Calendar (page 4), redesigned THEA-40.
 *
 * The timeline primitives (`WeekStrip`, `TimelineRow`, `MetaChip`) are
 * untouched — they were already the "real timeline" this design language
 * asks for. What changed is the four separately-bordered `Card`s around
 * them: the cycle overview, the show/hide filters, the week strip and the
 * selected day now each sit in one borderless `Section` instead, so the
 * screen reads as four grouped decisions rather than four boxes stacked on
 * top of a fifth (the timeline itself).
 *
 * Three things share one timeline: injections you have already logged, the
 * injections still coming, and the side effects you have recorded. A week
 * selector scrubs between days; filters hide any of the three streams, and a
 * per-compound filter narrows the injection streams to one peptide at a time.
 * Filters, week strip and the selected day sit first — that is what a user
 * opens this tab to do (THEA-40 owner feedback: this screen is for "what's
 * happening", not reference material).
 *
 * Below the day-to-day, each compound's cycle is drawn as a phase bar —
 * loading, fully on, rotating off — so the shape of a plan that can run past
 * new year is visible at a glance rather than reconstructed from a list of
 * dates. A per-peptide progress bar with the same "how far through" figure
 * also lives on Summary, next to the current stack (`app/(tabs)/index.tsx`).
 */

// ---------------------------------------------------------------------------
// Phase presentation
// ---------------------------------------------------------------------------

/**
 * Phase colours are chosen to read as loading → on → off without borrowing the
 * severity scale: info for the ramp, the brand accent for full strength, a
 * muted ink for the washout. Each segment also carries a label, so the
 * meaning never rests on colour alone. `tone` is resolved to an actual colour
 * via `theme.tone(...)` at render time (washout has no tone — it falls back
 * to `textTertiary`), since tone resolution now depends on the live theme.
 */
const PHASE_META: Record<PhaseKind, { label: string; tone?: SeverityTone }> = {
  titration: { label: 'Loading', tone: 'info' },
  on: { label: 'Fully on', tone: 'accent' },
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
  const { color } = useTheme();
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

      {/* Week strip --------------------------------------------------------- */}
      <Section
        title={formatRange(weekDates[0]!, weekDates[6]!)}
        action={
          <Row gap={spacing.xs}>
            <StepArrow icon="chevron-back" label="Previous week" onPress={() => shiftWeek(-1)} />
            <StepArrow icon="chevron-forward" label="Next week" onPress={() => shiftWeek(1)} />
          </Row>
        }
      >
        <WeekStrip days={dayMarkers} selected={selected} onSelect={setSelected} />
      </Section>

      {/* Selected day ------------------------------------------------------- */}
      <Section title={formatLong(selected)}>
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

      {/* Cycle overview — reference material, so it sits below the day-to-day. */}
      <Section title="Stack cycle" gap={spacing.xl} last>
        {stackPeptideIds.map((id, index) => {
          const phases = phasesByPeptide.get(id);
          if (!phases || phases.length === 0) return null;
          return (
            <View key={id}>
              {index > 0 ? <Divider style={{ marginBottom: spacing.xl }} /> : null}
              <CyclePhaseBar name={getPeptide(id)?.name ?? id} phases={phases} />
            </View>
          );
        })}
      </Section>
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Cycle phase bar
// ---------------------------------------------------------------------------

function CyclePhaseBar({ name, phases }: { name: string; phases: ReturnType<typeof buildCyclePhases> }) {
  const theme = useTheme();
  const { color } = theme;
  const phaseColor = (kind: PhaseKind) => {
    const tone = PHASE_META[kind].tone;
    return tone ? theme.tone(tone).fg : color.textTertiary;
  };

  return (
    <View>
      <Body style={{ marginBottom: spacing.sm }}>{name}</Body>

      {/* Proportional bar: segment width follows phase length in days. */}
      <Row gap={2} style={{ height: 10 }}>
        {phases.map((phase, index) => {
          const days = Math.max(1, diffDays(phase.startDate, phase.endDate) + 1);
          return (
            <View
              key={`${phase.kind}-${index}`}
              style={{
                flexGrow: days,
                flexBasis: 0,
                borderRadius: radius.sm,
                backgroundColor: phaseColor(phase.kind),
                opacity: phase.kind === 'washout' ? 0.5 : 1,
              }}
            />
          );
        })}
      </Row>

      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {phases.map((phase, index) => {
          const meta = PHASE_META[phase.kind];
          return (
            <Row key={`row-${phase.kind}-${index}`} gap={spacing.sm} align="center">
              <View
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  backgroundColor: phaseColor(phase.kind),
                  opacity: phase.kind === 'washout' ? 0.6 : 1,
                }}
              />
              <Data small color={color.textPrimary} style={{ width: 92 }}>
                {meta.label}
              </Data>
              <Small style={{ flex: 1 }}>{formatRange(phase.startDate, phase.endDate)}</Small>
            </Row>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Timeline rows
// ---------------------------------------------------------------------------

function DoseTimelineRow({ event, first, last }: { event: DoseEvent; first: boolean; last: boolean }) {
  const theme = useTheme();
  const peptide = getPeptide(event.dose.peptideId);
  const meta = DOSE_STATUS_META[event.status];
  return (
    <TimelineRow time={event.time} tone={meta.tone} first={first} last={last} dimmed={meta.dimmed}>
      <Row justify="space-between" align="flex-start">
        <View style={{ flex: 1 }}>
          <Body>{peptide?.name ?? event.dose.peptideId}</Body>
          <Row gap={spacing.xs} align="center" style={{ marginTop: spacing.xs }}>
            <Data small color={theme.color.textSecondary}>
              {formatDose(event.dose.dose)}
            </Data>
            <MetaChip
              icon="repeat"
              label={PHASE_META[event.dose.phase].label}
              tone={PHASE_META[event.dose.phase].tone}
            />
          </Row>
        </View>
        <Badge label={meta.label} tone={meta.tone} />
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

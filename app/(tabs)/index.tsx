import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { getPeptide } from '../../src/domain/peptides';
import type { ScheduledDose } from '../../src/domain/types';
import { TIME_OF_DAY_LABELS, generateSchedule, summariseCycle } from '../../src/engine/cycle';
import { formatDose } from '../../src/engine/dosing';
import { riskBand } from '../../src/engine/safety';
import { getPermissionState, requestPermission, syncReminders } from '../../src/lib/notifications';
import { addDays, formatLong, relativeLabel, today } from '../../src/lib/date';
import { selectAdherence, useActiveStack, useAppStore } from '../../src/store/useAppStore';
import {
  Badge,
  Body,
  Button,
  Callout,
  Caption,
  Card,
  Data,
  Display,
  EmptyState,
  Heading,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
  StatTile,
  Title,
} from '../../src/ui/components';
import { routeLabel } from '../../src/ui/icons';
import { Reveal } from '../../src/ui/motion';
import { IconAction, MetaChip, TimelineRow, WeekStrip } from '../../src/ui/schedule';
import { colors, spacing } from '../../src/ui/theme';

export default function TodayScreen() {
  const router = useRouter();
  const stack = useActiveStack();
  const profile = useAppStore((s) => s.profile);
  const doseLogs = useAppStore((s) => s.doseLogs);
  const logDose = useAppStore((s) => s.logDose);
  const clearDoseLog = useAppStore((s) => s.clearDoseLog);
  const program = useAppStore((s) => s.program);
  const remindersEnabled = useAppStore((s) => s.settings.remindersEnabled);
  const setSetting = useAppStore((s) => s.setSetting);

  const [permission, setPermission] = useState<string>('undetermined');
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const date = today();
  // The week strip lets you look back at what was missed and forward at what is
  // coming without leaving the dashboard, so "today" is a selection, not a fact.
  const [selectedDate, setSelectedDate] = useState(date);

  const weekDays = useMemo(() => {
    const start = addDays(date, -3);
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(start, i);
      const doses = stack ? generateSchedule(stack, day, day) : [];
      const logged = doses.filter((d) => doseLogs[d.id]).length;
      return { date: day, count: doses.length, complete: doses.length > 0 && logged === doses.length };
    });
  }, [stack, date, doseLogs]);

  const visibleDoses = useMemo(
    () => (stack ? generateSchedule(stack, selectedDate, selectedDate) : []),
    [stack, selectedDate],
  );
  // Always today, regardless of which day the strip has selected — the tile
  // reads "Doses today", so it must not follow the selection.
  const todaysDoses = useMemo(() => (stack ? generateSchedule(stack, date, date) : []), [stack, date]);
  const upcoming = useMemo(() => (stack ? generateSchedule(stack, date, addDays(date, 21)) : []), [stack, date]);
  const cycleStatus = useMemo(() => (stack ? summariseCycle(stack, date) : []), [stack, date]);
  const adherence = useMemo(
    () => selectAdherence(stack ? generateSchedule(stack, addDays(date, -13), date) : [], doseLogs),
    [stack, date, doseLogs],
  );

  useEffect(() => {
    void getPermissionState().then(setPermission);
  }, []);

  // Keep the rolling notification window in step with the plan.
  useEffect(() => {
    if (!remindersEnabled || upcoming.length === 0) return;
    void syncReminders(upcoming).then((result) => {
      setSyncNote(
        result.scheduled > 0
          ? `${result.scheduled} reminders scheduled${result.truncated ? ' (rolling window — more are added as these pass)' : ''}`
          : null,
      );
    });
  }, [remindersEnabled, upcoming]);

  const enableReminders = async () => {
    const state = await requestPermission();
    setPermission(state);
    if (state === 'granted') setSetting('remindersEnabled', true);
  };

  const todaysSession = program?.sessions.find((s) => {
    const jsDay = new Date().getDay();
    return s.dayIndex === (jsDay + 6) % 7;
  });

  if (!profile) {
    return (
      <Screen>
        <Spacer size={spacing.xl} />
        <EmptyState title="No profile yet" body="Complete onboarding to build your stack." />
      </Screen>
    );
  }

  const band = stack ? riskBand(stack.safety.riskScore) : null;

  return (
    <Screen>
      <Spacer size={spacing.lg} />
      <Caption color={colors.textMuted}>{formatLong(date)}</Caption>
      <Display style={{ marginTop: spacing.xs }}>Today</Display>

      {!stack ? (
        <View style={{ marginTop: spacing.xl }}>
          <EmptyState
            title="No active stack"
            body="Generate one from your profile, or build your own in the stack builder."
            action={<Button label="Go to Stack" onPress={() => router.push('/(tabs)/stack')} />}
          />
        </View>
      ) : (
        <View>
          <Spacer size={spacing.lg} />
          <Row gap={spacing.sm}>
            <StatTile
              label="Doses today"
              value={`${todaysDoses.filter((d) => doseLogs[d.id]?.status === 'taken').length}/${todaysDoses.length}`}
            />
            <StatTile label="14-day adherence" value={`${adherence.pct}%`} hint={`${adherence.taken} taken`} />
            <StatTile
              label="Risk"
              value={`${stack.safety.riskScore}`}
              hint={band?.label}
              tone={band?.tone === 'severe' ? 'critical' : band?.tone === 'low' ? 'accent' : band?.tone}
            />
          </Row>

          {stack.safety.blocking ? (
            <View style={{ marginTop: spacing.lg }}>
              <Callout tone="critical" title="This stack has a blocking safety finding">
                <Small muted={false} style={{ color: colors.text }}>
                  Something in here is contraindicated for you or is a critical interaction. Open the safety report
                  before you take anything.
                </Small>
                <Spacer size={spacing.md} />
                <Button label="Open safety report" variant="danger" onPress={() => router.push('/safety')} />
              </Callout>
            </View>
          ) : null}

          {!remindersEnabled ? (
            <View style={{ marginTop: spacing.lg }}>
              <Callout tone="info" title="Reminders are off">
                <Small muted={false} style={{ color: colors.text }}>
                  {permission === 'denied'
                    ? 'Notifications are blocked for this app. Enable them in your system settings to get dose alarms.'
                    : 'Turn on notifications and every dose in your plan gets an alarm at the right time, with the amount and route in the alert.'}
                </Small>
                {permission !== 'denied' ? (
                  <>
                    <Spacer size={spacing.md} />
                    <Button label="Enable dose reminders" onPress={enableReminders} />
                  </>
                ) : null}
              </Callout>
            </View>
          ) : syncNote ? (
            <Small style={{ marginTop: spacing.md }}>🔔 {syncNote}</Small>
          ) : null}

          <SectionTitle>Schedule</SectionTitle>
          <Reveal index={2}>
            <WeekStrip days={weekDays} selected={selectedDate} onSelect={setSelectedDate} />
            <Spacer size={spacing.lg} />
            <Row justify="space-between" style={{ marginBottom: spacing.md }}>
              <Caption color={colors.textMuted}>{relativeLabel(selectedDate)}</Caption>
              <Caption color={colors.textFaint}>
                {visibleDoses.length} dose{visibleDoses.length === 1 ? '' : 's'}
              </Caption>
            </Row>
          </Reveal>

          {visibleDoses.length === 0 ? (
            <Card>
              <Heading>Nothing scheduled</Heading>
              <Small style={{ marginTop: spacing.xs }}>
                {cycleStatus.every((c) => c.phase === 'washout')
                  ? 'Every compound in your stack is in its washout period. That is the plan working, not a gap in it.'
                  : `No doses fall on ${relativeLabel(selectedDate).toLowerCase()} in your schedule.`}
              </Small>
            </Card>
          ) : (
            visibleDoses.map((dose, index) => (
              <Reveal key={dose.id} index={index + 3}>
                <TimelineRow
                  time={dose.time}
                  first={index === 0}
                  last={index === visibleDoses.length - 1}
                  tone={doseLogs[dose.id]?.status === 'skipped' ? 'moderate' : 'accent'}
                  dimmed={Boolean(doseLogs[dose.id])}
                >
                  <DoseRow
                    dose={dose}
                    status={doseLogs[dose.id]?.status ?? null}
                    onTake={() => logDose(dose, 'taken')}
                    onSkip={() => logDose(dose, 'skipped')}
                    onClear={() => clearDoseLog(dose.id)}
                    onOpen={() => router.push(`/peptide/${dose.peptideId}`)}
                  />
                </TimelineRow>
              </Reveal>
            ))
          )}

          <SectionTitle>Cycle status</SectionTitle>
          {cycleStatus.map((status) => (
            <Card key={status.peptideId} style={{ marginBottom: spacing.sm }}>
              <Row justify="space-between">
                <Heading>{status.name}</Heading>
                <Badge
                  label={
                    status.phase === 'titration'
                      ? 'Titrating'
                      : status.phase === 'on'
                        ? 'On'
                        : status.phase === 'washout'
                          ? 'Washout'
                          : 'Ended'
                  }
                  tone={status.phase === 'washout' ? 'moderate' : status.phase === 'ended' ? 'info' : 'accent'}
                />
              </Row>
              {status.daysUntilChange !== null ? (
                <Small style={{ marginTop: spacing.xs }}>
                  {status.nextChangeLabel} in {status.daysUntilChange} day
                  {status.daysUntilChange === 1 ? '' : 's'}
                </Small>
              ) : (
                <Small style={{ marginTop: spacing.xs }}>{status.nextChangeLabel}</Small>
              )}
            </Card>
          ))}

          {stack.safety.redFlags.length > 0 ? (
            <>
              <SectionTitle>Know when to stop</SectionTitle>
              <Card tone="critical">
                <Caption color={colors.critical}>Seek medical care if you notice</Caption>
                <Spacer size={spacing.sm} />
                {stack.safety.redFlags.slice(0, 4).map((flag) => (
                  <View key={flag.symptom} style={{ marginBottom: spacing.md }}>
                    <Body>{flag.symptom}</Body>
                    <Small style={{ marginTop: 2 }}>{flag.action}</Small>
                  </View>
                ))}
                <Pressable onPress={() => router.push('/safety')} accessibilityRole="button">
                  <Small muted={false} style={{ color: colors.accent }}>
                    See the full safety report →
                  </Small>
                </Pressable>
              </Card>
            </>
          ) : null}
        </View>
      )}

      <SectionTitle>Training</SectionTitle>
      {todaysSession ? (
        <Card>
          <Row justify="space-between">
            <View style={{ flex: 1 }}>
              <Title>{todaysSession.name}</Title>
              <Small style={{ marginTop: 2 }}>
                {todaysSession.exercises.length} exercises · about {todaysSession.estimatedMinutes} min
              </Small>
            </View>
            <Badge label="Today" tone="accent" />
          </Row>
          <Spacer size={spacing.md} />
          <Button label="Start session" onPress={() => router.push(`/session/${todaysSession.id}`)} />
        </Card>
      ) : program ? (
        <Card>
          <Heading>Rest day</Heading>
          <Small style={{ marginTop: spacing.xs }}>
            No session scheduled. Recovery is when the adaptation actually happens — walking and sleep beat an
            unplanned extra workout.
          </Small>
        </Card>
      ) : (
        <EmptyState
          title="No programme yet"
          body="Generate a training programme built around your goals and your stack."
          action={<Button label="Go to Train" onPress={() => router.push('/(tabs)/train')} />}
        />
      )}

      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

function DoseRow({
  dose,
  status,
  onTake,
  onSkip,
  onClear,
  onOpen,
}: {
  dose: ScheduledDose;
  status: 'taken' | 'skipped' | null;
  onTake: () => void;
  onSkip: () => void;
  onClear: () => void;
  onOpen: () => void;
}) {
  const peptide = getPeptide(dose.peptideId);
  const done = status === 'taken';
  const skipped = status === 'skipped';

  return (
    <Card
      style={{
        marginBottom: spacing.sm,
        opacity: done || skipped ? 0.65 : 1,
        borderColor: done ? colors.accent : skipped ? colors.moderate : colors.border,
      }}
    >
      <Pressable onPress={onOpen} accessibilityRole="button">
        <Row justify="space-between" align="flex-start">
          <View style={{ flex: 1 }}>
            <Title>{peptide?.name ?? dose.peptideId}</Title>
            <Row gap={spacing.xs} align="baseline" style={{ marginTop: spacing.sm }}>
              <Data color={colors.accent} style={{ fontSize: 20 }}>
                {formatDose(dose.dose)}
              </Data>
            </Row>
          </View>
          {dose.phase === 'titration' ? <Badge label="Ramp" tone="moderate" /> : null}
        </Row>

        {/* Metadata as chips rather than a run-on grey sentence — each fact is
            separately scannable, which is the point on a dose list. */}
        <Row gap={spacing.xs} wrap style={{ marginTop: spacing.md }}>
          <MetaChip icon="time-outline" label={TIME_OF_DAY_LABELS[dose.timeOfDay]} />
          <MetaChip icon="navigate-outline" label={routeLabel(dose.route)} />
          {dose.phase === 'titration' ? (
            <MetaChip icon="trending-up" label="Titration dose" tone="moderate" />
          ) : null}
        </Row>
      </Pressable>

      <Spacer size={spacing.md} />
      {status ? (
        <Row justify="space-between">
          <Row gap={spacing.xs}>
            <Ionicons
              name={done ? 'checkmark-circle' : 'close-circle'}
              size={15}
              color={done ? colors.accent : colors.moderate}
            />
            <Small muted={false} style={{ color: done ? colors.accent : colors.moderate }}>
              {done ? 'Taken' : 'Skipped'}
            </Small>
          </Row>
          <Pressable onPress={onClear} accessibilityRole="button" hitSlop={8}>
            <Small muted={false} style={{ color: colors.textMuted }}>
              Undo
            </Small>
          </Pressable>
        </Row>
      ) : (
        <Row gap={spacing.sm}>
          <Button label="Log as taken" onPress={onTake} style={{ flex: 1 }} />
          <IconAction icon="close" onPress={onSkip} tone="moderate" label="Skip this dose" />
        </Row>
      )}
    </Card>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { getExercise } from '../../src/domain/exercises';
import type { PlannedSession } from '../../src/domain/types';
import { progressByExercise, sessionVolume } from '../../src/engine/workout';
import { WEEKDAY_LABELS, formatShort } from '../../src/lib/date';
import { useAppStore } from '../../src/store/useAppStore';
import {
  Badge,
  Body,
  Button,
  Callout,
  Caption,
  Card,
  Display,
  Divider,
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
import { colors, fonts, spacing } from '../../src/ui/theme';

export default function TrainScreen() {
  const router = useRouter();
  const program = useAppStore((s) => s.program);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const createProgram = useAppStore((s) => s.createProgram);
  const profile = useAppStore((s) => s.profile);

  const progress = useMemo(() => progressByExercise(workoutLogs).slice(0, 6), [workoutLogs]);
  const weekVolume = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const iso = cutoff.toISOString().slice(0, 10);
    return workoutLogs.filter((l) => l.date >= iso).reduce((sum, l) => sum + sessionVolume(l), 0);
  }, [workoutLogs]);

  if (!profile) {
    return (
      <Screen>
        <Spacer size={spacing.xl} />
        <EmptyState title="No profile" body="Complete onboarding first." />
      </Screen>
    );
  }

  if (!program) {
    return (
      <Screen>
        <Spacer size={spacing.lg} />
        <Display>Train</Display>
        <Spacer size={spacing.xl} />
        <EmptyState
          title="No programme yet"
          body="Generate a programme built around your goals, your recovery capacity and what is in your stack."
          action={<Button label="Generate programme" onPress={() => createProgram()} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Spacer size={spacing.lg} />
      <Caption color={colors.textMuted}>{program.split}</Caption>
      <Display style={{ marginTop: spacing.xs }}>Train</Display>

      <Spacer size={spacing.lg} />
      <Row gap={spacing.sm}>
        <StatTile label="Days / week" value={`${program.daysPerWeek}`} />
        <StatTile label="Sessions logged" value={`${workoutLogs.length}`} />
        <StatTile label="7-day volume" value={`${Math.round(weekVolume / 1000)}k`} hint="kg lifted" />
      </Row>

      <Spacer size={spacing.md} />
      <Pressable onPress={() => router.push('/analytics')} accessibilityRole="button">
        <Card>
          <Row justify="space-between">
            <Row gap={spacing.md} style={{ flex: 1 }}>
              <Ionicons name="stats-chart" size={20} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Heading>Analytics</Heading>
                <Small style={{ marginTop: 2 }}>
                  Volume, strength trend, sets per muscle, adherence and side effects over time.
                </Small>
              </View>
            </Row>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Row>
        </Card>
      </Pressable>

      <SectionTitle>Why this programme</SectionTitle>
      <Card>
        {program.rationale.map((reason, index) => (
          <Row key={index} gap={spacing.sm} align="flex-start" style={{ marginBottom: spacing.md }}>
            <Small muted={false} style={{ color: colors.accent }}>
              ·
            </Small>
            <Small style={{ flex: 1 }}>{reason}</Small>
          </Row>
        ))}
      </Card>

      <SectionTitle>Your week</SectionTitle>
      {program.sessions.map((session) => (
        <SessionCard key={session.id} session={session} onPress={() => router.push(`/session/${session.id}`)} />
      ))}

      <Callout tone="info" title={`Deload every ${program.deloadEveryWeeks} weeks`}>
        <Small muted={false} style={{ color: colors.text }}>
          Same exercises, half the sets, stop about 4 reps short of failure. A deload is not lost time — it is when
          the accumulated fatigue clears and the adaptation actually shows up.
        </Small>
      </Callout>

      {progress.length > 0 ? (
        <>
          <SectionTitle>Progress</SectionTitle>
          <Card>
            {progress.map((entry, index) => (
              <View key={entry.exerciseId}>
                {index > 0 ? <Divider /> : null}
                <Row justify="space-between" align="flex-start">
                  <View style={{ flex: 1 }}>
                    <Body>{entry.name}</Body>
                    <Small style={{ marginTop: 2 }}>
                      {entry.sessions} session{entry.sessions === 1 ? '' : 's'} · best estimated max{' '}
                      {entry.bestEstimatedMax} kg
                    </Small>
                  </View>
                  {entry.trendPct !== null ? (
                    <Badge
                      label={`${entry.trendPct > 0 ? '+' : ''}${entry.trendPct}%`}
                      tone={entry.trendPct > 0 ? 'accent' : entry.trendPct < 0 ? 'moderate' : 'info'}
                    />
                  ) : null}
                </Row>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {workoutLogs.length > 0 ? (
        <>
          <SectionTitle>Recent sessions</SectionTitle>
          {workoutLogs.slice(0, 5).map((log) => (
            <Card key={log.id} style={{ marginBottom: spacing.sm }}>
              <Row justify="space-between">
                <View style={{ flex: 1 }}>
                  <Body style={{ fontFamily: fonts.sansMedium }}>
                    {program.sessions.find((s) => s.id === log.sessionId)?.name ?? 'Session'}
                  </Body>
                  <Small style={{ marginTop: 2 }}>
                    {formatShort(log.date)} · {log.exercises.length} exercises ·{' '}
                    {Math.round(sessionVolume(log))} kg total volume
                  </Small>
                </View>
              </Row>
            </Card>
          ))}
        </>
      ) : null}

      <SectionTitle>Actions</SectionTitle>
      <Button label="Regenerate programme" variant="secondary" onPress={() => createProgram()} />
      <Small style={{ marginTop: spacing.sm }}>
        Rebuilds from your current profile and stack. Your logged sessions are kept.
      </Small>

      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

function SessionCard({ session, onPress }: { session: PlannedSession; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card>
        <Row justify="space-between" align="flex-start">
          <View style={{ flex: 1 }}>
            <Caption color={colors.accent}>{WEEKDAY_LABELS[session.dayIndex]}</Caption>
            <Title style={{ marginTop: spacing.xs }}>{session.name}</Title>
            <Small style={{ marginTop: 2 }}>
              {session.exercises.length} exercises · about {session.estimatedMinutes} min
            </Small>
          </View>
          <Small muted={false} style={{ color: colors.accent }}>
            Open →
          </Small>
        </Row>

        <Divider />
        {session.exercises.slice(0, 4).map((planned) => {
          const exercise = getExercise(planned.exerciseId);
          if (!exercise) return null;
          const first = planned.sets[0];
          return (
            <Row key={planned.exerciseId} justify="space-between" style={{ marginBottom: spacing.xs }}>
              <Small muted={false} style={{ flex: 1 }}>
                {exercise.name}
              </Small>
              <Small>
                {planned.sets.length} × {first?.reps ?? 0}
                {first ? ` @ RIR ${first.rir}` : ''}
              </Small>
            </Row>
          );
        })}
        {session.exercises.length > 4 ? (
          <Small style={{ marginTop: spacing.xs }}>+ {session.exercises.length - 4} more</Small>
        ) : null}

        {session.adjustments.length > 0 ? (
          <>
            <Divider />
            {session.adjustments.map((adjustment, index) => (
              <Small key={index} style={{ color: colors.moderate, marginBottom: spacing.xs }}>
                {adjustment}
              </Small>
            ))}
          </>
        ) : null}
      </Card>
    </Pressable>
  );
}

import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { getExercise } from '../../src/domain/exercises';
import type { LoggedExercise, LoggedSet, PlannedExercise } from '../../src/domain/types';
import { suggestNextLoad } from '../../src/engine/workout';
import { today } from '../../src/lib/date';
import { useAppStore } from '../../src/store/useAppStore';
import {
  Body,
  Button,
  Callout,
  Caption,
  Card,
  Display,
  Divider,
  Heading,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
  Title,
} from '../../src/ui/components';
import { colors, radius, spacing, typography } from '../../src/ui/theme';

type Draft = Record<string, LoggedSet[]>;

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();

  const program = useAppStore((s) => s.program);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const logWorkout = useAppStore((s) => s.logWorkout);

  const session = program?.sessions.find((s) => s.id === String(id));

  const [draft, setDraft] = useState<Draft>(() => {
    const initial: Draft = {};
    session?.exercises.forEach((planned) => {
      initial[planned.exerciseId] = planned.sets.map(() => ({ reps: 0, weightKg: 0 }));
    });
    return initial;
  });

  useEffect(() => {
    if (session) navigation.setOptions({ title: session.name });
  }, [navigation, session]);

  /** Most recent logged sets per exercise, used for load suggestions. */
  const lastSets = useMemo(() => {
    const map: Record<string, LoggedSet[]> = {};
    const ordered = [...workoutLogs].sort((a, b) => b.date.localeCompare(a.date));
    for (const log of ordered) {
      for (const exercise of log.exercises) {
        if (!map[exercise.exerciseId] && exercise.sets.length > 0) {
          map[exercise.exerciseId] = exercise.sets;
        }
      }
    }
    return map;
  }, [workoutLogs]);

  if (!session || !program) {
    return (
      <Screen>
        <Spacer size={spacing.xl} />
        <Heading>Session not found</Heading>
        <Small style={{ marginTop: spacing.sm }}>Generate a programme from the Train tab.</Small>
      </Screen>
    );
  }

  const updateSet = (exerciseId: string, index: number, patch: Partial<LoggedSet>) => {
    setDraft((current) => {
      const sets = [...(current[exerciseId] ?? [])];
      sets[index] = { ...(sets[index] ?? { reps: 0, weightKg: 0 }), ...patch };
      return { ...current, [exerciseId]: sets };
    });
  };

  const completedSets = Object.values(draft).flat().filter((set) => set.reps > 0).length;

  const save = () => {
    const exercises: LoggedExercise[] = Object.entries(draft)
      .map(([exerciseId, sets]) => ({
        exerciseId,
        sets: sets.filter((set) => set.reps > 0),
      }))
      .filter((entry) => entry.sets.length > 0);

    if (exercises.length === 0) return;

    logWorkout({
      programId: program.id,
      sessionId: session.id,
      date: today(),
      exercises,
    });
    router.back();
  };

  return (
    <Screen>
      <Spacer size={spacing.md} />
      <Display>{session.name}</Display>
      <Small style={{ marginTop: spacing.xs }}>
        {session.exercises.length} exercises · about {session.estimatedMinutes} min · {completedSets} sets logged
      </Small>

      {session.adjustments.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          {session.adjustments.map((adjustment, index) => (
            <Callout key={index} tone="info" title="Adjusted for you">
              <Small muted={false} style={{ color: colors.text }}>
                {adjustment}
              </Small>
            </Callout>
          ))}
        </View>
      ) : null}

      <SectionTitle>Exercises</SectionTitle>
      {session.exercises.map((planned) => (
        <ExerciseBlock
          key={planned.exerciseId}
          planned={planned}
          sets={draft[planned.exerciseId] ?? []}
          lastSets={lastSets[planned.exerciseId] ?? []}
          onChange={(index, patch) => updateSet(planned.exerciseId, index, patch)}
        />
      ))}

      <Button
        label={completedSets === 0 ? 'Log at least one set' : `Finish session (${completedSets} sets)`}
        onPress={save}
        disabled={completedSets === 0}
      />
      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

function ExerciseBlock({
  planned,
  sets,
  lastSets,
  onChange,
}: {
  planned: PlannedExercise;
  sets: LoggedSet[];
  lastSets: LoggedSet[];
  onChange: (index: number, patch: Partial<LoggedSet>) => void;
}) {
  const exercise = getExercise(planned.exerciseId);
  if (!exercise) return null;

  const targetReps = planned.sets[0]?.reps ?? 8;
  const suggestion = suggestNextLoad(lastSets, targetReps);

  return (
    <Card>
      <Title>{exercise.name}</Title>
      <Small style={{ marginTop: 2 }}>
        {planned.sets.length} sets × {targetReps} reps · RIR {planned.sets[0]?.rir ?? 2} ·{' '}
        {planned.restSeconds}s rest
      </Small>
      {planned.note ? <Small style={{ marginTop: spacing.xs, color: colors.accent }}>{planned.note}</Small> : null}

      {suggestion ? (
        <View style={{ marginTop: spacing.md }}>
          <Callout tone="accent" title={`Suggested: ${suggestion.weightKg} kg`}>
            <Small muted={false} style={{ color: colors.text }}>
              {suggestion.note}
            </Small>
          </Callout>
        </View>
      ) : null}

      <Divider />
      <Row justify="space-between" style={{ marginBottom: spacing.sm }}>
        <Caption color={colors.textFaint}>Set</Caption>
        <Row gap={spacing.md}>
          <Caption color={colors.textFaint}>Weight (kg)</Caption>
          <Caption color={colors.textFaint}>Reps</Caption>
        </Row>
      </Row>

      {planned.sets.map((plannedSet, index) => (
        <Row key={index} justify="space-between" style={{ marginBottom: spacing.sm }}>
          <Body style={{ width: 28 }}>{index + 1}</Body>
          <Row gap={spacing.sm}>
            <TextInput
              value={sets[index]?.weightKg ? String(sets[index]!.weightKg) : ''}
              onChangeText={(text) => onChange(index, { weightKg: Number(text.replace(',', '.')) || 0 })}
              keyboardType="decimal-pad"
              placeholder="—"
              placeholderTextColor={colors.textFaint}
              style={styles.numberInput}
            />
            <TextInput
              value={sets[index]?.reps ? String(sets[index]!.reps) : ''}
              onChangeText={(text) => onChange(index, { reps: parseInt(text, 10) || 0 })}
              keyboardType="number-pad"
              placeholder={String(plannedSet.reps)}
              placeholderTextColor={colors.textFaint}
              style={styles.numberInput}
            />
          </Row>
        </Row>
      ))}

      <Divider />
      <Caption color={colors.textFaint}>Cues</Caption>
      <Spacer size={spacing.xs} />
      {exercise.cues.map((cue, index) => (
        <Small key={index} style={{ marginBottom: 2 }}>
          · {cue}
        </Small>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  numberInput: {
    width: 78,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    textAlign: 'center',
    ...typography.bodyStrong,
  },
});

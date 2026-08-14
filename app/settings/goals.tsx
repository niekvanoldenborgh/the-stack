import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { GOALS, GOAL_CONFLICTS, GOALS_BY_ID } from '../../src/domain/goals';
import type { GoalId } from '../../src/domain/types';
import { useAppStore } from '../../src/store/useAppStore';
import { Body, Button, Callout, Card, Chip, Row, Screen, SectionTitle, Small, Spacer } from '../../src/ui/components';
import { colors, spacing } from '../../src/ui/theme';

/**
 * Edit goals. The recommendation engine reads `profile.goals`; changing them
 * here re-runs the safety pass over saved stacks via `updateProfile`.
 */
export default function GoalsScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const [selected, setSelected] = useState<GoalId[]>(profile?.goals ?? []);

  const toggle = (id: GoalId) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const conflicts = GOAL_CONFLICTS.filter(
    (c) => selected.includes(c.goals[0]) && selected.includes(c.goals[1]),
  );

  const save = () => {
    updateProfile({ goals: selected });
    router.back();
  };

  if (!profile) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'Goals' }} />
        <Spacer size={spacing.xl} />
        <Body>Complete your profile first to set goals.</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Goals' }} />
      <Spacer size={spacing.md} />
      <Body muted>Pick what this cycle is for. You can change these any time.</Body>

      <SectionTitle>Your goals</SectionTitle>
      <Row wrap gap={spacing.xs}>
        {GOALS.map((goal) => (
          <Chip
            key={goal.id}
            label={`${goal.icon} ${goal.label}`}
            selected={selected.includes(goal.id)}
            onPress={() => toggle(goal.id)}
          />
        ))}
      </Row>

      {conflicts.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          {conflicts.map((c, index) => (
            <Callout
              key={index}
              tone="moderate"
              title={`${GOALS_BY_ID[c.goals[0]]?.label} vs ${GOALS_BY_ID[c.goals[1]]?.label}`}
            >
              <Small muted={false} style={{ color: colors.text }}>
                {c.detail}
                {'\n\n'}
                {c.guidance}
              </Small>
            </Callout>
          ))}
        </View>
      ) : null}

      {selected.length > 0 ? (
        <Card style={{ marginTop: spacing.lg }}>
          {selected.map((id) => {
            const goal = GOALS_BY_ID[id];
            if (!goal) return null;
            return (
              <View key={id} style={{ marginBottom: spacing.md }}>
                <Small muted={false} style={{ color: colors.text }}>
                  {goal.icon} {goal.label}
                </Small>
                <Small style={{ marginTop: 2 }}>{goal.reality}</Small>
              </View>
            );
          })}
        </Card>
      ) : null}

      <Spacer size={spacing.lg} />
      <Button label={selected.length === 0 ? 'Clear all goals' : 'Save goals'} onPress={save} />
    </Screen>
  );
}

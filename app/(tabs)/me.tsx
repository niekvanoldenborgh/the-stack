import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { GOALS, HEALTH_FLAGS } from '../../src/domain/goals';
import { getPeptide, searchPeptides } from '../../src/domain/peptides';
import type { ActivityLevel, Experience, GoalId, HealthFlag, Severity, TrainingDaysPerWeek } from '../../src/domain/types';
import { cancelAllReminders, getPermissionState, pendingReminderCount, requestPermission } from '../../src/lib/notifications';
import { formatShort, today } from '../../src/lib/date';
import { useAppStore } from '../../src/store/useAppStore';
import {
  Badge,
  Body,
  Button,
  Callout,
  Caption,
  Card,
  Chip,
  Display,
  Divider,
  EmptyState,
  Heading,
  ListRow,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
  Toggle,
} from '../../src/ui/components';
import { RiskPicker } from '../../src/ui/RiskPicker';
import { RulerPicker } from '../../src/ui/RulerPicker';
import { LEGAL_LABELS, colors, radius, spacing, typography } from '../../src/ui/theme';

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Light',
  moderate: 'Moderate',
  high: 'High',
  athlete: 'Athlete',
};

const EXPERIENCE_LABELS: Record<Experience, string> = {
  none: 'Never used',
  some: 'Used a few',
  experienced: 'Experienced',
};

export default function MeScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const sideEffectLogs = useAppStore((s) => s.sideEffectLogs);
  const logSideEffect = useAppStore((s) => s.logSideEffect);
  const removeSideEffect = useAppStore((s) => s.removeSideEffect);
  const remindersEnabled = useAppStore((s) => s.settings.remindersEnabled);
  const setSetting = useAppStore((s) => s.setSetting);
  const resetAll = useAppStore((s) => s.resetAll);

  const [permission, setPermission] = useState<string>('undetermined');
  const [pending, setPending] = useState(0);
  const [note, setNote] = useState('');
  const [severity, setSeverity] = useState<Severity>('mild');
  const [peptideQuery, setPeptideQuery] = useState('');

  const currentPeptides = profile?.currentPeptides ?? [];

  const toggleCurrentPeptide = (id: string) => {
    updateProfile({
      currentPeptides: currentPeptides.includes(id)
        ? currentPeptides.filter((p) => p !== id)
        : [...currentPeptides, id],
    });
  };

  useEffect(() => {
    void getPermissionState().then(setPermission);
    void pendingReminderCount().then(setPending);
  }, [remindersEnabled]);

  if (!profile) {
    return (
      <Screen>
        <Spacer size={spacing.xl} />
        <EmptyState title="No profile" body="Complete onboarding first." />
      </Screen>
    );
  }

  const toggleGoal = (id: GoalId) => {
    const current = profile.goals;
    if (current.includes(id)) updateProfile({ goals: current.filter((g) => g !== id) });
    else if (current.length < 3) updateProfile({ goals: [...current, id] });
  };

  const toggleFlag = (id: HealthFlag) => {
    const current = profile.healthFlags;
    updateProfile({
      healthFlags: current.includes(id) ? current.filter((f) => f !== id) : [...current, id],
    });
  };

  const toggleReminders = async (next: boolean) => {
    if (!next) {
      setSetting('remindersEnabled', false);
      await cancelAllReminders();
      setPending(0);
      return;
    }
    const state = await requestPermission();
    setPermission(state);
    setSetting('remindersEnabled', state === 'granted');
  };

  const addSideEffect = () => {
    if (!note.trim()) return;
    logSideEffect({ date: today(), label: note.trim(), severity });
    setNote('');
    setSeverity('mild');
  };

  const confirmReset = () => {
    Alert.alert(
      'Erase everything?',
      'Your profile, stacks, dose history, side-effect log and training data will be permanently deleted from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase',
          style: 'destructive',
          onPress: () => {
            void cancelAllReminders();
            resetAll();
            router.replace('/onboarding');
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <Spacer size={spacing.lg} />
      <Display>Me</Display>
      <Small style={{ marginTop: spacing.xs }}>
        Changing anything here re-runs the safety engine over every stack you have saved.
      </Small>

      <SectionTitle>Body</SectionTitle>
      <Card>
        <Caption color={colors.textMuted}>Bodyweight</Caption>
        <Spacer size={spacing.md} />
        <RulerPicker
          value={profile.weightKg}
          onChange={(v) => updateProfile({ weightKg: v })}
          min={35}
          max={200}
          unit="kg"
        />
        <Small style={{ marginTop: spacing.md }}>
          Doses that scale per kilogram update immediately. Rebuild your stack to apply the change to your current
          plan.
        </Small>
      </Card>

      <Card>
        <Caption color={colors.textMuted}>Age</Caption>
        <Spacer size={spacing.md} />
        <RulerPicker value={profile.age} onChange={(v) => updateProfile({ age: v })} min={13} max={90} unit="years" />
      </Card>

      <SectionTitle>Recovery</SectionTitle>
      <Card>
        <Caption color={colors.textMuted}>Sleep per night</Caption>
        <Spacer size={spacing.md} />
        <RulerPicker
          value={profile.sleepHours}
          onChange={(v) => updateProfile({ sleepHours: v })}
          min={3}
          max={11}
          step={0.5}
          unit="hours"
        />
        <Spacer size={spacing.lg} />
        <Caption color={colors.textMuted}>Sleep quality</Caption>
        <Spacer size={spacing.sm} />
        <Row wrap>
          {[1, 2, 3, 4, 5].map((score) => (
            <Chip
              key={score}
              label={`${score}`}
              selected={profile.sleepQuality === score}
              onPress={() => updateProfile({ sleepQuality: score })}
            />
          ))}
        </Row>
      </Card>

      <Card>
        <Caption color={colors.textMuted}>Activity level</Caption>
        <Spacer size={spacing.sm} />
        <Row wrap>
          {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => (
            <Chip
              key={level}
              label={ACTIVITY_LABELS[level]}
              selected={profile.activity === level}
              onPress={() => updateProfile({ activity: level })}
            />
          ))}
        </Row>
        <Spacer size={spacing.md} />
        <Caption color={colors.textMuted}>Training days a week</Caption>
        <Spacer size={spacing.sm} />
        <Row wrap>
          {([2, 3, 4, 5, 6] as TrainingDaysPerWeek[]).map((days) => (
            <Chip
              key={days}
              label={`${days}`}
              selected={profile.trainingDays === days}
              onPress={() => updateProfile({ trainingDays: days })}
            />
          ))}
        </Row>
        <Spacer size={spacing.md} />
        <Caption color={colors.textMuted}>Peptide experience</Caption>
        <Spacer size={spacing.sm} />
        <Row wrap>
          {(Object.keys(EXPERIENCE_LABELS) as Experience[]).map((level) => (
            <Chip
              key={level}
              label={EXPERIENCE_LABELS[level]}
              selected={profile.experience === level}
              onPress={() => updateProfile({ experience: level })}
            />
          ))}
        </Row>
      </Card>

      <SectionTitle>Goals</SectionTitle>
      <Card>
        <Small style={{ marginBottom: spacing.md }}>Up to three, in priority order.</Small>
        <Row wrap>
          {GOALS.map((goal) => {
            const index = profile.goals.indexOf(goal.id);
            return (
              <Chip
                key={goal.id}
                label={`${goal.icon} ${goal.label}${index >= 0 ? ` ${index + 1}` : ''}`}
                selected={index >= 0}
                onPress={() => toggleGoal(goal.id)}
              />
            );
          })}
        </Row>
      </Card>

      <SectionTitle>Risk tolerance</SectionTitle>
      <RiskPicker
        value={profile.riskTolerance ?? 3}
        onChange={(level) => updateProfile({ riskTolerance: level })}
      />
      <Small style={{ marginTop: -spacing.sm }}>
        This changes future recommendations and the dose shown on each compound page. Your saved stack keeps the
        doses it was created with — rebuild it from the Stack tab to apply a new setting.
      </Small>

      <SectionTitle>What you are currently running</SectionTitle>
      <Card>
        <Small style={{ marginBottom: spacing.md }}>
          Everything here is checked against anything the engine recommends, for interactions and duplicate
          classes.
        </Small>

        {currentPeptides.length === 0 ? (
          <Small muted={false}>Nothing recorded.</Small>
        ) : (
          <Row wrap>
            {currentPeptides.map((id) => (
              <Chip
                key={id}
                label={`${getPeptide(id)?.name ?? id}  ✕`}
                selected
                onPress={() => toggleCurrentPeptide(id)}
              />
            ))}
          </Row>
        )}

        <Divider />
        <TextInput
          value={peptideQuery}
          onChangeText={setPeptideQuery}
          placeholder="Search to add a compound"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
        {peptideQuery.trim().length > 0 ? (
          <View style={{ marginTop: spacing.md }}>
            {searchPeptides(peptideQuery)
              .filter((p) => !currentPeptides.includes(p.id))
              .slice(0, 6)
              .map((peptide) => (
                <ListRow
                  key={peptide.id}
                  title={peptide.name}
                  subtitle={LEGAL_LABELS[peptide.legalStatus] ?? peptide.legalStatus}
                  onPress={() => {
                    toggleCurrentPeptide(peptide.id);
                    setPeptideQuery('');
                  }}
                />
              ))}
          </View>
        ) : null}
      </Card>

      <SectionTitle>Health history</SectionTitle>
      <Card>
        {HEALTH_FLAGS.map((flag) => (
          <Toggle
            key={flag.id}
            label={flag.label}
            value={profile.healthFlags.includes(flag.id)}
            onChange={() => toggleFlag(flag.id)}
            tone={flag.group === 'absolute' ? 'critical' : 'accent'}
          />
        ))}
      </Card>

      <SectionTitle>Reminders</SectionTitle>
      <Card>
        <Toggle
          label="Dose reminders"
          description={
            permission === 'denied'
              ? 'Blocked in system settings — enable notifications for The Stack there first.'
              : 'A notification at each scheduled dose time, with the amount and route in the alert.'
          }
          value={remindersEnabled}
          onChange={(next) => void toggleReminders(next)}
        />
        {remindersEnabled ? (
          <Small style={{ marginTop: spacing.sm }}>
            {pending} reminder{pending === 1 ? '' : 's'} currently scheduled. The app keeps a rolling window and
            tops it up each time you open it.
          </Small>
        ) : null}
      </Card>

      <SectionTitle>Side effect log</SectionTitle>
      <Card>
        <Small style={{ marginBottom: spacing.md }}>
          Log what you notice, when you notice it. Patterns across a cycle are far easier to see written down than
          remembered — and this is the record to show a doctor.
        </Small>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What did you notice?"
          placeholderTextColor={colors.textFaint}
          style={styles.input}
        />
        <Spacer size={spacing.md} />
        <Row wrap>
          {(['mild', 'moderate', 'severe'] as Severity[]).map((level) => (
            <Chip
              key={level}
              label={level}
              selected={severity === level}
              onPress={() => setSeverity(level)}
              tone={level === 'severe' ? 'critical' : level === 'moderate' ? 'moderate' : 'accent'}
            />
          ))}
        </Row>
        <Spacer size={spacing.sm} />
        <Button label="Log it" onPress={addSideEffect} disabled={!note.trim()} />
      </Card>

      {sideEffectLogs.length > 0 ? (
        <Card>
          {sideEffectLogs.slice(0, 15).map((entry, index) => (
            <View key={entry.id}>
              {index > 0 ? <Divider /> : null}
              <Row justify="space-between" align="flex-start" gap={spacing.md}>
                <View style={{ flex: 1 }}>
                  <Body>{entry.label}</Body>
                  <Small style={{ marginTop: 2 }}>{formatShort(entry.date)}</Small>
                </View>
                <Row gap={spacing.sm}>
                  <Badge
                    label={entry.severity}
                    tone={entry.severity === 'severe' ? 'critical' : entry.severity === 'moderate' ? 'moderate' : 'info'}
                  />
                  <Pressable onPress={() => removeSideEffect(entry.id)} accessibilityRole="button" hitSlop={8}>
                    <Small muted={false} style={{ color: colors.textFaint }}>
                      ✕
                    </Small>
                  </Pressable>
                </Row>
              </Row>
            </View>
          ))}
        </Card>
      ) : null}

      <SectionTitle>About</SectionTitle>
      <Card>
        <Heading>The Stack</Heading>
        <Small style={{ marginTop: spacing.sm }}>
          A harm-reduction reference for people who are going to use peptides regardless of whether good
          information exists. Doses are published protocol ranges, personalised within those ranges — never
          invented. Some compounds deliberately show no dose at all.
        </Small>
        <Divider />
        <Small>
          This is not medical advice and does not replace a doctor. For prescription compounds it is a reference,
          not a supply route. Profile created {formatShort(profile.createdAt.slice(0, 10))}.
        </Small>
      </Card>

      <Button label="Erase all my data" variant="danger" onPress={confirmReset} />
      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    color: colors.text,
    ...typography.body,
  },
});

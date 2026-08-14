import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';

import type { ActivityLevel, Experience, Sex, TrainingDaysPerWeek } from '../../src/domain/types';
import { useAppStore } from '../../src/store/useAppStore';
import { Body, Button, Card, Caption, Screen, Small, Spacer } from '../../src/ui/components';
import { RulerPicker } from '../../src/ui/RulerPicker';
import { Segmented } from '../../src/ui/schedule';
import { colors, spacing } from '../../src/ui/theme';

const ACTIVITY_OPTIONS: Array<{ value: ActivityLevel; label: string }> = [
  { value: 'sedentary', label: 'Sedentary' },
  { value: 'light', label: 'Light' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
  { value: 'athlete', label: 'Athlete' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card>
      <Caption color={colors.textMuted}>{label}</Caption>
      <Spacer size={spacing.md} />
      {children}
    </Card>
  );
}

/**
 * Edit personal info. All figures feed the dose and recommendation engines, so
 * saving goes through `updateProfile`, which re-runs the safety pass over every
 * saved stack.
 *
 * Numeric entry is metric (kg/cm) regardless of the display-unit preference —
 * the profile is the source of truth and stores metric. Display units are set
 * under Measurement units.
 */
export default function MyInfoScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);

  const [age, setAge] = useState(profile?.age ?? 30);
  const [sex, setSex] = useState<Sex>(profile?.sex ?? 'male');
  const [weightKg, setWeightKg] = useState(profile?.weightKg ?? 80);
  const [heightCm, setHeightCm] = useState(profile?.heightCm ?? 178);
  const [activity, setActivity] = useState<ActivityLevel>(profile?.activity ?? 'moderate');
  const [trainingDays, setTrainingDays] = useState<TrainingDaysPerWeek>(profile?.trainingDays ?? 4);
  const [experience, setExperience] = useState<Experience>(profile?.experience ?? 'none');
  const [sleepHours, setSleepHours] = useState(profile?.sleepHours ?? 7);
  const [sleepQuality, setSleepQuality] = useState(profile?.sleepQuality ?? 3);

  const save = () => {
    updateProfile({ age, sex, weightKg, heightCm, activity, trainingDays, experience, sleepHours, sleepQuality });
    router.back();
  };

  if (!profile) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'My Info' }} />
        <Spacer size={spacing.xl} />
        <Body>Complete onboarding first to set up your profile.</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'My Info' }} />
      <Spacer size={spacing.md} />

      <Field label="Age">
        <RulerPicker value={age} onChange={setAge} min={14} max={90} step={1} unit="yrs" />
      </Field>

      <Field label="Sex">
        <Segmented<Sex>
          value={sex}
          onChange={setSex}
          options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'other', label: 'Other' },
          ]}
        />
      </Field>

      <Field label="Bodyweight">
        <RulerPicker value={weightKg} onChange={setWeightKg} min={40} max={180} step={0.5} unit="kg" />
      </Field>

      <Field label="Height">
        <RulerPicker value={heightCm} onChange={setHeightCm} min={140} max={210} step={1} unit="cm" />
      </Field>

      <Field label="Activity level">
        <Segmented<ActivityLevel> value={activity} onChange={setActivity} options={ACTIVITY_OPTIONS} />
      </Field>

      <Field label="Training days per week">
        <Segmented<string>
          value={String(trainingDays)}
          onChange={(v) => setTrainingDays(Number(v) as TrainingDaysPerWeek)}
          options={[2, 3, 4, 5, 6].map((n) => ({ value: String(n), label: String(n) }))}
        />
      </Field>

      <Field label="Experience">
        <Segmented<Experience>
          value={experience}
          onChange={setExperience}
          options={[
            { value: 'none', label: 'New' },
            { value: 'some', label: 'Some' },
            { value: 'experienced', label: 'Experienced' },
          ]}
        />
      </Field>

      <Field label="Average sleep">
        <RulerPicker value={sleepHours} onChange={setSleepHours} min={4} max={12} step={0.5} unit="hrs" />
      </Field>

      <Field label="Sleep quality">
        <Segmented<string>
          value={String(sleepQuality)}
          onChange={(v) => setSleepQuality(Number(v))}
          options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
        />
        <Small style={{ marginTop: spacing.sm }}>1 = poor, 5 = excellent</Small>
      </Field>

      <Spacer size={spacing.md} />
      <Button label="Save changes" onPress={save} />
      <Spacer size={spacing.md} />
      <Small style={{ textAlign: 'center' }}>
        Changing your weight or age re-checks the safety of any saved stack.
      </Small>
    </Screen>
  );
}

import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { GOALS, HEALTH_FLAGS } from '../../src/domain/goals';
import { PEPTIDES, searchPeptides } from '../../src/domain/peptides';
import type {
  ActivityLevel,
  Experience,
  GoalId,
  HealthFlag,
  RiskTolerance,
  Sex,
  TrainingDaysPerWeek,
  UserProfile,
} from '../../src/domain/types';
import { generateSchedule } from '../../src/engine/cycle';
import { findGoalConflicts } from '../../src/engine/safety';
import { addDays, today } from '../../src/lib/date';
import { syncReminders } from '../../src/lib/notifications';
import { useAppStore } from '../../src/store/useAppStore';
import {
  Badge,
  Body,
  Button,
  Callout,
  Caption,
  Chip,
  Display,
  Divider,
  Heading,
  Logo,
  ProgressBar,
  Row,
  Screen,
  Small,
  Spacer,
  TextField,
  Title,
  Toggle,
} from '../../src/ui/components';
import { RiskPicker } from '../../src/ui/RiskPicker';
import { RulerPicker } from '../../src/ui/RulerPicker';
import { List, ListItem, Section } from '../../src/ui/primitives';
import { LEGAL_LABELS, colors, radius, spacing, typography } from '../../src/ui/theme';

type Step = 'disclaimer' | 'basics' | 'lifestyle' | 'goals' | 'current' | 'health' | 'review';

const STEPS: Step[] = ['disclaimer', 'basics', 'lifestyle', 'goals', 'current', 'health', 'review'];

const ACTIVITY_OPTIONS: Array<{ id: ActivityLevel; label: string; hint: string }> = [
  { id: 'sedentary', label: 'Sedentary', hint: 'Desk job, little movement' },
  { id: 'light', label: 'Light', hint: 'Walking, 1–2 sessions a week' },
  { id: 'moderate', label: 'Moderate', hint: '3–4 sessions a week' },
  { id: 'high', label: 'High', hint: '5–6 hard sessions a week' },
  { id: 'athlete', label: 'Athlete', hint: 'Daily structured training' },
];

const EXPERIENCE_OPTIONS: Array<{ id: Experience; label: string; hint: string }> = [
  { id: 'none', label: 'Never used peptides', hint: 'Doses start well below typical' },
  { id: 'some', label: 'Used a few', hint: 'One or two prior cycles' },
  { id: 'experienced', label: 'Experienced', hint: 'Multiple cycles, familiar with protocols' },
];

/**
 * Onboarding, redesigned THEA-40.
 *
 * Each step already had exactly one primary action (the bottom "Continue" /
 * "Build my stack" button) and a `Display` + `Body` heading, so the
 * hierarchy and single-action shape here didn't need inventing — what
 * changed is the field grouping underneath: related fields (age/weight/
 * height, activity/training days/experience, sleep hours/quality) now share
 * one `Section` instead of one bordered `Card` each, and the compound
 * search under "Are you running anything now?" uses `List`/`ListItem`
 * instead of a hand-styled selectable row. The under-18/21 growth-plate
 * copy is carried over byte-for-byte (AGENTS.md invariant 7).
 */
export default function Onboarding() {
  const router = useRouter();
  const saveProfile = useAppStore((s) => s.saveProfile);
  const updateProfile = useAppStore((s) => s.updateProfile);

  // Re-entry (Lock app -> onboarding) must prefill from the existing profile,
  // not hardcoded defaults — otherwise walking back through this flow silently
  // blanks health history the user already declared. Read once, imperatively:
  // this screen owns the form state from here, and the merge on submit (see
  // `finish`) is what actually persists it. See THEA-12a F1.
  const [existingProfile] = useState(() => useAppStore.getState().profile);

  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex]!;

  // Re-acceptance is always required, even on re-entry — that is the entire
  // point of locking the app.
  const [accepted, setAccepted] = useState(false);
  const [acknowledgedNotMedical, setAcknowledgedNotMedical] = useState(false);
  const [acknowledgedSourcing, setAcknowledgedSourcing] = useState(false);

  const [age, setAge] = useState(existingProfile?.age ?? 28);
  const [sex, setSex] = useState<Sex>(existingProfile?.sex ?? 'male');
  const [weightKg, setWeightKg] = useState(existingProfile?.weightKg ?? 80);
  const [heightCm, setHeightCm] = useState(existingProfile?.heightCm ?? 178);

  const [activity, setActivity] = useState<ActivityLevel>(existingProfile?.activity ?? 'moderate');
  const [sleepHours, setSleepHours] = useState(existingProfile?.sleepHours ?? 7);
  const [sleepQuality, setSleepQuality] = useState(existingProfile?.sleepQuality ?? 3);
  const [trainingDays, setTrainingDays] = useState<TrainingDaysPerWeek>(existingProfile?.trainingDays ?? 4);
  const [experience, setExperience] = useState<Experience>(existingProfile?.experience ?? 'none');

  const [goals, setGoals] = useState<GoalId[]>(existingProfile?.goals ?? []);
  const [healthFlags, setHealthFlags] = useState<HealthFlag[]>(existingProfile?.healthFlags ?? []);

  const [usingNow, setUsingNow] = useState<boolean | null>(
    existingProfile ? existingProfile.currentPeptides.length > 0 : null,
  );
  const [currentPeptides, setCurrentPeptides] = useState<string[]>(existingProfile?.currentPeptides ?? []);
  const [currentQuery, setCurrentQuery] = useState('');

  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>(existingProfile?.riskTolerance ?? 3);

  const conflicts = useMemo(() => findGoalConflicts(goals), [goals]);
  const currentResults = useMemo(
    () => (currentQuery ? searchPeptides(currentQuery) : PEPTIDES),
    [currentQuery],
  );

  const toggleGoal = (id: GoalId) => {
    setGoals((current) => {
      if (current.includes(id)) return current.filter((g) => g !== id);
      if (current.length >= 3) return current;
      return [...current, id];
    });
  };

  const toggleFlag = (id: HealthFlag) => {
    setHealthFlags((current) =>
      current.includes(id) ? current.filter((f) => f !== id) : [...current, id],
    );
  };

  const toggleCurrent = (id: string) => {
    setCurrentPeptides((current) =>
      current.includes(id) ? current.filter((p) => p !== id) : [...current, id],
    );
  };

  const canAdvance = (): boolean => {
    switch (step) {
      case 'disclaimer':
        return accepted && acknowledgedNotMedical && acknowledgedSourcing;
      case 'goals':
        return goals.length > 0;
      case 'current':
        return usingNow !== null && (usingNow === false || currentPeptides.length > 0);
      default:
        return true;
    }
  };

  const finish = () => {
    const patch = {
      age,
      sex,
      weightKg,
      heightCm,
      activity,
      sleepHours,
      sleepQuality,
      trainingDays,
      experience,
      goals,
      healthFlags,
      currentPeptides: usingNow ? currentPeptides : [],
      riskTolerance,
      acceptedDisclaimerAt: new Date().toISOString(),
    };

    if (existingProfile) {
      // Re-entry: merge, not replace. `updateProfile` re-runs the safety
      // engine over every saved stack — a plain `saveProfile` here is exactly
      // the THEA-12a F1 bug (blank health history + a stale "all clear").
      updateProfile(patch);

      // Reminders were cancelled on lock; re-sync them now the app is
      // unlocked again rather than leaving the user's alarms silently off.
      const state = useAppStore.getState();
      const stack = state.stacks.find((s) => s.id === state.activeStackId);
      if (stack && state.settings.remindersEnabled) {
        const doses = generateSchedule(stack, today(), addDays(today(), 14));
        void syncReminders(doses, state.settings.alarmOffsetsMin);
      }
    } else {
      // First run only: there is no profile and nothing to merge into.
      const profile: UserProfile = { ...patch, createdAt: new Date().toISOString() };
      saveProfile(profile);
    }

    // The stack itself is generated on the recommendation screen, so the risk
    // dial there can re-derive it live before the user commits to anything.
    router.replace('/recommendation');
  };

  return (
    <Screen>
      <Spacer size={spacing.lg} />
      <Row justify="space-between" style={{ marginBottom: spacing.sm }}>
        <Caption color={colors.textMuted}>
          Step {stepIndex + 1} of {STEPS.length}
        </Caption>
        {stepIndex > 0 ? (
          <Pressable onPress={() => setStepIndex((i) => Math.max(0, i - 1))} accessibilityRole="button">
            <Small muted={false} style={{ color: colors.accent }}>
              Back
            </Small>
          </Pressable>
        ) : null}
      </Row>
      <ProgressBar value={((stepIndex + 1) / STEPS.length) * 100} />
      <Spacer size={spacing.xl} />

      {step === 'disclaimer' ? (
        <DisclaimerStep
          accepted={accepted}
          setAccepted={setAccepted}
          notMedical={acknowledgedNotMedical}
          setNotMedical={setAcknowledgedNotMedical}
          sourcing={acknowledgedSourcing}
          setSourcing={setAcknowledgedSourcing}
        />
      ) : null}

      {step === 'basics' ? (
        <View>
          <Display>About you</Display>
          <Body muted style={{ marginTop: spacing.sm }}>
            Bodyweight scales the dose for several compounds. Age changes which warnings apply and how the engine
            ranks the growth-hormone compounds.
          </Body>
          <Spacer />

          <Section title="Body measurements" gap={spacing.xl}>
            <View>
              <Caption color={colors.textMuted}>Age</Caption>
              <Spacer size={spacing.md} />
              <RulerPicker value={age} onChange={setAge} min={13} max={90} unit="years" />
              {age < 21 ? (
                <View style={{ marginTop: spacing.lg }}>
                  <Callout
                    tone={age < 18 ? 'critical' : 'high'}
                    title={age < 18 ? 'Your growth plates are still open' : 'Your growth plates may not be closed yet'}
                  >
                    {age < 18
                      ? 'Growth-hormone and IGF-1 compounds act directly on open growth plates. Getting this wrong can permanently change your adult height and bone proportions, and it cannot be reversed. There is also no safety data for any of these compounds in under-18s — every dose figure in this app is extrapolated from adults.\n\nYou can continue, and every affected compound will be flagged. Please talk to a doctor first.'
                      : 'Growth plates typically finish closing between about 18 and 21, later in males. Growth-hormone compounds are ranked lower for you and will carry a warning, because skeletal changes are still possible at your age.'}
                  </Callout>
                </View>
              ) : null}
            </View>

            <Divider />

            <View>
              <Caption color={colors.textMuted}>Bodyweight</Caption>
              <Spacer size={spacing.md} />
              <RulerPicker value={weightKg} onChange={setWeightKg} min={35} max={200} unit="kg" />
            </View>

            <Divider />

            <View>
              <Caption color={colors.textMuted}>Height</Caption>
              <Spacer size={spacing.md} />
              <RulerPicker value={heightCm} onChange={setHeightCm} min={130} max={220} unit="cm" />
            </View>
          </Section>

          <Section title="Sex" last>
            <Row wrap>
              {(['male', 'female', 'other'] as Sex[]).map((option) => (
                <Chip
                  key={option}
                  label={option === 'male' ? 'Male' : option === 'female' ? 'Female' : 'Other'}
                  selected={sex === option}
                  onPress={() => setSex(option)}
                />
              ))}
            </Row>
            <Small style={{ marginTop: spacing.sm }}>
              Used for warnings that differ by sex — for example, that tirzepatide reduces oral contraceptive
              absorption. It does not change the dose maths.
            </Small>
          </Section>
        </View>
      ) : null}

      {step === 'lifestyle' ? (
        <View>
          <Display>Training and sleep</Display>
          <Body muted style={{ marginTop: spacing.sm }}>
            Sleep is not a soft input here. Most growth hormone is released during deep sleep, so it directly
            changes what the GH-axis compounds can do — and the doses this app suggests.
          </Body>
          <Spacer />

          <Section title="Training" gap={spacing.xl}>
            <View>
              <Caption color={colors.textMuted}>Activity level</Caption>
              <Spacer size={spacing.md} />
              {ACTIVITY_OPTIONS.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  sublabel={option.hint}
                  selected={activity === option.id}
                  onPress={() => setActivity(option.id)}
                />
              ))}
            </View>

            <Divider />

            <View>
              <Caption color={colors.textMuted}>Training days per week</Caption>
              <Spacer size={spacing.md} />
              <Row wrap>
                {([2, 3, 4, 5, 6] as TrainingDaysPerWeek[]).map((days) => (
                  <Chip
                    key={days}
                    label={`${days}`}
                    selected={trainingDays === days}
                    onPress={() => setTrainingDays(days)}
                  />
                ))}
              </Row>
            </View>

            <Divider />

            <View>
              <Caption color={colors.textMuted}>Peptide experience</Caption>
              <Spacer size={spacing.md} />
              {EXPERIENCE_OPTIONS.map((option) => (
                <Chip
                  key={option.id}
                  label={option.label}
                  sublabel={option.hint}
                  selected={experience === option.id}
                  onPress={() => setExperience(option.id)}
                />
              ))}
            </View>
          </Section>

          <Section title="Sleep" gap={spacing.xl} last>
            <View>
              <Caption color={colors.textMuted}>Average sleep per night</Caption>
              <Spacer size={spacing.md} />
              <RulerPicker value={sleepHours} onChange={setSleepHours} min={3} max={11} step={0.5} unit="hours" />
              {sleepHours < 6.5 ? (
                <View style={{ marginTop: spacing.lg }}>
                  <Callout tone="moderate" title="This will limit what any stack can do">
                    Under about 6.5 hours, GH-axis compounds have much less to amplify. The engine will hold those
                    doses down rather than pretending a bigger dose compensates.
                  </Callout>
                </View>
              ) : null}
            </View>

            <Divider />

            <View>
              <Caption color={colors.textMuted}>Sleep quality</Caption>
              <Spacer size={spacing.md} />
              <Row wrap>
                {[1, 2, 3, 4, 5].map((score) => (
                  <Chip
                    key={score}
                    label={`${score}`}
                    selected={sleepQuality === score}
                    onPress={() => setSleepQuality(score)}
                  />
                ))}
              </Row>
              <Small style={{ marginTop: spacing.sm }}>1 = broken and unrefreshing, 5 = deep and consistent.</Small>
            </View>
          </Section>
        </View>
      ) : null}

      {step === 'goals' ? (
        <View>
          <Display>What are you after?</Display>
          <Body muted style={{ marginTop: spacing.sm }}>
            Pick up to three, in order of importance. The order matters — your first choice gets the most weight
            when the engine builds your stack.
          </Body>
          <Spacer />

          {GOALS.map((goal) => {
            const index = goals.indexOf(goal.id);
            const selected = index >= 0;
            return (
              <Pressable
                key={goal.id}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => toggleGoal(goal.id)}
                style={({ pressed }) => ({
                  backgroundColor: selected ? `${colors.accent}14` : colors.surface,
                  borderColor: selected ? colors.accent : colors.border,
                  borderWidth: 1,
                  borderRadius: radius.md,
                  padding: spacing.lg,
                  marginBottom: spacing.sm,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Row justify="space-between">
                  <Row gap={spacing.md} style={{ flex: 1 }}>
                    <Body>{goal.icon}</Body>
                    <View style={{ flex: 1 }}>
                      <Heading>{goal.label}</Heading>
                      <Small style={{ marginTop: 2 }}>{goal.blurb}</Small>
                    </View>
                  </Row>
                  {selected ? <Badge label={`${index + 1}`} tone="accent" solid /> : null}
                </Row>
                {selected ? (
                  <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <Caption color={colors.moderate}>Reality check</Caption>
                    <Small style={{ marginTop: spacing.xs }}>{goal.reality}</Small>
                  </View>
                ) : null}
              </Pressable>
            );
          })}

          {conflicts.length > 0 ? (
            <View style={{ marginTop: spacing.lg }}>
              {conflicts.map((conflict) => (
                <Callout key={conflict.goals.join('-')} tone="moderate" title="These goals pull against each other">
                  {`${conflict.detail}\n\n${conflict.guidance}`}
                </Callout>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {step === 'current' ? (
        <View>
          <Display>Are you running anything now?</Display>
          <Body muted style={{ marginTop: spacing.sm }}>
            Anything you are already taking gets checked against everything we recommend — for interactions,
            and for compounds that would just duplicate what you have.
          </Body>
          <Spacer />

          <Chip
            label="No, nothing right now"
            sublabel="Starting from scratch"
            selected={usingNow === false}
            onPress={() => {
              setUsingNow(false);
              setCurrentPeptides([]);
            }}
          />
          <Chip
            label="Yes, I'm on something"
            sublabel="Pick what you're running below"
            selected={usingNow === true}
            onPress={() => setUsingNow(true)}
          />

          {usingNow ? (
            <Section
              title="Select everything you are on"
              action={currentPeptides.length > 0 ? <Badge label={`${currentPeptides.length} selected`} tone="accent" /> : undefined}
              last
            >
              <TextField
                value={currentQuery}
                onChangeText={setCurrentQuery}
                placeholder="Search compounds"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {currentResults.length > 0 ? (
                <List>
                  {currentResults.map((peptide) => {
                    const selected = currentPeptides.includes(peptide.id);
                    return (
                      <ListItem
                        key={peptide.id}
                        title={peptide.name}
                        detail={LEGAL_LABELS[peptide.legalStatus] ?? peptide.legalStatus}
                        onPress={() => toggleCurrent(peptide.id)}
                        tone={selected ? 'accent' : undefined}
                        meta={selected ? <Badge label="On it" tone="accent" solid /> : undefined}
                      />
                    );
                  })}
                </List>
              ) : null}
            </Section>
          ) : null}

          {usingNow === false ? (
            <Callout tone="info" title="Good — that keeps things simple">
              With nothing on board, the engine has a clean slate and every interaction check is just between the
              compounds it picks for you.
            </Callout>
          ) : null}
        </View>
      ) : null}

      {step === 'health' ? (
        <View>
          <Display>Health history</Display>
          <Body muted style={{ marginTop: spacing.sm }}>
            This is the most important screen in the app. Anything you tick here removes compounds from your
            results — permanently, not as a warning you can dismiss.
          </Body>
          <Spacer />

          {(['absolute', 'metabolic', 'cardio_renal', 'other'] as const).map((group, index, groups) => {
            const items = HEALTH_FLAGS.filter((f) => f.group === group);
            const label = {
              absolute: 'Hard stops',
              metabolic: 'Metabolic',
              cardio_renal: 'Heart, kidney and liver',
              other: 'Other',
            }[group];
            return (
              <Section key={group} title={label} tone={group === 'absolute' ? 2 : 1} last={index === groups.length - 1}>
                {items.map((flag) => (
                  <Toggle
                    key={flag.id}
                    label={flag.label}
                    value={healthFlags.includes(flag.id)}
                    onChange={() => toggleFlag(flag.id)}
                    tone={group === 'absolute' ? 'critical' : 'accent'}
                  />
                ))}
              </Section>
            );
          })}

          <Small>
            None of these apply? Leave them all unticked and continue. You can change this at any time from your
            profile, and your stack will be re-evaluated when you do.
          </Small>
        </View>
      ) : null}

      {step === 'review' ? (
        <View>
          <Display>How much risk?</Display>
          <Body muted style={{ marginTop: spacing.sm }}>
            This sets where in each compound&apos;s published range your dose lands, and how much of the catalogue
            the engine will draw from. You can change it any time — including on the next screen, with the doses
            updating live.
          </Body>
          <Spacer />

          <RiskPicker value={riskTolerance} onChange={setRiskTolerance} />

          <Section title="Your profile" last>
            <SummaryRow label="Age" value={`${age}`} tone={age < 21 ? 'moderate' : undefined} />
            <Divider />
            <SummaryRow label="Bodyweight" value={`${weightKg} kg`} />
            <Divider />
            <SummaryRow label="Activity" value={ACTIVITY_OPTIONS.find((a) => a.id === activity)?.label ?? activity} />
            <Divider />
            <SummaryRow label="Sleep" value={`${sleepHours} h, quality ${sleepQuality}/5`} />
            <Divider />
            <SummaryRow label="Training" value={`${trainingDays} days a week`} />
            <Divider />
            <SummaryRow
              label="Experience"
              value={EXPERIENCE_OPTIONS.find((e) => e.id === experience)?.label ?? experience}
            />
            <Divider />
            <SummaryRow label="Goals" value={goals.map((g) => GOALS.find((x) => x.id === g)?.label).join(', ') || '—'} />
            <Divider />
            <SummaryRow
              label="Currently on"
              value={
                currentPeptides.length === 0
                  ? 'Nothing'
                  : currentPeptides.map((id) => PEPTIDES.find((p) => p.id === id)?.name).join(', ')
              }
              tone={currentPeptides.length > 0 ? 'moderate' : undefined}
            />
            <Divider />
            <SummaryRow
              label="Health flags"
              value={healthFlags.length === 0 ? 'None reported' : `${healthFlags.length} reported`}
              tone={healthFlags.length > 0 ? 'moderate' : undefined}
            />
          </Section>
        </View>
      ) : null}

      <Spacer size={spacing.xl} />
      {stepIndex === STEPS.length - 1 ? (
        <Button label="Build my stack" onPress={finish} disabled={!canAdvance()} />
      ) : (
        <Button
          label={step === 'disclaimer' ? 'I understand — continue' : 'Continue'}
          onPress={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
          disabled={!canAdvance()}
        />
      )}
      {step === 'goals' && goals.length === 0 ? (
        <Small style={{ marginTop: spacing.md, textAlign: 'center' }}>Pick at least one goal to continue.</Small>
      ) : null}
      {step === 'current' && usingNow === null ? (
        <Small style={{ marginTop: spacing.md, textAlign: 'center' }}>Let us know either way to continue.</Small>
      ) : null}
      {step === 'current' && usingNow === true && currentPeptides.length === 0 ? (
        <Small style={{ marginTop: spacing.md, textAlign: 'center' }}>
          Select at least one compound, or switch to &ldquo;nothing right now&rdquo;.
        </Small>
      ) : null}
      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

function SummaryRow({ label, value, tone }: { label: string; value: string; tone?: 'moderate' }) {
  return (
    <Row justify="space-between" align="flex-start" gap={spacing.lg}>
      <Small style={{ flexShrink: 0 }}>{label}</Small>
      <Body
        style={{
          flex: 1,
          textAlign: 'right',
          color: tone === 'moderate' ? colors.moderate : colors.text,
          ...typography.bodyStrong,
        }}
      >
        {value}
      </Body>
    </Row>
  );
}

function DisclaimerStep({
  accepted,
  setAccepted,
  notMedical,
  setNotMedical,
  sourcing,
  setSourcing,
}: {
  accepted: boolean;
  setAccepted: (v: boolean) => void;
  notMedical: boolean;
  setNotMedical: (v: boolean) => void;
  sourcing: boolean;
  setSourcing: (v: boolean) => void;
}) {
  return (
    <View>
      <Logo size={52} />
      <Spacer size={spacing.lg} />
      <Display>The Stack</Display>
      <Title style={{ color: colors.accent, marginTop: spacing.xs }}>Read this properly</Title>
      <Body muted style={{ marginTop: spacing.md }}>
        This app exists because people use peptides whether or not good information is available. It is built to
        make that safer and more controlled — not to encourage it.
      </Body>
      <Spacer />

      <Callout tone="critical" title="Most of these are not approved medicines">
        The catalogue includes prescription drugs, compounds sold &ldquo;for research use only&rdquo; with no human
        approval anywhere, and cosmetic ingredients. The app labels which is which on every screen. Grey-market
        vials are routinely found to be underdosed, overdosed, or to contain something other than what the label
        says.
      </Callout>

      <Callout tone="high" title="Doses here are reference ranges, not prescriptions">
        Every number comes from a published protocol, a drug label, or a documented community convention — and is
        labelled with which. Personalisation moves the dose within those published ranges. It never invents one,
        and for several compounds it deliberately shows no dose at all.
      </Callout>

      <Callout tone="moderate" title="Some things this app will not do">
        It will not suggest a dose for compounds where the risk-to-evidence ratio makes a number irresponsible. It
        will not generate a stack containing a critical interaction. It will not push a dose past the top of the
        published range, whatever your risk setting. And it will not tell you a peptide can do something it cannot.
      </Callout>

      <Spacer />
      <Toggle label="I have read the above" value={accepted} onChange={setAccepted} tone="critical" />
      <Toggle
        label="I understand this is not medical advice"
        description="This app does not replace a doctor. For prescription compounds it is a reference, not a supply route."
        value={notMedical}
        onChange={setNotMedical}
        tone="critical"
      />
      <Toggle
        label="I understand unregulated compounds carry sourcing risk"
        description="Purity, concentration and sterility are not guaranteed for anything sold for research use."
        value={sourcing}
        onChange={setSourcing}
        tone="critical"
      />
    </View>
  );
}

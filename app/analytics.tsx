import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { View } from 'react-native';

import {
  adherenceSeries,
  muscleLoad,
  sideEffectsByWeek,
  strengthTrends,
  trainingSummary,
  weekLabel,
  weeklyVolume,
} from '../src/engine/analytics';
import { generateSchedule } from '../src/engine/cycle';
import { addDays, formatShort, today } from '../src/lib/date';
import { useActiveStack, useAppStore } from '../src/store/useAppStore';
import { HBars, Legend, Sparkbars, VBars } from '../src/ui/charts';
import {
  Badge,
  Body,
  Caption,
  Card,
  Data,
  Display,
  Divider,
  EmptyState,
  Heading,
  Metric,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
  StatTile,
} from '../src/ui/components';
import { Reveal } from '../src/ui/motion';
import { spacing, useTheme } from '../src/ui/theme';

export default function AnalyticsScreen() {
  const theme = useTheme();
  const { color } = theme;
  const profile = useAppStore((s) => s.profile);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const doseLogs = useAppStore((s) => s.doseLogs);
  const sideEffectLogs = useAppStore((s) => s.sideEffectLogs);
  const program = useAppStore((s) => s.program);
  const stack = useActiveStack();

  const date = today();

  const volume = useMemo(() => weeklyVolume(workoutLogs, 8, date), [workoutLogs, date]);
  const trends = useMemo(() => strengthTrends(workoutLogs, 4), [workoutLogs]);
  const muscles = useMemo(() => muscleLoad(workoutLogs, 7, date), [workoutLogs, date]);
  const summary = useMemo(
    () => trainingSummary(workoutLogs, program?.daysPerWeek ?? 0, date),
    [workoutLogs, program, date],
  );
  const adherence = useMemo(() => {
    if (!stack) return [];
    const doses = generateSchedule(stack, addDays(date, -13), date);
    return adherenceSeries(doses, doseLogs, 14, date);
  }, [stack, doseLogs, date]);
  const effects = useMemo(() => sideEffectsByWeek(sideEffectLogs, 8, date), [sideEffectLogs, date]);

  const adherencePct = useMemo(() => {
    const decided = adherence.reduce((sum, day) => sum + day.taken + day.skipped, 0);
    const taken = adherence.reduce((sum, day) => sum + day.taken, 0);
    return decided === 0 ? null : Math.round((taken / decided) * 100);
  }, [adherence]);

  const hasTraining = workoutLogs.length > 0;
  const hasEffects = sideEffectLogs.length > 0;

  if (!profile) {
    return (
      <Screen>
        <Spacer size={spacing.xl} />
        <EmptyState title="No profile" body="Complete onboarding first." illustration="onboarding" />
      </Screen>
    );
  }

  return (
    <Screen>
      <Spacer size={spacing.md} />
      <Reveal index={0}>
        <Caption color={color.primary}>Last 8 weeks</Caption>
        <Display style={{ marginTop: spacing.sm }}>Analytics</Display>
      </Reveal>

      <Reveal index={1}>
        <Spacer size={spacing.lg} />
        <Row gap={spacing.sm}>
          <StatTile
            label="Adherence"
            value={adherencePct === null ? '—' : `${adherencePct}%`}
            hint="14 days"
            tone={adherencePct !== null && adherencePct >= 80 ? 'accent' : 'moderate'}
          />
          <StatTile label="Sessions" value={`${summary.sessionsLogged}`} hint="logged" />
          <StatTile
            label="Streak"
            value={`${summary.streakWeeks}`}
            hint={summary.streakWeeks === 1 ? 'week' : 'weeks'}
            tone={summary.streakWeeks > 0 ? 'accent' : undefined}
          />
        </Row>
      </Reveal>

      {/* ------------------------------------------------------------------ */}
      <SectionTitle>Dose adherence</SectionTitle>
      {adherence.length === 0 ? (
        <Card>
          <Small>No active stack, so there is nothing scheduled to measure against.</Small>
        </Card>
      ) : (
        <Reveal index={2}>
          <Card>
            <Row justify="space-between" align="flex-end">
              <View style={{ flex: 1 }}>
                <Caption color={color.textSecondary}>Taken vs skipped</Caption>
                <Small style={{ marginTop: spacing.xs }}>
                  Only doses you actually logged count. Unlogged ones are left out rather than assumed missed.
                </Small>
              </View>
              {adherencePct !== null ? (
                <Metric color={adherencePct >= 80 ? color.primary : theme.tone('moderate').fg} style={{ fontSize: 34 }}>
                  {adherencePct}
                  <Data color={color.textSecondary}>%</Data>
                </Metric>
              ) : null}
            </Row>
            <Divider />
            <VBars
              data={adherence.map((day) => ({
                label: formatShort(day.date),
                value: day.taken,
                secondary: day.skipped,
                // The rail is what was scheduled. Without it, a day where you
                // took 1 of 1 and a day where you took 1 of 4 look identical.
                track: day.scheduled,
                focus: day.date === date,
                accessibilityLabel: `${formatShort(day.date)}: ${day.taken} taken, ${day.skipped} skipped, ${day.scheduled} scheduled`,
              }))}
              height={100}
              formatValue={(v) => `${v}`}
              showPeakLabel={false}
            />
            {/* Two series, so a legend is mandatory — identity is never colour alone. */}
            <Legend
              items={[
                { label: 'Taken', color: color.primary },
                { label: 'Skipped', color: color.borderStrong },
                { label: 'Scheduled', color: color.surfaceMuted },
              ]}
            />
          </Card>
        </Reveal>
      )}

      {/* ------------------------------------------------------------------ */}
      <SectionTitle>Training volume</SectionTitle>
      {!hasTraining ? (
        <Card>
          <Heading>Nothing logged yet</Heading>
          <Small style={{ marginTop: spacing.xs }}>
            Log a session from the Train tab and this fills in. Volume is total load moved — sets × reps × weight.
          </Small>
        </Card>
      ) : (
        <Reveal index={3}>
          <Card>
            <Row justify="space-between" align="flex-end">
              <View style={{ flex: 1 }}>
                <Caption color={color.textSecondary}>Weekly load moved</Caption>
                <Small style={{ marginTop: spacing.xs }}>Sets × reps × weight, per week.</Small>
              </View>
              <Metric style={{ fontSize: 30 }}>
                {Math.round(summary.totalVolumeKg / 1000)}
                <Data color={color.textSecondary}>t total</Data>
              </Metric>
            </Row>
            <Divider />
            <VBars
              data={volume.map((week) => ({
                label: weekLabel(week.weekStart, date),
                value: week.volumeKg,
                accessibilityLabel: `${weekLabel(week.weekStart, date)}: ${week.volumeKg} kg across ${week.sessions} sessions`,
              }))}
              formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${v}kg`)}
            />
          </Card>
        </Reveal>
      )}

      {/* ------------------------------------------------------------------ */}
      {trends.length > 0 ? (
        <>
          <SectionTitle>Strength trend</SectionTitle>
          <Reveal index={4}>
            <Card>
              <Small style={{ marginBottom: spacing.lg }}>
                Estimated one-rep max per session, per lift. Shown as separate sparklines rather than one combined
                chart so each is directly labelled and none depends on telling colours apart.
              </Small>
              {trends.map((trend, index) => (
                <View key={trend.exerciseId} style={{ marginBottom: index === trends.length - 1 ? 0 : spacing.lg }}>
                  <Row justify="space-between" style={{ marginBottom: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Small muted={false}>{trend.name}</Small>
                      <Data color={color.textTertiary} small>
                        {trend.points.length} session{trend.points.length === 1 ? '' : 's'} · best{' '}
                        {Math.max(...trend.points.map((p) => p.estimatedMax))} kg
                      </Data>
                    </View>
                    {trend.changePct !== null ? (
                      <Badge
                        label={`${trend.changePct > 0 ? '+' : ''}${trend.changePct}%`}
                        tone={trend.changePct > 0 ? 'accent' : trend.changePct < 0 ? 'moderate' : 'info'}
                      />
                    ) : null}
                  </Row>
                  <Sparkbars
                    values={trend.points.map((p) => p.estimatedMax)}
                    accessibilityLabel={`${trend.name} estimated one-rep max over ${trend.points.length} sessions: ${trend.points
                      .map((p) => `${p.estimatedMax} kg`)
                      .join(', ')}`}
                  />
                </View>
              ))}
            </Card>
          </Reveal>
        </>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      {muscles.length > 0 ? (
        <>
          <SectionTitle>Weekly sets per muscle</SectionTitle>
          <Reveal index={5}>
            <Card>
              <Small style={{ marginBottom: spacing.lg }}>
                Last 7 days. Sets rather than tonnage, because sets per muscle per week is what actually tracks with
                growth. A supporting muscle counts as half a set.
              </Small>
              <HBars
                data={muscles.map((m) => ({
                  label: m.muscle.replace(/_/g, ' '),
                  value: m.sets,
                }))}
                formatValue={(v) => `${v} ${v === 1 ? 'set' : 'sets'}`}
                threshold={10}
                thresholdLabel="10 sets — lower end of effective"
              />
              <Divider />
              <Small>
                Roughly 10–20 hard sets per muscle per week is the usual effective range. The dashed rule marks the
                bottom of that. Well under it and the stimulus is thin; well over and you are mostly buying fatigue.
              </Small>
            </Card>
          </Reveal>
        </>
      ) : null}

      {/* ------------------------------------------------------------------ */}
      <SectionTitle>Side effects over time</SectionTitle>
      <Reveal index={6}>
        <Card tone={effects.some((e) => e.severe > 0) ? 'critical' : undefined}>
          <Row gap={spacing.sm} style={{ marginBottom: spacing.sm }}>
            <Ionicons name="pulse" size={16} color={theme.tone('moderate').fg} />
            <Caption color={color.textSecondary}>Logged entries per week</Caption>
          </Row>
          {!hasEffects ? (
            <Small>
              Nothing logged. This is the chart worth keeping up to date — plotted against a cycle that titrates
              upward, it is what turns &ldquo;I think the headaches started around week three&rdquo; into something
              you can actually show a doctor.
            </Small>
          ) : (
            <>
              <VBars
                data={effects.map((week) => ({
                  label: weekLabel(week.weekStart, date),
                  value: week.mild + week.moderate,
                  secondary: week.severe,
                  accessibilityLabel: `${weekLabel(week.weekStart, date)}: ${week.total} entries — ${week.mild} mild, ${week.moderate} moderate, ${week.severe} severe`,
                }))}
                height={92}
                tint={theme.tone('moderate').fg}
                secondaryTint={theme.tone('critical').fg}
                showPeakLabel={false}
              />
              <Legend
                items={[
                  { label: 'Mild / moderate', color: theme.tone('moderate').fg },
                  { label: 'Severe', color: theme.tone('critical').fg },
                ]}
              />
              <Divider />
              <Small>
                Compare the shape of this against your cycle plan. A rise that lines up with a dose increase is the
                single most useful signal in this app.
              </Small>
            </>
          )}
        </Card>
      </Reveal>

      <Spacer size={spacing.xl} />
      <Body muted>
        Every figure here comes from what you logged. Gaps in logging show up as gaps in the analysis — the charts
        do not fill them in.
      </Body>
      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

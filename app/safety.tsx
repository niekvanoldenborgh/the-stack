import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { GOALS_BY_ID, HEALTH_FLAGS_BY_ID } from '../src/domain/goals';
import { getPeptide } from '../src/domain/peptides';
import { riskBand } from '../src/engine/safety';
import { useActiveStack } from '../src/store/useAppStore';
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
  Title,
} from '../src/ui/components';
import { colors, fonts, spacing } from '../src/ui/theme';

export default function SafetyScreen() {
  const router = useRouter();
  const stack = useActiveStack();

  if (!stack) {
    return (
      <Screen>
        <Spacer size={spacing.xl} />
        <EmptyState title="No active stack" body="There is nothing to evaluate yet." />
      </Screen>
    );
  }

  const { safety } = stack;
  const band = riskBand(safety.riskScore);
  const absolute = safety.contraindications.filter((c) => c.kind === 'absolute');
  const relative = safety.contraindications.filter((c) => c.kind === 'relative');

  return (
    <Screen>
      <Spacer size={spacing.md} />
      <Caption color={colors.textMuted}>{stack.name}</Caption>
      <Display style={{ marginTop: spacing.xs }}>Safety report</Display>

      <Spacer size={spacing.lg} />
      <Card tone={band.tone === 'severe' ? 'critical' : band.tone === 'low' ? 'accent' : band.tone}>
        <Row justify="space-between" align="flex-end">
          <View style={{ flex: 1 }}>
            <Caption color={colors.textMuted}>Overall risk</Caption>
            <Title style={{ marginTop: spacing.xs }}>{band.label}</Title>
          </View>
          <Display style={{ color: band.tone === 'low' ? colors.accent : colors.moderate }}>
            {safety.riskScore}
          </Display>
        </Row>
        <Divider />
        <Small>
          A composite of evidence quality, regulatory status, severe side effects, interactions and your health
          history. It is a comparison tool between stacks — not a probability that something will go wrong.
        </Small>
      </Card>

      {safety.blocking ? (
        <Callout tone="critical" title="This stack has a blocking finding">
          <Small muted={false} style={{ color: colors.text }}>
            Either something is absolutely contraindicated for your health history, or there is a critical
            interaction. Both mean: do not run this as it stands.
          </Small>
        </Callout>
      ) : null}

      {absolute.length > 0 ? (
        <>
          <SectionTitle>Contraindicated for you</SectionTitle>
          {absolute.map((finding) => (
            <Callout
              key={`${finding.peptideId}-${finding.flag}`}
              tone="critical"
              title={getPeptide(finding.peptideId)?.name ?? finding.peptideId}
            >
              <Small muted={false} style={{ color: colors.text }}>
                {HEALTH_FLAGS_BY_ID[finding.flag]?.label ?? finding.flag}
                {'\n\n'}
                {finding.reason}
              </Small>
            </Callout>
          ))}
        </>
      ) : null}

      {safety.interactions.length > 0 ? (
        <>
          <SectionTitle>Interactions</SectionTitle>
          {safety.interactions.map((interaction) => (
            <Card
              key={`${interaction.ruleId}-${interaction.peptideIds.join('-')}`}
              tone={
                interaction.severity === 'critical'
                  ? 'critical'
                  : interaction.severity === 'high'
                    ? 'high'
                    : interaction.severity === 'moderate'
                      ? 'moderate'
                      : 'info'
              }
            >
              <Row justify="space-between" align="flex-start" gap={spacing.md}>
                <Heading style={{ flex: 1 }}>{interaction.title}</Heading>
                <Badge
                  label={interaction.severity}
                  tone={
                    interaction.severity === 'critical'
                      ? 'critical'
                      : interaction.severity === 'high'
                        ? 'high'
                        : interaction.severity === 'moderate'
                          ? 'moderate'
                          : 'info'
                  }
                />
              </Row>
              <Small style={{ marginTop: spacing.xs }}>
                {interaction.peptideIds.map((id) => getPeptide(id)?.name ?? id).join('  +  ')}
              </Small>
              <Divider />
              <Body>{interaction.detail}</Body>
              <Spacer size={spacing.md} />
              <Caption color={colors.accent}>What to do</Caption>
              <Small style={{ marginTop: spacing.xs }}>{interaction.guidance}</Small>
            </Card>
          ))}
        </>
      ) : null}

      {relative.length > 0 ? (
        <>
          <SectionTitle>Cautions from your health history</SectionTitle>
          {relative.map((finding) => (
            <Card key={`${finding.peptideId}-${finding.flag}`} tone="high">
              <Heading>{getPeptide(finding.peptideId)?.name ?? finding.peptideId}</Heading>
              <Small style={{ marginTop: 2 }}>{HEALTH_FLAGS_BY_ID[finding.flag]?.label ?? finding.flag}</Small>
              <Divider />
              <Small>{finding.reason}</Small>
            </Card>
          ))}
        </>
      ) : null}

      {safety.notices.length > 0 ? (
        <>
          <SectionTitle>Stack-level notices</SectionTitle>
          {safety.notices.map((notice) => (
            <Card
              key={notice.id}
              tone={notice.severity === 'high' ? 'high' : notice.severity === 'moderate' ? 'moderate' : 'info'}
            >
              <Heading>{notice.title}</Heading>
              <Divider />
              <Small>{notice.detail}</Small>
            </Card>
          ))}
        </>
      ) : null}

      {safety.goalConflicts.length > 0 ? (
        <>
          <SectionTitle>Conflicting goals</SectionTitle>
          {safety.goalConflicts.map((conflict) => (
            <Card key={conflict.goals.join('-')} tone="moderate">
              <Heading>
                {GOALS_BY_ID[conflict.goals[0]]?.label} vs {GOALS_BY_ID[conflict.goals[1]]?.label}
              </Heading>
              <Divider />
              <Small>{conflict.detail}</Small>
              <Spacer size={spacing.md} />
              <Caption color={colors.accent}>What to do</Caption>
              <Small style={{ marginTop: spacing.xs }}>{conflict.guidance}</Small>
            </Card>
          ))}
        </>
      ) : null}

      {safety.redFlags.length > 0 ? (
        <>
          <SectionTitle>Stop and seek care if</SectionTitle>
          <Card tone="critical">
            {safety.redFlags.map((flag, index) => (
              <View key={flag.symptom} style={{ marginBottom: index === safety.redFlags.length - 1 ? 0 : spacing.lg }}>
                <Body style={{ fontFamily: fonts.sansMedium }}>{flag.symptom}</Body>
                <Small style={{ marginTop: 2 }}>{flag.action}</Small>
                <Small style={{ marginTop: 2, color: colors.textFaint }}>
                  From: {flag.peptideIds.map((id) => getPeptide(id)?.name ?? id).join(', ')}
                </Small>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {safety.sideEffects.length > 0 ? (
        <>
          <SectionTitle>Combined side effects</SectionTitle>
          <Card>
            <Small style={{ marginBottom: spacing.lg }}>
              Merged across your stack. Where several compounds share an effect, the risk is additive — that is the
              most useful thing on this page.
            </Small>
            {safety.sideEffects.map((effect, index) => (
              <View key={effect.label}>
                {index > 0 ? <Divider /> : null}
                <Row justify="space-between" align="flex-start" gap={spacing.md}>
                  <Body
                    style={{
                      flex: 1,
                      color: effect.severity === 'severe' ? colors.critical : colors.text,
                    }}
                  >
                    {effect.label}
                  </Body>
                  <Row gap={spacing.xs}>
                    <Badge
                      label={effect.severity}
                      tone={effect.severity === 'severe' ? 'critical' : effect.severity === 'moderate' ? 'moderate' : 'info'}
                    />
                  </Row>
                </Row>
                <Small style={{ marginTop: 2 }}>
                  {effect.likelihood}
                  {effect.peptideIds.length > 1
                    ? ` · from ${effect.peptideIds.length} compounds in this stack`
                    : ` · ${getPeptide(effect.peptideIds[0]!)?.name ?? ''}`}
                </Small>
                {effect.detail ? <Small style={{ marginTop: 2 }}>{effect.detail}</Small> : null}
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {safety.monitoring.length > 0 ? (
        <>
          <SectionTitle>Monitoring checklist</SectionTitle>
          <Card>
            {safety.monitoring.map((item, index) => (
              <Row key={index} gap={spacing.sm} align="flex-start" style={{ marginBottom: spacing.md }}>
                <Small muted={false} style={{ color: colors.accent }}>
                  ☐
                </Small>
                <Small style={{ flex: 1 }}>{item}</Small>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      <Spacer size={spacing.lg} />
      <Button label="Back to stack" variant="secondary" onPress={() => router.back()} />
      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

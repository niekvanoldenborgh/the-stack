import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { RISK_TOLERANCE_BY_LEVEL } from '../src/domain/goals';
import { getPeptide } from '../src/domain/peptides';
import type { RiskTolerance, StackItem } from '../src/domain/types';
import { TIME_OF_DAY_LABELS } from '../src/engine/cycle';
import { formatDose } from '../src/engine/dosing';
import { explainExclusions, generateStack } from '../src/engine/recommend';
import { riskBand } from '../src/engine/safety';
import { useAppStore } from '../src/store/useAppStore';
import {
  Badge,
  Body,
  Button,
  Callout,
  Caption,
  Card,
  Data,
  Display,
  Divider,
  EmptyState,
  Heading,
  Logo,
  Metric,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
  StatTile,
  Title,
} from '../src/ui/components';
import { Reveal } from '../src/ui/motion';
import { RiskPicker } from '../src/ui/RiskPicker';
import { EVIDENCE_LABELS, LEGAL_LABELS, colors, evidenceColor, radius, spacing } from '../src/ui/theme';

export default function RecommendationScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const saveStack = useAppStore((s) => s.saveStack);
  const createProgram = useAppStore((s) => s.createProgram);

  const [risk, setRisk] = useState<RiskTolerance>(profile?.riskTolerance ?? 3);
  const [showWorkings, setShowWorkings] = useState(false);

  // Re-derived on every risk change, so the dial is live rather than a
  // preference you set and hope about.
  const preview = useMemo(() => {
    if (!profile) return null;
    const tuned = { ...profile, riskTolerance: risk };
    const stack = generateStack(tuned);
    return { stack, exclusions: explainExclusions(tuned, stack) };
  }, [profile, risk]);

  if (!profile || !preview) {
    return (
      <Screen>
        <Spacer size={spacing.xl} />
        <EmptyState title="No profile yet" body="Complete onboarding to get a recommendation." />
      </Screen>
    );
  }

  const { stack, exclusions } = preview;
  const band = riskBand(stack.safety.riskScore);
  const meta = RISK_TOLERANCE_BY_LEVEL[risk];
  const currentNames = (profile.currentPeptides ?? [])
    .map((id) => getPeptide(id)?.name)
    .filter(Boolean)
    .join(', ');

  const accept = () => {
    updateProfile({ riskTolerance: risk });
    saveStack(stack);
    createProgram();
    router.replace('/(tabs)');
  };

  return (
    <Screen>
      <Spacer size={spacing.xl} />
      <Reveal index={0}>
        <Logo size={40} />
        <Spacer size={spacing.lg} />
        <Row gap={spacing.sm}>
          <Ionicons name="sparkles" size={16} color={colors.accent} />
          <Caption color={colors.accent}>Built from your profile</Caption>
        </Row>
      </Reveal>

      <Reveal index={1}>
        <Display style={{ marginTop: spacing.sm }}>The stack we recommend</Display>
        <Body muted style={{ marginTop: spacing.sm }}>
          {stack.items.length} compound{stack.items.length === 1 ? '' : 's'} for{' '}
          {profile.goals.map((g) => g.replace(/_/g, ' ')).join(', ')}
          {currentNames ? `, checked against the ${currentNames} you are already running` : ''}.
        </Body>
      </Reveal>

      <Reveal index={2}>
        <Spacer size={spacing.lg} />
        <Row gap={spacing.sm}>
          <StatTile label="Compounds" value={`${stack.items.length}`} />
          <StatTile
            label="Risk score"
            value={`${stack.safety.riskScore}`}
            hint={band.label}
            tone={band.tone === 'severe' ? 'critical' : band.tone === 'low' ? 'accent' : band.tone}
          />
          <StatTile label="Dial" value={`${risk}`} hint={meta?.label} />
        </Row>
      </Reveal>

      <Reveal index={3}>
        <SectionTitle>Your risk setting</SectionTitle>
        <RiskPicker value={risk} onChange={setRisk} />
        <Small style={{ marginTop: -spacing.sm, marginBottom: spacing.md }}>
          Moving the dial re-derives every dose below straight away. It changes the amounts only — never which
          compounds you are offered. Nothing is saved until you accept.
        </Small>
      </Reveal>

      {stack.safety.blocking ? (
        <Callout tone="critical" title="This recommendation has a blocking finding">
          Something here is contraindicated for your health history or interacts critically with what you are
          already taking. Read the warnings below before accepting.
        </Callout>
      ) : null}

      {stack.safety.notices
        .filter((n) => n.id.startsWith('age-'))
        .map((notice) => (
          <Callout
            key={notice.id}
            tone={notice.severity === 'critical' ? 'critical' : notice.severity === 'high' ? 'high' : 'moderate'}
            title={notice.title}
          >
            {notice.detail}
          </Callout>
        ))}

      {stack.safety.interactionsWithCurrent.length > 0 ? (
        <>
          <SectionTitle>Against what you are already on</SectionTitle>
          {stack.safety.interactionsWithCurrent.map((finding) => (
            <Callout
              key={`${finding.ruleId}-${finding.peptideIds.join('-')}`}
              tone={
                finding.severity === 'critical'
                  ? 'critical'
                  : finding.severity === 'high'
                    ? 'high'
                    : finding.severity === 'moderate'
                      ? 'moderate'
                      : 'info'
              }
              title={finding.title}
            >
              {`${finding.peptideIds.map((id) => getPeptide(id)?.name ?? id).join(' + ')}\n\n${finding.detail}\n\n${finding.guidance}`}
            </Callout>
          ))}
        </>
      ) : null}

      <SectionTitle>What we picked</SectionTitle>
      {stack.items.length === 0 ? (
        <EmptyState
          title="Nothing cleared the bar"
          body="At this risk setting, every compound that serves your goals is either contraindicated for you, conflicts with what you are already taking, or falls below the evidence threshold. Try raising the dial."
        />
      ) : (
        stack.items.map((item, index) => (
          <Reveal key={item.peptideId} index={4 + index}>
            <RecommendedCard item={item} onPress={() => router.push(`/peptide/${item.peptideId}`)} />
          </Reveal>
        ))
      )}

      {stack.safety.interactions.length > 0 ? (
        <>
          <SectionTitle>Inside this stack</SectionTitle>
          {stack.safety.interactions.map((finding) => (
            <Callout
              key={`${finding.ruleId}-${finding.peptideIds.join('-')}`}
              tone={finding.severity === 'info' ? 'info' : finding.severity === 'moderate' ? 'moderate' : 'high'}
              title={finding.title}
            >
              {`${finding.detail}\n\n${finding.guidance}`}
            </Callout>
          ))}
        </>
      ) : null}

      {stack.safety.notices.filter((n) => !n.id.startsWith('age-')).length > 0 ? (
        <>
          <SectionTitle>Before you start</SectionTitle>
          {stack.safety.notices
            .filter((n) => !n.id.startsWith('age-'))
            .map((notice) => (
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

      <Pressable onPress={() => setShowWorkings((v) => !v)} accessibilityRole="button">
        <Card>
          <Row justify="space-between">
            <Heading>Why not the others?</Heading>
            <Ionicons
              name={showWorkings ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={colors.textMuted}
            />
          </Row>
          {!showWorkings ? (
            <Small style={{ marginTop: spacing.xs }}>
              {exclusions.length} compound{exclusions.length === 1 ? '' : 's'} were considered and left out.
            </Small>
          ) : null}
        </Card>
      </Pressable>

      {showWorkings ? (
        <Card>
          {exclusions.slice(0, 14).map((exclusion, index) => (
            <View key={exclusion.peptideId}>
              {index > 0 ? <Divider /> : null}
              <Pressable onPress={() => router.push(`/peptide/${exclusion.peptideId}`)} accessibilityRole="button">
                <Body>{exclusion.name}</Body>
                <Small style={{ marginTop: 2 }}>{exclusion.reason}</Small>
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}

      <Spacer size={spacing.lg} />
      <Button
        label={stack.items.length === 0 ? 'Nothing to accept yet' : 'Start this stack'}
        onPress={accept}
        disabled={stack.items.length === 0}
      />
      <Spacer size={spacing.sm} />
      <Button label="Build my own instead" variant="secondary" onPress={() => router.replace('/builder')} />
      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

function RecommendedCard({ item, onPress }: { item: StackItem; onPress: () => void }) {
  const peptide = getPeptide(item.peptideId);
  if (!peptide) return null;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card>
        <Row justify="space-between" align="flex-start">
          <View style={{ flex: 1 }}>
            <Title>{peptide.name}</Title>
            <Row gap={spacing.xs} wrap style={{ marginTop: spacing.sm }}>
              <Badge
                label={LEGAL_LABELS[peptide.legalStatus] ?? peptide.legalStatus}
                tone={
                  peptide.legalStatus === 'research_chemical'
                    ? 'high'
                    : peptide.legalStatus === 'prescription'
                      ? 'info'
                      : 'accent'
                }
              />
              <View
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: evidenceColor(peptide.evidence),
                }}
              >
                <Caption color={evidenceColor(peptide.evidence)}>
                  {peptide.evidence} · {EVIDENCE_LABELS[peptide.evidence]}
                </Caption>
              </View>
            </Row>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Caption color={colors.textFaint}>Fit</Caption>
            <Heading style={{ color: colors.accent }}>{item.score}</Heading>
          </View>
        </Row>

        <Divider />

        {item.doseWithheld ? (
          <Small muted={false} style={{ color: colors.high }}>
            No dose shown for this compound — open it to see why.
          </Small>
        ) : (
          <Row justify="space-between" align="flex-end">
            <View>
              <Caption color={colors.textMuted}>Dose</Caption>
              <Row gap={spacing.xs} align="flex-end" style={{ marginTop: spacing.xs }}>
                <Metric color={colors.accent} style={{ fontSize: 32, lineHeight: 34 }}>
                  {formatDose(item.dose)}
                </Metric>
                {item.timesPerDay > 1 ? (
                  <Data color={colors.textMuted} small style={{ marginBottom: 4 }}>
                    × {item.timesPerDay}/day
                  </Data>
                ) : null}
              </Row>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Data color={colors.textMuted} small>
                {item.daysPerWeek === 7 ? 'daily' : `${item.daysPerWeek}×/week`}
              </Data>
              <Small>{item.preferredTimes.map((t) => TIME_OF_DAY_LABELS[t]).join(', ')}</Small>
            </View>
          </Row>
        )}

        {item.startDose.value !== item.dose.value && !item.doseWithheld ? (
          <Small style={{ marginTop: spacing.sm }}>
            Starts at {formatDose(item.startDose)} and ramps up.
          </Small>
        ) : null}

        <Divider />
        <Small>{item.rationale}</Small>
      </Card>
    </Pressable>
  );
}

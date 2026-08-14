import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { HEALTH_FLAGS_BY_ID } from '../src/domain/goals';
import { PEPTIDES, getPeptide, searchPeptides } from '../src/domain/peptides';
import type { StackItem } from '../src/domain/types';
import { computeDose, formatDose } from '../src/engine/dosing';
import { evaluateStack, riskBand } from '../src/engine/safety';
import { useAppStore } from '../src/store/useAppStore';
import {
  Badge,
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
} from '../src/ui/components';
import { EVIDENCE_LABELS, LEGAL_LABELS, colors, fonts, evidenceColor, radius, spacing, typography } from '../src/ui/theme';

export default function BuilderScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const createCustomStack = useAppStore((s) => s.createCustomStack);

  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const results = useMemo(() => (query ? searchPeptides(query) : PEPTIDES), [query]);

  const safety = useMemo(
    () => (profile ? evaluateStack(selected, profile) : null),
    [selected, profile],
  );

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((p) => p !== id) : [...current, id]));
  };

  const save = () => {
    if (!profile || selected.length === 0) return;
    const items: StackItem[] = selected.map((id) => {
      const peptide = getPeptide(id)!;
      const computation = computeDose(peptide, profile);
      return {
        peptideId: id,
        dose: computation.dose,
        startDose: computation.startDose,
        timesPerDay: peptide.frequency.timesPerDay,
        daysPerWeek: peptide.frequency.daysPerWeek,
        preferredTimes: peptide.frequency.preferredTimes,
        onWeeks: peptide.cycle.onWeeks,
        offWeeks: peptide.cycle.offWeeks,
        rationale: 'Chosen by you in the stack builder.',
        score: 0,
        servesGoals: profile.goals.filter((g) => (peptide.goalFit[g] ?? 0) > 0),
        doseWithheld: computation.withheld,
      };
    });
    createCustomStack(name, items);
    router.replace('/(tabs)');
  };

  if (!profile) {
    return (
      <Screen>
        <Spacer size={spacing.xl} />
        <Heading>Complete onboarding first</Heading>
        <Small style={{ marginTop: spacing.sm }}>
          The builder needs your profile to check contraindications and personalise doses.
        </Small>
      </Screen>
    );
  }

  const blocked = safety?.blocking ?? false;
  const band = safety ? riskBand(safety.riskScore) : null;

  return (
    <Screen>
      <Spacer size={spacing.md} />
      <Display>Build a stack</Display>
      <Small style={{ marginTop: spacing.xs }}>
        Pick whatever you want. The app checks every pair as you go and tells you what it finds — including when the
        answer is &ldquo;don&apos;t&rdquo;.
      </Small>

      <Spacer size={spacing.lg} />
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Stack name"
        placeholderTextColor={colors.textFaint}
        style={styles.input}
      />

      {selected.length > 0 && safety && band ? (
        <View style={{ marginTop: spacing.lg }}>
          <Card tone={blocked ? 'critical' : band.tone === 'severe' ? 'critical' : band.tone === 'low' ? 'accent' : band.tone}>
            <Row justify="space-between">
              <Heading>{band.label}</Heading>
              <Title style={{ color: blocked ? colors.critical : colors.accent }}>{safety.riskScore}</Title>
            </Row>
            <Small style={{ marginTop: spacing.xs }}>
              {selected.length} compound{selected.length === 1 ? '' : 's'} selected
            </Small>
          </Card>

          {safety.contraindications
            .filter((c) => c.kind === 'absolute')
            .map((c) => (
              <Callout
                key={`${c.peptideId}-${c.flag}`}
                tone="critical"
                title={`${getPeptide(c.peptideId)?.name} — contraindicated for you`}
              >
                <Small muted={false} style={{ color: colors.text }}>
                  {HEALTH_FLAGS_BY_ID[c.flag]?.label ?? c.flag}. {c.reason}
                </Small>
              </Callout>
            ))}

          {safety.interactions.map((interaction) => (
            <Callout
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
              title={interaction.title}
            >
              <Small muted={false} style={{ color: colors.text }}>
                {interaction.peptideIds.map((id) => getPeptide(id)?.name).join(' + ')}
                {'\n\n'}
                {interaction.detail}
                {'\n\n'}
                {interaction.guidance}
              </Small>
            </Callout>
          ))}

          {safety.contraindications
            .filter((c) => c.kind === 'relative')
            .map((c) => (
              <Callout
                key={`${c.peptideId}-${c.flag}`}
                tone="high"
                title={`${getPeptide(c.peptideId)?.name} — caution for you`}
              >
                <Small muted={false} style={{ color: colors.text }}>
                  {HEALTH_FLAGS_BY_ID[c.flag]?.label ?? c.flag}. {c.reason}
                </Small>
              </Callout>
            ))}

          {safety.notices.map((notice) => (
            <Callout
              key={notice.id}
              tone={notice.severity === 'high' ? 'high' : notice.severity === 'moderate' ? 'moderate' : 'info'}
              title={notice.title}
            >
              <Small muted={false} style={{ color: colors.text }}>
                {notice.detail}
              </Small>
            </Callout>
          ))}

          {safety.sideEffects.length > 0 ? (
            <Card>
              <Caption color={colors.textMuted}>Combined side effects</Caption>
              <Spacer size={spacing.sm} />
              {safety.sideEffects.slice(0, 8).map((effect) => (
                <Row key={effect.label} justify="space-between" align="flex-start" style={{ marginBottom: spacing.sm }} gap={spacing.md}>
                  <Small
                    muted={false}
                    style={{
                      flex: 1,
                      color: effect.severity === 'severe' ? colors.critical : colors.text,
                    }}
                  >
                    {effect.label}
                    {effect.peptideIds.length > 1 ? ` (${effect.peptideIds.length} compounds)` : ''}
                  </Small>
                  <Small>{effect.likelihood}</Small>
                </Row>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}

      <SectionTitle>Choose compounds</SectionTitle>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search"
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <Spacer size={spacing.md} />

      {results.map((peptide) => {
        const isSelected = selected.includes(peptide.id);
        const computation = computeDose(peptide, profile);
        return (
          <Pressable key={peptide.id} onPress={() => toggle(peptide.id)} accessibilityRole="button" accessibilityState={{ selected: isSelected }}>
            <Card
              style={{
                borderColor: isSelected ? colors.accent : colors.border,
                backgroundColor: isSelected ? `${colors.accent}0F` : colors.surface,
              }}
            >
              <Row justify="space-between" align="flex-start">
                <View style={{ flex: 1 }}>
                  <Row gap={spacing.sm}>
                    <Body style={{ fontFamily: fonts.sansMedium }}>{peptide.name}</Body>
                    {isSelected ? <Badge label="Added" tone="accent" solid /> : null}
                  </Row>
                  <Small style={{ marginTop: 2 }}>{peptide.summary}</Small>
                </View>
              </Row>
              <Row gap={spacing.xs} wrap style={{ marginTop: spacing.md }}>
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
                <View style={[styles.evidenceTag, { borderColor: evidenceColor(peptide.evidence) }]}>
                  <Caption color={evidenceColor(peptide.evidence)}>
                    {peptide.evidence} · {EVIDENCE_LABELS[peptide.evidence]}
                  </Caption>
                </View>
                {computation.withheld ? (
                  <Badge label="No dose shown" tone="high" />
                ) : (
                  <Badge label={formatDose(computation.dose)} tone="info" />
                )}
              </Row>
            </Card>
          </Pressable>
        );
      })}

      <Divider />
      {blocked ? (
        <Callout tone="critical" title="This stack cannot be saved">
          <Small muted={false} style={{ color: colors.text }}>
            It contains an absolute contraindication for your health history, a critical interaction, or both.
            Remove the compounds flagged above. This is the one thing the builder will not let you override — the
            whole point of the app is that it does not hand you a stack that it knows is dangerous.
          </Small>
        </Callout>
      ) : null}

      <Button
        label={selected.length === 0 ? 'Select at least one compound' : `Save stack (${selected.length})`}
        onPress={save}
        disabled={selected.length === 0 || blocked}
      />
      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    color: colors.text,
    ...typography.body,
  },
  evidenceTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
});

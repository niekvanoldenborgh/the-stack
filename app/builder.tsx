import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getPeptide, PEPTIDES, searchPeptides } from '../src/domain/peptides';
import type { StackItem } from '../src/domain/types';
import { computeDose, formatDose } from '../src/engine/dosing';
import { evaluateStack, riskBand } from '../src/engine/safety';
import { useAppStore } from '../src/store/useAppStore';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Display,
  Heading,
  Row,
  Screen,
  Small,
  Spacer,
  TextField,
} from '../src/ui/components';
import { SafetyReportView } from '../src/ui/SafetyReport';
import { EVIDENCE_LABELS, LEGAL_LABELS, colors, fonts, evidenceColor, radius, spacing } from '../src/ui/theme';

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
      <TextField value={name} onChangeText={setName} placeholder="Stack name" />

      {selected.length > 0 && safety && band ? (
        <View style={{ marginTop: spacing.xl }}>
          <SafetyReportView
            report={safety}
            band={{ label: band.label, riskScore: safety.riskScore, tone: band.tone }}
            bandNote={`${selected.length} compound${selected.length === 1 ? '' : 's'} selected.`}
            blockingCopy={{
              title: 'This stack cannot be saved',
              body: 'It contains an absolute contraindication for your health history, a critical interaction, or both. Remove the compounds flagged above.',
            }}
          />
        </View>
      ) : null}

      <Caption color={colors.textMuted} style={{ marginTop: spacing.xl, marginBottom: spacing.md }}>
        Choose compounds
      </Caption>
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search"
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

      <Spacer size={spacing.lg} />
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
  evidenceTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
});

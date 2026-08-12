import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { GOALS } from '../../src/domain/goals';
import { PEPTIDES, searchPeptides } from '../../src/domain/peptides';
import type { GoalId, LegalStatus, Peptide } from '../../src/domain/types';
import { isPeptideAllowed } from '../../src/engine/safety';
import { useAppStore } from '../../src/store/useAppStore';
import {
  Badge,
  Body,
  Caption,
  Card,
  Chip,
  Display,
  Heading,
  Row,
  Screen,
  Small,
  Spacer,
} from '../../src/ui/components';
import { Segmented } from '../../src/ui/schedule';
import { EVIDENCE_LABELS, LEGAL_LABELS, colors, fonts, evidenceColor, radius, spacing, typography } from '../../src/ui/theme';

const STATUS_FILTERS: Array<{ id: LegalStatus | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'prescription', label: 'Prescription' },
  { id: 'research_chemical', label: 'Research' },
  { id: 'cosmetic_otc', label: 'Cosmetic' },
];

export default function LibraryScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);

  const [query, setQuery] = useState('');
  const [goalFilter, setGoalFilter] = useState<GoalId | null>(null);
  const [statusFilter, setStatusFilter] = useState<LegalStatus | 'all'>('all');

  const results = useMemo(() => {
    let list = query ? searchPeptides(query) : PEPTIDES;
    if (goalFilter) {
      list = list.filter((p) => (p.goalFit[goalFilter] ?? 0) > 0);
      list = [...list].sort((a, b) => (b.goalFit[goalFilter] ?? 0) - (a.goalFit[goalFilter] ?? 0));
    }
    if (statusFilter !== 'all') list = list.filter((p) => p.legalStatus === statusFilter);
    return list;
  }, [query, goalFilter, statusFilter]);

  return (
    <Screen>
      <Spacer size={spacing.lg} />
      <Display>Library</Display>
      <Small style={{ marginTop: spacing.xs }}>
        {PEPTIDES.length} compounds. Every entry states what the evidence actually is, not what it is sold as.
      </Small>

      <Spacer size={spacing.lg} />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search name, alias or effect"
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />

      <Spacer size={spacing.md} />
      <Segmented
        options={STATUS_FILTERS.map((f) => ({ value: f.id, label: f.label }))}
        value={statusFilter}
        onChange={setStatusFilter}
      />
      <Spacer size={spacing.lg} />

      <Caption color={colors.textMuted}>Filter by goal</Caption>
      <Spacer size={spacing.sm} />
      <Row wrap>
        <Chip label="Any goal" selected={goalFilter === null} onPress={() => setGoalFilter(null)} />
        {GOALS.map((goal) => (
          <Chip
            key={goal.id}
            label={`${goal.icon} ${goal.label}`}
            selected={goalFilter === goal.id}
            onPress={() => setGoalFilter(goal.id === goalFilter ? null : goal.id)}
          />
        ))}
      </Row>

      <Spacer size={spacing.md} />
      <Caption color={colors.textFaint}>
        {results.length} result{results.length === 1 ? '' : 's'}
      </Caption>
      <Spacer size={spacing.sm} />

      {results.map((peptide) => {
        const blocked = profile ? !isPeptideAllowed(peptide, profile).allowed : false;
        return (
          <PeptideRow
            key={peptide.id}
            peptide={peptide}
            blocked={blocked}
            goalFilter={goalFilter}
            onPress={() => router.push(`/peptide/${peptide.id}`)}
          />
        );
      })}

      {results.length === 0 ? (
        <Card>
          <Heading>Nothing matches</Heading>
          <Small style={{ marginTop: spacing.xs }}>Try a different search or clear the filters.</Small>
        </Card>
      ) : null}

      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

function PeptideRow({
  peptide,
  blocked,
  goalFilter,
  onPress,
}: {
  peptide: Peptide;
  blocked: boolean;
  goalFilter: GoalId | null;
  onPress: () => void;
}) {
  const fit = goalFilter ? (peptide.goalFit[goalFilter] ?? 0) : null;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={{ opacity: blocked ? 0.55 : 1 }}>
        <Row justify="space-between" align="flex-start">
          <View style={{ flex: 1 }}>
            <Row gap={spacing.sm} align="center">
              <Heading>{peptide.name}</Heading>
              {peptide.doseGuidanceWithheld ? <Badge label="No dose shown" tone="high" /> : null}
            </Row>
            {peptide.aliases.length > 0 ? (
              <Small style={{ marginTop: 2 }}>{peptide.aliases.slice(0, 2).join(' · ')}</Small>
            ) : null}
          </View>
          {fit !== null ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Caption color={colors.textFaint}>Fit</Caption>
              <Body style={{ color: fit >= 4 ? colors.accent : colors.textMuted, fontFamily: fonts.sansMedium }}>{fit}/5</Body>
            </View>
          ) : null}
        </Row>

        <Small style={{ marginTop: spacing.sm }}>{peptide.summary}</Small>

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
          {peptide.bannedInSport ? <Badge label="Banned in sport" tone="moderate" /> : null}
          {blocked ? <Badge label="Contraindicated for you" tone="critical" /> : null}
        </Row>
      </Card>
    </Pressable>
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

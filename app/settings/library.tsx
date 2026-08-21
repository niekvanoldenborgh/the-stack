import { Stack, useRouter } from 'expo-router';
import { Check, Lock, Plus, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { searchPeptides } from '../../src/domain/peptides';
import type { Peptide, PeptideClass } from '../../src/domain/types';
import { Body, Caption, Chip, Row, Screen, Small, Spacer, TextField } from '../../src/ui/components';
import { EvidenceBadge, Tile } from '../../src/ui/nocturne';
import { Disclosure } from '../../src/ui/primitives';
import { useActiveStack } from '../../src/store/useAppStore';
import { EVIDENCE_LABELS, LEGAL_LABELS, radius, spacing, typography, useTheme } from '../../src/ui/theme';

/**
 * Compound library — NOCTURNE (design-lab/agents/14-me.sh).
 *
 * Tapping a row still opens the existing detail screen (app/peptide/[id]),
 * which renders uses, side effects, red flags, contraindications, monitoring
 * and a numbered Sources list — this screen stays the index into it, so the
 * sourced detail lives in exactly one place. Restyled: search, category
 * filters derived from the real `classes`/`legalStatus` fields (no new data),
 * and rows that each show an `EvidenceBadge`, a one-line plain-language
 * summary (truncated at a word boundary via `numberOfLines`, never invented
 * text), and whether the compound is already in the active stack.
 *
 * `doseGuidanceWithheld` compounds get a deliberately distinct row: the
 * evidence-tier slot becomes a lock instead of a letter, and the trailing
 * slot states "Guidance withheld" instead of stack membership — never a dose
 * number anywhere on this screen, withheld or not (the library never showed
 * one before this redesign either).
 */

type CategoryKey = 'all' | 'metabolic' | 'gh_axis' | 'healing' | 'cosmetic' | 'research';

/** Buckets over the real `classes`/`legalStatus` fields — no new data, just a
 *  grouping. Compounds can legitimately fall in more than one bucket (e.g.
 *  MK-677 is both metabolic and GH axis); that mirrors `classes` being an
 *  array in the domain model, not a single category. */
const METABOLIC_CLASSES: PeptideClass[] = ['incretin', 'metabolic_oral', 'mitochondrial', 'amylin'];
const GH_AXIS_CLASSES: PeptideClass[] = ['ghrh_analog', 'ghrp_secretagogue', 'growth_hormone', 'igf'];
const HEALING_CLASSES: PeptideClass[] = ['healing_repair', 'bone_anabolic', 'thymic_immune'];
const COSMETIC_CLASSES: PeptideClass[] = ['cosmetic_topical', 'melanocortin', 'sleep_neuro'];

const CATEGORIES: Array<{ key: CategoryKey; label: string; test: (p: Peptide) => boolean }> = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'metabolic', label: 'Metabolic', test: (p) => p.classes.some((c) => METABOLIC_CLASSES.includes(c)) },
  { key: 'gh_axis', label: 'GH axis', test: (p) => p.classes.some((c) => GH_AXIS_CLASSES.includes(c)) },
  { key: 'healing', label: 'Healing', test: (p) => p.classes.some((c) => HEALING_CLASSES.includes(c)) },
  { key: 'cosmetic', label: 'Cosmetic', test: (p) => p.classes.some((c) => COSMETIC_CLASSES.includes(c)) },
  { key: 'research', label: 'Research only', test: (p) => p.legalStatus === 'research_chemical' },
];

function CompoundRow({ peptide, inStack, onPress }: { peptide: Peptide; inStack: boolean; onPress: () => void }) {
  const theme = useTheme();
  const { color } = theme;
  const withheld = Boolean(peptide.doseGuidanceWithheld);

  return (
    <Tile
      elevation="low"
      onPress={onPress}
      accessibilityLabel={`${peptide.name}${withheld ? ', dose guidance withheld' : inStack ? ', already in your stack' : ', not in your stack'}`}
      style={{ marginBottom: spacing.md }}
    >
      <Row gap={spacing.md} align="flex-start">
        {withheld ? (
          <View
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: color.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Lock size={13} color={color.textSecondary} />
          </View>
        ) : (
          <EvidenceBadge tier={peptide.evidence} size={26} />
        )}

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.bodyStrong, { color: color.textPrimary }]} numberOfLines={1}>
            {peptide.name}
          </Text>
          <Text style={[typography.small, { color: color.textSecondary, marginTop: 2 }]} numberOfLines={1}>
            {peptide.summary}
          </Text>
        </View>

        {withheld ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: color.surfaceMuted,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              borderRadius: radius.sm,
            }}
          >
            <Text style={[typography.caption, { color: color.textSecondary, textTransform: 'none', letterSpacing: 0 }]}>
              Guidance withheld
            </Text>
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: inStack ? theme.tone('success').bg : color.surfaceMuted,
              paddingHorizontal: spacing.sm,
              paddingVertical: 4,
              borderRadius: radius.sm,
            }}
          >
            {inStack ? (
              <Check size={11} color={theme.tone('success').fg} />
            ) : (
              <Plus size={11} color={color.textSecondary} />
            )}
            <Text
              style={[
                typography.caption,
                { color: inStack ? theme.tone('success').fg : color.textSecondary, textTransform: 'none', letterSpacing: 0 },
              ]}
            >
              {inStack ? 'In stack' : 'Not in stack'}
            </Text>
          </View>
        )}
      </Row>
    </Tile>
  );
}

export default function LibraryScreen() {
  const theme = useTheme();
  const { color } = theme;
  const router = useRouter();
  const stack = useActiveStack();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryKey>('all');

  const activeCategory = CATEGORIES.find((c) => c.key === category) ?? CATEGORIES[0]!;
  const results = useMemo(
    () => searchPeptides(query).filter(activeCategory.test),
    [query, activeCategory],
  );
  const stackIds = useMemo(() => new Set(stack?.items.map((i) => i.peptideId) ?? []), [stack]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Library' }} />
      <Spacer size={spacing.md} />

      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search compounds"
        autoCorrect={false}
        autoCapitalize="none"
        leading={<Search size={18} color={color.textTertiary} />}
      />

      <Row wrap gap={spacing.sm} style={{ marginTop: spacing.md }}>
        {CATEGORIES.map((c) => (
          <Chip key={c.key} label={c.label} selected={c.key === category} onPress={() => setCategory(c.key)} />
        ))}
      </Row>

      <Spacer size={spacing.lg} />

      {results.length === 0 ? (
        <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
          <Small>No compounds match “{query}”.</Small>
        </View>
      ) : (
        <View>
          {results.map((peptide) => (
            <CompoundRow
              key={peptide.id}
              peptide={peptide}
              inStack={stackIds.has(peptide.id)}
              onPress={() => router.push(`/peptide/${peptide.id}`)}
            />
          ))}
        </View>
      )}

      <Spacer size={spacing.md} />
      <Disclosure label="Evidence tiers & legal status" summary="What the letters and labels on each row mean">
        <View style={{ gap: spacing.sm }}>
          {(['A', 'B', 'C', 'D'] as const).map((tier) => (
            <Row key={tier} gap={spacing.sm} align="center">
              <EvidenceBadge tier={tier} size={20} />
              <Small muted={false} style={{ color: color.textPrimary }}>
                {EVIDENCE_LABELS[tier]}
              </Small>
            </Row>
          ))}
        </View>
        <Spacer size={spacing.md} />
        <Caption style={{ marginBottom: spacing.xs }}>Legal status, shown on each compound&apos;s own page</Caption>
        <Body muted>{Object.values(LEGAL_LABELS).join(', ')}.</Body>
      </Disclosure>
    </Screen>
  );
}

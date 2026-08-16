import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { PEPTIDES, searchPeptides } from '../../src/domain/peptides';
import { Badge, Body, Caption, Row, Screen, Small, Spacer, TextField } from '../../src/ui/components';
import { List, ListItem } from '../../src/ui/primitives';
import { EVIDENCE_LABELS, LEGAL_LABELS, colors, spacing } from '../../src/ui/theme';

/**
 * Compound library — every peptide the app knows about.
 *
 * Tapping a row opens the existing detail screen (app/peptide/[id]), which
 * already renders uses, side effects, red flags, contraindications, monitoring
 * and a numbered Sources list. This screen is just the index into it, so the
 * sourced detail lives in exactly one place.
 */
export default function LibraryScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchPeptides(query), [query]);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Library' }} />
      <Spacer size={spacing.md} />
      <Body muted>
        Every compound in the app, with full sources on each detail page. {PEPTIDES.length} total.
      </Body>

      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name or alias"
        autoCorrect={false}
        autoCapitalize="none"
        leading={<Ionicons name="search" size={18} color={colors.textFaint} />}
        style={{ marginTop: spacing.lg, marginBottom: spacing.md }}
      />

      {results.length === 0 ? (
        <View style={{ paddingVertical: spacing.xl, alignItems: 'center' }}>
          <Small>No compounds match “{query}”.</Small>
        </View>
      ) : (
        <List>
          {results.map((peptide) => (
            <ListItem
              key={peptide.id}
              title={peptide.name}
              detail={peptide.summary}
              onPress={() => router.push(`/peptide/${peptide.id}`)}
              meta={
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Badge
                    label={`Ev ${peptide.evidence}`}
                    tone={peptide.evidence === 'A' ? 'accent' : peptide.evidence === 'D' ? 'critical' : 'moderate'}
                  />
                  <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
                </View>
              }
            />
          ))}
        </List>
      )}

      <Spacer size={spacing.md} />
      <Caption color={colors.textMuted}>Evidence tiers</Caption>
      <Spacer size={spacing.sm} />
      {(['A', 'B', 'C', 'D'] as const).map((tier) => (
        <Row key={tier} justify="space-between" style={{ marginBottom: spacing.xs }}>
          <Small>Tier {tier}</Small>
          <Small>{EVIDENCE_LABELS[tier]}</Small>
        </Row>
      ))}
      <Spacer size={spacing.sm} />
      <Small>
        Legal status shown on each page: {Object.values(LEGAL_LABELS).join(', ')}.
      </Small>
    </Screen>
  );
}

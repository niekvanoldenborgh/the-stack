import { Stack } from 'expo-router';

import { useAppStore } from '../../src/store/useAppStore';
import type { LengthUnit, MassUnit } from '../../src/store/useAppStore';
import { formatLength, formatMass } from '../../src/lib/units';
import { Body, Callout, Card, Caption, Row, Screen, SectionTitle, Small, Spacer } from '../../src/ui/components';
import { Segmented } from '../../src/ui/schedule';
import { colors, spacing } from '../../src/ui/theme';

/**
 * Measurement units. Bodyweight and height only.
 *
 * Dose units (mcg/mg/iu/pct) are deliberately absent here: the app never
 * converts a dose between units behind the scenes (AGENTS.md safety invariant
 * #8), so there is nothing to toggle. This screen changes presentation only —
 * the profile keeps storing metric.
 */
export default function UnitsScreen() {
  const settings = useAppStore((s) => s.settings);
  const setSetting = useAppStore((s) => s.setSetting);
  const profile = useAppStore((s) => s.profile);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Measurement units' }} />
      <Spacer size={spacing.md} />

      <SectionTitle>Bodyweight</SectionTitle>
      <Segmented<MassUnit>
        value={settings.massUnit}
        onChange={(v) => setSetting('massUnit', v)}
        options={[
          { value: 'kg', label: 'Kilograms' },
          { value: 'lb', label: 'Pounds' },
        ]}
      />

      <SectionTitle>Height</SectionTitle>
      <Segmented<LengthUnit>
        value={settings.lengthUnit}
        onChange={(v) => setSetting('lengthUnit', v)}
        options={[
          { value: 'cm', label: 'Centimetres' },
          { value: 'ft', label: 'Feet & inches' },
        ]}
      />

      {profile ? (
        <Card style={{ marginTop: spacing.xl }}>
          <Caption color={colors.textMuted}>Your profile, shown in these units</Caption>
          <Spacer size={spacing.sm} />
          <Row justify="space-between">
            <Small>Weight</Small>
            <Small muted={false} style={{ color: colors.text }}>
              {formatMass(profile.weightKg, settings.massUnit)}
            </Small>
          </Row>
          <Row justify="space-between" style={{ marginTop: spacing.sm }}>
            <Small>Height</Small>
            <Small muted={false} style={{ color: colors.text }}>
              {formatLength(profile.heightCm, settings.lengthUnit)}
            </Small>
          </Row>
        </Card>
      ) : null}

      <Callout tone="info" title="Doses are never converted">
        <Body>
          Peptide doses are always shown in the exact unit their protocol uses — micrograms, milligrams, IU or percent —
          and are never re-expressed in another unit. Mixing up units at the syringe is the single most common cause of a
          real overdose, so the app keeps each dose in the unit it was measured in.
        </Body>
      </Callout>
    </Screen>
  );
}

import { Stack } from 'expo-router';

import { useAppStore } from '../../src/store/useAppStore';
import { Body, Button, Callout, Card, Caption, Row, Screen, SectionTitle, Small, Spacer } from '../../src/ui/components';
import { colors, spacing } from '../../src/ui/theme';

/**
 * Manage data — export.
 *
 * Export as PDF / CSV / JSON is on the compliance-review path (THEA-12a, Benji)
 * because what leaves the device, in what shape, is a privacy decision. This
 * screen shows what is stored and previews the formats; the export actions are
 * disabled until the format and its contents are signed off, so we never ship
 * an unreviewed data-egress path.
 */
export default function ManageDataScreen() {
  const stacks = useAppStore((s) => s.stacks);
  const doseLogs = useAppStore((s) => s.doseLogs);
  const sideEffectLogs = useAppStore((s) => s.sideEffectLogs);
  const workoutLogs = useAppStore((s) => s.workoutLogs);
  const hasProfile = useAppStore((s) => Boolean(s.profile));

  const counts: Array<{ label: string; value: number }> = [
    { label: 'Profile', value: hasProfile ? 1 : 0 },
    { label: 'Saved stacks', value: stacks.length },
    { label: 'Dose logs', value: Object.keys(doseLogs).length },
    { label: 'Side-effect logs', value: sideEffectLogs.length },
    { label: 'Workout logs', value: workoutLogs.length },
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Manage data' }} />
      <Spacer size={spacing.md} />

      <SectionTitle>What you have stored</SectionTitle>
      <Card>
        {counts.map((row, index) => (
          <Row key={row.label} justify="space-between" style={{ marginTop: index === 0 ? 0 : spacing.sm }}>
            <Small>{row.label}</Small>
            <Small muted={false} style={{ color: colors.text }}>{row.value}</Small>
          </Row>
        ))}
      </Card>

      <SectionTitle>Export</SectionTitle>
      <Body muted>Take a copy of everything above.</Body>
      <Spacer size={spacing.md} />
      <Button label="Export as PDF" variant="secondary" disabled onPress={() => {}} />
      <Spacer size={spacing.sm} />
      <Button label="Export as CSV" variant="secondary" disabled onPress={() => {}} />
      <Spacer size={spacing.sm} />
      <Button label="Export as JSON" variant="secondary" disabled onPress={() => {}} />

      <Spacer size={spacing.lg} />
      <Callout tone="info" title="Export in review">
        <Body>
          Data export is being reviewed for exactly what each file includes before it ships — this keeps anything
          sensitive from leaving your device unintentionally. The buttons turn on once the format is signed off.
        </Body>
      </Callout>
      <Caption color={colors.textFaint}>Tracked in THEA-12a · reviewer: Benji (Audit/Compliance)</Caption>
    </Screen>
  );
}

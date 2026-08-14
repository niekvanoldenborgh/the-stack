import { Stack } from 'expo-router';

import { useAppStore } from '../../src/store/useAppStore';
import { Body, Button, Callout, Card, Caption, Row, Screen, SectionTitle, Small, Spacer } from '../../src/ui/components';
import { colors, spacing } from '../../src/ui/theme';

/**
 * Delete account.
 *
 * Deletion is irreversible and its consequence copy is a compliance matter, so
 * the destructive action is intentionally gated behind review (THEA-12a, Benji,
 * plus CEO sign-off on what "account" means in a local-only app). The store
 * already exposes `resetAll` to wipe local data; it is wired but disabled until
 * the reviewed confirmation flow and copy are approved — we do not ship an
 * unreviewed irreversible action.
 */
export default function DeleteAccountScreen() {
  const stacks = useAppStore((s) => s.stacks);
  const doseLogs = useAppStore((s) => s.doseLogs);

  const willRemove = [
    'Your profile, goals and health history',
    `Every saved stack (${stacks.length})`,
    `All dose and side-effect logs (${Object.keys(doseLogs).length} dose logs)`,
    'Your workout program and training history',
    'All app settings',
  ];

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Delete account' }} />
      <Spacer size={spacing.md} />

      <Callout tone="critical" title="This cannot be undone">
        <Body>
          Deleting removes everything below permanently from this device. Because your data is stored locally and never
          uploaded, there is no backup to restore from afterwards.
        </Body>
      </Callout>

      <SectionTitle>What gets deleted</SectionTitle>
      <Card tone="critical">
        {willRemove.map((item, index) => (
          <Row key={index} gap={spacing.sm} align="flex-start" style={{ marginBottom: spacing.sm }}>
            <Small muted={false} style={{ color: colors.critical }}>·</Small>
            <Small style={{ flex: 1 }}>{item}</Small>
          </Row>
        ))}
      </Card>

      <Spacer size={spacing.md} />
      <Button label="Delete account" variant="danger" disabled onPress={() => {}} />

      <Spacer size={spacing.lg} />
      <Callout tone="info" title="Confirmation flow in review">
        <Body>
          The exact wording and the confirm step for permanent deletion are being finalised with compliance before this
          is enabled. The underlying wipe is ready; only the reviewed confirmation gate is pending.
        </Body>
      </Callout>
      <Caption color={colors.textFaint}>Tracked in THEA-12a · reviewers: Benji (Audit/Compliance), CEO (product)</Caption>
    </Screen>
  );
}

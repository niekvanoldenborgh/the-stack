import { Stack } from 'expo-router';

import { Body, Callout, Card, Caption, Row, Screen, SectionTitle, Small, Spacer } from '../../src/ui/components';
import { colors, spacing } from '../../src/ui/theme';

/**
 * Privacy.
 *
 * States the app's actual data behaviour (everything is stored locally on the
 * device via AsyncStorage; there is no account server and no analytics SDK).
 * The formal, legally-worded privacy policy and any consent controls are under
 * compliance review (THEA-12a, Benji) and are intentionally not drafted here —
 * developers do not author privacy/legal copy.
 */
export default function PrivacyScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Privacy' }} />
      <Spacer size={spacing.md} />

      <SectionTitle>Where your data lives</SectionTitle>
      <Card>
        <Row justify="space-between">
          <Small>Storage</Small>
          <Small muted={false} style={{ color: colors.text }}>On this device only</Small>
        </Row>
        <Row justify="space-between" style={{ marginTop: spacing.sm }}>
          <Small>Account server</Small>
          <Small muted={false} style={{ color: colors.text }}>None</Small>
        </Row>
        <Row justify="space-between" style={{ marginTop: spacing.sm }}>
          <Small>Third-party analytics</Small>
          <Small muted={false} style={{ color: colors.text }}>None</Small>
        </Row>
      </Card>
      <Body muted>
        Your profile, stacks, dose logs and workout history are kept in local storage on your phone. They are not
        uploaded to a server, and there is no sign-in.
      </Body>

      <Callout tone="info" title="Formal policy in review">
        <Body>
          The full, legally-reviewed privacy policy and any consent settings are being finalised with our compliance
          reviewer before they ship. This screen describes current behaviour only and is not the policy itself.
        </Body>
      </Callout>

      <Caption color={colors.textFaint}>Tracked in THEA-12a · reviewer: Benji (Audit/Compliance)</Caption>
    </Screen>
  );
}

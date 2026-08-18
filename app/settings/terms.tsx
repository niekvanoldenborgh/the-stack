import { Stack } from 'expo-router';

import {
  TERMS_OF_SERVICE_BODY,
  TERMS_OF_SERVICE_LINK_LABEL,
  TERMS_OF_SERVICE_PENDING,
} from '../../src/content/termsOfService';
import { Body, Callout, Screen, Spacer } from '../../src/ui/components';
import { spacing } from '../../src/ui/theme';

/**
 * Full Terms of Service / liability agreement (THEA-93).
 *
 * Text is sourced from THEA-91 (Benji, compliance) via
 * `src/content/termsOfService.ts` — this route only renders it, it does not
 * author it (mirrors `app/settings/privacy.tsx`, THEA-12a). Reached two ways:
 * the acceptance link in onboarding, and the durable "Terms of Service" row
 * under Settings › Data & privacy, for re-reading after acceptance.
 */
export default function TermsOfServiceScreen() {
  return (
    <Screen>
      <Stack.Screen options={{ title: TERMS_OF_SERVICE_LINK_LABEL }} />
      <Spacer size={spacing.md} />

      {TERMS_OF_SERVICE_PENDING ? (
        <Callout tone="info" title="Final compliance text pending">
          <Body>
            The authoritative Terms of Service text is being finalised with our compliance reviewer and is not yet
            final. What follows is a placeholder only.
          </Body>
        </Callout>
      ) : null}

      {TERMS_OF_SERVICE_BODY.map((paragraph, index) => (
        <Body key={index} muted style={{ marginTop: spacing.md }}>
          {paragraph}
        </Body>
      ))}

      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

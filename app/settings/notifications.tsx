import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { getPermissionState, requestPermission, type PermissionState } from '../../src/lib/notifications';
import { useAppStore } from '../../src/store/useAppStore';
import type { NotificationPurposes } from '../../src/store/useAppStore';
import { Body, Callout, Screen, SectionTitle, Small, Spacer, Toggle } from '../../src/ui/components';
import { colors, spacing } from '../../src/ui/theme';

const PURPOSES: Array<{ key: keyof NotificationPurposes; label: string; description: string }> = [
  { key: 'doseReminders', label: 'Dose reminders', description: 'Alerts when a scheduled injection is due.' },
  { key: 'titrationChanges', label: 'Dose changes', description: 'When a titration step raises your dose.' },
  { key: 'cycleTransitions', label: 'Cycle changes', description: 'When a compound moves on or off cycle.' },
  { key: 'sideEffectCheckins', label: 'Check-in nudges', description: 'Occasional prompts to log how you feel.' },
];

/**
 * Per-purpose notification toggles.
 *
 * `remindersEnabled` is the master switch that actually gates OS-level dose
 * reminders (and requires notification permission). The per-purpose toggles let
 * the user silence categories independently. Dose reminders only fire when both
 * the master switch and the doseReminders purpose are on.
 */
export default function NotificationsScreen() {
  const remindersEnabled = useAppStore((s) => s.settings.remindersEnabled);
  const notifications = useAppStore((s) => s.settings.notifications);
  const setSetting = useAppStore((s) => s.setSetting);

  const [permission, setPermission] = useState<PermissionState>('undetermined');

  useEffect(() => {
    void getPermissionState().then(setPermission);
  }, []);

  const setPurpose = (key: keyof NotificationPurposes, value: boolean) =>
    setSetting('notifications', { ...notifications, [key]: value });

  const onMasterToggle = async (value: boolean) => {
    if (!value) {
      setSetting('remindersEnabled', false);
      return;
    }
    const state = await requestPermission();
    setPermission(state);
    setSetting('remindersEnabled', state === 'granted');
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Notifications' }} />
      <Spacer size={spacing.md} />

      <SectionTitle>Reminders</SectionTitle>
      <Toggle
        label="Enable reminders"
        description="Master switch. Turning this off silences every notification below."
        value={remindersEnabled}
        onChange={(v) => void onMasterToggle(v)}
      />

      {permission === 'denied' && Platform.OS !== 'web' ? (
        <Callout tone="high" title="Notifications are blocked">
          <Body>
            Your device has denied notifications for The Stack. Turn them on in your system settings, then flip the
            switch above.
          </Body>
        </Callout>
      ) : null}
      {permission === 'unsupported' ? (
        <Callout tone="info" title="Not available on web">
          <Body>Local scheduled reminders run on the iOS and Android apps. On the web build this is a no-op.</Body>
        </Callout>
      ) : null}

      <SectionTitle>Categories</SectionTitle>
      {PURPOSES.map((purpose) => (
        <Toggle
          key={purpose.key}
          label={purpose.label}
          description={purpose.description}
          value={notifications[purpose.key]}
          onChange={(v) => setPurpose(purpose.key, v)}
        />
      ))}

      <Spacer size={spacing.md} />
      <Small>
        Injection alarm timing — how far ahead each dose reminder fires — is set under Settings → Alarm.
      </Small>
    </Screen>
  );
}

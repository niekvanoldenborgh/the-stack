import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Platform, View } from 'react-native';

import { GOALS_BY_ID } from '../../src/domain/goals';
import { useAppStore } from '../../src/store/useAppStore';
import { formatLength, formatMass } from '../../src/lib/units';
import { cancelAllReminders } from '../../src/lib/notifications';
import { Caption, Display, ListRow, Screen, Small, Spacer } from '../../src/ui/components';
import { colors, spacing } from '../../src/ui/theme';

/**
 * Settings hub (THEA-4 page 5). Each row opens its own screen.
 *
 * The four data/account rows — Privacy, Manage Data, Lock App and Delete
 * Account — are handled with extra care: Lock App is non-destructive (it only
 * re-locks the disclaimer gate, keeping local data — see THEA-12a F1, which
 * is what made that guarantee actually true), while Privacy, Manage Data and
 * Delete Account carry legal/irreversible weight and are gated behind
 * compliance review (see THEA-12a) rather than shipping unreviewed copy.
 *
 * "Lock App", not "Log out": there is no account or sign-in anywhere in this
 * app (THEA-12a §0) and that label would promise protection the app does not
 * provide (THEA-12a F2).
 */

function Chevron() {
  return <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />;
}

export default function SettingsScreen() {
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const settings = useAppStore((s) => s.settings);
  const updateProfile = useAppStore((s) => s.updateProfile);

  const goalSummary =
    profile && profile.goals.length > 0
      ? profile.goals.map((g) => GOALS_BY_ID[g]?.label ?? g).join(', ')
      : 'No goals set';

  const infoSummary = profile
    ? `${profile.age} yrs · ${formatMass(profile.weightKg, settings.massUnit)} · ${formatLength(profile.heightCm, settings.lengthUnit)}`
    : 'Complete your profile';

  const activeNotifications = [
    settings.notifications.doseReminders && settings.remindersEnabled,
    settings.notifications.titrationChanges,
    settings.notifications.cycleTransitions,
    settings.notifications.sideEffectCheckins,
  ].filter(Boolean).length;

  const alarmSummary =
    settings.alarmOffsetsMin.length === 1 && settings.alarmOffsetsMin[0] === 0
      ? 'At injection time'
      : `${settings.alarmOffsetsMin.length} alert${settings.alarmOffsetsMin.length === 1 ? '' : 's'} per dose`;

  const LOCK_MESSAGE =
    'You will need to accept the safety disclaimer again to get back in. Nothing is deleted — your profile, stacks and logs stay on this device.';

  const lockApp = () => {
    // Reminders live in the OS, not AsyncStorage — leaving them scheduled
    // would keep naming the user's compounds on the lock screen of an app
    // they just locked (THEA-12a §5). onboarding re-syncs them on unlock.
    void cancelAllReminders();
    // Non-destructive: re-locks the disclaimer gate, keeps all local data.
    // True as of THEA-12a F1 — onboarding now merges into the existing
    // profile on re-entry instead of overwriting it with fresh defaults.
    updateProfile({ acceptedDisclaimerAt: undefined });
    router.replace('/');
  };

  const onLogOut = () => {
    if (Platform.OS === 'web') {
      // Alert has no buttons on web; fall back to confirm().
      // eslint-disable-next-line no-alert
      if (typeof confirm === 'function' && !confirm(`Lock the app?\n\n${LOCK_MESSAGE}`)) return;
      lockApp();
      return;
    }
    Alert.alert('Lock the app?', LOCK_MESSAGE, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Lock', onPress: lockApp },
    ]);
  };

  return (
    <Screen>
      <Spacer size={spacing.md} />
      <Display>Settings</Display>

      <Caption color={colors.textMuted}>Profile</Caption>
      <Spacer size={spacing.sm} />
      <ListRow title="Goals" subtitle={goalSummary} right={<Chevron />} onPress={() => router.push('/settings/goals')} />
      <ListRow title="My Info" subtitle={infoSummary} right={<Chevron />} onPress={() => router.push('/settings/my-info')} />
      <ListRow
        title="Measurement units"
        subtitle={`${settings.massUnit === 'kg' ? 'Kilograms' : 'Pounds'} · ${settings.lengthUnit === 'cm' ? 'Centimetres' : 'Feet & inches'}`}
        right={<Chevron />}
        onPress={() => router.push('/settings/units')}
      />

      <Caption color={colors.textMuted}>Reminders</Caption>
      <Spacer size={spacing.sm} />
      <ListRow title="Alarm" subtitle={alarmSummary} right={<Chevron />} onPress={() => router.push('/settings/alarm')} />
      <ListRow
        title="Notifications"
        subtitle={`${activeNotifications} of 4 categories on`}
        right={<Chevron />}
        onPress={() => router.push('/settings/notifications')}
      />

      <Caption color={colors.textMuted}>App</Caption>
      <Spacer size={spacing.sm} />
      <ListRow
        title="Theme"
        subtitle={settings.theme === 'dark' ? 'Dark' : 'System'}
        right={<Chevron />}
        onPress={() => router.push('/settings/theme')}
      />
      <ListRow
        title="Library"
        subtitle="Every compound, with sources"
        right={<Chevron />}
        onPress={() => router.push('/settings/library')}
      />

      <Caption color={colors.textMuted}>Data & privacy</Caption>
      <Spacer size={spacing.sm} />
      <ListRow title="Privacy" subtitle="How your data is stored" right={<Chevron />} onPress={() => router.push('/settings/privacy')} />
      <ListRow title="Manage data" subtitle="Export as PDF, CSV or JSON" right={<Chevron />} onPress={() => router.push('/settings/manage-data')} />

      <Caption color={colors.textMuted}>Account</Caption>
      <Spacer size={spacing.sm} />
      <ListRow
        title="Lock app"
        subtitle="Re-locks the safety disclaimer. Your data stays on this device."
        onPress={onLogOut}
        right={<Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />}
      />
      <ListRow
        title="Delete account"
        tone="critical"
        right={<Ionicons name="trash-outline" size={18} color={colors.critical} />}
        onPress={() => router.push('/settings/delete-account')}
      />

      <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
        <Small>The Stack — educational use only. Not medical advice.</Small>
      </View>
    </Screen>
  );
}

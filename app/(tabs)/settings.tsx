import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Platform, View } from 'react-native';

import { GOALS_BY_ID } from '../../src/domain/goals';
import { useAppStore } from '../../src/store/useAppStore';
import { formatLength, formatMass } from '../../src/lib/units';
import { cancelAllReminders } from '../../src/lib/notifications';
import { Display, Screen, Small, Spacer } from '../../src/ui/components';
import { List, ListItem, Section } from '../../src/ui/primitives';
import { spacing, useTheme } from '../../src/ui/theme';

/**
 * Settings hub (THEA-4 page 5, design transform THEA-52). Each row opens its
 * own screen.
 *
 * Rebuilt on `Section`/`List`/`ListItem` (THEA-38 primitives) — this screen
 * predated that redesign and was the one surface still on the flat bordered
 * `ListRow`, so its five groups read as a wall of identical boxes next to
 * Summary/Logger/Results reading as fixed hierarchy. Grouping is unchanged;
 * only the anatomy is.
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
  const { color } = useTheme();
  return <Ionicons name="chevron-forward" size={18} color={color.textTertiary} />;
}

export default function SettingsScreen() {
  const theme = useTheme();
  const { color } = theme;
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
    updateProfile({ acceptedDisclaimerAt: undefined, acceptedTermsAt: undefined });
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

      <Section title="Profile">
        <List>
          <ListItem title="Goals" detail={goalSummary} meta={<Chevron />} onPress={() => router.push('/settings/goals')} />
          <ListItem title="My Info" detail={infoSummary} meta={<Chevron />} onPress={() => router.push('/settings/my-info')} />
          <ListItem
            title="Measurement units"
            detail={`${settings.massUnit === 'kg' ? 'Kilograms' : 'Pounds'} · ${settings.lengthUnit === 'cm' ? 'Centimetres' : 'Feet & inches'}`}
            meta={<Chevron />}
            onPress={() => router.push('/settings/units')}
          />
        </List>
      </Section>

      <Section title="Reminders">
        <List>
          <ListItem title="Alarm" detail={alarmSummary} meta={<Chevron />} onPress={() => router.push('/settings/alarm')} />
          <ListItem
            title="Notifications"
            detail={`${activeNotifications} of 4 categories on`}
            meta={<Chevron />}
            onPress={() => router.push('/settings/notifications')}
          />
        </List>
      </Section>

      <Section title="App">
        <List>
          <ListItem
            title="Theme"
            detail={settings.theme === 'dark' ? 'Dark' : 'System'}
            meta={<Chevron />}
            onPress={() => router.push('/settings/theme')}
          />
          <ListItem
            title="Library"
            detail="Every compound, with sources"
            meta={<Chevron />}
            onPress={() => router.push('/settings/library')}
          />
        </List>
      </Section>

      <Section title="Data & privacy">
        <List>
          <ListItem title="Privacy" detail="How your data is stored" meta={<Chevron />} onPress={() => router.push('/settings/privacy')} />
          <ListItem
            title="Manage data"
            detail="Export as PDF, CSV or JSON"
            meta={<Chevron />}
            onPress={() => router.push('/settings/manage-data')}
          />
          <ListItem
            title="Terms of Service"
            detail="The agreement you accepted during setup"
            meta={<Chevron />}
            onPress={() => router.push('/settings/terms')}
          />
        </List>
      </Section>

      <Section title="Account" last>
        <List>
          <ListItem
            title="Lock app"
            detail="Re-locks the safety disclaimer. Your data stays on this device."
            onPress={onLogOut}
            meta={<Ionicons name="lock-closed-outline" size={18} color={color.textSecondary} />}
          />
          <ListItem
            title="Delete account"
            tone="critical"
            meta={<Ionicons name="trash-outline" size={18} color={theme.tone('critical').fg} />}
            onPress={() => router.push('/settings/delete-account')}
          />
        </List>
      </Section>

      <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
        <Small>The Stack — educational use only. Not medical advice.</Small>
      </View>
    </Screen>
  );
}

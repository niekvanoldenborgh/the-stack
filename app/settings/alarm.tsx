import { Stack } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useAppStore } from '../../src/store/useAppStore';
import { Body, Callout, Card, Caption, Row, Screen, SectionTitle, Small, Spacer } from '../../src/ui/components';
import { radius, spacing, useTheme } from '../../src/ui/theme';

/**
 * Injection-alarm timing.
 *
 * The user builds the set of alerts fired around each scheduled injection. `0`
 * is an alert at the injection time itself; any positive value is a lead-in
 * (e.g. two minutes before). The chosen offsets are stored on
 * `settings.alarmOffsetsMin` and consumed by `syncReminders`, which fans every
 * dose out into one notification per offset. The Summary screen reads the same
 * config to describe the next alert.
 */

const PRESETS: Array<{ min: number; label: string }> = [
  { min: 0, label: 'At injection time' },
  { min: 2, label: '2 min before' },
  { min: 5, label: '5 min before' },
  { min: 10, label: '10 min before' },
  { min: 15, label: '15 min before' },
  { min: 30, label: '30 min before' },
  { min: 60, label: '1 hour before' },
];

function offsetLabel(min: number): string {
  if (min === 0) return 'at injection time';
  if (min >= 60) return `${min / 60} hour${min === 60 ? '' : 's'} before`;
  return `${min} min before`;
}

export default function AlarmScreen() {
  const theme = useTheme();
  const { color } = theme;
  const offsets = useAppStore((s) => s.settings.alarmOffsetsMin);
  const remindersEnabled = useAppStore((s) => s.settings.remindersEnabled);
  const setSetting = useAppStore((s) => s.setSetting);

  const toggle = (min: number) => {
    const next = offsets.includes(min) ? offsets.filter((m) => m !== min) : [...offsets, min];
    // Keep sorted, unique, high-to-low; never persist an empty set — an empty
    // set would silently drop the at-time alert. Fall back to [0].
    const cleaned = Array.from(new Set(next)).sort((a, b) => b - a);
    setSetting('alarmOffsetsMin', cleaned.length > 0 ? cleaned : [0]);
  };

  const sortedActive = [...offsets].sort((a, b) => b - a);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Alarm' }} />
      <Spacer size={spacing.md} />
      <Body muted>
        Choose when to be alerted for each scheduled injection. Pick more than one to get, say, a heads-up two minutes
        before and again at the exact time.
      </Body>

      <SectionTitle>Alerts per dose</SectionTitle>
      {PRESETS.map((preset) => {
        const active = offsets.includes(preset.min);
        return (
          <Pressable
            key={preset.min}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            onPress={() => toggle(preset.min)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: color.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: active ? color.primary : color.border,
              padding: spacing.md,
              marginBottom: spacing.sm,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                borderWidth: 1.5,
                borderColor: active ? color.primary : color.borderStrong,
                backgroundColor: active ? color.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {active ? <Body style={{ color: color.onPrimary, fontSize: 13 }}>✓</Body> : null}
            </View>
            <Body style={{ flex: 1, color: color.textPrimary }}>{preset.label}</Body>
          </Pressable>
        );
      })}

      <Card style={{ marginTop: spacing.md }}>
        <Caption color={color.textSecondary}>For a dose scheduled at 22:30 you will be alerted</Caption>
        <Spacer size={spacing.sm} />
        {sortedActive.map((min) => (
          <Row key={min} justify="space-between" style={{ marginBottom: spacing.xs }}>
            <Small muted={false} style={{ color: color.textPrimary }}>
              {offsetLabel(min)}
            </Small>
            <Small>
              {(() => {
                const total = 22 * 60 + 30 - min;
                const h = Math.floor(total / 60);
                const m = total % 60;
                return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
              })()}
            </Small>
          </Row>
        ))}
      </Card>

      {!remindersEnabled ? (
        <Callout tone="moderate" title="Reminders are off">
          <Body>
            These alarm times only fire when dose reminders are turned on. Enable them under Settings → Notifications.
          </Body>
        </Callout>
      ) : null}
    </Screen>
  );
}

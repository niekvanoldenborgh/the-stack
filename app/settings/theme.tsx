import { Stack } from 'expo-router';
import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { useAppStore } from '../../src/store/useAppStore';
import type { ThemePreference } from '../../src/store/useAppStore';
import { Body, Row, Screen, SectionTitle, Small, Spacer } from '../../src/ui/components';
import { radius, spacing, useTheme } from '../../src/ui/theme';

type Option = { value: ThemePreference; label: string; hint: string };

const OPTIONS: Option[] = [
  { value: 'system', label: 'System', hint: 'Match your device setting' },
  { value: 'light', label: 'Light', hint: 'Bright surfaces, for daytime use' },
  { value: 'dark', label: 'Dark', hint: 'Low-light, for evening use' },
];

/**
 * Theme preference (PULSE — THEA-69).
 *
 * Light is a real theme now, not a stub — this screen used to show it
 * disabled with a "coming soon" note while the app shipped Dark only. Both
 * palettes preserve the same load-bearing colour relationships (severity
 * scale vs brand accent, evidence badges, single-hue charts); see the
 * THEA-68 design spec.
 */
export default function ThemeScreen() {
  const theme = useTheme();
  const { color } = theme;
  const preference = useAppStore((s) => s.settings.theme);
  const setSetting = useAppStore((s) => s.setSetting);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Theme' }} />
      <Spacer size={spacing.md} />
      <SectionTitle>Appearance</SectionTitle>

      {OPTIONS.map((option) => {
        const selected = option.value === preference;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => setSetting('theme', option.value)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: color.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: selected ? color.primary : color.border,
              padding: spacing.md,
              marginBottom: spacing.sm,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: selected ? color.primary : color.borderStrong,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? color.primarySolid : 'transparent',
              }}
            >
              {selected ? <Check size={13} color={color.onPrimary} strokeWidth={3} /> : null}
            </View>
            <Row style={{ flex: 1 }} gap={0}>
              <View style={{ flex: 1 }}>
                <Body>{option.label}</Body>
                <Small style={{ marginTop: 2 }}>{option.hint}</Small>
              </View>
            </Row>
          </Pressable>
        );
      })}
    </Screen>
  );
}

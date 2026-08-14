import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useAppStore } from '../../src/store/useAppStore';
import type { ThemePreference } from '../../src/store/useAppStore';
import { Body, Callout, Row, Screen, SectionTitle, Small, Spacer } from '../../src/ui/components';
import { colors, radius, spacing } from '../../src/ui/theme';

type Option = { value: ThemePreference | 'light'; label: string; hint: string; disabled?: boolean };

const OPTIONS: Option[] = [
  { value: 'system', label: 'System', hint: 'Match your device setting' },
  { value: 'dark', label: 'Dark', hint: 'The calibrated laboratory theme' },
  { value: 'light', label: 'Light', hint: 'Coming soon', disabled: true },
];

/**
 * Theme preference.
 *
 * The app currently ships one palette — the dark "laboratory notebook" theme —
 * where colour is load-bearing (severity scale vs brand accent). A light
 * palette is a cross-cutting change tracked in THEA-12a; until it lands, Light
 * is shown but disabled so the choice is honest.
 */
export default function ThemeScreen() {
  const theme = useAppStore((s) => s.settings.theme);
  const setSetting = useAppStore((s) => s.setSetting);

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Theme' }} />
      <Spacer size={spacing.md} />
      <SectionTitle>Appearance</SectionTitle>

      {OPTIONS.map((option) => {
        const selected = option.value === theme;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: option.disabled }}
            onPress={option.disabled ? undefined : () => setSetting('theme', option.value as ThemePreference)}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: selected ? colors.accent : colors.border,
              padding: spacing.md,
              marginBottom: spacing.sm,
              opacity: option.disabled ? 0.5 : pressed ? 0.8 : 1,
            })}
          >
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: 2,
                borderColor: selected ? colors.accent : colors.borderBright,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected ? (
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent }} />
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <Body style={{ color: colors.text }}>{option.label}</Body>
              <Small style={{ marginTop: 2 }}>{option.hint}</Small>
            </View>
            {option.disabled ? <Ionicons name="time-outline" size={18} color={colors.textFaint} /> : null}
          </Pressable>
        );
      })}

      <Callout tone="info" title="Why dark-first">
        <Body>
          Colour carries meaning in this app — the rose→amber severity scale and the lime accent are kept distinct so a
          warning is never mistaken for a highlight. A light palette has to preserve those relationships, so it is being
          built and validated separately rather than flipped on.
        </Body>
      </Callout>
    </Screen>
  );
}

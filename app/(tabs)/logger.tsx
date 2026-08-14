import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Display, EmptyState, Screen, Spacer } from '../../src/ui/components';
import { colors, fonts, radius, spacing } from '../../src/ui/theme';

type Mode = 'injection' | 'side-effect';

const MODES: { key: Mode; label: string }[] = [
  { key: 'injection', label: 'Injection' },
  { key: 'side-effect', label: 'Side-effect' },
];

export default function LoggerScreen() {
  const [mode, setMode] = useState<Mode>('injection');

  return (
    <Screen>
      <Display>Logger</Display>
      <Spacer size={spacing.lg} />

      <View style={styles.segments}>
        {MODES.map((m) => {
          const active = m.key === mode;
          return (
            <Pressable
              key={m.key}
              onPress={() => setMode(m.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.segment,
                {
                  backgroundColor: active ? colors.accentDim : colors.surface,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}
            >
              <Text style={[styles.segmentLabel, { color: active ? colors.accent : colors.textMuted }]}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Spacer size={spacing.xl} />

      {mode === 'injection' ? (
        <EmptyState title="Log an injection" body="Injection logging will live here." />
      ) : (
        <EmptyState title="Log a side-effect" body="Side-effect logging will live here." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
  },
  segmentLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 14,
    letterSpacing: -0.1,
  },
});

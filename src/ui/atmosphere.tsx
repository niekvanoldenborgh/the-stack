import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { useTheme } from './theme';

/**
 * Background texture (PULSE — THEA-69).
 *
 * PULSE explicitly rejects lab/telemetry cues (graph-paper grids, per-screen
 * texture). What's left is one thing: a very low-intensity wash of the brand
 * violet bleeding down from the top of a hero screen, giving the surface
 * somewhere to fall away to. `HeroGlow` sits at very low opacity and is
 * `pointerEvents="none"`, so it adds depth without competing with
 * safety-critical text or intercepting touches.
 */

/**
 * A wash of brand-colour light behind the header. Intensity is capped low —
 * ≤0.06 in light mode, ≤0.10 in dark — so it reads as atmosphere, not a tint
 * on the content itself (design spec §3.7).
 */
export function HeroGlow({ tint, height = 280, intensity }: { tint?: string; height?: number; intensity?: number }) {
  const theme = useTheme();
  const resolvedTint = tint ?? theme.color.primary;
  const resolvedIntensity = intensity ?? (theme.mode === 'dark' ? 0.1 : 0.06);
  const alpha = Math.round(resolvedIntensity * 255)
    .toString(16)
    .padStart(2, '0');

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}>
      <LinearGradient
        colors={[`${resolvedTint}${alpha}`, `${resolvedTint}00`]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ flex: 1 }}
      />
    </View>
  );
}

/** For screens that open with a hero. A single soft glow layer — no grid, no
 *  per-screen texture (see file doc-comment above). */
export function ScreenAtmosphere({ tint }: { tint?: string }) {
  return <HeroGlow tint={tint} />;
}

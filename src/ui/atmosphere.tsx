import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { colors } from './theme';

/**
 * Background texture.
 *
 * The dark "lab notebook" theme used a faint graph-paper ruling plus this
 * glow; on a white/near-white surface a ruled grid reads as clutter rather
 * than instrument texture, so the light theme keeps only the glow — a soft
 * wash of accent light behind the header — and drops the grid entirely.
 * `HeroGlow` sits at very low opacity and is `pointerEvents="none"`, so it
 * adds depth without competing with safety-critical text or intercepting
 * touches.
 */

/**
 * A wash of accent light bleeding down from the top of a screen. Anchors the
 * header and gives the white surface somewhere to fall away to.
 */
export function HeroGlow({
  tint = colors.accent,
  height = 280,
  intensity = 0.06,
}: {
  tint?: string;
  height?: number;
  intensity?: number;
}) {
  const alpha = Math.round(intensity * 255)
    .toString(16)
    .padStart(2, '0');

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height }}>
      <LinearGradient
        colors={[`${tint}${alpha}`, `${tint}00`]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ flex: 1 }}
      />
    </View>
  );
}

/** For screens that open with a hero. A single soft glow layer — see the file
 *  doc-comment above for why the old grid ruling was dropped. */
export function ScreenAtmosphere({ tint = colors.accent }: { tint?: string }) {
  return <HeroGlow tint={tint} />;
}

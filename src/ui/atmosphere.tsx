import { LinearGradient } from 'expo-linear-gradient';
import { View } from 'react-native';

import { colors } from './theme';

/**
 * Background texture.
 *
 * A flat fill reads as unfinished, but a dark app also cannot afford loud
 * decoration behind safety-critical text. Both pieces here sit at very low
 * opacity and are `pointerEvents="none"`, so they add depth without competing
 * with content or intercepting touches.
 */

/**
 * A wash of accent light bleeding down from the top of a screen. Anchors the
 * header and gives the near-black surface somewhere to fall away to.
 */
export function HeroGlow({
  tint = colors.accent,
  height = 320,
  intensity = 0.1,
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

/**
 * Faint graph-paper ruling — the lab-notebook cue the whole theme is built on.
 *
 * Drawn as a fixed set of hairline Views rather than a repeating image so it
 * costs nothing to load and scales with the container.
 */
export function GridBackdrop({
  rows = 9,
  columns = 6,
  opacity = 0.045,
  height = 340,
}: {
  rows?: number;
  columns?: number;
  opacity?: number;
  height?: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height, overflow: 'hidden' }}
    >
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={`r${index}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: (index + 1) * (height / (rows + 1)),
            height: 1,
            backgroundColor: colors.text,
            opacity,
          }}
        />
      ))}
      {Array.from({ length: columns }, (_, index) => (
        <View
          key={`c${index}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${((index + 1) * 100) / (columns + 1)}%`,
            width: 1,
            backgroundColor: colors.text,
            opacity,
          }}
        />
      ))}
    </View>
  );
}

/** Both layers together, for screens that open with a hero. */
export function ScreenAtmosphere({ tint = colors.accent }: { tint?: string }) {
  return (
    <>
      <GridBackdrop />
      <HeroGlow tint={tint} />
    </>
  );
}

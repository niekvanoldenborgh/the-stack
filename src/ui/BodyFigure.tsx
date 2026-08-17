import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { InjectionSite } from '../domain/types';
import { fonts, radius, spacing, useTheme } from './theme';

/**
 * Human-readable names for each injection site, from the user's own point of
 * view (their left, their right). Exported so lists elsewhere can label a
 * logged injection without re-deriving the mapping.
 */
export const INJECTION_SITE_LABELS: Record<InjectionSite, string> = {
  abdomen_left: 'Abdomen, left',
  abdomen_right: 'Abdomen, right',
  thigh_left: 'Thigh, left',
  thigh_right: 'Thigh, right',
  upper_arm_left: 'Upper arm, left',
  upper_arm_right: 'Upper arm, right',
  glute_left: 'Glute, left',
  glute_right: 'Glute, right',
};

/**
 * A pad on the figure. `box` is absolute layout inside the 220×360 frame; the
 * two-line `label` keeps each pad readable at this size.
 */
interface Zone {
  site: InjectionSite;
  label: string;
  box: { top: number; height: number; width: number; left?: number; right?: number };
}

const ZONES: Zone[] = [
  { site: 'upper_arm_left', label: 'Arm\nL', box: { left: 6, top: 60, width: 40, height: 96 } },
  { site: 'upper_arm_right', label: 'Arm\nR', box: { right: 6, top: 60, width: 40, height: 96 } },
  { site: 'abdomen_left', label: 'Abd\nL', box: { left: 62, top: 56, width: 44, height: 60 } },
  { site: 'abdomen_right', label: 'Abd\nR', box: { left: 114, top: 56, width: 44, height: 60 } },
  { site: 'glute_left', label: 'Glute\nL', box: { left: 62, top: 124, width: 44, height: 40 } },
  { site: 'glute_right', label: 'Glute\nR', box: { left: 114, top: 124, width: 44, height: 40 } },
  { site: 'thigh_left', label: 'Thigh\nL', box: { left: 62, top: 172, width: 44, height: 150 } },
  { site: 'thigh_right', label: 'Thigh\nR', box: { left: 114, top: 172, width: 44, height: 150 } },
];

/**
 * A schematic body figure the user taps to mark where they injected.
 *
 * Deliberately drawn with plain Views rather than an SVG dependency — the same
 * choice `Logo` makes. Left and right are the user's own (see the site labels),
 * and a caption at the call site says so, because a mirrored front figure is
 * the usual source of confusion here.
 */
export function BodyFigure({
  value,
  onChange,
}: {
  value: InjectionSite | null;
  onChange: (site: InjectionSite) => void;
}) {
  const theme = useTheme();
  const { color } = theme;
  return (
    <View style={styles.frame}>
      {/* Head + torso silhouette, purely decorative. */}
      <View style={[styles.head, { backgroundColor: color.surface, borderColor: color.border }]} />
      <View style={[styles.torso, { backgroundColor: color.surface, borderColor: color.border }]} />

      {ZONES.map((zone) => {
        const active = zone.site === value;
        const { left, right, top, width, height } = zone.box;
        return (
          <Pressable
            key={zone.site}
            accessibilityRole="button"
            accessibilityLabel={INJECTION_SITE_LABELS[zone.site]}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(zone.site)}
            style={({ pressed }) => [
              styles.zone,
              { left, right, top, width, height },
              {
                backgroundColor: active ? theme.tone('accent').bg : color.surfaceMuted,
                borderColor: active ? color.primary : color.borderStrong,
                opacity: pressed ? 0.75 : 1,
              },
            ]}
          >
            <Text style={[styles.zoneLabel, { color: active ? color.primary : color.textSecondary }]}>
              {zone.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: 220,
    height: 340,
    alignSelf: 'center',
    position: 'relative',
  },
  head: {
    position: 'absolute',
    top: 4,
    left: 90,
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  torso: {
    position: 'absolute',
    top: 48,
    left: 56,
    width: 108,
    height: 280,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  zone: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.xs,
  },
  zoneLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    lineHeight: 14,
    textAlign: 'center',
  },
});

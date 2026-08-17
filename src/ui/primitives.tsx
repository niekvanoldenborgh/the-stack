import { LinearGradient } from 'expo-linear-gradient';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Caption, Row, Small } from './components';
import { radius, spacing, typography, useTheme, type Elevation, type SeverityTone } from './theme';

/**
 * Redesign primitives (THEA-38, retinted for PULSE — THEA-69).
 *
 * The house style before THEA-38 was "border around everything, uniform
 * padding, no focal point" — every screen read as a stack of identical
 * bordered cards. These four primitives are the fix, and every screen
 * should reach for these instead of a bespoke `Card`:
 *
 *  1. `Section` — groups content by surface tone, not a border.
 *  2. `FocalMetric` — the one oversized number a screen is about.
 *  3. `Disclosure` — progressive disclosure for secondary/reference prose.
 *  4. `List` / `ListItem` — a real list row instead of hand-typed bullets.
 */

// ---------------------------------------------------------------------------
// 1. Section — borderless grouping via surface tone + shadow
// ---------------------------------------------------------------------------

/**
 * Groups related content into one tone-shifted panel. Spacing carries the
 * hierarchy: a large gap separates one Section from the next, a tight gap
 * separates the rows inside it. No border — elevation reads through the
 * theme's tier shadow (`surfaceStyle`, `src/ui/theme.ts`), which is a soft
 * drop shadow in light mode and mainly a tone step in dark mode.
 */
export function Section({
  children,
  title,
  action,
  tone = 1,
  gap = spacing.md,
  last = false,
  gradient = false,
  style,
}: {
  children: ReactNode;
  /** Rendered as a caption above the panel, outside the tone shift. */
  title?: string;
  action?: ReactNode;
  /** Elevation step for the panel background. Most sections want 1; the one
   *  focal block a screen leads with wants 2 (or 3 for a full hero). */
  tone?: Elevation;
  /** Vertical gap between direct children inside the panel. */
  gap?: number;
  /** Drop the trailing margin — for the last section on a screen. */
  last?: boolean;
  /** Fill with the brand gradient instead of a flat surface. Hero/summary
   *  elements only (design spec §3.3) — content inside should use
   *  `theme.color.onPrimary`. */
  gradient?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const panelRadius = tone >= 3 ? radius.xl : radius.lg;
  const surface = theme.surface(tone);

  return (
    <View style={[{ marginBottom: last ? 0 : spacing.xxl }, style]}>
      {title ? (
        <Row justify="space-between" align="center" style={{ marginBottom: spacing.sm }}>
          <Caption>{title}</Caption>
          {action}
        </Row>
      ) : null}
      {gradient ? (
        <LinearGradient
          colors={theme.color.accentGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[{ borderRadius: panelRadius, padding: spacing.xl, gap }, theme.shadow(tone)]}
        >
          {children}
        </LinearGradient>
      ) : (
        <View style={[{ borderRadius: panelRadius, padding: spacing.xl, gap }, surface]}>{children}</View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 2. FocalMetric — one oversized primary figure per screen
// ---------------------------------------------------------------------------

/**
 * The single number a screen exists to show. Everything else on that screen
 * should be typographically smaller than this — hierarchy through scale, not
 * through boxing every element identically.
 */
export function FocalMetric({
  eyebrow,
  value,
  unit,
  meta,
  tone,
  metaTone,
  children,
  style,
}: {
  /** Short label above the figure — what this number is. */
  eyebrow?: string;
  /** The figure itself. A short string, set in the largest weight. */
  value: string;
  /** Trailing unit, set smaller and muted, e.g. "mcg" or "in 6h". */
  unit?: string;
  /** A line below the figure — context, not a repeat of the eyebrow. */
  meta?: string;
  /** Figure colour. Defaults to `textPrimary`; pass `theme.color.onPrimary`
   *  on a gradient hero. */
  tone?: string;
  /** Colour for `meta`/`unit`; defaults to `textSecondary`. */
  metaTone?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const figureColor = tone ?? theme.color.textPrimary;
  const metaColor = metaTone ?? theme.color.textSecondary;
  return (
    <View style={style}>
      {eyebrow ? <Caption color={theme.color.primary}>{eyebrow}</Caption> : null}
      <Row align="flex-end" gap={spacing.xs} style={{ marginTop: eyebrow ? spacing.xs : 0 }}>
        <Text style={[typography.metric, { color: figureColor }]}>{value}</Text>
        {unit ? <Text style={[typography.data, { color: metaColor, marginBottom: 8 }]}>{unit}</Text> : null}
      </Row>
      {meta ? (
        <Small muted={false} style={{ marginTop: spacing.xs, color: metaColor }}>
          {meta}
        </Small>
      ) : null}
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 3. Disclosure — progressive disclosure, tap to expand
// ---------------------------------------------------------------------------

/**
 * Hides secondary or reference-grade content (long PK methodology, source
 * citations, "worth knowing" asides) behind a tap instead of stacking it
 * inline. The collapsed summary line must still say something real — this is
 * for de-prioritising prose, never for hiding a safety disclaimer entirely.
 */
export function Disclosure({
  label,
  summary,
  children,
  defaultOpen = false,
  tone,
}: {
  label: string;
  /** Shown under the label while collapsed. */
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  tone?: SeverityTone;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const fg = tone ? theme.tone(tone).fg : theme.color.textPrimary;

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={label}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
      >
        <Row justify="space-between" align="flex-start" gap={spacing.md}>
          <View style={{ flex: 1 }}>
            <Small muted={false} style={{ color: fg, textDecorationLine: open ? undefined : 'underline' }}>
              {label}
            </Small>
            {!open && summary ? <Small style={{ marginTop: 2 }}>{summary}</Small> : null}
          </View>
          {open ? (
            <ChevronUp size={16} color={theme.color.textSecondary} />
          ) : (
            <ChevronDown size={16} color={theme.color.textSecondary} />
          )}
        </Row>
      </Pressable>
      {open ? <View style={{ marginTop: spacing.md }}>{children}</View> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 4. List / ListItem — a real list row
// ---------------------------------------------------------------------------

/** Wraps a run of `ListItem`s with the tight internal gap the row style expects. */
export function List({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ gap: spacing.md }, style]}>{children}</View>;
}

/**
 * One list row. Replaces every hand-typed `·` / `☐` glyph bullet in the old
 * screens — the leading marker is drawn (a dot, a check, or a passed-in
 * icon), never typed as a text character, so it can't collide with real
 * content and reads correctly to a screen reader.
 */
export function ListItem({
  icon,
  title,
  detail,
  meta,
  tone,
  checked,
  onPress,
  children,
}: {
  /** A lucide icon element, e.g. `<Syringe size={16} color={theme.color.textSecondary} />`. */
  icon?: ReactNode;
  title: string;
  detail?: string;
  /** Right-aligned trailing content — a value, a badge. */
  meta?: ReactNode;
  tone?: SeverityTone;
  /** Renders a checklist mark instead of a dot/icon; for monitoring-style lists. */
  checked?: boolean;
  onPress?: () => void;
  /** Extra content below `detail`, full width within the row — e.g. a progress bar. */
  children?: ReactNode;
}) {
  const theme = useTheme();
  const { color } = theme;
  const markColor = tone ? theme.tone(tone).fg : checked ? theme.tone('success').fg : color.primary;
  const Wrapper = onPress ? Pressable : View;

  return (
    <Wrapper
      {...(onPress ? { accessibilityRole: 'button' as const, onPress } : {})}
      style={onPress ? ({ pressed }: { pressed: boolean }) => ({ opacity: pressed ? 0.7 : 1 }) : undefined}
    >
      <Row align="flex-start" gap={spacing.md}>
        <View style={{ width: 18, alignItems: 'center', marginTop: 3 }}>
          {icon ??
            (checked !== undefined ? (
              <View
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  borderWidth: 1.5,
                  borderColor: checked ? markColor : color.borderStrong,
                  backgroundColor: checked ? markColor : 'transparent',
                }}
              />
            ) : (
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: markColor, marginTop: 7 }} />
            ))}
        </View>
        <View style={{ flex: 1 }}>
          <Row justify="space-between" align="flex-start" gap={spacing.md}>
            <Text style={[typography.body, { color: color.textPrimary, flex: 1 }]}>{title}</Text>
            {meta}
          </Row>
          {detail ? <Small style={{ marginTop: 2 }}>{detail}</Small> : null}
          {children ? <View style={{ marginTop: spacing.sm }}>{children}</View> : null}
        </View>
      </Row>
    </Wrapper>
  );
}

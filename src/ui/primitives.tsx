import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Caption, Row, Small } from './components';
import { colors, elevation, fonts, radius, spacing, toneColors, typography, type Elevation, type SeverityTone } from './theme';

/**
 * Redesign primitives (THEA-38).
 *
 * The house style before this file was "border around everything, uniform
 * padding, no focal point" — every screen read as a stack of identical
 * bordered cards. These four primitives are the fix, and every screen that
 * gets redesigned should reach for these instead of a bespoke `Card`:
 *
 *  1. `Section` — groups content by surface tone, not a border.
 *  2. `FocalMetric` — the one oversized number a screen is about.
 *  3. `Disclosure` — progressive disclosure for secondary/reference prose.
 *  4. `List` / `ListItem` — a real list row instead of hand-typed bullets.
 */

// ---------------------------------------------------------------------------
// 1. Section — borderless grouping via surface-tone shift
// ---------------------------------------------------------------------------

/**
 * Groups related content into one tone-shifted panel. Spacing carries the
 * hierarchy: a large gap separates one Section from the next, a tight gap
 * separates the rows inside it. No border — reserve outlines for edges a
 * user can actually press.
 */
export function Section({
  children,
  title,
  action,
  tone = 1,
  gap = spacing.md,
  last = false,
  style,
}: {
  children: ReactNode;
  /** Rendered as a caption above the panel, outside the tone shift. */
  title?: string;
  action?: ReactNode;
  /** Elevation step for the panel background. Most sections want 1. */
  tone?: Elevation;
  /** Vertical gap between direct children inside the panel. */
  gap?: number;
  /** Drop the trailing margin — for the last section on a screen. */
  last?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ marginBottom: last ? 0 : spacing.xxl }, style]}>
      {title ? (
        <Row justify="space-between" align="center" style={{ marginBottom: spacing.sm }}>
          <Caption color={colors.textMuted}>{title}</Caption>
          {action}
        </Row>
      ) : null}
      <View style={{ backgroundColor: elevation[tone], borderRadius: radius.lg, padding: spacing.lg, gap }}>
        {children}
      </View>
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
  tone = colors.text,
  children,
  style,
}: {
  /** Short label above the figure — what this number is. */
  eyebrow?: string;
  /** The figure itself. A short string, set in the largest mono weight. */
  value: string;
  /** Trailing unit, set smaller and muted, e.g. "mcg" or "in 6h". */
  unit?: string;
  /** A line below the figure — context, not a repeat of the eyebrow. */
  meta?: string;
  tone?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={style}>
      {eyebrow ? <Caption color={colors.accent}>{eyebrow}</Caption> : null}
      <Row align="flex-end" gap={spacing.xs} style={{ marginTop: eyebrow ? spacing.xs : 0 }}>
        <Text style={{ fontFamily: fonts.displayLight, fontSize: 56, letterSpacing: -2.5, lineHeight: 58, color: tone }}>
          {value}
        </Text>
        {unit ? (
          <Text style={[typography.data, { color: colors.textMuted, marginBottom: 8 }]}>{unit}</Text>
        ) : null}
      </Row>
      {meta ? <Small style={{ marginTop: spacing.xs }}>{meta}</Small> : null}
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
  const [open, setOpen] = useState(defaultOpen);
  const fg = tone ? toneColors(tone).fg : colors.text;

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
          {open ? <ChevronUp size={16} color={colors.textMuted} /> : <ChevronDown size={16} color={colors.textMuted} />}
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
}: {
  /** A lucide icon element, e.g. `<Syringe size={16} color={colors.textMuted} />`. */
  icon?: ReactNode;
  title: string;
  detail?: string;
  /** Right-aligned trailing content — a value, a badge. */
  meta?: ReactNode;
  tone?: SeverityTone;
  /** Renders a checklist mark instead of a dot/icon; for monitoring-style lists. */
  checked?: boolean;
  onPress?: () => void;
}) {
  const markColor = tone ? toneColors(tone).fg : colors.accent;
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
                  borderColor: checked ? markColor : colors.borderBright,
                  backgroundColor: checked ? markColor : 'transparent',
                }}
              />
            ) : (
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: markColor, marginTop: 7 }} />
            ))}
        </View>
        <View style={{ flex: 1 }}>
          <Row justify="space-between" align="flex-start" gap={spacing.md}>
            <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{title}</Text>
            {meta}
          </Row>
          {detail ? <Small style={{ marginTop: 2 }}>{detail}</Small> : null}
        </View>
      </Row>
    </Wrapper>
  );
}

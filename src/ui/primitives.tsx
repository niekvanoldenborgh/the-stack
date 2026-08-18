import { LinearGradient } from 'expo-linear-gradient';
import { Check, ChevronDown, ChevronUp, Clock, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Circle, Svg } from 'react-native-svg';

import { Caption, Row, Small } from './components';
import { fonts, radius, spacing, typography, useTheme, type Elevation, type SeverityTone } from './theme';

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

// ---------------------------------------------------------------------------
// PULSE v2 structural primitives (pulse-design-spec-v2, THEA-69 rebuild).
//
// The five above predate the KIMI reference and stay in place. Everything
// below fills the gaps that spec identified between them and KIMI's actual
// shapes — a header avatar, a ring stat, a paired duo row, a checklist row
// with a 3-state trailing mark, sheet chrome, a hero numeric input, and a
// floating primary action. All theme-driven via `useTheme()`; no literal hex.
// ---------------------------------------------------------------------------

/**
 * Circular gradient initials badge — spec-v2 §3.1. Uses `avatarGradient`,
 * never `accentGradient`: the hero gradient's 3 stops read muddy at this
 * size, which is exactly why the spec gave avatars their own token.
 */
export function Avatar({
  initials,
  icon,
  size = 44,
}: {
  /** Ignored when `icon` is passed. `UserProfile` has no display-name field
   *  today (spec-v2 §4.1/§8.2) — pass `icon` for the generic-mark fallback
   *  rather than inventing initials from nothing. */
  initials?: string;
  icon?: ReactNode;
  size?: number;
}) {
  const theme = useTheme();
  return (
    <LinearGradient
      colors={theme.color.avatarGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[
        { width: size, height: size, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
        theme.shadow(1),
      ]}
    >
      {icon ?? (
        <Text style={[typography.bodyStrong, { color: theme.color.onPrimary, fontSize: size * 0.36 }]}>
          {initials}
        </Text>
      )}
    </LinearGradient>
  );
}

/**
 * Small glowing status dot for the hero countdown row — spec-v2 §3.2. Fixed
 * on-gradient shadow, not an animation, so it needs no `useNativeDriver`
 * gate.
 */
export function PulseDot({ size = 7 }: { size?: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.color.heroAccent,
        shadowColor: theme.color.heroAccent,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.9,
        shadowRadius: 4,
      }}
    />
  );
}

/**
 * Circular progress ring — spec-v2 §3.3. `react-native-svg` is already a
 * dependency (illustrations.tsx); no new package.
 */
export function StatRing({ pct, size = 54 }: { pct: number; size?: number }) {
  const theme = useTheme();
  const strokeWidth = 5;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const center = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={center} cy={center} r={r} stroke={theme.color.surfaceMuted} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke={theme.color.primary}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          fill="none"
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <Text
        style={[
          typography.dataSmall,
          { position: 'absolute', fontFamily: fonts.bold, fontSize: 13, color: theme.color.textPrimary },
        ]}
      >
        {`${Math.round(clamped)}%`}
      </Text>
    </View>
  );
}

/** Wraps two `StatCard`s side by side — spec-v2 §3.4. Each child should be a
 *  `StatCard`; the row just supplies the gap and equal-flex layout. */
export function DuoRow({ children }: { children: ReactNode }) {
  return (
    <Row gap={spacing.md} align="stretch">
      {children}
    </Row>
  );
}

/**
 * One card in a `DuoRow` — spec-v2 §3.4. A narrower, KIMI-specific sibling to
 * `StatTile`: `StatTile` keeps its existing call sites (Results etc.) as-is.
 * Pass either `value` (a plain big number/string) or `ring` (a percentage,
 * rendered as a `StatRing`) — not both.
 */
export function StatCard({
  label,
  value,
  ring,
  hint,
  style,
}: {
  label: string;
  value?: string;
  ring?: number;
  hint?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        // 22px is KIMI's own radius — nearest existing step is radius.lg
        // (20); used as a one-off override rather than a new radius step for
        // one shape (spec-v2 §3.4).
        { flex: 1, borderRadius: 22, padding: spacing.lg, backgroundColor: theme.color.surface },
        theme.shadow(1),
        style,
      ]}
    >
      <Caption>{label}</Caption>
      <View style={{ marginTop: spacing.sm }}>
        {ring !== undefined ? (
          <StatRing pct={ring} />
        ) : (
          <Text style={[typography.statBig, { color: theme.color.textPrimary }]}>{value}</Text>
        )}
      </View>
      {hint ? <Small style={{ marginTop: spacing.xs }}>{hint}</Small> : null}
    </View>
  );
}

/**
 * Dose-checklist row — spec-v2 §3.5. Replaces `ListItem` specifically for
 * this shape: a fixed-width leading time column and a 3-state trailing mark
 * don't fit `ListItem`'s icon+title anatomy.
 */
export function DoseRow({
  time,
  name,
  detail,
  status,
  onPress,
}: {
  /** e.g. "08:00" — fixed-width leading column. */
  time: string;
  name: string;
  detail: string;
  status: 'done' | 'next' | 'todo';
  onPress?: () => void;
}) {
  const theme = useTheme();
  const { color } = theme;
  const Wrapper = onPress ? Pressable : View;
  const mark =
    status === 'done'
      ? { bg: color.successSoft, icon: <Check size={14} color={color.success} /> }
      : status === 'next'
        ? { bg: color.primarySoft, icon: <Clock size={14} color={color.primary} /> }
        : { bg: 'transparent', icon: null };

  return (
    <Wrapper
      {...(onPress ? { accessibilityRole: 'button' as const, onPress } : {})}
      style={onPress ? ({ pressed }: { pressed: boolean }) => ({ opacity: pressed ? 0.7 : 1 }) : undefined}
    >
      <Row align="center" gap={spacing.md}>
        <View style={{ width: 52 }}>
          <Caption style={{ color: color.textSecondary }}>{time}</Caption>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[typography.bodyStrong, { color: color.textPrimary }]}>{name}</Text>
          <Small style={{ marginTop: 2 }}>{detail}</Small>
        </View>
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: mark.bg,
            borderWidth: status === 'todo' ? 2 : 0,
            borderColor: color.border,
          }}
        >
          {mark.icon}
        </View>
      </Row>
    </Wrapper>
  );
}

/** Title + circular close button — spec-v2 §3.6. Top chrome for any
 *  screen/sheet/modal that needs a dismiss affordance. `onClose` is optional
 *  so a screen can use just the title half (e.g. Logger, which stays a tab —
 *  §5.1). */
export function SheetHeader({ title, onClose, closeLabel = 'Close' }: { title: string; onClose?: () => void; closeLabel?: string }) {
  const theme = useTheme();
  const { color } = theme;
  return (
    <Row justify="space-between" align="center" style={{ marginBottom: spacing.lg }}>
      <Text style={[typography.title, { fontFamily: fonts.displayBold, color: color.textPrimary }]}>{title}</Text>
      {onClose ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          hitSlop={8}
          onPress={onClose}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: color.surfaceMuted,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <X size={16} color={color.textSecondary} />
        </Pressable>
      ) : null}
    </Row>
  );
}

/**
 * Oversized numeric input with an inline unit switcher — spec-v2 §3.8. For
 * the single focal number a screen is about (Logger's injected dose); every
 * other numeric field stays a normal `TextField`.
 */
export function BigNumberField({
  label,
  value,
  onChangeText,
  units,
  unit,
  onUnitChange,
  placeholder = '0',
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  units: string[];
  unit: string | null;
  onUnitChange: (next: string) => void;
  placeholder?: string;
}) {
  const theme = useTheme();
  const { color } = theme;
  return (
    <View style={[{ borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md, backgroundColor: color.surface }, theme.shadow(1)]}>
      <Caption>{label}</Caption>
      <Row justify="space-between" align="center" gap={spacing.sm}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={color.textTertiary}
          style={{ flex: 1, fontFamily: fonts.displayBold, fontSize: 46, letterSpacing: -1.38, color: color.textPrimary }}
        />
        <Row gap={2} style={{ backgroundColor: color.surfaceSunken, borderRadius: radius.pill, padding: 3 }}>
          {units.map((u) => {
            const active = u === unit;
            return (
              <Pressable
                key={u}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => onUnitChange(u)}
                style={[
                  { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.pill },
                  active ? [{ backgroundColor: color.surface }, theme.shadow(1)] : null,
                ]}
              >
                <Text style={[typography.small, { fontFamily: fonts.semibold, color: active ? color.primary : color.textSecondary }]}>
                  {u === 'iu' ? 'IU' : u}
                </Text>
              </Pressable>
            );
          })}
        </Row>
      </Row>
    </View>
  );
}

/**
 * Bottom-fixed primary action — spec-v2 §3.10. Only for the single primary
 * commit action on a tab screen (the tab bar is still showing); pushed/modal
 * screens keep an inline `Button` at the end of scroll content instead (§6).
 */
export function FloatingCTA({
  label,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const theme = useTheme();
  const { color } = theme;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        {
          position: 'absolute',
          // 92 clears the 64-tall floating tab bar + its 14px inset + a
          // little breathing room (spec-v2 §3.10).
          bottom: 92,
          left: 20,
          right: 20,
          borderRadius: radius.lg,
          paddingVertical: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDisabled ? color.disabled : color.textPrimary,
        },
        !isDisabled ? theme.shadow(2) : null,
        { opacity: isDisabled ? 1 : pressed ? 0.85 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color.background} />
      ) : (
        <Text style={[typography.bodyStrong, { color: isDisabled ? color.disabledContent : color.background }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

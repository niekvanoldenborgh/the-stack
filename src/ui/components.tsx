import { Children, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenAtmosphere } from './atmosphere';
import { colors, fonts, radius, spacing, toneColors, typography, type SeverityTone } from './theme';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({
  children,
  scroll = true,
  padded = true,
  edges = ['top'],
  atmosphere = true,
  tint,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  edges?: Array<'top' | 'bottom' | 'left' | 'right'>;
  /** Graph-paper ruling and accent wash behind the header. */
  atmosphere?: boolean;
  tint?: string;
}) {
  const inner = (
    <View style={[padded && { paddingHorizontal: spacing.lg }, { paddingBottom: spacing.xxl }]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.screen} edges={edges}>
      {atmosphere ? <ScreenAtmosphere tint={tint} /> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: spacing.xxl * 2 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
  tone,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: SeverityTone;
}) {
  const accent = tone ? toneColors(tone) : null;
  return (
    <View
      style={[
        styles.card,
        accent ? { borderColor: accent.fg, borderLeftWidth: 3 } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Row({
  children,
  style,
  gap = spacing.sm,
  align = 'center',
  justify = 'flex-start',
  wrap = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
  align?: ViewStyle['alignItems'];
  justify?: ViewStyle['justifyContent'];
  wrap?: boolean;
}) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: align, justifyContent: justify, gap, flexWrap: wrap ? 'wrap' : 'nowrap' },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Spacer({ size = spacing.lg }: { size?: number }) {
  return <View style={{ height: size }} />;
}

/**
 * The brand mark, drawn with plain Views.
 *
 * Deliberately not an image or an SVG dependency: the mark is three rounded
 * bars, which layout can express exactly, so it stays crisp at any size and
 * costs nothing to render. It mirrors assets/brand/logo.svg — change both
 * together.
 */
export function Logo({ size = 44, tint = colors.accent }: { size?: number; tint?: string }) {
  const bar = size * 0.2;
  const gap = size * 0.09;
  const layers = [
    { width: size * 0.62, opacity: 1 },
    { width: size * 0.81, opacity: 0.66 },
    { width: size, opacity: 0.38 },
  ];
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="The Stack"
      style={{ width: size, height: bar * 3 + gap * 2, alignItems: 'center', justifyContent: 'space-between' }}
    >
      {layers.map((layer, index) => (
        <View
          key={index}
          style={{
            width: layer.width,
            height: bar,
            borderRadius: bar / 2.4,
            backgroundColor: tint,
            opacity: layer.opacity,
          }}
        />
      ))}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.divider, style]} />;
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export function Display({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[typography.display, { color: colors.text }, style]}>{children}</Text>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[typography.title, { color: colors.text }, style]}>{children}</Text>;
}

export function Heading({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[typography.heading, { color: colors.text }, style]}>{children}</Text>;
}

export function Body({
  children,
  muted = false,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[typography.body, { color: muted ? colors.textMuted : colors.text }, style]}>{children}</Text>;
}

export function Small({
  children,
  muted = true,
  style,
}: {
  children: ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[typography.small, { color: muted ? colors.textMuted : colors.text }, style]}>{children}</Text>;
}

export function Caption({ children, color = colors.textFaint }: { children: ReactNode; color?: string }) {
  return <Text style={[typography.caption, { color, textTransform: 'uppercase' }]}>{children}</Text>;
}

/**
 * Any quantity — a dose, a unit count, a duration.
 *
 * Monospaced on purpose: figures line up in columns, digits do not shift width
 * as a value animates, and a number typeset in mono reads as measured rather
 * than merely written. In an app whose core output is micrograms, that
 * distinction is the whole point.
 */
export function Data({
  children,
  color = colors.text,
  small = false,
  style,
}: {
  children: ReactNode;
  color?: string;
  small?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[small ? typography.dataSmall : typography.data, { color }, style]}>{children}</Text>;
}

/** Hairline-weight display figure, for the one number a screen is about. */
export function Metric({
  children,
  color = colors.text,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return <Text style={[typography.metric, { color }, style]}>{children}</Text>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <Row justify="space-between" style={{ marginBottom: spacing.md, marginTop: spacing.xl }}>
      <Caption color={colors.textMuted}>{children}</Caption>
      {action}
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  const palette = {
    primary: { bg: colors.accent, fg: colors.accentText, border: colors.accent },
    secondary: { bg: colors.surfaceHigh, fg: colors.text, border: colors.borderBright },
    ghost: { bg: 'transparent', fg: colors.textMuted, border: colors.border },
    danger: { bg: colors.criticalDim, fg: colors.critical, border: colors.critical },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: isDisabled ? 0.45 : pressed ? 0.8 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[typography.bodyStrong, { color: palette.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Badge({
  label,
  tone = 'info',
  solid = false,
}: {
  label: string;
  tone?: SeverityTone;
  solid?: boolean;
}) {
  const { fg, bg } = toneColors(tone);
  return (
    <View style={[styles.badge, { backgroundColor: solid ? fg : bg, borderColor: fg }]}>
      <Text style={[typography.caption, { color: solid ? colors.bg : fg }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  tone = 'accent',
  sublabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: SeverityTone;
  sublabel?: string;
}) {
  const { fg } = toneColors(tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? fg : colors.border,
          backgroundColor: selected ? `${fg}1A` : colors.surface,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[typography.bodyStrong, { color: selected ? fg : colors.text }]}>{label}</Text>
      {sublabel ? <Small style={{ marginTop: 2 }}>{sublabel}</Small> : null}
    </Pressable>
  );
}

export function Stepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix = '',
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  return (
    <Row gap={spacing.md} align="center">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        onPress={() => onChange(clamp(value - step))}
        style={styles.stepperButton}
      >
        <Text style={[typography.title, { color: colors.text }]}>−</Text>
      </Pressable>
      <View style={{ minWidth: 92, alignItems: 'center' }}>
        <Text style={[typography.title, { color: colors.text }]}>
          {value}
          {suffix ? <Text style={[typography.body, { color: colors.textMuted }]}> {suffix}</Text> : null}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase"
        onPress={() => onChange(clamp(value + step))}
        style={styles.stepperButton}
      >
        <Text style={[typography.title, { color: colors.text }]}>+</Text>
      </Pressable>
    </Row>
  );
}

export function Toggle({
  label,
  description,
  value,
  onChange,
  tone = 'accent',
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  tone?: SeverityTone;
}) {
  const { fg } = toneColors(tone);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.toggle,
        { borderColor: value ? fg : colors.border, backgroundColor: value ? `${fg}14` : colors.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={[styles.checkbox, { borderColor: value ? fg : colors.borderBright, backgroundColor: value ? fg : 'transparent' }]}>
        {value ? <Text style={{ color: colors.bg, fontSize: 13, fontFamily: fonts.sansMedium }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{label}</Text>
        {description ? <Small style={{ marginTop: 2 }}>{description}</Small> : null}
      </View>
    </Pressable>
  );
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: SeverityTone }) {
  const { fg } = toneColors(tone);
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: fg }]} />
    </View>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: SeverityTone }) {
  const fg = tone ? toneColors(tone).fg : colors.text;
  return (
    <View style={styles.statTile}>
      <Caption color={colors.textFaint}>{label}</Caption>
      <Text style={[typography.data, { fontSize: 21, color: fg, marginTop: spacing.sm }]}>{value}</Text>
      {hint ? <Small style={{ marginTop: 2 }}>{hint}</Small> : null}
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
      <Heading style={{ textAlign: 'center' }}>{title}</Heading>
      <Small style={{ textAlign: 'center', marginTop: spacing.sm, marginBottom: action ? spacing.lg : 0 }}>{body}</Small>
      {action}
    </Card>
  );
}

/**
 * Standard warning block used everywhere a risk needs to interrupt reading.
 *
 * Text children are wrapped in a `<Small>` automatically. This is not a
 * convenience — React Native throws on a bare string inside a `<View>`, and a
 * call site passing `{'\n\n'}` between two strings yields an *array* of
 * strings, which a naive `typeof children === 'string'` check misses. Getting
 * that wrong crashes the screen on device while only logging a warning on web.
 */
export function Callout({
  tone,
  title,
  children,
}: {
  tone: SeverityTone;
  title?: string;
  children?: ReactNode;
}) {
  const { fg, bg } = toneColors(tone);
  const parts = Children.toArray(children);
  const isTextOnly = parts.length > 0 && parts.every((part) => typeof part === 'string' || typeof part === 'number');

  return (
    <View style={[styles.callout, { borderColor: fg, backgroundColor: bg }]}>
      {title ? (
        <Text style={[typography.bodyStrong, { color: fg, marginBottom: parts.length > 0 ? spacing.xs : 0 }]}>
          {title}
        </Text>
      ) : null}
      {parts.length === 0 ? null : isTextOnly ? (
        <Small muted={false} style={{ color: colors.text }}>
          {children}
        </Small>
      ) : (
        children
      )}
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  right,
  onPress,
  tone,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  tone?: SeverityTone;
}) {
  const borderColor = tone ? toneColors(tone).fg : colors.border;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, { borderColor, opacity: pressed && onPress ? 0.75 : 1 }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyStrong, { color: colors.text }]}>{title}</Text>
        {subtitle ? <Small style={{ marginTop: 2 }}>{subtitle}</Small> : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  button: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    marginRight: spacing.sm,
  },
  stepperButton: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderBright,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceHigh,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
  },
  callout: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});

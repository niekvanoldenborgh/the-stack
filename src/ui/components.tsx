import { LinearGradient } from 'expo-linear-gradient';
import { Children, Fragment, isValidElement, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenAtmosphere } from './atmosphere';
import { Illustration, type IllustrationName } from './illustrations';
import { fonts, radius, spacing, typography, useTheme, type SeverityTone } from './theme';

/**
 * PULSE gutter — airier than the general spacing scale, so it's a named
 * constant rather than a new step on that scale (design spec §3.4).
 */
const SCREEN_MARGIN = 20;

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
  /** Soft accent wash behind the header. */
  atmosphere?: boolean;
  tint?: string;
}) {
  const theme = useTheme();
  const inner = (
    <View style={[padded && { paddingHorizontal: SCREEN_MARGIN }, { paddingBottom: spacing.xxl }]}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.color.background }]} edges={edges}>
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
  const theme = useTheme();
  const accent = tone ? theme.tone(tone) : null;
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.color.surface, ...theme.shadow(1) },
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
 * together (AGENTS.md — one change, one place, per the THEA-63 lime-drift
 * lesson). Tint defaults to the theme's `primary` (violet, not the retired
 * lime/teal accents).
 */
export function Logo({ size = 44, tint }: { size?: number; tint?: string }) {
  const theme = useTheme();
  const resolvedTint = tint ?? theme.color.primary;
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
            backgroundColor: resolvedTint,
            opacity: layer.opacity,
          }}
        />
      ))}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  return <View style={[styles.divider, { backgroundColor: theme.color.divider }, style]} />;
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export function Display({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return <Text style={[typography.display, { color: theme.color.textPrimary }, style]}>{children}</Text>;
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return <Text style={[typography.title, { color: theme.color.textPrimary }, style]}>{children}</Text>;
}

export function Heading({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const theme = useTheme();
  return <Text style={[typography.heading, { color: theme.color.textPrimary }, style]}>{children}</Text>;
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
  const theme = useTheme();
  return (
    <Text style={[typography.body, { color: muted ? theme.color.textSecondary : theme.color.textPrimary }, style]}>
      {children}
    </Text>
  );
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
  const theme = useTheme();
  return (
    <Text style={[typography.small, { color: muted ? theme.color.textSecondary : theme.color.textPrimary }, style]}>
      {children}
    </Text>
  );
}

export function Caption({
  children,
  color,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  // textSecondary, not textTertiary — a caption is often a section's only
  // textual label, and textTertiary is reserved for sub-AA decorative use
  // (design spec §1.1). Pass `color` explicitly for a genuinely decorative
  // eyebrow.
  return <Text style={[typography.caption, { color: color ?? theme.color.textSecondary }, style]}>{children}</Text>;
}

/**
 * Any quantity — a dose, a unit count, a duration. `tabular-nums` (set in
 * `typography.data`) keeps figures aligned in columns without the retired
 * IBM Plex Mono voice — see the design spec §3.1.
 */
export function Data({
  children,
  color,
  small = false,
  style,
}: {
  children: ReactNode;
  color?: string;
  small?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  return (
    <Text style={[small ? typography.dataSmall : typography.data, { color: color ?? theme.color.textPrimary }, style]}>
      {children}
    </Text>
  );
}

/** The one focal figure a screen is about — solid weight, tabular. */
export function Metric({
  children,
  color,
  style,
}: {
  children: ReactNode;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const theme = useTheme();
  return <Text style={[typography.metric, { color: color ?? theme.color.textPrimary }, style]}>{children}</Text>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <Row justify="space-between" style={{ marginBottom: spacing.md, marginTop: spacing.xl }}>
      <Caption>{children}</Caption>
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
  /** Swap the `primary` fill for the hero gradient — the single primary CTA
   *  on a high-priority decision screen only (design spec §3.3). */
  gradient = false,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  gradient?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const { color } = theme;
  const isDisabled = disabled || loading;
  const danger = theme.tone('critical');
  const palette = {
    primary: { bg: color.primarySolid, fg: color.onPrimary, border: 'transparent' },
    secondary: {
      bg: theme.mode === 'light' ? color.surface : color.surfaceMuted,
      fg: color.textPrimary,
      border: color.borderStrong,
    },
    ghost: { bg: 'transparent', fg: color.primary, border: 'transparent' },
    danger: { bg: danger.bg, fg: danger.fg, border: 'transparent' },
  }[variant];

  const content = loading ? (
    <ActivityIndicator color={palette.fg} />
  ) : (
    <Text style={[typography.bodyStrong, { color: palette.fg }]}>{label}</Text>
  );

  const disabledStyle: ViewStyle | null = isDisabled
    ? { backgroundColor: color.disabled, borderColor: 'transparent' }
    : null;

  if (gradient && variant === 'primary' && !isDisabled) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={style}>
        {({ pressed }) => (
          <LinearGradient
            colors={color.accentGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.button, { borderWidth: 0, opacity: pressed ? 0.9 : 1 }, theme.shadow(1)]}
          >
            {content}
          </LinearGradient>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={isDisabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border },
        variant === 'primary' && !isDisabled ? theme.shadow(1) : null,
        disabledStyle,
        { opacity: isDisabled ? 1 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {isDisabled ? <Text style={[typography.bodyStrong, { color: color.disabledContent }]}>{label}</Text> : content}
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
  const theme = useTheme();
  const { fg, bg } = theme.tone(tone);
  return (
    <View style={[styles.badge, { backgroundColor: solid ? fg : bg, borderColor: fg }]}>
      <Text style={[typography.caption, { color: solid ? theme.color.onPrimary : fg }]}>{label.toUpperCase()}</Text>
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
  const theme = useTheme();
  const { color } = theme;
  const { fg } = theme.tone(tone);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? fg : color.borderStrong,
          backgroundColor: selected ? theme.tone(tone).bg : color.surfaceMuted,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <Text style={[typography.bodyStrong, { color: selected ? fg : color.textPrimary }]}>{label}</Text>
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
  const theme = useTheme();
  const { color } = theme;
  const clamp = (n: number) => Math.min(max, Math.max(min, Math.round(n * 100) / 100));
  return (
    <Row gap={spacing.md} align="center">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Decrease"
        onPress={() => onChange(clamp(value - step))}
        style={[styles.stepperButton, { backgroundColor: color.surfaceMuted, borderColor: color.borderStrong }]}
      >
        <Text style={[typography.title, { color: color.textPrimary }]}>−</Text>
      </Pressable>
      <View style={{ minWidth: 92, alignItems: 'center' }}>
        <Text style={[typography.title, { color: color.textPrimary }]}>
          {value}
          {suffix ? <Text style={[typography.body, { color: color.textSecondary }]}> {suffix}</Text> : null}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Increase"
        onPress={() => onChange(clamp(value + step))}
        style={[styles.stepperButton, { backgroundColor: color.surfaceMuted, borderColor: color.borderStrong }]}
      >
        <Text style={[typography.title, { color: color.textPrimary }]}>+</Text>
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
  const theme = useTheme();
  const { color } = theme;
  const { fg, bg } = theme.tone(tone);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.toggle,
        { borderColor: value ? fg : color.border, backgroundColor: value ? bg : color.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View
        style={[
          styles.checkbox,
          { borderColor: value ? fg : color.borderStrong, backgroundColor: value ? fg : 'transparent' },
        ]}
      >
        {value ? <Text style={{ color: color.onPrimary, fontSize: 13, fontFamily: fonts.semibold }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyStrong, { color: color.textPrimary }]}>{label}</Text>
        {description ? <Small style={{ marginTop: 2 }}>{description}</Small> : null}
      </View>
    </Pressable>
  );
}

/**
 * One field anatomy for every hand-typed input in the app: label above,
 * a chrome box that answers focus/error with a border colour (never fill
 * alone — colour is load-bearing here, so a state also has to survive
 * losing that colour), optional trailing slot for a unit or an inline
 * control, and helper/error text below.
 */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  helper,
  error,
  leading,
  suffix,
  style,
  inputStyle,
  ...inputProps
}: {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  /** Shown below the field when there's no error. */
  helper?: string;
  /** Shown below the field instead of `helper`, and tints the border. */
  error?: string;
  /** Leading content inside the field chrome — a search icon, typically. */
  leading?: ReactNode;
  /** Trailing content inside the field chrome — a unit label, a small control. */
  suffix?: ReactNode;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
} & Pick<
  TextInputProps,
  | 'keyboardType'
  | 'autoCorrect'
  | 'autoCapitalize'
  | 'autoComplete'
  | 'secureTextEntry'
  | 'multiline'
  | 'returnKeyType'
  | 'onSubmitEditing'
  | 'maxLength'
  | 'clearButtonMode'
>) {
  const theme = useTheme();
  const { color } = theme;
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.tone('critical').fg : focused ? color.primary : color.border;

  return (
    <View style={style}>
      {label ? <Caption style={{ marginBottom: spacing.xs }}>{label}</Caption> : null}
      <Row
        gap={spacing.sm}
        align={inputProps.multiline ? 'flex-start' : 'center'}
        style={[
          styles.fieldWrap,
          { backgroundColor: color.surfaceSunken, borderColor },
          inputProps.multiline ? styles.fieldWrapMultiline : null,
        ]}
      >
        {leading}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={color.textTertiary}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[
            typography.body,
            { color: color.textPrimary, flex: 1 },
            inputProps.multiline ? styles.fieldInputMultiline : null,
            inputStyle,
          ]}
          {...inputProps}
        />
        {suffix}
      </Row>
      {error ? (
        <Small style={{ marginTop: spacing.xs, color: theme.tone('critical').softText }} muted={false}>
          {error}
        </Small>
      ) : helper ? (
        <Small style={{ marginTop: spacing.xs }}>{helper}</Small>
      ) : null}
    </View>
  );
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: SeverityTone }) {
  const theme = useTheme();
  const { fg } = theme.tone(tone);
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={[styles.progressTrack, { backgroundColor: theme.color.surfaceSunken }]}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: fg }]} />
    </View>
  );
}

export function StatTile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: SeverityTone }) {
  const theme = useTheme();
  const fg = tone ? theme.tone(tone).fg : theme.color.textPrimary;
  return (
    <View style={[styles.statTile, { backgroundColor: theme.color.surface, ...theme.shadow(1) }]}>
      <Caption>{label}</Caption>
      <Text style={[typography.data, { fontSize: 21, color: fg, marginTop: spacing.sm }]}>{value}</Text>
      {hint ? <Small style={{ marginTop: 2 }}>{hint}</Small> : null}
    </View>
  );
}

export function EmptyState({
  title,
  body,
  action,
  illustration,
}: {
  title: string;
  body: string;
  action?: ReactNode;
  illustration?: IllustrationName;
}) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
      {illustration && (
        <>
          <Illustration name={illustration} size={140} />
          <Spacer size={spacing.md} />
        </>
      )}
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
 * that wrong crashes the screen on device while only logging a warning on web
 * (AGENTS.md — do not touch this handling as part of the redesign).
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
  const theme = useTheme();
  const { fg, bg, softText } = theme.tone(tone);
  const parts = Children.toArray(children);
  // A <>...</> fragment shows up here as a single Fragment element, not the
  // bare strings inside it — unwrap it before judging text-only-ness, or a
  // fragment full of plain text slips past this check unwrapped and crashes
  // once it lands directly inside the <View> below.
  const leaves = parts.flatMap((part) =>
    isValidElement(part) && part.type === Fragment ? Children.toArray((part.props as { children?: ReactNode }).children) : [part],
  );
  const isTextOnly = leaves.length > 0 && leaves.every((part) => typeof part === 'string' || typeof part === 'number');

  return (
    <View style={[styles.callout, { backgroundColor: bg, borderLeftWidth: 3, borderLeftColor: fg }]}>
      {title ? (
        <Text style={[typography.bodyStrong, { color: fg, marginBottom: parts.length > 0 ? spacing.xs : 0 }]}>
          {title}
        </Text>
      ) : null}
      {parts.length === 0 ? null : isTextOnly ? (
        <Small muted={false} style={{ color: softText }}>
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
  const theme = useTheme();
  const { color } = theme;
  const accentColor = tone ? theme.tone(tone).fg : undefined;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        styles.listRow,
        { borderBottomColor: color.divider },
        accentColor ? { borderLeftWidth: 3, borderLeftColor: accentColor, paddingLeft: spacing.md - 3 } : null,
        onPress && pressed ? { backgroundColor: color.surfaceMuted, borderRadius: radius.sm } : null,
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[typography.bodyStrong, { color: color.textPrimary }]}>{title}</Text>
        {subtitle ? <Small style={{ marginTop: 2 }}>{subtitle}</Small> : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  card: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  fieldWrap: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
  },
  fieldWrapMultiline: {
    paddingVertical: spacing.md,
  },
  fieldInputMultiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  button: {
    paddingVertical: 14,
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
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: spacing.sm,
    marginRight: spacing.sm,
  },
  stepperButton: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
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
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
  },
  statTile: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  callout: {
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
  },
});

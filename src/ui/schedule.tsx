import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { WEEKDAY_LABELS, weekdayIndex } from '../lib/date';
import { Caption, Data, Row, Small } from './components';
import { radius, spacing, useTheme, type SeverityTone } from './theme';

/**
 * Scheduling UI.
 *
 * The structure here — a week selector above a time-gutter timeline, with
 * metadata as inline chips and confirm/dismiss as compact icon buttons — is
 * adapted from the appointment patterns in the Medical/Dermatology UI kit.
 * The layout ideas transfer; the palette does not — everything is rebuilt on
 * our own PULSE tokens (`useTheme`), not the kit's.
 */

export interface DayMarker {
  date: string;
  /** Number of scheduled items, used for the density dot. */
  count: number;
  /** True once every item on the day has been logged either way. */
  complete?: boolean;
}

/**
 * Horizontal week selector.
 *
 * The dashboard previously showed only today, which made it impossible to see
 * a dose coming or check what was missed yesterday without leaving the screen.
 */
export function WeekStrip({
  days,
  selected,
  onSelect,
}: {
  days: DayMarker[];
  selected: string;
  onSelect: (date: string) => void;
}) {
  const theme = useTheme();
  const { color } = theme;
  return (
    <Row gap={spacing.xs} justify="space-between">
      {days.map((day) => {
        const isSelected = day.date === selected;
        const dayNumber = Number(day.date.slice(8, 10));
        return (
          <Pressable
            key={day.date}
            onPress={() => onSelect(day.date)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${WEEKDAY_LABELS[weekdayIndex(day.date)]} ${dayNumber}, ${day.count} dose${day.count === 1 ? '' : 's'}`}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              paddingVertical: spacing.md,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: isSelected ? color.primary : color.border,
              backgroundColor: isSelected ? color.primarySolid : color.surface,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Caption color={isSelected ? color.onPrimary : color.textTertiary}>
              {WEEKDAY_LABELS[weekdayIndex(day.date)]}
            </Caption>
            <Data color={isSelected ? color.onPrimary : color.textPrimary} style={{ fontSize: 17, marginTop: spacing.xs }}>
              {dayNumber}
            </Data>
            {/* Density dot — shows a day has doses without spelling out a count. */}
            <View
              style={{
                width: 4,
                height: 4,
                borderRadius: 2,
                marginTop: spacing.xs,
                backgroundColor:
                  day.count === 0
                    ? 'transparent'
                    : isSelected
                      ? color.onPrimary
                      : day.complete
                        ? theme.tone('success').fg
                        : color.textTertiary,
              }}
            />
          </Pressable>
        );
      })}
    </Row>
  );
}

/**
 * One row of a timeline: a fixed time gutter, a continuous rail with a node,
 * and the content itself.
 *
 * The rail is what makes a list of times read as a day rather than as unrelated
 * cards — a flat list of five cards each captioned "22:30" makes you reconstruct
 * the shape of the day yourself.
 */
export function TimelineRow({
  time,
  children,
  tone = 'accent',
  first = false,
  last = false,
  dimmed = false,
}: {
  time: string;
  children: ReactNode;
  tone?: SeverityTone;
  first?: boolean;
  last?: boolean;
  dimmed?: boolean;
}) {
  const theme = useTheme();
  const { color } = theme;
  const { fg } = theme.tone(tone);

  return (
    <Row align="stretch" gap={spacing.md} style={{ opacity: dimmed ? 0.55 : 1 }}>
      <View style={{ width: 46, alignItems: 'flex-end', paddingTop: spacing.lg }}>
        <Data color={color.textSecondary} small>
          {time}
        </Data>
      </View>

      {/* Rail. Segments are drawn separately so the first and last rows do not
          trail a line off into nothing. */}
      <View style={{ width: 12, alignItems: 'center' }}>
        <View style={{ width: 1, flex: 0, height: spacing.lg + 2, backgroundColor: first ? 'transparent' : color.border }} />
        <View
          style={{
            width: 9,
            height: 9,
            borderRadius: 5,
            borderWidth: 2,
            borderColor: fg,
            backgroundColor: color.background,
          }}
        />
        <View style={{ width: 1, flex: 1, backgroundColor: last ? 'transparent' : color.border }} />
      </View>

      <View style={{ flex: 1, paddingBottom: spacing.md }}>{children}</View>
    </Row>
  );
}

/** Inline metadata pill with a leading glyph. */
export function MetaChip({
  icon,
  label,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone?: SeverityTone;
}) {
  const theme = useTheme();
  const { color } = theme;
  const fg = tone ? theme.tone(tone).fg : color.textSecondary;
  return (
    <Row
      gap={spacing.xs}
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 4,
        borderRadius: radius.sm,
        backgroundColor: color.surfaceMuted,
        borderWidth: 1,
        borderColor: tone ? `${fg}55` : color.border,
      }}
    >
      <Ionicons name={icon} size={11} color={fg} />
      <Small muted={!tone} style={tone ? { color: fg } : undefined}>
        {label}
      </Small>
    </Row>
  );
}

/** Circular action button, for confirm/dismiss beside a primary action. */
export function IconAction({
  icon,
  onPress,
  tone = 'accent',
  filled = false,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: SeverityTone;
  filled?: boolean;
  label: string;
}) {
  const theme = useTheme();
  const { fg } = theme.tone(tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: fg,
        backgroundColor: filled ? fg : 'transparent',
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Ionicons name={icon} size={19} color={filled ? theme.color.onPrimary : fg} />
    </Pressable>
  );
}

/** Segmented filter pills. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  const theme = useTheme();
  const { color } = theme;
  return (
    <Row gap={spacing.xs}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              paddingVertical: spacing.sm + 2,
              borderRadius: radius.pill,
              borderWidth: 1,
              borderColor: selected ? color.primary : color.border,
              backgroundColor: selected ? color.primarySolid : color.surface,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Small muted={false} style={{ color: selected ? color.onPrimary : color.textSecondary }}>
              {option.label}
            </Small>
          </Pressable>
        );
      })}
    </Row>
  );
}

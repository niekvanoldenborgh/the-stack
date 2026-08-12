import { View } from 'react-native';

import { Caption, Data, Row } from './components';
import { colors, radius, spacing } from './theme';

/**
 * A dose plotted inside its published range.
 *
 * This is the single most safety-critical relationship in the app — am I at the
 * bottom of what has been published, in the middle, at the top, or outside it —
 * and until now it was two separate pieces of text that the reader had to
 * compare arithmetically. As an interval with a mark on it, the answer is
 * pre-attentive.
 *
 * Two deliberate details:
 *
 *  - The unit is repeated on BOTH ends rather than stated once in a heading.
 *    Compounds in this app are dosed in mcg, mg, IU and percent, often adjacent
 *    to each other on the same screen; a range whose unit lives somewhere above
 *    it is a mg/mcg confusion waiting to happen.
 *  - Position carries the magnitude, never hue. The accent marks *where you
 *    are*, and severity colour appears only when the dose leaves the published
 *    interval — which the engine should make impossible, so it is a backstop,
 *    not a routine state.
 */
export function RangeBar({
  low,
  typical,
  high,
  value,
  unit,
  /** Shown under the scale, e.g. "per kg of bodyweight". */
  basis,
}: {
  low: number;
  typical: number;
  high: number;
  value: number;
  unit: string;
  basis?: string;
}) {
  // Pad the scale beyond the published bounds so an out-of-range dose still has
  // somewhere to render, and so the end caps do not touch the edges.
  const span = high - low || high || 1;
  const pad = span * 0.22;
  const scaleLow = low - pad;
  const scaleHigh = high + pad;
  const pct = (v: number) => ((v - scaleLow) / (scaleHigh - scaleLow)) * 100;
  const clamp = (n: number) => Math.min(100, Math.max(0, n));

  const below = value < low;
  const above = value > high;
  const outside = below || above;
  const tone = outside ? colors.critical : colors.accent;

  const trackLeft = clamp(pct(low));
  const trackRight = clamp(pct(high));
  const valueLeft = clamp(pct(value));
  const typicalLeft = clamp(pct(typical));

  const format = (n: number) => (Number.isInteger(n) ? `${n}` : `${n}`);

  return (
    <View accessible accessibilityLabel={`Your dose ${value} ${unit}. Published range ${low} to ${high} ${unit}, typical ${typical}.`}>
      {/* Value pill, pinned above the mark. */}
      <View style={{ height: 26, justifyContent: 'flex-end' }}>
        <View
          style={{
            position: 'absolute',
            left: `${valueLeft}%`,
            transform: [{ translateX: -26 }],
            backgroundColor: outside ? colors.criticalDim : colors.surfaceHigh,
            borderWidth: 1,
            borderColor: tone,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.sm,
            paddingVertical: 2,
            minWidth: 52,
            alignItems: 'center',
          }}
        >
          <Data color={tone} small>
            {format(value)}
          </Data>
        </View>
      </View>

      <View style={{ height: 14, justifyContent: 'center', marginTop: 4 }}>
        {/* Padded scale — the faint rule the published interval sits on. */}
        <View style={{ position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: colors.border }} />

        {/* The published interval itself. */}
        <View
          style={{
            position: 'absolute',
            left: `${trackLeft}%`,
            width: `${Math.max(1, trackRight - trackLeft)}%`,
            height: 14,
            borderRadius: 7,
            backgroundColor: colors.surfaceHigh,
            borderWidth: 1,
            borderColor: colors.borderBright,
          }}
        />

        {/* Typical dose — a quiet reference tick, not a second accent. */}
        <View
          style={{
            position: 'absolute',
            left: `${typicalLeft}%`,
            width: 1,
            height: 14,
            backgroundColor: colors.textFaint,
          }}
        />

        {/* Where this user actually lands. */}
        <View
          style={{
            position: 'absolute',
            left: `${valueLeft}%`,
            transform: [{ translateX: -1 }],
            width: 2,
            height: 20,
            borderRadius: 1,
            backgroundColor: tone,
          }}
        />
      </View>

      <Row justify="space-between" style={{ marginTop: spacing.sm }}>
        <Data color={colors.textMuted} small>
          {format(low)} {unit}
        </Data>
        <Caption color={colors.textFaint}>published range</Caption>
        <Data color={colors.textMuted} small>
          {format(high)} {unit}
        </Data>
      </Row>

      {basis ? (
        <Caption color={colors.textFaint}>{basis}</Caption>
      ) : null}

      {outside ? (
        <Data color={colors.critical} small style={{ marginTop: spacing.sm }}>
          {below ? 'Below the published range' : 'Above the published range'}
        </Data>
      ) : null}
    </View>
  );
}

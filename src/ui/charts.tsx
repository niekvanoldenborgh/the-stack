import { View } from 'react-native';

import { Caption, Data, Row, Small } from './components';
import { radius, spacing, useTheme } from './theme';

/**
 * Charts, drawn with plain Views.
 *
 * No charting library and no SVG dependency: every form here is rectangles on a
 * baseline, which layout expresses exactly. That keeps the bundle honest and
 * means the charts inherit the app's spacing and colour tokens directly.
 *
 * Conventions, applied consistently:
 *  - Marks are thin, with a 4px rounded data-end and a square end anchored to
 *    the baseline, so the value reads from the axis rather than floating.
 *  - A 2px surface gap separates adjacent marks and stacked segments.
 *  - A zero value renders as a 2px stub rather than nothing, so an empty slot
 *    reads as "nothing happened" instead of "no data".
 *  - Only the peak is direct-labelled. A number on every bar is noise.
 *  - Axes and grid are recessive; the data is the only thing with chroma.
 *  - Every mark carries an accessibilityLabel with its own figure, which is the
 *    mobile equivalent of the table view a chart owes a screen-reader user.
 *
 * Single-hue small-multiples only (design spec §1.5/§2.3) — `tint` defaults
 * to the theme's `chartInk`, tracks/rails to `chartTrack`. Do not introduce
 * a categorical series palette here without a CVD validation pass first
 * (AGENTS.md).
 */

const BAR_GAP = 2;
const ZERO_STUB = 2;

export interface BarDatum {
  label: string;
  value: number;
  /** Optional second segment stacked on top, e.g. skipped doses. */
  secondary?: number;
  /**
   * The denominator this bar should be read against — doses scheduled, sets
   * programmed, a volume target. Drawn as a muted rail behind the bar.
   *
   * Without it a chart scales to whatever the largest observed value happens to
   * be, so a week where you took 6 of 6 doses and a week where you took 6 of 20
   * render identically. For a ratio quantity the denominator is the entire
   * point, so it is drawn rather than normalised away.
   */
  track?: number;
  /** Marks the one bar worth drawing the eye to. Others render recessive. */
  focus?: boolean;
  accessibilityLabel?: string;
}

/**
 * Vertical bars for a single measure over time.
 *
 * One series means no legend — the caption above the chart names it.
 */
export function VBars({
  data,
  height = 116,
  tint,
  secondaryTint,
  formatValue = (v) => `${v}`,
  showPeakLabel = true,
  threshold,
  thresholdLabel,
}: {
  data: BarDatum[];
  height?: number;
  tint?: string;
  secondaryTint?: string;
  formatValue?: (value: number) => string;
  showPeakLabel?: boolean;
  /** A reference level drawn as a dashed rule across the plot. */
  threshold?: number;
  /** Labelled inline at the right end of the rule — no legend, no axis. */
  thresholdLabel?: string;
}) {
  const theme = useTheme();
  const { color } = theme;
  const resolvedTint = tint ?? color.chartInk;
  const resolvedSecondaryTint = secondaryTint ?? color.borderStrong;

  // Tracks and thresholds participate in the scale; otherwise a bar could sit
  // above its own denominator, or a threshold could fall off the top.
  const max = Math.max(
    ...data.map((d) => Math.max(d.value + (d.secondary ?? 0), d.track ?? 0)),
    threshold ?? 0,
    1,
  );
  const peakIndex = data.reduce(
    (best, d, i) => (d.value + (d.secondary ?? 0) > data[best]!.value + (data[best]!.secondary ?? 0) ? i : best),
    0,
  );
  const hasExplicitFocus = data.some((d) => d.focus);

  return (
    <View>
      <View style={{ height, flexDirection: 'row', alignItems: 'flex-end' }}>
        {threshold !== undefined ? (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: (threshold / max) * height,
              height: 1,
              borderBottomWidth: 1,
              borderStyle: 'dashed',
              borderColor: color.borderStrong,
              zIndex: 2,
              alignItems: 'flex-end',
            }}
          >
            {/* Labelled on the rule itself, so the reference needs no legend. */}
            {thresholdLabel ? (
              <View style={{ marginTop: -14, backgroundColor: color.surface, paddingHorizontal: 4 }}>
                <Caption color={color.textTertiary}>{thresholdLabel}</Caption>
              </View>
            ) : null}
          </View>
        ) : null}
        {data.map((datum, index) => {
          const total = datum.value + (datum.secondary ?? 0);
          const isPeak = index === peakIndex && total > 0;
          // With explicit focus set, that bar leads; otherwise the peak does.
          const leads = hasExplicitFocus ? Boolean(datum.focus) : isPeak;
          const primaryHeight = total > 0 ? Math.max((datum.value / max) * height, datum.value > 0 ? 3 : 0) : 0;
          const secondaryHeight = datum.secondary ? Math.max((datum.secondary / max) * height, 3) : 0;
          const trackHeight = datum.track ? (datum.track / max) * height : 0;

          return (
            <View
              key={datum.label + index}
              accessible
              accessibilityLabel={datum.accessibilityLabel ?? `${datum.label}: ${formatValue(datum.value)}`}
              style={{ flex: 1, marginHorizontal: BAR_GAP / 2, justifyContent: 'flex-end' }}
            >
              {/* The denominator, drawn behind the bar at the same width. */}
              {trackHeight > 0 ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: trackHeight,
                    backgroundColor: color.chartTrack,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                  }}
                />
              ) : null}

              {leads && showPeakLabel ? (
                <Data color={color.chartPeakLabel} small style={{ textAlign: 'center', marginBottom: spacing.xs }}>
                  {formatValue(total)}
                </Data>
              ) : null}

              {secondaryHeight > 0 ? (
                <View
                  style={{
                    height: secondaryHeight,
                    backgroundColor: resolvedSecondaryTint,
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                    // Surface gap keeps stacked segments legible without a stroke.
                    marginBottom: BAR_GAP,
                  }}
                />
              ) : null}

              <View
                style={{
                  height: total > 0 ? primaryHeight : ZERO_STUB,
                  backgroundColor: total > 0 ? resolvedTint : color.border,
                  borderTopLeftRadius: secondaryHeight > 0 ? 0 : 4,
                  borderTopRightRadius: secondaryHeight > 0 ? 0 : 4,
                  // Recessive rather than transparent: opacity alone on ink
                  // drops below usable contrast, so the non-leading bars keep
                  // full opacity and step down in luminance instead.
                  opacity: leads || total === 0 ? 1 : 0.62,
                }}
              />
            </View>
          );
        })}
      </View>

      {/* Recessive baseline. */}
      <View style={{ height: 1, backgroundColor: color.border, marginTop: 0 }} />

      <Row justify="space-between" style={{ marginTop: spacing.sm }}>
        <Caption color={color.textTertiary}>{data[0]?.label ?? ''}</Caption>
        <Caption color={color.textTertiary}>{data[data.length - 1]?.label ?? ''}</Caption>
      </Row>
    </View>
  );
}

/**
 * Ranked horizontal bars. Magnitude is length only — colour stays constant,
 * because encoding the same measure twice adds no information.
 */
export function HBars({
  data,
  tint,
  formatValue = (v) => `${v}`,
  threshold,
  thresholdLabel,
}: {
  data: BarDatum[];
  tint?: string;
  formatValue?: (value: number) => string;
  /** A reference level, drawn as a dashed vertical rule across every row. */
  threshold?: number;
  thresholdLabel?: string;
}) {
  const theme = useTheme();
  const { color } = theme;
  const resolvedTint = tint ?? color.chartInk;
  const max = Math.max(...data.map((d) => Math.max(d.value, d.track ?? 0)), threshold ?? 0, 1);

  return (
    <View>
      {thresholdLabel && threshold !== undefined ? (
        <Row justify="flex-end" style={{ marginBottom: spacing.sm }}>
          <Caption color={color.textTertiary}>{thresholdLabel}</Caption>
        </Row>
      ) : null}
      {data.map((datum, index) => (
        <View
          key={datum.label}
          accessible
          accessibilityLabel={`${datum.label}: ${formatValue(datum.value)}`}
          style={{ marginBottom: index === data.length - 1 ? 0 : spacing.md }}
        >
          <Row justify="space-between" style={{ marginBottom: spacing.xs }}>
            <Small muted={false}>{datum.label}</Small>
            <Data color={color.textSecondary} small>
              {formatValue(datum.value)}
            </Data>
          </Row>
          <View style={{ height: 8, backgroundColor: color.surfaceSunken, borderRadius: radius.sm }}>
            {/* Denominator rail, where this measure has one. */}
            {datum.track ? (
              <View
                style={{
                  position: 'absolute',
                  width: `${(datum.track / max) * 100}%`,
                  height: 8,
                  backgroundColor: color.chartTrack,
                  borderRadius: radius.sm,
                }}
              />
            ) : null}
            <View
              style={{
                width: `${Math.max((datum.value / max) * 100, 1.5)}%`,
                height: 8,
                backgroundColor: resolvedTint,
                borderRadius: radius.sm,
                opacity: index === 0 ? 1 : 0.66,
              }}
            />
            {threshold !== undefined ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  left: `${(threshold / max) * 100}%`,
                  top: -2,
                  bottom: -2,
                  width: 1,
                  borderLeftWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: color.borderStrong,
                }}
              />
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * A compact bar sparkline, for small multiples.
 *
 * Bars rather than a line: with a handful of logged sessions the points are
 * sparse and irregularly spaced, and a connecting line would imply a continuity
 * between them that the data does not have.
 */
export function Sparkbars({
  values,
  height = 34,
  tint,
  accessibilityLabel,
}: {
  values: number[];
  height?: number;
  tint?: string;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const resolvedTint = tint ?? theme.color.chartInk;
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  // Floor the scale a little below the minimum so a flat series still reads as
  // flat rather than as a row of full-height bars.
  const floor = min === max ? 0 : min * 0.9;

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={{ height, flexDirection: 'row', alignItems: 'flex-end' }}
    >
      {values.map((value, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            marginHorizontal: BAR_GAP / 2,
            height: Math.max(((value - floor) / (max - floor || 1)) * height, 3),
            backgroundColor: resolvedTint,
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
            opacity: index === values.length - 1 ? 1 : 0.5,
          }}
        />
      ))}
    </View>
  );
}

/**
 * A continuous curve with an uncertainty band, for the "estimated medication
 * levels" chart (THEA-6). Built the same way as the rest of this file — no SVG,
 * just Views — as a run of adjacent thin columns rather than bars: the band is
 * a lighter fill from `low` to `high`, and the central estimate is a slim
 * marker layered on top. Zero gap between columns (unlike VBars) is
 * deliberate: this is one continuous quantity, not discrete measurements, and
 * a gap would misread as missing data.
 *
 * Never rendered without a band (AGENTS.md / THEA-6 §2.2 U3) — a bare line
 * would imply a measurement this chart is not.
 */
export interface LevelCurvePoint {
  value: number;
  low: number;
  high: number;
}

export function LevelCurve({
  points,
  height = 120,
  tint,
  formatValue = (v) => `${Math.round(v)}%`,
  accessibilityLabel,
}: {
  points: LevelCurvePoint[];
  height?: number;
  tint?: string;
  formatValue?: (value: number) => string;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const resolvedTint = tint ?? theme.color.chartInk;
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.high), 1);

  return (
    <View
      accessible
      accessibilityLabel={
        accessibilityLabel ?? `Estimated level, ${points.length} points, peak ${formatValue(Math.max(...points.map((p) => p.value)))}`
      }
      style={{ height, flexDirection: 'row', alignItems: 'flex-end' }}
    >
      {points.map((point, index) => {
        const bandBottom = (Math.max(point.low, 0) / max) * height;
        const bandTop = (point.high / max) * height;
        const lineBottom = (point.value / max) * height;
        return (
          <View key={index} style={{ flex: 1, height, justifyContent: 'flex-end' }}>
            {/* Uncertainty band — always present, never a bare line (U3). */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: bandBottom,
                height: Math.max(bandTop - bandBottom, 1),
                backgroundColor: resolvedTint,
                opacity: 0.16,
              }}
            />
            {/* Central estimate. */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: Math.max(lineBottom - 1, 0),
                height: 2,
                backgroundColor: resolvedTint,
                opacity: 0.9,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

/** Legend row. Present whenever a chart carries two or more series. */
export function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <Row gap={spacing.lg} wrap style={{ marginTop: spacing.md }}>
      {items.map((item) => (
        <Row key={item.label} gap={spacing.xs}>
          <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: item.color }} />
          <Small>{item.label}</Small>
        </Row>
      ))}
    </Row>
  );
}

import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Info, Minus, ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Circle, Svg } from 'react-native-svg';

import { Caption, Row, Small } from './components';
import {
  EVIDENCE_LABELS,
  fonts,
  radius,
  spacing,
  typography,
  useTheme,
  withOpacity,
  type Elevation,
} from './theme';

/**
 * NOCTURNE shared components (THEA rebrand).
 *
 * Six primitives translated from `design-lab/mockups/nocturne.html` /
 * `KIT.md` into React Native: `CountdownRing`, `SafetyTile`, `EvidenceBadge`,
 * `DeltaBadge`, `PhaseBar` and `Tile`. All colour comes from `useTheme()` —
 * nothing here hardcodes a hex. `color.severity` is only ever touched by
 * `SafetyTile` (that's what it's for); everything else stays on brand-violet
 * or neutral tokens, per AGENTS.md.
 */

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Dark reads violet as a light source, so emphasis there is a glow. Light
 * can't fake a glow with a shadow that will actually be visible, so emphasis
 * there is a deeper, more saturated stroke instead — `primaryPressed` is
 * exactly that: the same hue, pushed darker. Shared by `CountdownRing` and
 * `PhaseBar`'s "current" marker, the two places this file draws glow-as-state.
 */
function emphasisColor(mode: 'light' | 'dark', color: { primary: string; primaryPressed: string }): string {
  return mode === 'dark' ? color.primary : color.primaryPressed;
}

// ---------------------------------------------------------------------------
// 1. CountdownRing — the signature hero element
// ---------------------------------------------------------------------------

export interface CountdownRingProps {
  /** 0–100, progress toward the next dose. */
  pct: number;
  /** The large centred numeral, e.g. "2h 12m". */
  timeLabel: string;
  /** Small caption above the ring, e.g. "NEXT DOSE". */
  caption: string;
  /** Compound line below the ring, e.g. "Semaglutide · 2.4 mg". */
  subtitle: string;
  /** Extra content under the subtitle — a site line, a CTA. */
  children?: ReactNode;
  size?: number;
}

/**
 * The one glowing element on its screen (AGENTS.md — brand colour is
 * reserved emphasis, not decoration sprinkled everywhere). In dark mode the
 * arc and numeral carry a real glow via a layered low-opacity stroke plus a
 * text shadow; in light mode a shadow would be invisible, so emphasis comes
 * from a deeper, more saturated stroke instead (`emphasisColor` above) — no
 * glow is faked there.
 */
export function CountdownRing({ pct, timeLabel, caption, subtitle, children, size = 220 }: CountdownRingProps) {
  const theme = useTheme();
  const { color, mode } = theme;
  const emphasis = emphasisColor(mode, color);
  const strokeWidth = Math.max(8, Math.round(size * 0.045));
  const center = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <View style={{ alignItems: 'center' }}>
      {/* Grouped as one accessibility node — caption/ring/subtitle are one
       *  stat, read together. `children` (often a CTA button) stays outside
       *  this node: `accessible` on an ancestor swallows descendant
       *  interactive elements, so a button caught inside it would never be
       *  individually focusable. */}
      <View accessible accessibilityLabel={`${caption}: ${timeLabel}, ${subtitle}`} style={{ alignItems: 'center' }}>
        <Caption style={{ marginBottom: spacing.sm }}>{caption}</Caption>
        <View style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Circle cx={center} cy={center} r={r} stroke={color.border} strokeWidth={strokeWidth} fill="none" />
            {mode === 'dark' ? (
              <Circle
                cx={center}
                cy={center}
                r={r}
                stroke={emphasis}
                strokeWidth={strokeWidth * 2}
                strokeLinecap="round"
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={dashOffset}
                fill="none"
                opacity={0.18}
                transform={`rotate(-90 ${center} ${center})`}
              />
            ) : null}
            <Circle
              cx={center}
              cy={center}
              r={r}
              stroke={emphasis}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashOffset}
              fill="none"
              transform={`rotate(-90 ${center} ${center})`}
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text
              style={[
                typography.metric,
                { color: emphasis },
                mode === 'dark'
                  ? { textShadowColor: emphasis, textShadowRadius: 18, textShadowOffset: { width: 0, height: 0 } }
                  : null,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {timeLabel}
            </Text>
          </View>
        </View>
        <Text style={[typography.title, { color: color.textPrimary, marginTop: spacing.md, textAlign: 'center' }]}>
          {subtitle}
        </Text>
      </View>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 2. SafetyTile — a tile that is also a disclosure
// ---------------------------------------------------------------------------

export type FindingSeverity = 'critical' | 'high' | 'moderate' | 'info';

export interface SafetyFinding {
  id: string;
  severity: FindingSeverity;
  /** Short label. Rendered on the tile face when this is the worst finding
   *  present and it's critical/high; otherwise it only appears expanded. */
  label: string;
  /** Longer explanation — only ever shown inside the expanded body. */
  detail?: string;
}

export interface SafetyTileProps {
  /** Section caption, e.g. "Interactions". */
  title: string;
  findings: SafetyFinding[];
  /** Face copy when there is nothing to report at all. */
  emptyLabel?: string;
  defaultOpen?: boolean;
}

const SEVERITY_RANK: Record<FindingSeverity, number> = { info: 0, moderate: 1, high: 2, critical: 3 };
/** Hard safety rule, not a caller-tunable threshold (AGENTS.md #5/#6-adjacent:
 *  a critical/high finding must never hide behind a tap). Moderate/info are
 *  the only severities allowed to collapse. */
const BLOCKING = new Set<FindingSeverity>(['critical', 'high']);

/**
 * The face always states the worst severity present — critical/high can
 * never be the thing you only see after tapping. Moderate/info collapse
 * behind the disclosure. Callers hand over raw `findings`; this component
 * computes the face state itself so there's no call site that can get the
 * ordering wrong.
 */
export function SafetyTile({ title, findings, emptyLabel = 'Nothing on file', defaultOpen = false }: SafetyTileProps) {
  const theme = useTheme();
  const { color } = theme;
  const [open, setOpen] = useState(defaultOpen);

  const blocking = findings.filter((f) => BLOCKING.has(f.severity));
  const worstBlocking = blocking.reduce<SafetyFinding | null>(
    (worst, f) => (!worst || SEVERITY_RANK[f.severity] > SEVERITY_RANK[worst.severity] ? f : worst),
    null,
  );
  const collapsibleCount = findings.length - blocking.length;
  const canExpand = findings.length > 0;

  const faceTone = worstBlocking ? theme.tone(worstBlocking.severity) : theme.tone('success');
  const faceLabel = worstBlocking ? worstBlocking.label : emptyLabel;
  const FaceIcon = worstBlocking ? TriangleAlert : ShieldCheck;

  const toggle = () => {
    if (!canExpand) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  };

  return (
    <View style={[styles.safetyTile, { backgroundColor: color.surfaceElevated }, theme.shadow(2)]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open, disabled: !canExpand }}
        accessibilityLabel={`${title}: ${faceLabel}${!worstBlocking && collapsibleCount > 0 ? `, ${collapsibleCount} more to review` : ''}`}
        onPress={toggle}
        disabled={!canExpand}
        style={({ pressed }) => [styles.safetyTileFace, { opacity: pressed && canExpand ? 0.75 : 1 }]}
      >
        <Row justify="space-between" align="center">
          <Caption>{title}</Caption>
          {canExpand ? (
            open ? (
              <ChevronUp size={13} color={color.textSecondary} />
            ) : (
              <ChevronDown size={13} color={color.textSecondary} />
            )
          ) : null}
        </Row>
        <Row gap={spacing.xs} align="center" style={{ marginTop: spacing.xs }}>
          <FaceIcon size={15} color={faceTone.fg} />
          <Text
            style={[typography.dataSmall, { color: faceTone.fg, flexShrink: 1 }]}
            numberOfLines={open ? undefined : 1}
          >
            {faceLabel}
          </Text>
        </Row>
        {!open && !worstBlocking && collapsibleCount > 0 ? (
          <Small style={{ marginTop: 2 }}>{`${collapsibleCount} more note${collapsibleCount > 1 ? 's' : ''} to review`}</Small>
        ) : null}
      </Pressable>
      {open ? (
        <View style={{ marginTop: spacing.md }}>
          {findings.map((finding, index) => {
            const tone = theme.tone(finding.severity);
            const Icon = finding.severity === 'info' ? Info : TriangleAlert;
            return (
              <View
                key={finding.id}
                style={index === 0 ? styles.findingRowFirst : [styles.findingRow, { borderTopColor: color.divider }]}
              >
                <Row gap={spacing.xs} align="flex-start">
                  <Icon size={13} color={tone.fg} style={{ marginTop: 1 }} />
                  <Text style={[typography.small, { fontFamily: fonts.semibold, color: color.textPrimary, flex: 1 }]}>
                    {finding.label}
                  </Text>
                </Row>
                {finding.detail ? <Small style={{ marginTop: 2 }}>{finding.detail}</Small> : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 3. EvidenceBadge — compact A/B/C/D badge
// ---------------------------------------------------------------------------

export interface EvidenceBadgeProps {
  tier: 'A' | 'B' | 'C' | 'D';
  /** Also render the tier's plain-language meaning next to the letter. */
  showLabel?: boolean;
  size?: number;
}

/**
 * Reads `color.evidence[tier]` only — never `color.severity`. A "C" evidence
 * badge and a "moderate" safety warning must never share a hex, or a user
 * who learns "amber = danger" on one screen carries that reading into the
 * other (AGENTS.md). The letter is always drawn, never colour alone.
 */
export function EvidenceBadge({ tier, showLabel = false, size = 26 }: EvidenceBadgeProps) {
  const theme = useTheme();
  const { color, mode } = theme;
  // Evidence hues are mid-to-light violets in both themes; a fixed near-black
  // ink reads reliably on all four without picking per-tier text colours.
  const ink = mode === 'dark' ? color.background : color.textPrimary;
  const meaning = EVIDENCE_LABELS[tier];
  const a11yLabel = `Evidence tier ${tier}: ${meaning}`;

  const dot = (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color.evidence[tier],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={[typography.caption, { color: ink, textTransform: 'none', letterSpacing: 0 }]}>{tier}</Text>
    </View>
  );

  if (!showLabel) {
    return (
      <View accessibilityRole="text" accessibilityLabel={a11yLabel}>
        {dot}
      </View>
    );
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
    >
      {dot}
      <Text style={[typography.small, { fontFamily: fonts.semibold, color: color.textPrimary }]}>{meaning}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 4. DeltaBadge — a signed change with a direction arrow
// ---------------------------------------------------------------------------

export interface DeltaBadgeProps {
  /** Signed change, e.g. -3.1 or 2. */
  value: number;
  /** Which raw direction of `value` counts as improvement — 'down' for
   *  weight, 'up' for e.g. adherence. */
  goodDirection: 'up' | 'down';
  unit?: string;
  /** Decimal places to display. Defaults to 1. */
  decimals?: number;
}

/**
 * The arrow glyph is never omitted — colour alone never carries the
 * direction (AGENTS.md). Only the "good" direction gets `success` tinting;
 * the "bad" direction stays neutral rather than borrowing `color.severity`,
 * because a wrong-direction number (e.g. weight up 1kg) isn't a safety
 * finding and shouldn't read as one.
 */
export function DeltaBadge({ value, goodDirection, unit, decimals = 1 }: DeltaBadgeProps) {
  const theme = useTheme();
  const { color } = theme;
  const direction: 'up' | 'down' | 'flat' = value === 0 ? 'flat' : value > 0 ? 'up' : 'down';
  const isGood = direction !== 'flat' && direction === goodDirection;
  const Icon = direction === 'up' ? ArrowUp : direction === 'down' ? ArrowDown : Minus;
  const tone = isGood ? theme.tone('success') : null;
  const fg = tone ? tone.fg : color.textSecondary;
  const bg = tone ? tone.bg : color.surfaceMuted;
  const magnitude = Math.abs(value).toFixed(decimals);
  const sign = direction === 'up' ? '+' : direction === 'down' ? '−' : '';
  const unitSuffix = unit ? ` ${unit}` : '';
  const words =
    direction === 'flat' ? 'no change' : `${direction === 'down' ? 'decreased' : 'increased'} by ${magnitude}${unitSuffix}`;

  return (
    <View accessibilityRole="text" accessibilityLabel={words} style={[styles.deltaBadge, { backgroundColor: bg }]}>
      <Icon size={13} color={fg} />
      <Text style={[typography.small, { fontFamily: fonts.bold, color: fg }]}>
        {sign}
        {magnitude}
        {unitSuffix}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 5. PhaseBar — proportional segmented bar for cycle phases
// ---------------------------------------------------------------------------

export interface PhaseBarSegment {
  key: string;
  /** Phase name, e.g. "Loading". Rendered under its segment. */
  label: string;
  /** Proportional weight — days, weeks, anything, as long as every segment
   *  in one bar shares a unit. */
  length: number;
  /** Secondary line under the label, e.g. a date range. */
  detail?: string;
}

export interface PhaseBarProps {
  segments: PhaseBarSegment[];
  /** 0–1 fraction across the whole bar marking "now". Segments before it
   *  read as done, the segment it falls in reads as current, the rest read
   *  as upcoming. Omit to render a plain, state-free bar. */
  position?: number;
}

/**
 * Promoted from `app/(tabs)/calendar.tsx`'s `CyclePhaseBar`, generalised and
 * corrected to the single-hue rule: that screen coloured phases by *type*
 * (loading/on/washout) using `theme.tone('info')` etc — decorative use of a
 * severity tone, which AGENTS.md reserves for danger. This version colours
 * by *state* instead (done / current / upcoming), one hue at varying weight,
 * matching `design-lab/mockups/nocturne-kit.css`'s `.phase-seg` exactly.
 */
export function PhaseBar({ segments, position }: PhaseBarProps) {
  const theme = useTheme();
  const { color, mode } = theme;
  const emphasis = emphasisColor(mode, color);
  const total = segments.reduce((sum, s) => sum + s.length, 0) || 1;

  let cursor = 0;
  const ranges = segments.map((s) => {
    const start = cursor / total;
    cursor += s.length;
    return { ...s, start, end: cursor / total };
  });

  const at = position === undefined ? undefined : Math.max(0, Math.min(1, position));

  return (
    <View>
      <View style={{ position: 'relative' }}>
        <Row gap={spacing.xs} style={{ height: 10 }}>
          {ranges.map((seg) => {
            const state = at === undefined ? 'plain' : seg.end <= at ? 'done' : seg.start <= at ? 'current' : 'upcoming';
            const bg = state === 'done' ? color.primary : state === 'current' ? emphasis : color.border;
            return (
              <View
                key={seg.key}
                style={[
                  { flexGrow: seg.length, flexBasis: 0, height: 10, borderRadius: 5, backgroundColor: bg },
                  state === 'current' && mode === 'dark'
                    ? { shadowColor: emphasis, shadowOpacity: 0.75, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }
                    : null,
                ]}
              />
            );
          })}
        </Row>
        {at !== undefined ? (
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.phaseMarker,
              { left: `${at * 100}%`, backgroundColor: emphasis },
              mode === 'dark'
                ? { shadowColor: emphasis, shadowOpacity: 0.85, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } }
                : null,
            ]}
          />
        ) : null}
      </View>
      <Row gap={spacing.xs} align="flex-start" style={{ marginTop: spacing.sm }}>
        {ranges.map((seg) => (
          <View key={seg.key} style={{ flexGrow: seg.length, flexBasis: 0 }}>
            <Text style={[typography.dataSmall, { color: color.textPrimary }]} numberOfLines={1}>
              {seg.label}
            </Text>
            {seg.detail ? (
              <Text style={[typography.small, { color: color.textSecondary }]} numberOfLines={1}>
                {seg.detail}
              </Text>
            ) : null}
          </View>
        ))}
      </Row>
    </View>
  );
}

// ---------------------------------------------------------------------------
// 6. Tile — the chunky rounded surface primitive
// ---------------------------------------------------------------------------

export type TileElevation = 'low' | 'mid' | 'hero';

export interface TileProps {
  /** Maps to `surface` / `surfaceElevated` / the hero treatment. Defaults to 'mid'. */
  elevation?: TileElevation;
  icon?: ReactNode;
  caption?: string;
  /** The large figure. For richer hero content (a `CountdownRing`, a
   *  `PhaseBar`), use `children` instead. */
  value?: string;
  footer?: ReactNode;
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const TILE_TIER: Record<TileElevation, { shadowTier: Elevation; cornerRadius: number; pad: number }> = {
  low: { shadowTier: 1, cornerRadius: radius.md, pad: spacing.md },
  mid: { shadowTier: 2, cornerRadius: radius.lg, pad: spacing.lg },
  hero: { shadowTier: 3, cornerRadius: radius.xl, pad: spacing.xl },
};

/**
 * The surface every other component in this file (and most PULSE screens)
 * sits on. Three tiers only — reach for `low`/`mid` for ordinary grouping
 * and reserve `hero` for the one focal block a screen leads with, same rule
 * as `Section`'s `tone` prop in primitives.tsx.
 */
export function Tile({ elevation = 'mid', icon, caption, value, footer, children, onPress, accessibilityLabel, style }: TileProps) {
  const theme = useTheme();
  const { color, mode } = theme;
  const tier = TILE_TIER[elevation];
  const bg = elevation === 'low' ? color.surface : elevation === 'mid' ? color.surfaceElevated : color.surfaceMuted;
  const borderColor = elevation === 'hero' ? withOpacity(color.primary, mode === 'dark' ? 0.28 : 0.2) : color.border;

  const content = (
    <>
      {icon || caption ? (
        <Row gap={spacing.xs} align="center" style={{ marginBottom: value || children ? spacing.sm : 0 }}>
          {icon}
          {caption ? <Caption>{caption}</Caption> : null}
        </Row>
      ) : null}
      {value ? <Text style={[typography.statBig, { color: color.textPrimary }]}>{value}</Text> : null}
      {children}
      {footer ? <View style={{ marginTop: spacing.md }}>{footer}</View> : null}
    </>
  );

  const box: StyleProp<ViewStyle> = [
    { backgroundColor: bg, borderWidth: 1, borderColor, borderRadius: tier.cornerRadius, padding: tier.pad },
    theme.shadow(tier.shadowTier),
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? caption}
        onPress={onPress}
        style={({ pressed }) => [box, { minHeight: 44, opacity: pressed ? 0.85 : 1 }]}
      >
        {content}
      </Pressable>
    );
  }

  return <View style={box}>{content}</View>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  safetyTile: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  safetyTileFace: {
    minHeight: 44,
    justifyContent: 'center',
  },
  findingRowFirst: {
    paddingTop: 0,
  },
  findingRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  phaseMarker: {
    position: 'absolute',
    top: -3,
    width: 10,
    height: 16,
    borderRadius: 5,
    marginLeft: -5,
  },
});

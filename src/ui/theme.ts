import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme, type TextStyle, type ViewStyle } from 'react-native';

import { useAppStore, type ThemePreference } from '../store/useAppStore';

/**
 * Visual language: PULSE (THEA-68 / THEA-69).
 *
 * Two real themes — light and dark — behind one semantic token set. The
 * previous "Clinical Light" iteration (THEA-55/59) shipped a single flat
 * `colors` object; PULSE replaces that with `ColorTokens` (this file) plus a
 * `ThemeProvider`/`useTheme()` (bottom of this file) so every component reads
 * `theme.color.x` instead of importing a static palette. `spacing`, `radius`,
 * `typography` and `fonts` stay theme-independent exports, exactly as before
 * — only colour and elevation are theme-aware.
 *
 * Full token rationale, contrast notes and the safety reconciliation
 * (severity scale vs brand accent, evidence-badge exemption, chart
 * single-hue rule) live in the THEA-68 design spec doc ("pulse-design-spec")
 * on that issue. Do not "improve" the numbers here without checking that doc
 * — the severity hex values in particular are pinned so this redesign cannot
 * silently drift brand violet into warning territory (AGENTS.md).
 */

export type ThemeMode = 'light' | 'dark';

export type SeverityTone = 'critical' | 'high' | 'moderate' | 'info' | 'accent' | 'success';

interface ToneColor {
  fg: string;
  soft: string;
  softText: string;
}

export interface ColorTokens {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSunken: string;
  surfaceMuted: string;

  textPrimary: string;
  textSecondary: string;
  textTertiary: string;

  border: string;
  borderStrong: string;
  divider: string;
  overlay: string;

  primary: string;
  primaryPressed: string;
  primarySolid: string;
  onPrimary: string;
  primarySoft: string;
  primarySoftText: string;
  accentGradient: readonly [string, string, string];
  /** Avatar badge only — a lighter 2-stop relative of `accentGradient`, not a
   *  general accent. `accentGradient`'s 3 stops read muddy at avatar size
   *  (pulse-design-spec-v2 §1). */
  avatarGradient: readonly [string, string];
  /** Hero pulse-dot only, on-gradient. Not a severity/status colour — a mint
   *  lighter than `success` because the darker green loses contrast sitting
   *  on the violet hero gradient (pulse-design-spec-v2 §1). */
  heroAccent: string;

  success: string;
  successSoft: string;
  successText: string;

  disabled: string;
  disabledContent: string;

  /** Severity/status scale — reserved, never reused as a general accent. */
  severity: Record<Exclude<SeverityTone, 'accent'>, ToneColor>;

  /** Evidence-tier badges only — never a chart series (AGENTS.md). */
  evidence: Record<'A' | 'B' | 'C' | 'D', string>;

  chartInk: string;
  chartTrack: string;
  chartPeakLabel: string;
}

const LIGHT_COLORS: ColorTokens = {
  // NOCTURNE light. Violet-tinted throughout — there is deliberately no
  // #FFFFFF surface. The owner's complaint about the previous palette was
  // "too much white", and a near-white card on a near-white canvas is what
  // produced that. Elevation still reads lighter-as-higher (unlike the
  // dark theme, where it reads brighter-as-higher via glow).
  background: '#EDE9F9',
  surface: '#F5F2FD',
  surfaceElevated: '#FAF8FF',
  surfaceSunken: '#E4DFF4',
  surfaceMuted: '#DFDAF1',

  textPrimary: '#16132A',
  textSecondary: '#52496E',
  textTertiary: '#7A7196',

  border: '#D7CFEC',
  borderStrong: '#C3B8E0',
  divider: '#E7E2F6',
  overlay: 'rgba(22,19,42,0.45)',

  primary: '#5B4BD6',
  primaryPressed: '#4636B5',
  primarySolid: '#5B4BD6',
  onPrimary: '#FFFFFF',
  primarySoft: '#E3DDFB',
  primarySoftText: '#4636B5',
  accentGradient: ['#5B4BD6', '#7B5BE0', '#9D6BF0'],
  avatarGradient: ['#6A63F0', '#9D7BF5'],
  heroAccent: '#7CFFB2',

  success: '#1FA968',
  successSoft: '#DDF3E8',
  successText: '#157A4B',

  disabled: '#E4DFF4',
  disabledContent: '#8B82A6',

  severity: {
    critical: { fg: '#C42A43', soft: '#FBE4E8', softText: '#A31F35' },
    high: { fg: '#B4551A', soft: '#FBEADD', softText: '#8F410F' },
    moderate: { fg: '#E39A00', soft: '#FAF0D5', softText: '#8A6100' },
    info: { fg: '#0E7490', soft: '#DFF3F8', softText: '#0B5E76' },
    success: { fg: '#1FA968', soft: '#DDF3E8', softText: '#157A4B' },
  },

  // Brand-family ramp, NOT the severity scale. Previously A/B/C/D reused the
  // severity hexes verbatim, so a "C" evidence badge rendered in the exact
  // amber a moderate interaction warning uses — a user who learned
  // "amber = warning" on Summary carried that reading into an evidence badge
  // meaning "weaker research". Zero hex overlap with `severity` is required.
  evidence: { A: '#7C5CE8', B: '#6D7FD4', C: '#8E82B8', D: '#6B6484' },

  chartInk: '#5B4BD6',
  chartTrack: '#E0DAF3',
  chartPeakLabel: '#16132A',
};

const DARK_COLORS: ColorTokens = {
  // NOCTURNE dark — the chosen direction. A near-black violet-tinted canvas
  // where violet acts as a light source rather than a paint colour: elevation
  // reads as "how much light this surface catches", so surfaces step up in
  // brightness and the one hero metric per screen carries a glow.
  background: '#0B0A14',
  surface: '#141225',
  surfaceElevated: '#1D1A33',
  surfaceSunken: '#08070F',
  surfaceMuted: '#241F42',

  textPrimary: '#F2F0FF',
  // Lightened from the first Nocturne pass (#8B86A8), which computed to
  // exactly 4.50:1 on surfaceMuted — sitting on the AA floor with no margin,
  // so ordinary gamma variance across devices pushed real renders under it.
  textSecondary: '#9992BC',
  textTertiary: '#7871A0',

  border: '#2A2745',
  borderStrong: '#3A3560',
  divider: '#221E3A',
  overlay: 'rgba(5,3,10,0.62)',

  primary: '#9C82FF',
  primaryPressed: '#6244E8',
  primarySolid: '#7856F8',
  onPrimary: '#FFFFFF',
  primarySoft: '#241F42',
  primarySoftText: '#C4B5FD',
  accentGradient: ['#5B3FE0', '#7C5CFF', '#9D7BF5'],
  avatarGradient: ['#655BF5', '#9B74F8'],
  heroAccent: '#7CFFB2',

  success: '#45C987',
  successSoft: '#12301F',
  successText: '#8FE3B7',

  disabled: '#1D1A33',
  disabledContent: '#5C5578',

  severity: {
    critical: { fg: '#FF6B85', soft: '#3A1721', softText: '#FF9DAF' },
    high: { fg: '#FF9E5C', soft: '#3A2412', softText: '#FFC199' },
    moderate: { fg: '#F2B84D', soft: '#3A2E12', softText: '#F6CE82' },
    info: { fg: '#55C7DE', soft: '#123039', softText: '#8BDBEB' },
    success: { fg: '#45C987', soft: '#12301F', softText: '#8FE3B7' },
  },

  // See the light-mode note: brand-family ramp, zero overlap with `severity`.
  evidence: { A: '#9B87F5', B: '#7C93D6', C: '#A99FC2', D: '#7E7799' },

  chartInk: '#9C82FF',
  chartTrack: '#241F42',
  chartPeakLabel: '#F2F0FF',
};

export const COLOR_TOKENS: Record<ThemeMode, ColorTokens> = { light: LIGHT_COLORS, dark: DARK_COLORS };

/**
 * `#RRGGBB` + alpha → `rgba(...)`. Only reach for this where no token already
 * covers the exact opacity — currently just the floating tab bar's solid
 * translucent fallback for KIMI's `backdrop-filter: blur()` (spec-v2 §3.9,
 * AGENTS.md — there's no literal RN equivalent for backdrop blur).
 */
export function withOpacity(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * `tone` → { fg, bg, softText }, theme-aware.
 *
 * `'accent'` is brand emphasis, not a severity — it routes to
 * `primary`/`primarySoft`/`primarySoftText` rather than the reserved
 * severity table (§2.1 of the design spec). Every other tone reads straight
 * off `color.severity`.
 */
export function toneColors(color: ColorTokens, tone: SeverityTone): { fg: string; bg: string; softText: string } {
  if (tone === 'accent') {
    return { fg: color.primary, bg: color.primarySoft, softText: color.primarySoftText };
  }
  const t = color.severity[tone];
  return { fg: t.fg, bg: t.soft, softText: t.softText };
}

export function evidenceColor(color: ColorTokens, tier: 'A' | 'B' | 'C' | 'D'): string {
  return color.evidence[tier];
}

export const EVIDENCE_LABELS: Record<'A' | 'B' | 'C' | 'D', string> = {
  A: 'Human RCTs',
  B: 'Limited human data',
  C: 'Animal data only',
  D: 'Anecdotal only',
};

export const LEGAL_LABELS: Record<string, string> = {
  prescription: 'Prescription only',
  research_chemical: 'Research chemical',
  cosmetic_otc: 'Cosmetic (OTC)',
  supplement: 'Supplement',
};

// ---------------------------------------------------------------------------
// Type — Inter, per-weight families (§3.1). Never set `fontWeight` alongside
// `fontFamily`: each weight below is its own family, so combining the two
// makes Android fall back to the system font and react-native-web paint a
// synthetic faux-bold over an already-bold face (AGENTS.md).
// ---------------------------------------------------------------------------

export const fonts = {
  displayBold: 'Inter_800ExtraBold',
  bold: 'Inter_700Bold',
  semibold: 'Inter_600SemiBold',
  medium: 'Inter_500Medium',
  regular: 'Inter_400Regular',
} as const;

/**
 * RN's `TextStyle['fontVariant']` wants a mutable array of its literal
 * union, not a readonly tuple — `as const` on the literal produces the
 * latter, so this is typed and reused instead of repeating the cast.
 */
const TABULAR_NUMS: TextStyle['fontVariant'] = ['tabular-nums'];

/**
 * Same export keys as before the redesign so call sites don't churn — only
 * the family/size/weight underneath changed. `tabular-nums` on the numeric
 * styles is the honest replacement for the retired IBM Plex Mono: columns of
 * figures still line up and digits don't shift width, without a lab/terminal
 * monospace voice.
 */
export const typography = {
  display: { fontFamily: fonts.displayBold, fontSize: 30, letterSpacing: -0.6, lineHeight: 36 },
  title: { fontFamily: fonts.bold, fontSize: 22, letterSpacing: -0.4, lineHeight: 28 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, letterSpacing: -0.2, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 23 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.4, lineHeight: 15, textTransform: 'uppercase' as const },
  metric: {
    fontFamily: fonts.bold,
    fontSize: 44,
    letterSpacing: -1.5,
    lineHeight: 48,
    fontVariant: TABULAR_NUMS,
  },
  data: { fontFamily: fonts.medium, fontSize: 15, fontVariant: TABULAR_NUMS },
  dataSmall: { fontFamily: fonts.medium, fontSize: 12.5, fontVariant: TABULAR_NUMS },
  /** `StatCard`'s big figure (pulse-design-spec-v2 §2) — same size as `title`
   *  but heavier (800) and tighter tracking; kept as its own scale step
   *  rather than overloading `title`'s weight. */
  statBig: { fontFamily: fonts.displayBold, fontSize: 22, letterSpacing: -0.44, lineHeight: 26, fontVariant: TABULAR_NUMS },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

/** PULSE radius bands (brief 14–28, §3.3). Circular controls use `pill`;
 *  don't turn every control into one — pills are for toggles/segmented state
 *  and round check marks only. */
export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

// ---------------------------------------------------------------------------
// Elevation — surface + shadow per tier, per theme (§3.2).
//
// In light mode depth reads through a diffuse drop shadow; in dark mode
// shadows barely register, so depth comes mainly from the tone step
// (background → surface → surfaceElevated) with shadow only a faint
// reinforcement. `Elevation` keeps its old 0–3 numeric shape so `Section`'s
// `tone` prop doesn't churn — 0 is bare background (no shadow), 1/2/3 map to
// the card/raised/hero tiers below.
// ---------------------------------------------------------------------------

export type Elevation = 0 | 1 | 2 | 3;
export type ElevationTier = 'card' | 'raised' | 'hero';

const TIER_BY_ELEVATION: Record<Elevation, ElevationTier | null> = { 0: null, 1: 'card', 2: 'raised', 3: 'hero' };

function rnShadow(offsetY: number, blurRadius: number, color: string): ViewStyle {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: offsetY },
    shadowOpacity: 1,
    shadowRadius: blurRadius / 2,
    elevation: Math.max(1, Math.round(offsetY)),
  };
}

/** Shadow (+ dark-mode hairline highlight) for one elevation tier — no
 *  `backgroundColor`, so a component can layer it over its own fill (e.g.
 *  `Button`'s `primary` variant, which needs the card shadow but not the
 *  card's surface colour). */
export function elevationShadow(mode: ThemeMode, tier: Elevation): ViewStyle {
  const kind = TIER_BY_ELEVATION[tier];
  if (!kind) return {};
  if (mode === 'light') {
    switch (kind) {
      case 'card':
        return rnShadow(2, 8, 'rgba(21,26,34,0.06)');
      case 'raised':
        return rnShadow(6, 18, 'rgba(21,26,34,0.08)');
      case 'hero':
        return rnShadow(10, 28, 'rgba(90,84,209,0.14)');
    }
  }
  // Dark: shadows barely register, so this is a faint reinforcement only —
  // depth comes mainly from the tone step applied by `surfaceStyle` below.
  const base = rnShadow(2, 8, 'rgba(0,0,0,0.35)');
  if (kind === 'card') return base;
  return { ...base, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.04)' };
}

/** Background + shadow style for one elevation tier, resolved for `mode`. */
export function surfaceStyle(color: ColorTokens, mode: ThemeMode, tier: Elevation): ViewStyle {
  const kind = TIER_BY_ELEVATION[tier];
  if (!kind) return { backgroundColor: color.background };
  const bg = kind === 'card' ? color.surface : color.surfaceElevated;
  return { backgroundColor: bg, ...elevationShadow(mode, tier) };
}

// ---------------------------------------------------------------------------
// ThemeProvider / useTheme — reads the persisted `settings.theme` preference
// (`'system' | 'light' | 'dark'`) plus the OS scheme for `'system'`, and
// exposes the resolved tokens. Components consume colour via this hook
// instead of importing a static palette; `spacing`/`radius`/`typography`/
// `fonts` above stay plain imports since they don't vary by theme.
// ---------------------------------------------------------------------------

export interface Theme {
  mode: ThemeMode;
  color: ColorTokens;
  tone: (tone: SeverityTone) => { fg: string; bg: string; softText: string };
  evidence: (tier: 'A' | 'B' | 'C' | 'D') => string;
  surface: (tier: Elevation) => ViewStyle;
  shadow: (tier: Elevation) => ViewStyle;
}

function resolveMode(preference: ThemePreference, systemScheme: string | null | undefined): ThemeMode {
  if (preference === 'light' || preference === 'dark') return preference;
  return systemScheme === 'dark' ? 'dark' : 'light';
}

const ThemeModeContext = createContext<ThemeMode>('light');

/**
 * Wraps the app once, near the root. Not per-screen — every screen reads the
 * same resolved mode via `useTheme()`.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useAppStore((s) => s.settings.theme);
  const systemScheme = useColorScheme();
  const mode = resolveMode(preference, systemScheme);
  return createElement(ThemeModeContext.Provider, { value: mode }, children);
}

export function useTheme(): Theme {
  const mode = useContext(ThemeModeContext);
  const color = COLOR_TOKENS[mode];
  return useMemo(
    () => ({
      mode,
      color,
      tone: (tone: SeverityTone) => toneColors(color, tone),
      evidence: (tier: 'A' | 'B' | 'C' | 'D') => evidenceColor(color, tier),
      surface: (tier: Elevation) => surfaceStyle(color, mode, tier),
      shadow: (tier: Elevation) => elevationShadow(mode, tier),
    }),
    [mode, color],
  );
}

/** Resolved mode without the rest of the theme object — for call sites that
 *  only need e.g. `StatusBar style` or an image variant. */
export function useThemeMode(): ThemeMode {
  return useContext(ThemeModeContext);
}

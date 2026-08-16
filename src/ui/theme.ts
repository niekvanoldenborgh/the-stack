/**
 * Visual language: clinical light.
 *
 * The reference points are premium telehealth products and Linear's light
 * mode, not a lab notebook — this is software people should feel comfortable
 * reading in a waiting room, so it trades the previous near-black/acid-lime
 * instrument-panel look for white surfaces, generous air and a single
 * restrained accent.
 *
 * Three decisions carry the whole look:
 *
 *  1. Type is one family, not a split display/body trick. Inter carries
 *     everything from the largest metric to the smallest label — 700 for
 *     display headings, 600 where the old theme used a "medium" weight, 400
 *     for reading text. IBM Plex Mono is kept, unchanged, for every quantity
 *     and unit: that convention is functional (figures line up, digits don't
 *     shift width), not palette, and a neutral mono reads just as well on a
 *     light surface as a dark one.
 *  2. Ink, not black, on white and near-white, not grey. `#14171F` against
 *     `#FFFFFF`/`#F6F7F9` keeps body text short of true #000/#FFF contrast
 *     harshness while still reading as unambiguously light.
 *  3. One accent — a deep teal — kept clear of the severity scale. Colour is
 *     load-bearing information in this app, so the brand colour must never be
 *     mistakable for a warning colour, and on a light background the
 *     severity hues themselves are darkened/desaturated from their old
 *     dark-surface values so they still pass contrast on white.
 *
 * Elevation is shadow-based here, not the near-black stepping ladder the
 * dark theme used — a light surface has nowhere darker to step down into, so
 * depth comes from `shadow` tokens (see below) applied to panels instead.
 */

export const colors = {
  // Surfaces, brightest to the one recessed tone used for sunken wells.
  bgDeep: '#EEF1F5',
  bg: '#FFFFFF',
  surface: '#F6F7F9',
  surfaceAlt: '#EEF1F4',
  surfaceHigh: '#E4E8ED',
  border: '#E2E5EA',
  borderBright: '#CBD1D9',

  // Warm-dark ink, not pure black.
  text: '#14171F',
  textMuted: '#5B6270',
  textFaint: '#8B92A0',

  // Deep teal. Deliberately outside the severity range.
  accent: '#0F766E',
  accentDim: '#DCF3EF',
  accentText: '#FFFFFF',

  // Severity scale, re-tuned for a light surface — darkened/desaturated from
  // the dark-theme values so each still reads at AA contrast on white, and
  // lightness is varied across the four (not just hue) so the ladder stays
  // distinguishable under a colour-vision-deficiency simulation.
  critical: '#B3261E',
  criticalDim: '#FBEAE9',
  high: '#B85C00',
  highDim: '#FCEEDD',
  moderate: '#8A6D00',
  moderateDim: '#FAF3D6',
  info: '#0369A1',
  infoDim: '#E3F2FB',

  evidenceA: '#0F766E',
  evidenceB: '#4D9A8F',
  evidenceC: '#8A6D00',
  evidenceD: '#B3261E',
} as const;

/**
 * Inter + IBM Plex Mono, bundled locally.
 *
 * Each weight is its own font family, so `fontWeight` must never be set
 * alongside these — doing both makes Android fall back to the system font and
 * makes react-native-web paint a synthetic faux-bold over an already-bold face.
 */
export const fonts = {
  display: 'Inter_700Bold',
  displayLight: 'Inter_400Regular',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_600SemiBold',
  mono: 'IBMPlexMono_500Medium',
  monoBold: 'IBMPlexMono_600SemiBold',
} as const;

export const typography = {
  /** Screen titles. Heavy and tight. */
  display: { fontFamily: fonts.display, fontSize: 32, letterSpacing: -0.8, lineHeight: 38 },
  /** Large figures — doses, risk scores. Inter has no hairline weight, so the
   *  old extreme-weight contrast trick is replaced by scale contrast alone. */
  metric: { fontFamily: fonts.displayLight, fontSize: 44, letterSpacing: -1.2, lineHeight: 48 },
  title: { fontFamily: fonts.sansMedium, fontSize: 19, letterSpacing: -0.3, lineHeight: 25 },
  heading: { fontFamily: fonts.sansMedium, fontSize: 16, letterSpacing: -0.1, lineHeight: 21 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 23 },
  bodyStrong: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 23 },
  small: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 20 },
  /** Quantities. Monospaced so columns of figures line up and read as data. */
  data: { fontFamily: fonts.mono, fontSize: 15, letterSpacing: -0.2 },
  dataSmall: { fontFamily: fonts.mono, fontSize: 12.5, letterSpacing: -0.1 },
  /** Section labels and badges. Wide-tracked mono. */
  caption: { fontFamily: fonts.monoBold, fontSize: 10.5, letterSpacing: 1.3 },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

/** Moderate-to-soft radii — Linear's card radius, not sharp and not a pill. */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/**
 * Soft-shadow tokens for elevation on a light surface. Depth comes from a
 * diffuse drop shadow, not a step up a near-black tone ladder — there is
 * nowhere darker than `colors.bg` to step down into on a light theme.
 * `Section` (src/ui/primitives.tsx) and `Card`/`StatTile` (src/ui/components.tsx)
 * are the consumers.
 */
export const shadow = {
  low: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  medium: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
} as const;

/**
 * Surface-tone ladder — 0 is the screen itself; 3 is the highest a piece of
 * content sits above it. On this light theme the steps are close together
 * (white → near-white → a faint recessed grey) because depth now reads
 * mainly through `shadow`, not through big luminance jumps.
 */
export type Elevation = 0 | 1 | 2 | 3;

export const elevation: Record<Elevation, string> = {
  0: colors.bg,
  1: colors.surface,
  2: colors.surfaceAlt,
  3: colors.surfaceHigh,
};

export type SeverityTone = 'critical' | 'high' | 'moderate' | 'info' | 'accent';

export function toneColors(tone: SeverityTone): { fg: string; bg: string } {
  switch (tone) {
    case 'critical':
      return { fg: colors.critical, bg: colors.criticalDim };
    case 'high':
      return { fg: colors.high, bg: colors.highDim };
    case 'moderate':
      return { fg: colors.moderate, bg: colors.moderateDim };
    case 'info':
      return { fg: colors.info, bg: colors.infoDim };
    case 'accent':
      return { fg: colors.accent, bg: colors.accentDim };
  }
}

export function evidenceColor(tier: 'A' | 'B' | 'C' | 'D'): string {
  switch (tier) {
    case 'A':
      return colors.evidenceA;
    case 'B':
      return colors.evidenceB;
    case 'C':
      return colors.evidenceC;
    case 'D':
      return colors.evidenceD;
  }
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

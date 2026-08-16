/**
 * Visual language: laboratory notebook.
 *
 * The reference points are instrument readouts and safety data sheets, not
 * wellness apps — this is software that shows you microgram figures and tells
 * you when to stop, so it should read like something calibrated.
 *
 * Three decisions carry the whole look:
 *
 *  1. Type is split by job. Bricolage Grotesque at its extremes (800 for
 *     headings, 200 for large figures) gives the display voice; IBM Plex Sans
 *     carries reading text; IBM Plex Mono carries every number, unit and label,
 *     so quantities look measured rather than written.
 *  2. Ink and bone, not black and white. A warm off-white on a near-black with
 *     a hint of blue is far easier on the eye over long reading than #FFF/#000,
 *     and it stops the dark theme reading as a default.
 *  3. One acid accent, and the severity scale kept clear of it. The accent is
 *     lime; severity runs rose → orange → amber → sky. Colour is load-bearing
 *     information in this app, so the brand colour must never be mistakable for
 *     a warning colour.
 */

export const colors = {
  // Surfaces, coolest to warmest.
  bgDeep: '#060608',
  bg: '#0A0A0C',
  surface: '#121216',
  surfaceAlt: '#17171C',
  surfaceHigh: '#1F1F26',
  border: '#26262F',
  borderBright: '#3A3A46',

  // Bone, not white.
  text: '#EDEAE3',
  textMuted: '#9C978C',
  textFaint: '#66625B',

  // Acid lime. Deliberately outside the severity range.
  accent: '#C9F24D',
  accentDim: '#242E07',
  accentText: '#0A0A0C',

  // Severity scale — rose, orange, amber, sky.
  critical: '#FF4D6D',
  criticalDim: '#3B0A16',
  high: '#FF8A3D',
  highDim: '#3A1607',
  moderate: '#FFAE35',
  moderateDim: '#382103',
  info: '#5FC7F5',
  infoDim: '#06283A',

  evidenceA: '#C9F24D',
  evidenceB: '#9BD84B',
  evidenceC: '#FFAE35',
  evidenceD: '#FF4D6D',
} as const;

/**
 * Bricolage Grotesque + IBM Plex, bundled locally.
 *
 * Each weight is its own font family, so `fontWeight` must never be set
 * alongside these — doing both makes Android fall back to the system font and
 * makes react-native-web paint a synthetic faux-bold over an already-bold face.
 */
export const fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayLight: 'BricolageGrotesque_200ExtraLight',
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_500Medium',
  monoBold: 'IBMPlexMono_600SemiBold',
} as const;

export const typography = {
  /** Screen titles. Heavy and tight. */
  display: { fontFamily: fonts.display, fontSize: 34, letterSpacing: -1.1, lineHeight: 38 },
  /** Large figures — doses, risk scores. Hairline weight against the display heavy. */
  metric: { fontFamily: fonts.displayLight, fontSize: 44, letterSpacing: -2, lineHeight: 48 },
  title: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.5, lineHeight: 25 },
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

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

/**
 * Near-black elevation ladder — depth comes from stepping through these
 * tones, not from shadows or borders. 0 is the screen itself; 3 is the
 * highest a piece of content sits above it. Most grouped content lives at 1;
 * reach for 2/3 only to lift something (a focal block, a nested callout)
 * above its own container.
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

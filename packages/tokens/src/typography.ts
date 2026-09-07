/**
 * Typography tokens — Root System 4.7 §5. This section owns the SCALE, not the
 * faces; which typefaces fill the family slots is 4.6 §4 and is not yet locked.
 *
 * Every size here must survive OS accessibility text scaling (4.7 §5.5): a size
 * token is a base value, not a rendered promise. Line heights are MULTIPLIERS
 * precisely so they scale with the text — a fixed-height container wrapped
 * around scalable text is a defect.
 */

export const FONT_FAMILY = {
  /** The safe default. Everything readable. */
  'font-body': 'Urbanist',
  /**
   * Aliased to body until a display face passes the on-device validation in
   * 4.6 §4.2. Open question 4.7 §14 item 5 — do not resolve it here.
   */
  'font-display': 'Urbanist',
  /** Money, counts, timers, streaks — digits must not jump. */
  'font-numeric': 'Urbanist',
} as const;

/** Fallback stack, appended when the face is unavailable. */
export const FONT_FAMILY_FALLBACK = 'System' as const;

export const FONT_SIZE = {
  'font-size-xs': 12,
  'font-size-sm': 14,
  'font-size-base': 16,
  'font-size-lg': 18,
  'font-size-xl': 20,
  'font-size-2xl': 24,
  'font-size-3xl': 30,
  'font-size-4xl': 36,
} as const;

export const FONT_WEIGHT = {
  'font-weight-regular': '400',
  'font-weight-medium': '500',
  'font-weight-semibold': '600',
  'font-weight-bold': '700',
} as const;

export const LINE_HEIGHT = {
  'line-height-tight': 1.2,
  'line-height-snug': 1.35,
  'line-height-normal': 1.5,
  'line-height-relaxed': 1.65,
} as const;

export const LETTER_SPACING = {
  'letter-spacing-tight': -0.2,
  'letter-spacing-normal': 0,
  'letter-spacing-wide': 0.4,
  'letter-spacing-caps': 1.2,
} as const;

export type FontFamilyToken = keyof typeof FONT_FAMILY;
export type FontSizeToken = keyof typeof FONT_SIZE;
export type FontWeightToken = keyof typeof FONT_WEIGHT;
export type LineHeightToken = keyof typeof LINE_HEIGHT;
export type LetterSpacingToken = keyof typeof LETTER_SPACING;

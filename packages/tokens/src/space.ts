/**
 * Spacing tokens — Root System 4.7 §4. Base unit 4; the working step is 8.
 *
 * A spacing value that is not on this scale is not allowed. If a layout needs
 * 14, either the scale is wrong or the layout is.
 *
 * Raised in importance at v2.0: 4.6 §3.5 established that this palette cannot
 * produce a surface luminance step that separates a card from its ground, so
 * SPACING AND BORDERS carry the grouping work fill cannot. Load-bearing, not
 * cosmetic.
 */

export const SPACE = {
  'space-0': 0,
  'space-1': 4,
  'space-2': 8,
  'space-3': 12,
  'space-4': 16,
  'space-5': 20,
  'space-6': 24,
  'space-8': 32,
  'space-10': 40,
  'space-12': 48,
  'space-16': 64,
} as const;

export type SpaceToken = keyof typeof SPACE;

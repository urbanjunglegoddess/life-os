/** Radius tokens — Root System 4.7 §6. */

export const RADIUS = {
  'radius-none': 0,
  'radius-sm': 4,
  'radius-md': 8,
  'radius-lg': 12,
  'radius-xl': 16,
  /** Sheets — top corners only. */
  'radius-2xl': 24,
  'radius-full': 9999,
} as const;

export type RadiusToken = keyof typeof RADIUS;

/**
 * RAW palette tokens — Root System 4.7 §2. UJG Color System v2.0, locked 2026-07-29.
 *
 * These are the ONLY raw colour values in the system. Nothing outside this
 * package's `color.ts` may reference them: components point at the SEMANTIC
 * tier so a palette migration stays a one-file change (4.7 §3.1).
 *
 * Adding a hue that is not in UJG Color System v2.0 is a BRAND decision
 * recorded in 4.6 first, not a code change (4.7 §13).
 */

export const PALETTE = {
  'color-night': '#0A0A0A',
  'color-platinum': '#E8E6E1',
  'color-platinum-muted': '#A8A5A0',
  'color-gold': '#F2B01E',
  'color-marigold': '#E28D1F',
  'color-ember': '#D9531A',
  'color-jungle-green': '#2E6B4F',
  'color-forest-midnight': '#042F1E',
  'color-forest-rich': '#0D5E39',
  'color-amethyst': '#47107D',

  // Derived, 4.7 §2. Rich Jungle Green is 3.14:1 on Night and fails AA as text;
  // this tint (24% toward Platinum) measures 4.96:1 on base and 4.80:1 on
  // surface, so success can be a word and not only a dot.
  'color-jungle-green-text': '#5B8972',
} as const;

export type PaletteToken = keyof typeof PALETTE;

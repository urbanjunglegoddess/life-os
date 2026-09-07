/** Border tokens — Root System 4.7 §8. */

import { COLOR } from './color.ts';

export const BORDER_WIDTH = {
  /**
   * Dividers between list rows. React Native's own hairline resolves per
   * screen density, but `packages/tokens` depends on nothing (6.4 §3) and so
   * cannot import `StyleSheet` to ask. 0.5 is that value at @2x and reads as a
   * hairline everywhere; the alternative — resolving it in components — would
   * put a design value outside this package, which is the defect this rule
   * exists to prevent.
   */
  'border-width-hairline': 0.5,
  /** Card outlines. */
  'border-width-thin': 1,
  /** Focus ring, selected state, input outlines. */
  'border-width-thick': 2,
} as const;

export const BORDER_COLOR = {
  /** Inputs, toggles, unfilled buttons — 8.07:1 on Night, clears 3:1 with room. */
  'border-color-meaningful': COLOR['border-meaningful'],
  /** Dividers, card edges — no AA obligation. */
  'border-color-decorative': COLOR['border-decorative'],
  /** Focus and selection — 10.37:1. */
  'border-color-focus': COLOR['focus-ring'],
} as const;

export type BorderWidthToken = keyof typeof BORDER_WIDTH;
export type BorderColorToken = keyof typeof BORDER_COLOR;

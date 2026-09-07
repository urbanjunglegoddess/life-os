/**
 * @life-os/tokens — the design token module. Root System 4.7.
 *
 * SOURCE OF TRUTH IS CODE. There is no Tokens Studio file, no Figma variable
 * set, no export step. 4.7 is the specification and the rationale; when the two
 * disagree, this module wins and the page gets corrected. A token file that
 * drifts from the code is worse than no token file, because it is trusted and
 * wrong.
 *
 * How a value travels (4.7 §11):
 *   `color-gold` defined once in `palette.ts`
 *     → `accent-primary` points at it in `color.ts`
 *     → the NativeWind theme exposes it in `apps/mobile/tailwind.config.ts`
 *     → a component writes `bg-accent-primary`.
 * Changing the accent is one line, and nothing in `components/` is touched.
 *
 * The rule that makes it worth doing: components reference SEMANTIC tokens
 * only. Never raw palette values, never a literal hex. `scripts/check-tokens.sh`
 * enforces it mechanically, so it is not a judgement call at review.
 */

export { PALETTE, type PaletteToken } from './palette.ts';
export { COLOR, type ColorToken } from './color.ts';
export { SPACE, type SpaceToken } from './space.ts';
export {
  FONT_FAMILY,
  FONT_FAMILY_FALLBACK,
  FONT_SIZE,
  FONT_WEIGHT,
  LINE_HEIGHT,
  LETTER_SPACING,
  type FontFamilyToken,
  type FontSizeToken,
  type FontWeightToken,
  type LineHeightToken,
  type LetterSpacingToken,
} from './typography.ts';
export { RADIUS, type RadiusToken } from './radius.ts';
export {
  BORDER_WIDTH,
  BORDER_COLOR,
  type BorderWidthToken,
  type BorderColorToken,
} from './border.ts';
export {
  ELEVATION,
  type ElevationToken,
  type ElevationTokenName,
} from './elevation.ts';
export { OPACITY, type OpacityToken } from './opacity.ts';
export { DURATION, EASING, type DurationToken, type EasingToken } from './motion.ts';
export { LAYER, type LayerToken } from './layer.ts';
export { TARGET, type TargetToken } from './target.ts';

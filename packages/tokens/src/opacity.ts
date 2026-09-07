/**
 * Opacity tokens — Root System 4.7 §9.
 *
 * Reduced in scope at v2.0. `opacity-muted` is RETIRED: muted text is
 * `color-platinum-muted` at full opacity, a measured 8.07:1, not a value tuned
 * by eye. Opacity no longer produces any TEXT value in this system.
 */

export const OPACITY = {
  'opacity-full': 1,
  'opacity-disabled': 0.38,
  'opacity-pressed': 0.8,
  'opacity-scrim': 0.6,

  /**
   * `color-forest-midnight` over Night for surfaces. 4.7 §9 gives a range of
   * 0.30–0.60 and calls the choice PURELY AESTHETIC — card fill carries no AA
   * obligation (4.6 §3.5), because spacing and borders carry the grouping work
   * this palette cannot do with luminance. These two sit inside that range as
   * starting points and are the on-device tuning pass in 4.7 §14 item 2.
   */
  'opacity-surface-tint': 0.4,
  'opacity-surface-tint-elevated': 0.6,

  /** `color-platinum-muted` for dividers and card edges. Range 0.25–0.35 (4.7 §9). */
  'opacity-border-decorative': 0.3,
} as const;

export type OpacityToken = keyof typeof OPACITY;

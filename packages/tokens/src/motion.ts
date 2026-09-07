/**
 * Motion tokens — Root System 4.7 §10.1. Motion confirms an action landed; it
 * does not entertain.
 *
 * Reduced motion is handled ONCE at the theme level, not component by
 * component: when the OS preference is set, durations collapse toward zero.
 */

export const DURATION = {
  /** Press feedback, one-tap log confirmation. */
  'duration-instant': 100,
  /** Chips, toggles, small state changes. */
  'duration-fast': 150,
  /** The default transition. */
  'duration-base': 200,
  /** Sheets rising, screen transitions. */
  'duration-slow': 300,
} as const;

/** Cubic-bézier control points, the form Reanimated and CSS both accept. */
export const EASING = {
  'easing-standard': [0.4, 0, 0.2, 1],
  /** Things entering the screen. */
  'easing-decelerate': [0, 0, 0.2, 1],
  /** Things leaving the screen. */
  'easing-accelerate': [0.4, 0, 1, 1],
} as const;

export type DurationToken = keyof typeof DURATION;
export type EasingToken = keyof typeof EASING;

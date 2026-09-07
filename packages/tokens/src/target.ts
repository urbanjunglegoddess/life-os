/**
 * Tap-target tokens — Root System 4.7 §10.3, 4.5 §5.
 *
 * Tokenized specifically so they cannot drift. The core interaction of this app
 * is repeated tapping on a phone; a target quietly shrinking by a few points is
 * a FAILED LOG, not a cosmetic issue.
 */

export const TARGET = {
  /** ABSOLUTE MINIMUM for every interactive element. No exceptions, no one-offs. */
  'tap-target-min': 48,
  /** Minimum gap between adjacent targets — same value as `space-2`. */
  'tap-target-spacing-min': 8,
  /** Default hit slop, so a small icon can still carry a full-size target. */
  'hit-slop-default': 8,
} as const;

export type TargetToken = keyof typeof TARGET;

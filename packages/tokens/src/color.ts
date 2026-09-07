/**
 * SEMANTIC colour tokens — Root System 4.7 §3.
 *
 * Every entry is a ROLE, not a colour. This is the only tier components are
 * allowed to touch. A literal hex, or a raw palette reference, anywhere in
 * `apps/mobile/components` is a review failure with no argument attached
 * (4.7 §3.1) — `scripts/check-tokens.sh` makes that check mechanical.
 */

import { compositeOver, withAlpha } from './composite.ts';
import { OPACITY } from './opacity.ts';
import { PALETTE } from './palette.ts';

export const COLOR = {
  /** The screen ground. Default background of every screen. */
  'bg-base': PALETTE['color-night'],
  /** Cards, list containers, tab bar. */
  'bg-surface': compositeOver(
    PALETTE['color-forest-midnight'],
    PALETTE['color-night'],
    OPACITY['opacity-surface-tint'],
  ),
  /** Sheets, modals, quick-add — anything floating. */
  'bg-elevated': compositeOver(
    PALETTE['color-forest-midnight'],
    PALETTE['color-night'],
    OPACITY['opacity-surface-tint-elevated'],
  ),
  /** Gated and reflective screens — journal, spiritual practice. */
  'bg-ceremonial': PALETTE['color-amethyst'],

  /** Body, labels, values — every readable word by default. */
  'text-primary': PALETTE['color-platinum'],
  /** Metadata, timestamps, secondary labels. AT FULL OPACITY, 8.07:1 on base. */
  'text-muted': PALETTE['color-platinum-muted'],
  /** Any label sitting on gold, marigold or ember. */
  'text-on-warm': PALETTE['color-night'],
  /** Any label sitting on amethyst, forest or jungle green. */
  'text-on-cool': PALETTE['color-platinum'],

  /** Do-now action, active state, primary control, focus. */
  'accent-primary': PALETTE['color-gold'],

  /** Input outlines, toggle edges — any boundary that IS the affordance. */
  'border-meaningful': PALETTE['color-platinum-muted'],
  /** Dividers, card edges. Grouping only, no AA obligation. */
  'border-decorative': withAlpha(
    PALETTE['color-platinum-muted'],
    OPACITY['opacity-border-decorative'],
  ),

  /** Completed, logged, synced — as a fill or an icon. */
  'state-success': PALETTE['color-jungle-green'],
  /** The same meaning, when it has to be a WORD. */
  'state-success-text': PALETTE['color-jungle-green-text'],
  /** Overdue, pending write, stale data, attention needed. */
  'state-warning': PALETTE['color-marigold'],
  /**
   * Failed write, load failure, invalid input, destructive confirm.
   * Ember means exactly ONE thing (4.7 §3.2). If Ember appears and nothing
   * failed, that is a bug in the design, not a style choice.
   */
  'state-error': PALETTE['color-ember'],

  /** Keyboard and assistive focus. Never removed, never subtle. 10.37:1. */
  'focus-ring': PALETTE['color-gold'],
} as const;

export type ColorToken = keyof typeof COLOR;

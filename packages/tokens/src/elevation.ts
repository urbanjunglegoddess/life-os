/**
 * Elevation tokens — Root System 4.7 §7. REVISED at v2.0.
 *
 * v1 said elevation is a step in surface luminance. Measurement said this
 * palette cannot produce that step (4.6 §3.5), so elevation is carried by
 * BORDER AND SPACING, with a small tint and a shadow as support. On near-black
 * a shadow does very little work — do not budget for it to. The boundary is
 * what the eye reads.
 *
 * React Native expresses shadow differently per platform, so each token carries
 * both forms: a component asks for `elevation-2` and never for a
 * platform-specific shadow object.
 */

import { BORDER_COLOR } from './border.ts';
import { COLOR } from './color.ts';
import { PALETTE } from './palette.ts';

export interface ElevationToken {
  /** Semantic background this layer sits on. */
  readonly surface: string;
  /** The boundary that actually does the separating. `null` at ground level. */
  readonly borderColor: string | null;
  /** iOS shadow properties. */
  readonly ios: {
    readonly shadowColor: string;
    readonly shadowOffset: { readonly width: number; readonly height: number };
    readonly shadowOpacity: number;
    readonly shadowRadius: number;
  };
  /** Android elevation value. */
  readonly android: { readonly elevation: number };
}

export const ELEVATION = {
  /** The screen ground. */
  'elevation-0': {
    surface: COLOR['bg-base'],
    borderColor: null,
    ios: {
      shadowColor: PALETTE['color-night'],
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
    },
    android: { elevation: 0 },
  },
  /** Cards, list containers. */
  'elevation-1': {
    surface: COLOR['bg-surface'],
    borderColor: BORDER_COLOR['border-color-decorative'],
    ios: {
      shadowColor: PALETTE['color-night'],
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.18,
      shadowRadius: 2,
    },
    android: { elevation: 1 },
  },
  /** Tab bar, sticky headers. */
  'elevation-2': {
    surface: COLOR['bg-elevated'],
    borderColor: BORDER_COLOR['border-color-decorative'],
    ios: {
      shadowColor: PALETTE['color-night'],
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.24,
      shadowRadius: 6,
    },
    android: { elevation: 4 },
  },
  /** Sheets, modals, quick-add. */
  'elevation-3': {
    surface: COLOR['bg-elevated'],
    borderColor: BORDER_COLOR['border-color-meaningful'],
    ios: {
      shadowColor: PALETTE['color-night'],
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.32,
      shadowRadius: 16,
    },
    android: { elevation: 12 },
  },
} as const satisfies Record<string, ElevationToken>;

export type ElevationTokenName = keyof typeof ELEVATION;

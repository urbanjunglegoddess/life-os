/**
 * Z-index tokens — Root System 4.7 §10.2.
 *
 * Tokenized so two components can never quietly disagree about which one is on
 * top. A raw z-index number in a component is a defect.
 */

export const LAYER = {
  'z-base': 0,
  'z-raised': 10,
  'z-sticky': 100,
  'z-tab-bar': 200,
  'z-sheet': 300,
  'z-modal': 400,
  /** Toasts, undo, pending-write notices. */
  'z-toast': 500,
  /**
   * THE BIOMETRIC GATE — above everything, always. BUILD-SPEC §8 pins the gate
   * to this layer, and its state must not survive backgrounding.
   */
  'z-gate': 900,
} as const;

export type LayerToken = keyof typeof LAYER;

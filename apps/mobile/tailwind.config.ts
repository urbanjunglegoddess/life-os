/**
 * The NativeWind theme — Root System 4.7 §11, the middle layer of "how a value
 * travels". It maps @life-os/tokens into theme keys and defines NO values of
 * its own. Every utility class below reads as its token name: `bg-surface`,
 * `text-muted`, `accent-primary`, `z-gate`.
 *
 * Scales are REPLACED, not extended, wherever 4.7 says the scale is closed.
 * That turns "a spacing value that is not on this scale is not allowed" (§4)
 * from a review note into a build error: `p-14` simply does not compile.
 */
import {
  BORDER_COLOR,
  BORDER_WIDTH,
  COLOR,
  DURATION,
  EASING,
  FONT_FAMILY,
  FONT_FAMILY_FALLBACK,
  FONT_SIZE,
  FONT_WEIGHT,
  LAYER,
  LETTER_SPACING,
  LINE_HEIGHT,
  OPACITY,
  RADIUS,
  SPACE,
  TARGET,
} from '@life-os/tokens';
import type { Config } from 'tailwindcss';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nativewindPreset = require('nativewind/preset');

const px = (n: number) => `${n}px`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [nativewindPreset],
  theme: {
    // Closed scales — replaced outright.
    spacing: {
      '0': px(SPACE['space-0']),
      '1': px(SPACE['space-1']),
      '2': px(SPACE['space-2']),
      '3': px(SPACE['space-3']),
      '4': px(SPACE['space-4']),
      '5': px(SPACE['space-5']),
      '6': px(SPACE['space-6']),
      '8': px(SPACE['space-8']),
      '10': px(SPACE['space-10']),
      '12': px(SPACE['space-12']),
      '16': px(SPACE['space-16']),
    },
    fontSize: {
      xs: px(FONT_SIZE['font-size-xs']),
      sm: px(FONT_SIZE['font-size-sm']),
      base: px(FONT_SIZE['font-size-base']),
      lg: px(FONT_SIZE['font-size-lg']),
      xl: px(FONT_SIZE['font-size-xl']),
      '2xl': px(FONT_SIZE['font-size-2xl']),
      '3xl': px(FONT_SIZE['font-size-3xl']),
      '4xl': px(FONT_SIZE['font-size-4xl']),
    },
    fontWeight: {
      regular: FONT_WEIGHT['font-weight-regular'],
      medium: FONT_WEIGHT['font-weight-medium'],
      semibold: FONT_WEIGHT['font-weight-semibold'],
      bold: FONT_WEIGHT['font-weight-bold'],
    },
    borderRadius: {
      none: px(RADIUS['radius-none']),
      sm: px(RADIUS['radius-sm']),
      md: px(RADIUS['radius-md']),
      lg: px(RADIUS['radius-lg']),
      xl: px(RADIUS['radius-xl']),
      '2xl': px(RADIUS['radius-2xl']),
      full: px(RADIUS['radius-full']),
    },
    borderWidth: {
      DEFAULT: px(BORDER_WIDTH['border-width-thin']),
      hairline: px(BORDER_WIDTH['border-width-hairline']),
      thin: px(BORDER_WIDTH['border-width-thin']),
      thick: px(BORDER_WIDTH['border-width-thick']),
    },
    zIndex: {
      base: String(LAYER['z-base']),
      raised: String(LAYER['z-raised']),
      sticky: String(LAYER['z-sticky']),
      'tab-bar': String(LAYER['z-tab-bar']),
      sheet: String(LAYER['z-sheet']),
      modal: String(LAYER['z-modal']),
      toast: String(LAYER['z-toast']),
      gate: String(LAYER['z-gate']),
    },
    opacity: {
      full: String(OPACITY['opacity-full']),
      disabled: String(OPACITY['opacity-disabled']),
      pressed: String(OPACITY['opacity-pressed']),
      scrim: String(OPACITY['opacity-scrim']),
    },
    letterSpacing: {
      tight: px(LETTER_SPACING['letter-spacing-tight']),
      normal: px(LETTER_SPACING['letter-spacing-normal']),
      wide: px(LETTER_SPACING['letter-spacing-wide']),
      caps: px(LETTER_SPACING['letter-spacing-caps']),
    },
    lineHeight: {
      // Multipliers, not fixed values, so they scale with OS text size (4.7 §5.5).
      tight: String(LINE_HEIGHT['line-height-tight']),
      snug: String(LINE_HEIGHT['line-height-snug']),
      normal: String(LINE_HEIGHT['line-height-normal']),
      relaxed: String(LINE_HEIGHT['line-height-relaxed']),
    },
    fontFamily: {
      body: [FONT_FAMILY['font-body'], FONT_FAMILY_FALLBACK],
      display: [FONT_FAMILY['font-display'], FONT_FAMILY_FALLBACK],
      numeric: [FONT_FAMILY['font-numeric'], FONT_FAMILY_FALLBACK],
    },
    transitionDuration: {
      instant: `${DURATION['duration-instant']}ms`,
      fast: `${DURATION['duration-fast']}ms`,
      base: `${DURATION['duration-base']}ms`,
      slow: `${DURATION['duration-slow']}ms`,
    },
    transitionTimingFunction: {
      standard: `cubic-bezier(${EASING['easing-standard'].join(',')})`,
      decelerate: `cubic-bezier(${EASING['easing-decelerate'].join(',')})`,
      accelerate: `cubic-bezier(${EASING['easing-accelerate'].join(',')})`,
    },

    extend: {
      // Roles usable as fill, text or border alike.
      colors: {
        'accent-primary': COLOR['accent-primary'],
        'state-success': COLOR['state-success'],
        'state-success-text': COLOR['state-success-text'],
        'state-warning': COLOR['state-warning'],
        'state-error': COLOR['state-error'],
        'focus-ring': COLOR['focus-ring'],
      },
      backgroundColor: {
        base: COLOR['bg-base'],
        surface: COLOR['bg-surface'],
        elevated: COLOR['bg-elevated'],
        ceremonial: COLOR['bg-ceremonial'],
      },
      textColor: {
        primary: COLOR['text-primary'],
        muted: COLOR['text-muted'],
        'on-warm': COLOR['text-on-warm'],
        'on-cool': COLOR['text-on-cool'],
      },
      borderColor: {
        meaningful: BORDER_COLOR['border-color-meaningful'],
        decorative: BORDER_COLOR['border-color-decorative'],
        focus: BORDER_COLOR['border-color-focus'],
      },
      // 48pt is the absolute minimum for anything interactive (4.7 §10.3). It is
      // its own key so it can never be confused with a spacing step.
      minWidth: { 'tap-target': px(TARGET['tap-target-min']) },
      minHeight: { 'tap-target': px(TARGET['tap-target-min']) },
    },
  },
  plugins: [],
};

export default config;

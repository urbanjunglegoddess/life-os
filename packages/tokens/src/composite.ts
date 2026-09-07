/**
 * Colour maths used by the semantic tier. Not a token module — nothing here is
 * a design value, and nothing outside `color.ts` should need it.
 */

function channels(hex: string): [number, number, number] {
  const v = hex.replace('#', '');
  return [
    Number.parseInt(v.slice(0, 2), 16),
    Number.parseInt(v.slice(2, 4), 16),
    Number.parseInt(v.slice(4, 6), 16),
  ];
}

/**
 * Flatten `fg` at `alpha` over an opaque `bg` into one opaque hex.
 *
 * Surfaces are specified as a tinted overlay (4.7 §3) but a React Native view
 * needs one solid colour, and stacking a translucent layer over every card is
 * both a per-frame cost and a value that varies with whatever sits behind it.
 * Compositing once here keeps the tint a single tunable number in `opacity.ts`
 * while what components receive stays a plain, predictable colour.
 */
export function compositeOver(fg: string, bg: string, alpha: number): string {
  const [fr, fg_, fb] = channels(fg);
  const [br, bg_, bb] = channels(bg);
  const mix = (f: number, b: number) => Math.round(f * alpha + b * (1 - alpha));
  return (
    '#' +
    [mix(fr, br), mix(fg_, bg_), mix(fb, bb)]
      .map((c) => c.toString(16).padStart(2, '0').toUpperCase())
      .join('')
  );
}

/** Hex to `rgba()`, for the one boundary that is genuinely translucent. */
export function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

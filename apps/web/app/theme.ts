import { COLOR, FONT_SIZE, RADIUS, SPACE } from '@life-os/tokens';

/**
 * The token bridge for the web app. `packages/tokens` is the single source of
 * truth for both apps (6.4 §4), so the compliance pages emit the same semantic
 * roles as CSS custom properties rather than restating any value. A literal hex
 * here would be the same defect it is in a mobile component.
 */
export const TOKEN_CSS = `
:root {
  --bg-base: ${COLOR['bg-base']};
  --bg-surface: ${COLOR['bg-surface']};
  --text-primary: ${COLOR['text-primary']};
  --text-muted: ${COLOR['text-muted']};
  --accent-primary: ${COLOR['accent-primary']};
  --border-decorative: ${COLOR['border-decorative']};
  --state-warning: ${COLOR['state-warning']};

  --space-2: ${SPACE['space-2']}px;
  --space-4: ${SPACE['space-4']}px;
  --space-6: ${SPACE['space-6']}px;
  --space-8: ${SPACE['space-8']}px;
  --space-12: ${SPACE['space-12']}px;

  --font-size-sm: ${FONT_SIZE['font-size-sm']}px;
  --font-size-base: ${FONT_SIZE['font-size-base']}px;
  --font-size-xl: ${FONT_SIZE['font-size-xl']}px;
  --font-size-2xl: ${FONT_SIZE['font-size-2xl']}px;

  --radius-lg: ${RADIUS['radius-lg']}px;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg-base);
  color: var(--text-primary);
  font-size: var(--font-size-base);
  line-height: 1.5;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}

main {
  max-width: 42rem;
  margin: 0 auto;
  padding: var(--space-12) var(--space-4);
}

h1 { font-size: var(--font-size-2xl); margin: 0 0 var(--space-2); }
h2 { font-size: var(--font-size-xl); margin: var(--space-8) 0 var(--space-2); }
p  { margin: 0 0 var(--space-4); }
a  { color: var(--accent-primary); }

.muted { color: var(--text-muted); font-size: var(--font-size-sm); }

.notice {
  background: var(--bg-surface);
  border: 1px solid var(--border-decorative);
  border-left: 3px solid var(--state-warning);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  margin: var(--space-6) 0;
}

nav { display: flex; gap: var(--space-4); margin-bottom: var(--space-8); }
`;

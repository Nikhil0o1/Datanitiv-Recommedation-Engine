/**
 * One-time merge: copilot-v4 + app + cost → index.css @layer components
 * Run: node scripts/merge-styles-into-index.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const styles = path.join(root, 'src', 'styles');

const theme = `@import 'tailwindcss';

@theme {
  --color-brand: #f5a623;
  --color-brand-600: #e8940d;
  --color-brand-050: #fff6e6;
  --color-ink: #1f2733;
  --color-ink-2: #5b6675;
  --color-ink-3: #8a95a3;
  --color-line: #e7eaef;
  --color-line-2: #eef1f5;
  --color-bg: #f4f6f9;
  --color-surface: #ffffff;
  --color-surface-2: #fafbfc;
  --color-pos: #1a9e6a;
  --color-neg: #e0483f;
  --color-neg-bg: #fdeceb;
  --color-warn: #e8940d;
  --color-warn-bg: #fff4e0;
  --color-info: #2a78d6;
  --color-info-bg: #eaf2fc;
  --color-header: #2b2f36;
  --color-amber: #f5b01a;
  --color-amber-d: #8a6100;
  --color-amber-m: #fad277;
  --color-amber-s: #fef4dc;
  --font-mono: 'IBM Plex Mono', ui-monospace, monospace;
  --font-display: 'Bricolage Grotesque', 'Segoe UI', sans-serif;
  --shadow-sm: 0 1px 3px rgba(20, 30, 45, 0.06), 0 1px 2px rgba(20, 30, 45, 0.04);
  --shadow-lg: 0 8px 28px rgba(20, 30, 45, 0.1);
  --radius-card: 12px;

  /* Legacy CSS variable aliases (used in merged component rules) */
  --brand: #f5a623;
  --brand-600: #e8940d;
  --brand-050: #fff6e6;
  --ink: #1f2733;
  --ink-2: #5b6675;
  --ink-3: #8a95a3;
  --line: #e7eaef;
  --line-2: #eef1f5;
  --bg: #f4f6f9;
  --surface: #ffffff;
  --surface-2: #fafbfc;
  --pos: #1a9e6a;
  --neg: #e0483f;
  --neg-bg: #fdeceb;
  --warn: #e8940d;
  --warn-bg: #fff4e0;
  --info: #2a78d6;
  --info-bg: #eaf2fc;
  --header: #2b2f36;
  --r: 12px;
  --shadow: 0 1px 3px rgba(20, 30, 45, 0.06), 0 1px 2px rgba(20, 30, 45, 0.04);
  --text: #1c1b18;
  --muted: #6b665d;
  --dim: #9a948a;
  --surf: #faf9f6;
  --surf2: #f2f0ea;
  --paper: #ffffff;
  --amber: #f5b01a;
  --fb: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --fm: 'IBM Plex Mono', ui-monospace, monospace;
  --fd: 'Bricolage Grotesque', 'Segoe UI', sans-serif;
  --sh: 0 1px 2px rgba(28, 27, 24, 0.05);
  --shm: 0 6px 18px -8px rgba(28, 27, 24, 0.2);
  --shl: 0 28px 64px -32px rgba(28, 27, 24, 0.42);
}

@layer base {
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    height: 100%;
    margin: 0;
  }

  body {
    background: var(--bg);
    color: var(--ink);
    font-family: var(--fb);
    font-size: 14px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  .mono {
    font-variant-numeric: tabular-nums;
    font-feature-settings: 'tnum';
  }
}

@layer components {
`;

function stripRoot(css) {
  return css.replace(/^:root\{[^}]+\}\s*/m, '');
}

const copilot = stripRoot(fs.readFileSync(path.join(styles, 'copilot-v4.css'), 'utf8'));
const app = stripRoot(fs.readFileSync(path.join(styles, 'app.css'), 'utf8'));
const cost = fs.readFileSync(path.join(styles, 'cost.css'), 'utf8');

const footer = `
}

@layer utilities {
  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }
}
`;

const out = theme + copilot + '\n' + app + '\n' + cost + footer;
fs.writeFileSync(path.join(root, 'src', 'index.css'), out);
console.log('Wrote src/index.css', out.length, 'bytes');

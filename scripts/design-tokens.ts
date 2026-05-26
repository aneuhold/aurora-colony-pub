import { readFileSync } from 'node:fs';

/** Path to the design-token source of truth — colors, fonts, paper-grain. */
const TOKENS_CSS_PATH = 'site/src/styles/tokens.css';

/**
 * Reads `tokens.css` and rewrites the Tailwind v4 directives into plain CSS so
 * the same tokens can drive build-time render targets (OG image, future PDF
 * exports, …) without bringing the Tailwind toolchain along. `@theme { … }`
 * becomes `:root { … }`, and `@utility bg-paper { … }` becomes `.bg-paper { … }`.
 * Consumers inject the returned string with `page.addStyleTag({ content })`.
 */
export const readDesignTokensCss = (): string => {
  const css = readFileSync(TOKENS_CSS_PATH, 'utf8');
  const theme = extractBlockBody(css, /@theme\s*\{/);
  const bgPaper = extractBlockBody(css, /@utility\s+bg-paper\s*\{/);
  return `:root {\n${theme}\n}\n.bg-paper {\n${bgPaper}\n}\n`;
};

/**
 * Returns the body of the first CSS at-rule whose opening matches `openRegex`,
 * walking braces so nested blocks (none today, but cheap insurance) don't trip
 * the parser the way a non-greedy regex would.
 *
 * @param css - Full CSS source to scan
 * @param openRegex - Regex matching the at-rule's opening (must include the `{`)
 */
const extractBlockBody = (css: string, openRegex: RegExp): string => {
  const open = openRegex.exec(css);
  if (!open) {
    throw new Error(`Could not find block matching ${openRegex} in ${TOKENS_CSS_PATH}`);
  }
  const start = open.index + open[0].length;
  let depth = 1;
  for (let i = start; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, i).trim();
    }
  }
  throw new Error(`Unterminated block matching ${openRegex} in ${TOKENS_CSS_PATH}`);
};

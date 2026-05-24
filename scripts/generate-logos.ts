import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { ASSETS_DIR, PUBLIC_DIR, renderSquareIco } from './generate-logos-utils';

/**
 * Returns the logo-generation config. All file paths and tunable values live
 * here so the rest of the script just reads from one object.
 */
const getConfig = () => ({
  /** Canonical brand SVG. The favicon source is derived from this. */
  brandSource: `${ASSETS_DIR}/logo-inverted.svg`,
  /**
   * Sibling variant with a white background injected behind the masked path.
   * Acts as the single source for both favicon outputs so they stay in sync.
   */
  faviconSource: `${ASSETS_DIR}/logo-inverted-on-white.svg`,
  /** Output served at `/favicon.svg` — referenced from BaseLayout.astro. */
  faviconSvg: `${PUBLIC_DIR}/favicon.svg`,
  /** Output served at `/favicon.ico` — fallback for browsers that ignore the SVG. */
  faviconIco: `${PUBLIC_DIR}/favicon.ico`,
  /** Square sizes packed into the multi-image ICO. */
  faviconIcoSizes: [16, 32, 48],
  /** Colour used for the favicon source's background rect + ICO padding. */
  backgroundColor: '#ffffff'
});

const config = getConfig();

/**
 * Reads the brand SVG and writes the favicon source variant by injecting a
 * full-viewBox background rect right after the opening <svg>. viewBox
 * dimensions are read from the source so the variant stays in sync if the
 * brand SVG's intrinsic size changes.
 */
const generateFaviconSource = (): void => {
  const source = readFileSync(config.brandSource, 'utf8');
  const viewBox = source.match(/viewBox="\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)\s*"/);
  if (!viewBox) {
    throw new Error(`Could not parse viewBox from ${config.brandSource}`);
  }
  const [, width, height] = viewBox;
  const onBackground = source.replace(
    /(<svg[^>]*>)/,
    `$1<rect width="${width}" height="${height}" fill="${config.backgroundColor}"/>`
  );
  writeFileSync(config.faviconSource, onBackground);
  console.log(`  wrote ${config.faviconSource}`);
};

/**
 * Copies the favicon source SVG into /public so it ships as `/favicon.svg`.
 */
const generateFaviconSvg = (): void => {
  copyFileSync(config.faviconSource, config.faviconSvg);
  console.log(`  wrote ${config.faviconSvg}`);
};

/**
 * Renders the favicon source SVG at each declared size, pads each to a
 * square with the configured background colour, then packs them into a
 * multi-image .ico.
 */
const generateFaviconIco = (): void => {
  renderSquareIco(
    config.faviconSource,
    config.faviconIcoSizes,
    config.faviconIco,
    config.backgroundColor
  );
  console.log(`  wrote ${config.faviconIco}`);
};

console.log(`Brand source: ${config.brandSource}`);
generateFaviconSource();
generateFaviconSvg();
generateFaviconIco();

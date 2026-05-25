import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { PUBLIC_DIR } from './generate-logos-utils';

const scriptDir = dirname(fileURLToPath(import.meta.url));

/**
 * Returns the OG image generation config. Paths and viewport size live here so
 * the rest of the script just reads from one object.
 */
const getConfig = () => ({
  /** Self-contained HTML source for the share image. */
  htmlSource: resolve(scriptDir, 'og-image/index.html'),
  /** Output PNG served at `/og-image.png` — referenced from BaseLayout.astro. */
  outputPath: resolve(scriptDir, '..', PUBLIC_DIR, 'og-image.png'),
  /** Open Graph image spec: 1200×630 px, 1.91:1 aspect. */
  viewport: { width: 1200, height: 630 }
});

const config = getConfig();

/**
 * Launches headless Chromium, loads the local HTML at the OG image viewport,
 * waits for webfonts to resolve so glyph metrics are final, then writes the
 * captured PNG to the configured output path.
 */
const generateOgImage = async (): Promise<void> => {
  const browser = await chromium.launch({
    args: ['--allow-file-access-from-files']
  });
  try {
    const context = await browser.newContext({
      viewport: config.viewport,
      deviceScaleFactor: 1
    });
    const page = await context.newPage();
    await page.goto(pathToFileURL(config.htmlSource).toString(), {
      waitUntil: 'networkidle'
    });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: config.outputPath,
      type: 'png',
      omitBackground: false,
      clip: { x: 0, y: 0, ...config.viewport }
    });
    console.log(`  wrote ${config.outputPath}`);
  } finally {
    await browser.close();
  }
};

console.log(`OG image source: ${config.htmlSource}`);
await generateOgImage();

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Folder holding the canonical brand SVG sources. */
export const ASSETS_DIR = 'site/src/assets';

/** Astro static folder served at the site root. */
export const PUBLIC_DIR = 'site/public';

/**
 * Renders an SVG to a square PNG of the given pixel dimension, padding the
 * shorter axis with the supplied background colour. librsvg handles the
 * initial render — its SVG support is materially better than ImageMagick's
 * built-in MSVG renderer — and magick then extends the canvas to a centred
 * square.
 *
 * @param sourceSvg - Path to the SVG to render
 * @param size - Pixel dimension (width and height) of the output PNG
 * @param outputPath - Destination PNG path
 * @param backgroundColor - Colour used to pad to square (e.g. `#ffffff`)
 */
const renderSquarePng = (
  sourceSvg: string,
  size: number,
  outputPath: string,
  backgroundColor: string
): void => {
  const tempDir = mkdtempSync(join(tmpdir(), 'aurora-logo-'));
  const rawPath = join(tempDir, 'raw.png');
  try {
    execFileSync('rsvg-convert', ['-h', String(size), sourceSvg, '-o', rawPath], {
      stdio: 'inherit'
    });
    execFileSync(
      'magick',
      [
        rawPath,
        '-background',
        backgroundColor,
        '-gravity',
        'center',
        '-extent',
        `${size}x${size}`,
        outputPath
      ],
      { stdio: 'inherit' }
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
};

/**
 * Renders an SVG at each requested square size (padded to square with the
 * given background colour) and packs the PNGs into a single multi-image .ico.
 * Requires `rsvg-convert` (librsvg) and `magick` (ImageMagick) on PATH.
 *
 * @param sourceSvg - Path to the SVG to render
 * @param sizes - Square pixel dimensions to include in the .ico
 * @param outputPath - Destination .ico path
 * @param backgroundColor - Colour used to pad each PNG to square
 */
export const renderSquareIco = (
  sourceSvg: string,
  sizes: readonly number[],
  outputPath: string,
  backgroundColor: string
): void => {
  const tempDir = mkdtempSync(join(tmpdir(), 'aurora-logo-ico-'));
  try {
    const pngs = sizes.map((size) => {
      const png = join(tempDir, `${size}.png`);
      renderSquarePng(sourceSvg, size, png, backgroundColor);
      return png;
    });
    execFileSync('magick', [...pngs, outputPath], { stdio: 'inherit' });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
};

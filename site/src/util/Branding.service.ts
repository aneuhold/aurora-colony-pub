/**
 * Subset of the W3C Web App Manifest payload we emit. This is intentionally
 * narrower than the full spec — we only model fields we actually set, so
 * adding a new member is an explicit decision, not a typo waiting to happen.
 * Field semantics and the full surface area:
 *
 * - MDN reference: https://developer.mozilla.org/en-US/docs/Web/Manifest
 * - W3C spec: https://www.w3.org/TR/appmanifest/
 *
 * Served at `/site.webmanifest` with `Content-Type: application/manifest+json`.
 */
interface WebManifest {
  name: string;
  short_name: string;
  description: string;
  start_url: '/';
  display: 'standalone';
  background_color: string;
  theme_color: string;
  icons: WebManifestIcon[];
}

/**
 * A square PNG derived from the logo, used by iOS home-screen icons
 * (apple-touch-icon) and/or the PWA web manifest. Renders are produced by
 * `scripts/generate-logos.ts` from `logo-on-white.svg`.
 */
export interface PwaIcon {
  /** Square pixel dimension of the rendered PNG. */
  size: number;
  /** File name inside `site/public/`. */
  fileName: string;
  /** Whether to include this icon in the web manifest `icons` array. */
  inManifest: boolean;
}

interface WebManifestIcon {
  src: string;
  sizes: string;
  type: 'image/png';
}

class BrandingService {
  /** Full display name. Used in OG tags, JSON-LD, and the web manifest. */
  readonly siteName = 'Aurora Colony Pub';

  /** Short name for home-screen launchers / PWA install prompts. */
  readonly shortName = 'Aurora Colony Pub';

  /** One-line summary used by the web manifest. */
  readonly description = 'Historic neighborhood pub in Aurora, Oregon.';

  /**
   * Primary brand color as sRGB hex — equivalent of `--color-primary`
   * (`oklch(0.5 0.13 55)`) in `site/src/styles/tokens.css`. Used for the
   * browser theme bar and the web manifest's `theme_color`.
   *
   * Keep in sync when `--color-primary` changes: paste the OKLCH literal into
   * https://oklch.com/#0.5,0.13,55,100 and copy the displayed sRGB hex.
   */
  readonly themeColor = '#994a00';

  /**
   * Page background as sRGB hex — equivalent of `--color-background`
   * (`oklch(0.98 0.006 80)`) in `site/src/styles/tokens.css`. Used by the
   * web manifest's splash-screen `background_color`.
   *
   * Keep in sync when `--color-background` changes: paste the OKLCH literal
   * into https://oklch.com/#0.98,0.006,80,100 and copy the displayed sRGB hex.
   */
  readonly backgroundColor = '#fbf8f4';

  /**
   * Single source of truth for the PWA / Apple touch icons. Drives both the
   * asset-generation script (`scripts/generate-logos.ts`) and the web
   * manifest endpoint (`site/src/pages/site.webmanifest.ts`).
   */
  readonly icons: readonly PwaIcon[] = [
    { size: 180, fileName: 'apple-touch-icon.png', inManifest: false },
    { size: 192, fileName: 'icon-192.png', inManifest: true },
    { size: 512, fileName: 'icon-512.png', inManifest: true }
  ];

  /**
   * Builds the JSON payload returned by `/site.webmanifest`. Only icons with
   * `inManifest: true` are included — apple-touch-icon is referenced via
   * `<link>` instead and would be redundant here.
   */
  buildWebManifest(): WebManifest {
    return {
      name: this.siteName,
      short_name: this.shortName,
      description: this.description,
      start_url: '/',
      display: 'standalone',
      background_color: this.backgroundColor,
      theme_color: this.themeColor,
      icons: this.icons
        .filter((icon) => icon.inManifest)
        .map((icon) => ({
          src: `/${icon.fileName}`,
          sizes: `${icon.size}x${icon.size}`,
          type: 'image/png'
        }))
    };
  }
}

export default new BrandingService();

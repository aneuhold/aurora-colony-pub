import type { APIRoute } from 'astro';
import { globalConstants } from '$util/globalConstants';

/**
 * Subset of the W3C Web App Manifest payload we emit. This is intentionally
 * narrower than the full spec — we only model fields we actually set, so
 * adding a new member is an explicit decision, not a typo waiting to happen.
 * Field semantics and the full surface area:
 *
 * - MDN reference: https://developer.mozilla.org/en-US/docs/Web/Manifest
 * - W3C spec: https://www.w3.org/TR/appmanifest/
 *
 * Only icons flagged `inManifest: true` are included — apple-touch-icon is
 * referenced via `<link>` instead and would be redundant here.
 */
const buildWebManifest = () => ({
  name: globalConstants.siteName,
  short_name: globalConstants.webManifestShortName,
  description: globalConstants.webManifestDescription,
  start_url: '/',
  display: 'standalone',
  background_color: globalConstants.webManifestBackgroundColor,
  theme_color: globalConstants.webManifestThemeColor,
  icons: globalConstants.pwaIcons
    .filter((icon) => icon.inManifest)
    .map((icon) => ({
      src: `/${icon.fileName}`,
      sizes: `${icon.size}x${icon.size}`,
      type: 'image/png'
    }))
});

/**
 * Emits `/site.webmanifest` at build time, served with
 * `Content-Type: application/manifest+json`.
 */
export const GET: APIRoute = () => {
  const body = JSON.stringify(buildWebManifest());
  return new Response(body, { headers: { 'Content-Type': 'application/manifest+json' } });
};

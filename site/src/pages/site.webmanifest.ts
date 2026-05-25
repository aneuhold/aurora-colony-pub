import type { APIRoute } from 'astro';
import brandingService from '$util/Branding.service';

/**
 * Emits `/site.webmanifest` at build time. The payload is built by
 * `BrandingService` so the icons, theme color, and background color stay
 * aligned with the asset-generation script and the design tokens.
 */
export const GET: APIRoute = () => {
  const body = JSON.stringify(brandingService.buildWebManifest());
  return new Response(body, { headers: { 'Content-Type': 'application/manifest+json' } });
};

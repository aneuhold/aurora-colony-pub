import type { APIRoute } from 'astro';

/**
 * Emits `/robots.txt` at build time. The `Sitemap:` URL is derived from
 * `Astro.site`, so flipping the domain in `astro.config.ts` cascades here
 * automatically — no edits needed at DNS-switch time.
 *
 * @param ctx - Astro API route context
 * @param ctx.site - Canonical site origin from `astro.config.ts`
 */
export const GET: APIRoute = ({ site }) => {
  if (!site) {
    throw new Error('Astro.site must be configured to build robots.txt');
  }
  const sitemap = new URL('sitemap-index.xml', site).href;
  const body = `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${sitemap}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
};

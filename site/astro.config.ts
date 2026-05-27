import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import seoGraph from '@jdevalk/astro-seo-graph/integration';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Update this to be the actual site URL when the domain is switched over.
  site: 'https://aurora-colony-pub-frontend.pages.dev',
  output: 'static',
  // Canonical URLs are slashless: `/menu` not `/menu/`. This makes it so we don't get
  // redirects on every page visit to /menu/ when the url is /menu.
  trailingSlash: 'never',
  build: { format: 'file' },
  // CMS-managed images live in the `aurora-colony-pub-media` R2 bucket. The
  // allowlist below opts every URL on that host into Astro's build-time
  // fetch + Sharp optimization pipeline; URLs from any other host pass
  // through unprocessed.
  // https://docs.astro.build/en/guides/images/#authorizing-remote-images
  image: {
    remotePatterns: [{ protocol: 'https', hostname: 'media.auroracolonypub.aneuhold.dev' }]
  },
  integrations: [
    svelte(),
    sitemap({
      filter: (url) => !url.includes('/admin'),
      // Using weekly as a general rule of thumb.
      changefreq: 'weekly',
      // So whenever the build was ran
      lastmod: new Date(),
      serialize: (item) => {
        const pathname = new URL(item.url).pathname;
        // Home is the primary entry; menu is the second most important page.
        // The rest stay at the default so the spread carries signal.
        if (pathname === '/') return { ...item, priority: 1.0 };
        if (pathname === '/menu') return { ...item, priority: 0.75 };
        return item;
      }
    }),
    seoGraph()
  ],
  fonts: [
    {
      name: 'Zilla Slab',
      cssVariable: '--font-zilla-slab',
      provider: fontProviders.google(),
      weights: [400, 600, 700],
      styles: ['normal'],
      fallbacks: ['ui-serif', 'Georgia', 'serif']
    },
    {
      name: 'Inter',
      cssVariable: '--font-inter',
      provider: fontProviders.google(),
      weights: [400, 500, 600],
      styles: ['normal'],
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif']
    }
  ],
  vite: {
    plugins: [tailwindcss()]
  }
});

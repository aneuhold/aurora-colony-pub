import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Update this to be the actual site URL when the domain is switched over.
  site: 'https://aurora-colony-pub-frontend.pages.dev',
  output: 'static',
  integrations: [svelte(), sitemap()],
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

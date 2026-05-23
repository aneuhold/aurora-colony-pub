import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  // Update this to be the actual site URL when the domain is switched over.
  site: 'https://aurora-colony-pub-frontend.pages.dev',
  output: 'static',
  integrations: [svelte(), sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});

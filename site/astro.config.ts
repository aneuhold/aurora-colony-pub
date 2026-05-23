import sitemap from '@astrojs/sitemap';
import svelte from '@astrojs/svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  site: 'https://auroracolonypub.com',
  output: 'static',
  integrations: [svelte(), sitemap()],
  vite: {
    plugins: [tailwindcss()]
  }
});

import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,svelte.ts}'],
    setupFiles: ['./testUtils/vitest-setup.ts']
  }
});

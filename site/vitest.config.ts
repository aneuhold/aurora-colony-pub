// The below nasty reference is required evidently. See the Astro docs here:
// https://docs.astro.build/en/guides/testing/
/// <reference types="vitest/config" />
import { getViteConfig } from 'astro/config';

export default getViteConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,svelte.ts}'],
    setupFiles: ['./testUtils/vitest-setup.ts']
  }
});

import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { configDefaults, defineConfig, type ViteUserConfig } from 'vitest/config';

export interface WorkerVitestOptions {
  /**
   * Extra miniflare bindings to inject — typically test stand-ins for
   * secrets that aren't declared in `wrangler.jsonc` because they're set
   * via `wrangler secret put` in production. Secrets are always strings.
   */
  bindings?: Record<string, string>;
}

/**
 * Builds a vitest config for a Worker. Workers without overrides can keep
 * their `vitest.config.ts` as `export { default } from '../vitest.shared'`.
 *
 * @param options Per-Worker overrides
 */
export const createWorkerVitestConfig = (options: WorkerVitestOptions = {}): ViteUserConfig =>
  defineConfig({
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: { bindings: options.bindings ?? {} }
      })
    ],
    test: {
      include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts'],
      exclude: [...configDefaults.exclude, '**/*.e2e.test.ts']
    }
  });

export default createWorkerVitestConfig();

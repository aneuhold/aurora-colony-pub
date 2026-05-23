import svelteConfig from '@aneuhold/eslint-config/src/svelte-config.js';
import astro from 'eslint-plugin-astro';

export default [
  ...svelteConfig,
  ...astro.configs.recommended,
  {
    rules: {
      // We have dynamic routes that ESLint can't statically resolve.
      'svelte/no-navigation-without-resolve': 'off',
      // TypeScript without `noUncheckedIndexedAccess` reports `arr[0]` as non-nullable,
      // which makes this rule flag legitimate runtime guards as unnecessary.
      '@typescript-eslint/no-unnecessary-condition': 'off'
    }
  },
  {
    ignores: [
      '**/dist/**',
      '**/.astro/**',
      '**/.wrangler/**',
      '**/node_modules/**',
      '**/build/**',
      '**/worker-configuration.d.ts',
      // Shared workers Vitest configs — trivial re-export bases; not part of any tsconfig.
      'workers/vitest.shared.ts',
      'workers/vitest.e2e.shared.ts'
    ]
  }
];

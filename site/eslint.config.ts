import svelteConfig from '@aneuhold/eslint-config/src/configs/svelte-config';
import astro from 'eslint-plugin-astro';

export default [
  ...svelteConfig,
  ...astro.configs.recommended,
  {
    // Anchors the TypeScript project lookup to this directory.
    languageOptions: {
      parserOptions: {
        // @ts-expect-error, eslint does recognize this as correct. TS flags dirname as not existing.
        tsconfigRootDir: import.meta.dirname
      }
    }
  },
  {
    rules: {
      // TypeScript without `noUncheckedIndexedAccess` reports `arr[0]` as non-nullable,
      // which makes this rule flag legitimate runtime guards as unnecessary.
      '@typescript-eslint/no-unnecessary-condition': 'off'
    }
  },
  {
    ignores: ['eslint.config.ts', 'dist', '.astro']
  }
];

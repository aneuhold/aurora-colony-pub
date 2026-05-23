/**
 * Base prettier config for the aurora-colony-pub workspace.
 */
const config = {
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'none',
  printWidth: 100,
  plugins: ['prettier-plugin-svelte', 'prettier-plugin-astro'],
  overrides: [
    { files: '*.svelte', options: { parser: 'svelte' } },
    { files: '*.astro', options: { parser: 'astro' } }
  ]
};

export default config;

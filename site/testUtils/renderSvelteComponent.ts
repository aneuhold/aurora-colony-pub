import {
  render as testingLibraryRender,
  type RenderResult,
  type SvelteComponentOptions
} from '@testing-library/svelte';
import type { Component } from 'svelte';

/**
 * Renders a Svelte 5 component for `@testing-library/svelte`, working
 * around an Astro type-tooling bug.
 *
 * `@astrojs/svelte`'s editor shim rewrites every `.svelte` file's default
 * export as `(_props: PropsWithClientDirectives<Props>) => any` so that
 * `client:*` directives type-check inside `.astro` files. `astro check`
 * uses the same shim, so a `.test.ts` file that imports a `.svelte`
 * component sees the Astro wrapper rather than Svelte 5's `Component`.
 * That doesn't satisfy `render()`'s `C extends Component` constraint even
 * though the runtime value is the real Svelte component. Centralising the
 * widening here keeps individual tests free of inline casts.
 *
 * Will be removed once https://github.com/withastro/astro/pull/16496
 * lands and `.svelte` imports type-check as `Component` directly.
 *
 * @param component The `.svelte` default export to mount
 * @param options Props or mount options for the component
 */
export const renderSvelteComponent = <C extends Component>(
  component: unknown,
  options?: SvelteComponentOptions<C>
): RenderResult<C> => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return testingLibraryRender(component as never, options);
};

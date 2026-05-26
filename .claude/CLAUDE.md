# Repo-specific instructions for AI coding agents

This repository is an Astro 5 + Svelte 5 islands site, styled with Tailwind v4, deployed to Cloudflare Pages (static output). Cloudflare Workers live in `/workers/*` and handle the dynamic concerns (Facebook feed, contact form, CMS auth). Managed with pnpm workspaces.

## Quick Commands

All commands run from the **repo root** — pnpm filters route them to the right package:

- Dev server (site): `pnpm dev`
- Build everything: `pnpm build`
- Build site only: `pnpm build:site`
- Build workers only: `pnpm build:workers` (each runs `wrangler deploy --dry-run`)
- Preview built site: `pnpm preview`
- Lint: `pnpm lint`
- Type-check: `pnpm check`
- Test: `pnpm test`
- Deploy workers: `pnpm deploy:workers`
- Upgrade all deps to latest: `pnpm upgrade:deps`

## Architecture & Conventions

### Site (`/site`)

- **Framework**: Astro 5 with `output: 'static'`. Pages live in `src/pages/`, shared layouts in `src/layouts/`. `BaseLayout.astro` wires Astro's `<ClientRouter />` (root view-transition crossfade) and the site `<Nav>` for every page.
- **Components**: Split by runtime cost into two folders. `.astro` components live in `src/components-astro/` — prefer these for anything that doesn't need client-side interactivity, they render at build time and ship **zero JS**. Compose pages from the UI primitives in `src/components-astro/ui/` (`Section`, `Container`, `Heading`, `Button`) rather than reinventing layout: `Section` owns vertical rhythm + horizontal gutter, `Container` owns max-width. Reach for a Svelte island only when you genuinely need reactivity.
- **Islands**: Svelte 5 components in `src/components-svelte/*.svelte`, embedded in `.astro` files with `client:*` directives. Use runes (`$state`, `$derived`, `$effect`, `$props`).
- **Styling**: Tailwind v4 only — **no component library**. Tokens live in `site/src/styles/tokens.css` (`--color-*`, `--font-*`) and `motion.css` (`--duration-*`, `--ease-*`, `--animate-*`, the `.reveal` scroll-driven fade, root view-transition tuning); `global.css` just imports them. Tailwind generates utilities from `@theme` automatically — `bg-primary`, `text-foreground/60`, `font-display`, `duration-snap`, `animate-fade-up` — and opacity modifiers (`/N`) cover most tint/shade needs, so expand the token set only when opacity-on-`foreground` gives the wrong hue. Avoid scoped `<style>` blocks; for descendant selectors use arbitrary variants (`[&_img]:rounded-md`). Do not introduce shadcn-svelte, bits-ui, or any other UI kit.
- **Path aliases**: `$components-astro/*`, `$components-svelte/*`, `$util/*`, `$styles/*` (see `site/tsconfig.json`).
- **Tests**: Vitest + `@testing-library/svelte`, jsdom environment. Vitest reads the Astro plugin set via `getViteConfig`.

### Workers (`/workers/*`)

- One folder per Worker.
- Every Worker is wrapped with `Sentry.withSentry` from `@sentry/cloudflare` so unhandled errors auto-report. The DSN is hard-coded inline per Worker (it's a public identifier, not a secret).
- Shared KV namespace: `aurora-colony-pub-kv` (single namespace for the whole project; bound as `AURORA_COLONY_PUB_KV`). Use key prefixes to separate concerns (e.g. `fb:post:123`, `contact:sub:456`).
- Every Worker has a `RATE_LIMITER` binding (Cloudflare's [`ratelimit`](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) binding) keyed by `CF-Connecting-IP`. The `fetch` handler should call `await env.RATE_LIMITER.limit({ key: ip })` first and return `429` on miss. Per-Worker `limit`/`period` lives in each `wrangler.jsonc`.
- Per-Worker bindings, secrets, and vars are declared in each `wrangler.jsonc`; the `Env` interface in each `src/index.ts` is the source of truth for what the handler consumes.
- Each Worker uses the shared `workers/tsconfig.base.json` (its own `tsconfig.json` is a two-line extender) and the shared `workers/vitest.shared.ts` (its own `vitest.config.ts` re-exports it). Don't duplicate either.
- Tests use `@cloudflare/vitest-pool-workers` so `fetch`/KV bindings work inside Vitest.

## Code Style

### Types & Functions

- NEVER EVER use `any` NOT EVEN IN TESTS (use `unknown` if necessary, and only if absolutely unavoidable).
- Add explicit types when unclear; extract complex object types to separate `type` declarations.
- Use PascalCase for type names; file names should match the primary exported type.
- Use arrow functions and `const`/`let` (never `var`).
- Use `async`/`await` instead of `.then()`.

### Documentation & Naming

- Add JSDoc for all methods, functions, and classes (include `@param`, omit `@returns`).
- Add JSDoc for public class properties only if complex.
- Never prefix functions/methods with underscores.

### Class Structure

- Order methods by visibility: public, protected, private.
- Within same visibility, order doesn't matter.

### Services

- When a module exposes more than one related function, or any state/constants shared across functions, write it as a `*.service.ts` singleton instead of a file of floating exports. See `site/src/util/DateTime.service.ts` for the canonical shape: one class with helpers as methods, `private static readonly` for constants, `private` for internal helpers, `public` for the surface the rest of the app consumes, and `export default new XyzService()` at the bottom.
- File name is PascalCase matching the class (e.g. `Branding.service.ts` → `class BrandingService`).

## File Organization

### Barrel Files (`index.ts`)

- Only use a barrel file when a folder has a **single public export** and all other files in the folder are internal implementation details consumed exclusively by that export.
- Do **not** create barrel files that aggregate exports from multiple unrelated modules.

### Imports

- Use relative imports within a package, package references for external packages.
- Use named imports only (NEVER `import * as`) — except for namespaces the runtime requires (e.g. `import * as Sentry from '@sentry/cloudflare'`).
- Import at file top (inline only when absolutely necessary).

### Enums

- Use PascalCase for enum names and values.
- Use TypeScript `enum` (not `const enum` or `type`).
- Prefer string enums over string unions for readability.

### Syntax and Best Practices

- NEVER use `['propertyName']` syntax to access properties, always use `.propertyName` unless the property name is dynamic.
- Use object destructuring when accessing multiple properties from an object.
- Prefer template literals over string concatenation.

## Tests

- Follow the same TypeScript conventions as in the main codebase (no `any`).
- Use Vitest for unit tests.
- Place tests in a separate file next to the original with `.test.ts` appended.
- Prefer real implementations over mocks where practical.
- Keep tests concise and focused on business logic, not implementation details.

## Before Considering a Task Complete

Run + fix any issues that come up: `pnpm lint --fix`, `pnpm check`, and `pnpm test`.

## Tool Information

- **Sentry MCP server**: Organization slug is `anton-neuhold`. Worker projects: `aurora-fb-feed-read`, `aurora-fb-feed-sync`, `aurora-contact`, `aurora-cms-auth`.
- **Cloudflare**: Pages project (placeholder) `aurora-colony-pub`. Workers deploy from `/workers/*` via Wrangler.

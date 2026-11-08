# Setup parity with augment-takehome

Port the workspace setup and configuration improvements from `augment-takehome` into this repo. Application code changes only where the new lint rules require them.

## What augment-takehome does differently

| Area | augment-takehome | aurora-colony-pub today |
| --- | --- | --- |
| ESLint package | `@aneuhold/eslint-config` ^3 (raw `.ts` configs under `src/configs/`, adds `aneuhold/no-private-modifier` and `aneuhold/service-file-structure`) | ^2.0.5 (`src/svelte-config.js`) |
| ESLint layout | Root `eslint.config.ts` uses `ts-lib-config` and ignores the frontend; the frontend has its own `eslint.config.ts` for its stack. Root `lint` = `eslint && pnpm -r --parallel lint`. Both anchor `tsconfigRootDir: import.meta.dirname`. | One root `eslint.config.js` applies `svelte-config` (with its relaxed `no-unsafe-*` / `no-floating-promises`) to workers, packages, and scripts too |
| TS project graph | Root `tsconfig.json` solution file (`files: []` + `references`) so find-all-references / rename work across packages. `packages/shared` is `composite` and emits declarations to `.tsbuild`; consumers list it in `references`. | No solution file, no references |
| Shared worker Vitest files | `workers/tsconfig.json` includes `workers/*.ts`, so the shared Vitest configs are type-checked and linted | Those files are excluded from ESLint by hand |
| Workers Vitest integration | `@cloudflare/vitest-plugin` (`cloudflareTest`), types `@cloudflare/vitest-plugin/types` | `@cloudflare/vitest-pool-workers` |
| CI path filters | Site and worker workflows also trigger on `packages/**` and `tsconfig.json` | `packages/**` missing, so a change to `@aurora/shared` or `@aurora/workers-shared` alone does not deploy |
| Env onboarding | `.env.example` committed, README quickstart uses `cp .env.example .env` | `.gitignore` already whitelists `.env.example`, but none exists |
| VS Code | `markdown.copyFiles.destination` also maps `/README.md` to `docs/images/` | Only `/docs/**/*` |

Not ported, on purpose:

- Takehome's `workers/vitest.shared.ts` loads the root `.env` and each worker builds its own `cloudflareTest` plugin through `mergeConfig`. Aurora's `createWorkerVitestConfig` helper is less code and no aurora test reads `process.env`, so keep the helper and only swap the package.
- Takehome dropped a root `tsconfig.base.json`. Aurora's base is shared by `site`, `scripts`, `workers`, and both packages; removing it would duplicate compiler options. Keep it.
- Unscoped package names, `ignoreWorkspaceRootCheck`, and the `--filter "./workers/**"` script form: no functional gain.

## Steps

### 1. Upgrade ESLint config and split it per stack

- `package.json` (root):
  - Bump `@aneuhold/eslint-config` to `^3.0.3`; add `jiti` (ESLint needs it to load `.ts` configs and the package's raw `.ts` sources).
  - Move `astro-eslint-parser`, `eslint-plugin-astro`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser` to `site/package.json` devDependencies, alongside `@aneuhold/eslint-config` and `eslint` (same pattern as takehome's `frontend/package.json`).
  - `lint`: `eslint --cache && pnpm -r --parallel lint`.
  - Add `lint:fix`: `eslint --cache --fix && pnpm -r --parallel lint --fix`. A separate script is needed because pnpm appends extra args to the end of the script, so `pnpm lint --fix` would only pass `--fix` to the package `lint` scripts and skip the root `eslint`.
- Replace `eslint.config.js` with `eslint.config.ts`, modeled on takehome's root config:
  - Spread `@aneuhold/eslint-config/src/configs/ts-lib-config`.
  - `tsconfigRootDir: import.meta.dirname` block (copy the `@ts-expect-error` comment from takehome).
  - Keep the `@typescript-eslint/no-unnecessary-condition: 'off'` override and its comment.
  - Ignores: `site`, `eslint.config.ts`, `**/.tsbuild`, `**/dist`, `**/.wrangler`, `**/node_modules`, `**/build`, `**/worker-configuration.d.ts`. Drop the `workers/vitest.shared.ts` / `workers/vitest.e2e.shared.ts` ignores (step 3 brings them into a tsconfig).
- New `site/eslint.config.ts` (mirrors takehome's `frontend/eslint.config.ts`): `svelte-config` from `src/configs/` plus `astro.configs.recommended`, the `tsconfigRootDir` block, the `no-unnecessary-condition` override, and ignores for `eslint.config.ts`, `dist`, `.astro`. Drop the `svelte/no-navigation-without-resolve` override: v3's `svelte-config` already turns it off for `.svelte` files.
- `site/package.json`: add `"lint": "eslint ."`.
- `site/tsconfig.json`: exclude `eslint.config.ts`.

### 2. Fix what the v3 rules and `ts-lib-config` flag

Run `pnpm lint:fix` first; most of this autofixes.

- `aneuhold/no-private-modifier` (autofix): about 46 `private` members become `#private`.
- `aneuhold/service-file-structure`: the worker services do not follow `<Name>.service.ts`. Rename and update imports:
  - `workers/contact/src/services/ContactService.ts`, `ContactEmailService.ts`
  - `workers/cms-auth/src/services/AuthService.ts`, `GitHubOAuthService.ts`, `StateCookieService.ts`
  - `workers/fb-feed-read/src/services/FbFeedReadService.ts`
  - `workers/fb-feed-sync/src/services/FbFeedSyncService.ts`, `FbGraphService.ts` (and its `.test.ts`)

  Top-level `const`s in service files (e.g. `EMAIL_REGEX`, `CORS_METHODS` in `ContactService.ts`) move into the class as `static readonly #` fields. Top-level `type` aliases are allowed to stay.
- Workers, packages, and scripts now get `ts-lib-config`, which keeps `no-floating-promises` and the `no-unsafe-*` rules on. Fix any new reports in place; do not add overrides to silence them.
- `.claude/CLAUDE.md`:
  - Services section: replace `private static readonly` / `private` guidance with `#private` and match the singleton shape the rule enforces (`const xyzService = new XyzService(); export default xyzService;`, which is what `DateTime.service.ts` already does).
  - Note that worker service files follow the same `<Name>.service.ts` naming.
  - Mention the per-stack ESLint layout (root config for workers / packages / scripts, `site/eslint.config.ts` for the site).
  - Quick Commands: add `pnpm lint:fix`. "Before Considering a Task Complete": replace `pnpm lint --fix` with `pnpm lint:fix`.
- Check `.claude/skills/*/SKILL.md` for references to the old service naming or `private` and update them if present.

### 3. TypeScript solution file and project references

- New root `tsconfig.json`: solution file (`files: []`) referencing `packages/shared`, `packages/workers-shared`, `site`, `scripts`, `workers`, and each of `workers/{cms-auth,contact,fb-feed-read,fb-feed-sync}`. Reuse takehome's comment explaining why it exists.
- `packages/shared/tsconfig.json` and `packages/workers-shared/tsconfig.json`: replace `noEmit` with `composite: true`, `rootDir: "."`, `outDir: "./.tsbuild"`, `emitDeclarationOnly: true`. Their `check` script becomes `tsc -b`.
- Add `references` to consumers:
  - `site/tsconfig.json` → `packages/shared`
  - each worker `tsconfig.json` → the packages it depends on per its `package.json` (`cms-auth` only uses `workers-shared`)
- New `workers/tsconfig.json`: extends `./tsconfig.base.json`, `include: ["*.ts"]` (copy of takehome's), so `vitest.shared.ts` / `vitest.e2e.shared.ts` are type-checked and linted.
- `.gitignore`: add `.tsbuild` and `*.tsbuildinfo`.
- `.prettierignore`: add `.tsbuild/`.

Build order: with `references`, `tsc --noEmit` in a consumer reads the referenced package's `.tsbuild` declarations, and `pnpm -r --parallel check` ignores topological order. Verify from a clean state (`rm -rf packages/*/.tsbuild && pnpm check`). If a consumer fails with "has not been built from source", prefix its `check` with `tsc -b` of the packages it references (the same approach as takehome's `frontend` `build` script). `astro check` gets the same verification. Astro's `build` and `wrangler deploy --dry-run` do not type-check, so their scripts stay as they are.

### 4. Switch workers to `@cloudflare/vitest-plugin`

- Root and every `workers/*/package.json`: replace `@cloudflare/vitest-pool-workers` with `@cloudflare/vitest-plugin`.
- `workers/vitest.shared.ts`: change the `cloudflareTest` import to the new package. The helper and the per-worker `vitest.config.ts` files stay the same.
- `workers/tsconfig.base.json`: types `@cloudflare/vitest-plugin/types`.
- `.claude/CLAUDE.md` Workers section: update the package name in the tests bullet.
- Stay on Vitest 4 here. `@cloudflare/vitest-plugin@1.4.4` declares `vitest: '^4.1.0 || ^5.0.0'` as a peer, so the switch does not require Vitest 5. Takehome reached the plugin by way of `@cloudflare/vitest-pool-workers@0.23.0` + Vitest 5, which may be where the bug you remember came from. Only if worker tests fail on Vitest 4 after the switch, pull the Vitest 5 bump (root, every worker, `packages/*`, `site`) into this step and note why in the commit.

### 5. CI path filters

In `main-branch-site.yml`, `main-branch-workers.yml`, `pull-request-site.yml`, `pull-request-workers.yml`: add `packages/**` and `tsconfig.json` to `paths` (keep `tsconfig.base.json`). Update the header comments to mention the shared packages.

### 6. Env example, README, and editor settings

- New `.env.example` with every key from `.env` and empty values, keeping the `FB_SYSTEM_USER_TOKEN` comment. Drop `CI` (set by the runner, not by a developer).
- `README.md` Development section: add `cp .env.example .env` and fill in the values, before `pnpm i`.
- `.vscode/settings.json`: add `"/README.md": "docs/images/"` to `markdown.copyFiles.destination`.

### 7. Dependency versions

Separate commit, after steps 1 through 6 pass, so it can be reverted alone. Site tests use Astro's `getViteConfig` and `@testing-library/svelte`, and their Vitest 5 support is not verified.

Run `pnpm upgrade:deps` to pick up what takehome is on (`vitest` 5 unless step 4 already pulled it in, `@cloudflare/workers-types` 5, `concurrently` 10). `minimumReleaseAge` may hold some back. If pnpm reports an unapproved build script for `unrs-resolver` (pulled in by the new ESLint config), add `unrs-resolver: false` under `allowBuilds` in `pnpm-workspace.yaml`, as takehome does.

## Validation

From the repo root: `pnpm lint:fix`, `pnpm check`, `pnpm test`, then `pnpm build` (confirms the worker renames and project references did not break bundling). Run `pnpm check` once more from a clean `.tsbuild` state as described in step 3. In VS Code, run "Find All References" on an export from `@aurora/shared` and confirm it lists usages in `site` and the workers.

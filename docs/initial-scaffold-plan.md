# Initial Scaffolding Plan — Aurora Colony Pub

Goal: bootstrap an Astro + Svelte 5 static site with sibling Cloudflare Workers, mirroring the toolchain in `~/Development/GithubRepos/workout` (preferred) and `~/Development/GithubRepos/portfolio` (secondary), using the user's decisions:

- **Hosting:** Cloudflare Pages, static output.
- **Layout:** pnpm workspace with `/site` + `/workers/*` packages, orchestrated by root scripts (no `cd` in invocation).
- **Styling:** Tailwind v4 only (no shadcn-svelte, no bits-ui).
- **Extras:** Vitest + `@testing-library/svelte`, `@sentry/cloudflare` per Worker, Lighthouse CI on PR (preview **and** production for comparison).
- **Initial content:** minimal landing page, one Svelte island.

The plan is deliberately minimal — no abstractions, helpers, or files exist beyond what each chosen capability strictly requires.

---

## 1. Repo layout (final state)

```
aurora-colony-pub/
├── .claude/                          # already exists
│   ├── CLAUDE.md                     # NEW — sole AI instruction file (repo conventions)
│   └── settings.local.json           # already exists
├── .github/
│   └── workflows/
│       ├── main-branch.yml           # NEW — deploy site + workers on main
│       └── pull-request.yml          # NEW — lint/check/test/build/deploy preview + Lighthouse
├── .vscode/
│   ├── extensions.json               # NEW
│   └── settings.json                 # NEW
├── docs/
│   ├── worker-details.md             # already exists
│   └── initial-scaffold-plan.md      # this file
├── site/                             # Astro app (pnpm workspace package)
│   ├── public/favicon.svg
│   ├── src/
│   │   ├── components/
│   │   │   └── HelloIsland.svelte    # demo Svelte 5 island
│   │   ├── layouts/BaseLayout.astro
│   │   ├── pages/index.astro
│   │   ├── styles/global.css         # @import 'tailwindcss' + tokens
│   │   └── env.d.ts
│   ├── astro.config.mjs
│   ├── svelte.config.js
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── package.json
│   └── testUtils/vitest-setup.ts
├── workers/
│   ├── tsconfig.base.json            # NEW — shared by all four workers
│   ├── vitest.shared.ts              # NEW — shared Vitest config (workers re-export)
│   ├── fb-feed-read/                 # one folder per worker (4 total)
│   ├── fb-feed-sync/
│   ├── contact/
│   └── cms-auth/                     # ─── each: src/index.ts, wrangler.toml,
│                                     #         package.json, tsconfig.json (extends ../tsconfig.base.json),
│                                     #         vitest.config.ts (re-exports ../vitest.shared.ts)
├── .gitignore                        # NEW
├── .prettierignore                   # NEW
├── .prettierrc.js                    # NEW
├── eslint.config.js                  # NEW — root flat config (covers ALL packages, no per-pkg overrides)
├── package.json                      # NEW — workspace root scripts
├── pnpm-workspace.yaml               # NEW
├── tsconfig.base.json                # NEW — shared TS compiler options
├── AGENTS.md                         # NEW — points at .claude/CLAUDE.md
└── README.md                         # already exists
```

**Per-package config grouping (your feedback #4):** Workers share one `tsconfig.base.json` and one `vitest.shared.ts` at the `/workers/` level. Each worker only needs its own `tsconfig.json` (one line: `{ "extends": "../tsconfig.base.json", "include": ["src/**/*"] }`) — required because `wrangler` and `tsc` both need a config rooted in the worker folder. The site keeps its own `tsconfig.json` because Astro requires it there. ESLint is unified: a **single root `eslint.config.js`** covers site + all workers via `files:` globs — no per-package eslint config at all.

The Sveltia CMS admin folder is intentionally NOT scaffolded yet — README marks it as "tried first, not set in stone." Add later when committed.

---

## 2. Root workspace tooling

### 2.1 `package.json` (root)
- `name`: `aurora-colony-pub`, `private: true`, `type: module`, `packageManager: "pnpm@10.19.0"` (newest pinned version used in workout).
- **Scripts** (run via pnpm filters so no `cd` is needed):
  - `dev` → `pnpm --filter ./site dev`
  - `build` → `pnpm -r --parallel build` (site + all workers build their outputs)
  - `build:site` → `pnpm --filter ./site build`
  - `build:workers` → `pnpm --filter "./workers/*" build`
  - `preview` → `pnpm --filter ./site preview`
  - `lint` → `eslint --cache` (root flat config covers all packages)
  - `check` → `pnpm -r --parallel check`
  - `test` → `pnpm -r --parallel test`
  - `deploy:workers` → `pnpm --filter "./workers/*" deploy` (each worker delegates to wrangler)
  - `upgrade:deps` → `pnpm -r exec pnpm up --latest && pnpm up --latest`
- **devDependencies** (root only — shared lint/format tooling):
  - `@aneuhold/eslint-config` (matches workout — provides svelte + ts presets)
  - `eslint`, `prettier`, `prettier-plugin-svelte`, `prettier-plugin-astro`
  - `eslint-plugin-astro`, `astro-eslint-parser`
  - `typescript` (latest 6.x — matches workout)
  - `@types/node`
  - `concurrently` (for any future combined-watch scripts)

### 2.2 `pnpm-workspace.yaml`
```yaml
packages:
  - site
  - workers/*
```

### 2.3 `tsconfig.base.json`
Shared compiler options: `strict`, `esModuleInterop`, `forceConsistentCasingInFileNames`, `resolveJsonModule`, `skipLibCheck`, `moduleResolution: bundler`, `sourceMap`, `target: ES2022`. Each package extends this and only adds its `include`/`paths`.

### 2.4 `eslint.config.js` (root, flat) — the **only** ESLint config in the repo
Mirrors `workout/eslint.config.js`. Layered:
1. `...svelteConfig` from `@aneuhold/eslint-config/src/svelte-config.js` (applies to all `.ts`/`.svelte`).
2. `...astro.configs.recommended` from `eslint-plugin-astro` (applies to `.astro`).
3. One block disabling `svelte/no-navigation-without-resolve` and `@typescript-eslint/no-unnecessary-condition` (same overrides workout uses).
4. `ignores`: `**/dist`, `**/.astro`, `**/.wrangler`, `**/node_modules`, `**/build`.

Workers and the site do **not** ship their own `eslint.config.js`. `pnpm lint` runs ESLint from the repo root and picks up every file via globs.

### 2.5 `.prettierrc.js`
Verbatim from workout: `semi: true`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: 'none'`, `printWidth: 100`, plugins `['prettier-plugin-svelte', 'prettier-plugin-astro']`, plus a `*.astro` parser override.

### 2.6 `.prettierignore`, `.gitignore`
Same as workout, with Astro/CF additions:
- `.gitignore`: add `dist/`, `.astro/`, `.wrangler/`, `.dev.vars`, `worker-configuration.d.ts`.
- `.prettierignore`: add `.astro/`, `dist/`, `.wrangler/`.

---

## 3. Site package (`/site`)

### 3.0 Initialization (your feedback #6 — must run first, before any of the steps below)

```sh
pnpm create astro@latest site -- \
  --template minimal \
  --typescript strict \
  --install \
  --no-git
```

Then, still in `/site/`:

```sh
pnpm astro add svelte
pnpm astro add tailwind          # installs @tailwindcss/vite + wires astro.config.mjs
```

Both `astro add` commands edit `astro.config.mjs` and install deps. Only after this completes do we apply the customizations in 3.1–3.11 below — those edits modify generated files in place rather than writing from scratch. The intent is that the latest official scaffold is the source of truth for boilerplate (config shape, `env.d.ts`, etc.) and we only diverge where we need to match workout's conventions.

### 3.1 `site/package.json` — edits to the generated file
The `create astro` template already provides `name`, `type: module`, dev/build/preview/check scripts, and the `astro`/`@astrojs/check` deps. Edits to apply:
- Rename `"name"` → `"@aurora/site"`.
- Add `"test": "vitest run"`.
- Add devDependencies the scaffold doesn't include: `@astrojs/sitemap`, `@testing-library/svelte`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`, `vitest`.
- Verify (don't re-add) that `astro add svelte` and `astro add tailwind` already wrote: `svelte`, `@astrojs/svelte`, `@tailwindcss/vite`, `tailwindcss`. Pin Svelte to `^5.x` if the scaffold installed an older line.

### 3.2 `site/astro.config.mjs` — edits to the generated file
`astro add svelte`/`astro add tailwind` already wrote `integrations: [svelte()]` and the Tailwind Vite plugin. Edits:
- Add `sitemap()` to the integrations array.
- Add `output: 'static'` (explicit, even though it's the default — makes intent unambiguous).
- Add `site: 'https://auroracolonypub.com'` (placeholder — see open question §10.1).

### 3.3 `site/svelte.config.js`
- `preprocess: vitePreprocess({ script: true })` (matches workout).
- No `kit:` block (this is Astro, not SvelteKit) — Astro's `@astrojs/svelte` reads this for component-level settings only.

### 3.4 `site/tsconfig.json`
- `extends: '../tsconfig.base.json'`.
- `extends` chain also pulls Astro's `astro/tsconfigs/strict`.
- `include`: `src/**/*`, `astro.config.mjs`, `vitest.config.ts`, `testUtils/**/*`, `.astro/types.d.ts`.
- `paths` for aliasing — minimal set to start: `$components/*`, `$util/*`, `$styles/*`. (Astro respects tsconfig `paths` for Astro+Svelte files.)

### 3.5 `site/vitest.config.ts`
- Uses `getViteConfig` from `astro/config` so Vitest reads the same plugin set (svelte + tailwind).
- `test.environment: 'jsdom'`, `test.setupFiles: ['./testUtils/vitest-setup.ts']`, `test.include: ['src/**/*.{test,spec}.{ts,svelte.ts}']`.
- Mirrors workout's `vite.config.ts` Vitest section (mergeConfig pattern).

### 3.6 ESLint
No `site/eslint.config.js`. The root `eslint.config.js` (§2.4) covers `site/**` via globs.

### 3.7 `site/src/styles/global.css`
Minimal: `@import 'tailwindcss';` plus a starter `:root` block with semantic color tokens (without the shadcn registry import, since we opted out of shadcn). Token names follow workout's naming (`--background`, `--foreground`, `--primary`, ...) so future migration to shadcn is easy if the user changes their mind.

### 3.8 `site/src/layouts/BaseLayout.astro`
Standard `<html><head>` with viewport, charset, title slot, description slot, favicon link, `<slot />` body. Imports `../styles/global.css`.

### 3.9 `site/src/pages/index.astro`
"Aurora Colony Pub — coming soon" hero. Uses `BaseLayout` and embeds `<HelloIsland client:load />` to prove the Astro+Svelte wiring.

### 3.10 `site/src/components/HelloIsland.svelte`
Svelte 5 runes (`$state`, `$derived`) — a tiny click-counter or theme-toggle to demonstrate hydration. JSDoc `@component` per workout convention.

### 3.11 `site/testUtils/vitest-setup.ts`
`import '@testing-library/jest-dom/vitest';` — workout pattern, minimal.

---

## 4. Worker packages (`/workers/*`)

### 4.0 Initialization (your feedback #7 — must run first, before any of the steps below)

For each of the four workers (`fb-feed-read`, `fb-feed-sync`, `contact`, `cms-auth`), from the **repo root**:

```sh
pnpm create cloudflare@latest workers/<name> -- \
  --framework=none \
  --type=hello-world \
  --lang=ts \
  --git=false \
  --deploy=false
```

Notes on the flags:
- `--framework=none --type=hello-world` produces a minimal `fetch`-only Worker (no Pages, no Hono, no React). For `fb-feed-sync` use `--type=scheduled` instead so the generated `wrangler.toml` includes a `[triggers]` cron block to edit.
- `--lang=ts` ensures TypeScript output and a starter `tsconfig.json` we can collapse into the shared one.
- `--git=false --deploy=false` because the repo already has git and we're not deploying yet.

After all four are generated, apply the customizations in 4.1–4.6 (most of which **delete** generated boilerplate to consolidate per-worker tsconfig / vitest into the shared files at `workers/`).

- `create cloudflare` already writes `name`, `type: module`, `wrangler`, `@cloudflare/workers-types`, and `dev`/`deploy`/`start` scripts. Edits:
  - Rename `"name"` → `"@aurora/worker-<name>"`.
  - Add `"build": "wrangler deploy --dry-run --outdir=dist"` (CI uses this as a build-only check).
  - Add `"check": "tsc --noEmit"`.
  - Add `"test": "vitest run"`.
  - Add dependencies: `@sentry/cloudflare` (alerting).
  - Add devDependencies: `vitest`, `@cloudflare/vitest-pool-workers` (lets Vitest run inside the Workers runtime so `fetch`/KV bindings work in tests).

### 4.2 `workers/<name>/wrangler.toml`
Minimal:
```
name = "aurora-<name>"
main = "src/index.ts"
compatibility_date = "2026-05-01"
```
For `fb-feed-read` and `fb-feed-sync`: declare a shared KV binding (`[[kv_namespaces]]`) named `FB_FEED` (id placeholder — user fills in after `wrangler kv:namespace create`).
For `fb-feed-sync`: add `[triggers] crons = ["*/30 * * * *"]` per worker-details.md.
For `contact` and `cms-auth`: vars block reserves names (`TURNSTILE_SECRET`, `RESEND_API_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`) — values via `wrangler secret put`.

### 4.3 `workers/<name>/src/index.ts`
Skeleton `export default { fetch }` (or `{ scheduled }` for sync), wrapped with `Sentry.withSentry(...)` from `@sentry/cloudflare` so unhandled errors auto-report. The wrapper reads `SENTRY_DSN` from `env`. **No business logic** — that comes in follow-up tasks driven by `docs/worker-details.md`.

### 4.4 Shared `workers/tsconfig.base.json`
Created once at `/workers/` level. Extends the repo-root `tsconfig.base.json` and adds `compilerOptions.types: ['@cloudflare/workers-types']`. Each worker's `tsconfig.json` is reduced to:
```json
{ "extends": "../tsconfig.base.json", "include": ["src/**/*"] }
```
(The `create cloudflare` template's generated tsconfig is **deleted** and replaced with this two-line file in each worker.)

### 4.5 ESLint
No per-worker `eslint.config.js`. The root `eslint.config.js` (§2.4) covers `workers/**` via globs.

### 4.6 Shared `workers/vitest.shared.ts`
Created once at `/workers/` level. Uses `defineWorkersConfig` from `@cloudflare/vitest-pool-workers` with `pool: '@cloudflare/vitest-pool-workers'` and `include: ['src/**/*.{test,spec}.ts']` (relative paths resolve per-package). Each worker's `vitest.config.ts` is a one-liner:
```ts
export { default } from '../vitest.shared.ts';
```
A single `index.test.ts` placeholder per worker asserts the worker returns a 200 on `GET /`.

---

## 5. GitHub Actions

Setup steps are inlined in each workflow (no composite action). Both workflows start with the same three steps from `workout/.github/workflows/main-branch.yml`: `actions/checkout@v6` → `pnpm/action-setup@v6` → `actions/setup-node@v6` (`node-version: lts/*`, `cache: pnpm`) → `pnpm install`.

### 5.2 `.github/workflows/pull-request.yml`
Trigger: `pull_request` to `main`. Jobs:

1. **`verify`** — fast fail.
   - Run the inlined setup steps (checkout + pnpm + node + install).
   - `pnpm lint`, `pnpm check`, `pnpm test`.

2. **`build-site`** — runs after `verify`.
   - Run the inlined setup steps.
   - `pnpm build:site`.
   - Upload `site/dist/` as artifact `site-dist-pr`.

3. **`build-workers`** — runs after `verify`.
   - Matrix over the four workers.
   - Run the inlined setup steps.
   - `pnpm --filter @aurora/worker-${{ matrix.worker }} build` (wrangler deploy --dry-run).
   - No deploy on PR — workers deploy only on `main` to avoid clobbering prod bindings.

4. **`deploy-preview`** — needs `build-site`.
   - Download `site-dist-pr`.
   - Deploy to Cloudflare Pages preview via `cloudflare/pages-action@v1` with `branch: ${{ github.head_ref }}`. Output the preview URL.

5. **`lighthouse`** — needs `deploy-preview`. **Implements the comparison the user asked for.**
   - Run `treosh/lighthouse-ci-action@v12` against:
     - the PR preview URL (output of `deploy-preview`)
     - the production URL (hard-coded `https://auroracolonypub.com`, configurable)
   - `temporaryPublicStorage: true` so per-run reports get hosted links.
   - Use `actions/github-script@v7` to post a **single sticky PR comment** (via `marocchino/sticky-pull-request-comment@v3` — same action workout uses) with two columns: `PR` vs `prod`, per Lighthouse category, with delta emoji (🟢/🟡/🔴) on each delta. Comment format adapted from `portfolio/.github/workflows/pull-request.yml` but augmented with the delta column.

### 5.3 `.github/workflows/main-branch.yml`
Trigger: `push` to `main`. Jobs:

1. **`deploy-site`**:
   - Run the inlined setup steps.
   - `pnpm build:site`.
   - Deploy `site/dist/` to Cloudflare Pages **production** branch via `cloudflare/pages-action@v1`.

2. **`deploy-workers`**:
   - Matrix over the four workers.
   - Run the inlined setup steps.
   - `pnpm --filter @aurora/worker-${{ matrix.worker }} deploy`.
   - Env: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` from repo secrets.

### 5.4 Required GitHub secrets (documented in README addendum, not stored)
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- Per worker: `SENTRY_DSN_<NAME>` (set via `wrangler secret put`, not GH Actions, but listed for completeness).

---

## 6. LLM instruction files

All AI guidance lives in **one file**: `.claude/CLAUDE.md`. No `copilot-instructions.md`, no `.github/agents/`.

### 6.1 `.claude/CLAUDE.md`
The full repo-conventions document, adapted from `workout/.github/copilot-instructions.md`. Key changes from that source:
- Replace "SvelteKit app" intro with: "Astro 5 + Svelte 5 islands, Tailwind v4, deployed to Cloudflare Pages. Cloudflare Workers live in `/workers/*` and handle dynamic concerns (FB feed, contact form, CMS auth)."
- Replace `pnpm dev` etc. with the root scripts table from §2.1.
- Replace shadcn-svelte / bits-ui sections with: "No component library — write Svelte 5 components directly, use Tailwind utilities, follow the token names in `site/src/styles/global.css`."
- Keep Code Style, File Organization, Imports, Enums, Tests sections verbatim from workout (TypeScript-only sections apply unchanged).
- Add a new section: **Workers** — points at `docs/worker-details.md`, notes that every worker is wrapped with `@sentry/cloudflare`, lists the bindings each one expects.
- Remove SvelteKit-specific items: `$lib`, load functions, `$app/*` imports, app.html details.

### 6.2 `AGENTS.md`
Single line at repo root, pointing other agents at the canonical instructions: `Follow the instructions in .claude/CLAUDE.md`.

---

## 7. VS Code config

Two small files, copied from workout with minor edits:
- `.vscode/extensions.json`: drop `selemondev.vscode-shadcn-svelte`; add `astro-build.astro-vscode`.
- `.vscode/settings.json`: copy verbatim, then add `astro` to `eslint.validate`.

No `.vscode/mcp.json`.

---

## 8. README addendum

Add a small **Development** section to `README.md` (at end, before any final notes):
- One-liner install: `pnpm i`.
- Common scripts table (dev, build, lint, check, test, deploy:workers).
- Pointer to `docs/worker-details.md`.
- Pointer to `docs/initial-scaffold-plan.md` (this file).

Keep the rest of the existing README intact.

---

## 9. Validation order (when implementing)

After each major step, run these from repo root:

1. `pnpm install` — must succeed once `package.json` + `pnpm-workspace.yaml` exist.
2. `pnpm --filter @aurora/site check` — Astro+Svelte type check passes on empty scaffold.
3. `pnpm --filter "@aurora/worker-*" check` — TS compile passes for each worker.
4. `pnpm lint` — root ESLint clean across site + workers.
5. `pnpm test` — placeholder tests pass.
6. `pnpm build` — site emits `site/dist/`, each worker emits to its `dist/` via `wrangler deploy --dry-run`.

If any step fails, fix root-cause before moving to the next step (no `--no-verify`, no skips).

---

## 10. Open items (call out before implementation)

These were not resolved during planning and need a quick decision *during* implementation, or can stay as TODOs in code:

1. **Production domain.** `astro.config.mjs` `site:` and the Lighthouse prod-comparison URL are placeholders (`https://auroracolonypub.com`). If the real domain differs, swap in one place.
2. **Cloudflare Pages project name.** Used in `cloudflare/pages-action@v1`. Defaulted to `aurora-colony-pub`; rename to match the actual Pages project once created.
3. **Sentry org/project per Worker.** Workout uses org `anton-neuhold`. Worker DSNs are per-project; the plan reserves four (`aurora-fb-feed-read`, `aurora-fb-feed-sync`, `aurora-contact`, `aurora-cms-auth`). Create them in Sentry before first deploy.
4. **KV namespace IDs.** `wrangler.toml` for both fb-feed workers has placeholder IDs; replace after `wrangler kv:namespace create FB_FEED`.
5. **Sveltia CMS.** Deferred — not scaffolded in this pass. Add `/site/public/admin/` + a follow-up plan when committing to Sveltia vs alternatives.
6. **Lighthouse budget config.** Plan defers any `lighthouserc.yml` budget assertions until a baseline run produces real numbers; the workflow just records + comments for now. Workout doesn't gate on Lighthouse either.

---

## 11. Step-by-step implementation order

1. **Scaffold via official generators** (no hand-rolled boilerplate):
   - `pnpm create astro@latest site -- --template minimal --typescript strict --install --no-git`
   - In `/site/`: `pnpm astro add svelte && pnpm astro add tailwind`
   - For each of `fb-feed-read`, `contact`, `cms-auth`: `pnpm create cloudflare@latest workers/<name> -- --framework=none --type=hello-world --lang=ts --git=false --deploy=false`
   - For `fb-feed-sync`: same as above but `--type=scheduled`.
2. **Root files**: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.prettierrc.js`, `.prettierignore`, `.gitignore`, `eslint.config.js`.
3. **Shared workers config**: `workers/tsconfig.base.json`, `workers/vitest.shared.ts`. Replace each worker's generated `tsconfig.json` with the two-line extender; add the one-line `vitest.config.ts` re-export.
4. **Apply site customizations** (§3.1–§3.11) on top of the scaffolded `/site/`.
5. **Apply worker customizations** (§4.1–§4.6) on top of each scaffolded worker — including Sentry wrapper in `src/index.ts` and `wrangler.toml` edits (KV binding for fb-feed pair; cron block for sync; vars for contact + cms-auth).
6. `.claude/CLAUDE.md`, `AGENTS.md`.
7. `.github/workflows/pull-request.yml`, `.github/workflows/main-branch.yml`.
8. `.vscode/extensions.json`, `.vscode/settings.json`.
9. README addendum.
10. Run the §9 validation order; fix anything that fails.

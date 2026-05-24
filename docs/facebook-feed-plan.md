# Facebook Feed Implementation Plan

Two-worker pipeline + a Svelte island, as described in `docs/worker-details.md`:
`aurora-fb-feed-sync` writes Facebook posts to KV (cron + manual trigger);
`aurora-fb-feed-read` reads KV and serves them to the browser; the island
fetches the read worker and renders a minimal list.

The skeletons already exist (Sentry wrapping, KV binding, rate limiter, manual
bearer auth, cron). This plan fills in the bodies and the frontend.

Styling is intentionally minimal — basic Tailwind utilities only, polished
later.

## Prequel — one-time setup outside the codebase

Required before the sync worker can do anything useful. Nothing in this list
goes through code review; it's account/console work. We use the
**Business Portfolio → System User** path because it produces a Page Access
Token that does not expire by time (vs. the user-token-exchange path, which
breaks if the user changes their FB password, loses Page admin, etc.).

1. **Pub's Page access — pending approval**
   - Shared-access request is sent; waiting on the pub's portfolio admin
     to approve.
   - Watch the request status here:
     <https://business.facebook.com/latest/settings/pages/?business_id=1592741911818216&selected_asset_id=465497836965753&selected_asset_type=page>
   - Once it flips to approved, the Page shows up under Business Settings
     → Accounts → Pages with the access level granted. Don't proceed past
     this step until that happens.
2. **Meta developer app**
   ([docs](https://developers.facebook.com/docs/development/create-an-app/))
   - https://developers.facebook.com/apps → Create App.
   - **Use case**: pick **"Manage everything on your Page"**. That bundle
     ships `pages_show_list`, `pages_manage_engagement`,
     `pages_read_engagement`, and `business_management` — covers what we
     need to call `GET /{page-id}/posts`
     ([use-case mapping](https://developers.facebook.com/docs/development/create-an-app/use-cases-permission-mapping/),
     [permission reference](https://developers.facebook.com/docs/permissions/)).
   - **Business Portfolio**: connect to the one created in step 1.
4. **System User + non-expiring Page Access Token**
   ([docs](https://developers.facebook.com/docs/business-management-apis/system-users/),
   [token generation](https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens/))
   - In Business Settings → Users → **System Users** → Add. Type: Admin.
   - Add Assets → Pages → select the pub's Page → grant content/management
     access.
   - **Generate New Token** → pick the app from step 3 → select scopes
     `pages_show_list` + `pages_read_engagement` → **leave
     "Set token expiration" off** so it's non-expiring (the alternative is
     a 60-day expiring token; we don't want that). Copy the token now —
     it's only shown once.
   - From the Page's About section, copy the **Page ID**.
5. **Smoke-test the token before wiring secrets**
   ([Standard vs Advanced Access](https://developers.facebook.com/docs/graph-api/overview/access-levels/))
   - `curl "https://graph.facebook.com/v21.0/{PAGE_ID}/posts?fields=id,message,permalink_url&limit=1&access_token={TOKEN}"`
   - **Posts come back** → Standard Access is enough; the app can stay in
     development mode forever (server-to-server calls from the Worker
     don't need it Live). Skip the dashboard's "Business verification"
     and "Publish your app" checklist items entirely.
   - **`(#10)` / `(#200)` / "requires Advanced Access"** → loop back and
     run Business Verification
     ([docs](https://developers.facebook.com/docs/development/release/business-verification/));
     the Meta Business Portfolio needs to be backed by a real
     business/EIN. Aurora Colony Pub's existing portfolio almost
     certainly already satisfies this on their side; ours may not, but
     since the Page is shared into our portfolio rather than owned by
     it, Standard Access is the expected path.
6. **Wrangler secrets** (sync worker only — the read worker doesn't talk to
   Facebook)
   - `pnpm --filter ./workers/fb-feed-sync exec wrangler secret put FB_PAGE_ID`
   - `pnpm --filter ./workers/fb-feed-sync exec wrangler secret put FB_PAGE_ACCESS_TOKEN`
7. **Local `.env`** — add `FB_PAGE_ID` and `FB_PAGE_ACCESS_TOKEN` so
   `wrangler dev --env-file ../../.env` picks them up locally (matches the
   pattern already used for `FB_MANUAL_SYNC_TOKEN`).
8. **README table** is already populated; no change needed there.

Open question worth flagging: System User tokens don't expire by time, but
they can still be invalidated — Page admin role removed, password reset on
an account tied to the System User, scope revocation, Meta security
intervention
([reference](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/debugging-and-error-handling)).
If the token ever breaks, the sync worker will start returning 5xx —
Sentry catches it and we re-mint from the Business Settings console. Not
building auto-refresh now.

## Step 1 — Shared types in `@aurora/shared`

Single source of truth for the wire format the read worker emits and the
island consumes.

- **New file** `packages/shared/src/fbFeedTypes.ts`
  - `WorkerFbFeedPost` — `{ id: string; message: string; permalink: string; createdAt: string; imageUrl?: string }`. Keep it small; we strip everything else in the sync worker so the KV blob stays compact.
  - `WorkerFbFeedResponse` — `{ posts: WorkerFbFeedPost[]; syncedAt: string }`.
- **Edit** `packages/shared/src/index.ts` — add `export * from './fbFeedTypes';`.

## Step 2 — `fb-feed-sync` worker body

Mirror the `contact` worker's service split (`index.ts` stays trivial,
`services/*` does the work).

- **New file** `workers/fb-feed-sync/src/Env.ts`
  - Re-export the existing inline `Env`: `AURORA_COLONY_PUB_KV`,
    `RATE_LIMITER`, `FB_MANUAL_SYNC_TOKEN`, `FB_PAGE_ID`,
    `FB_PAGE_ACCESS_TOKEN`.
- **New file** `workers/fb-feed-sync/src/util/fbFeedSyncConstants.ts`
  - `kvKey: 'fb:feed:latest'`.
  - `graphApiVersion: 'v21.0'`.
  - `fields: 'id,message,permalink_url,created_time,full_picture'` (Graph API field list).
  - `postLimit: 10` — keep KV blob small; we only render a handful.
- **New file** `workers/fb-feed-sync/src/services/FbGraphService.ts`
  - Singleton, `async fetchLatestPosts(env: Env): Promise<WorkerFbFeedPost[]>`.
  - Calls `GET https://graph.facebook.com/{version}/{pageId}/posts?fields=…&limit=…&access_token=…`.
  - Throws on non-2xx so the orchestrator can return a 502 / let Sentry capture it.
  - Maps Graph response fields → `WorkerFbFeedPost` (drops anything the type doesn't declare; `imageUrl` from `full_picture` only when present; `message` defaults to empty string when missing).
- **New file** `workers/fb-feed-sync/src/services/FbFeedSyncService.ts`
  - Singleton with two public methods:
    - `handleRequest(request: Request, env: Env): Promise<Response>` — IP rate-limit, require `Authorization: Bearer ${FB_MANUAL_SYNC_TOKEN}`, then call `syncFeed`. Return 200 on success, 502 on Graph failure.
    - `syncFeed(env: Env): Promise<void>` — calls `FbGraphService.fetchLatestPosts`, wraps result as `WorkerFbFeedResponse` with `syncedAt = new Date().toISOString()`, writes to KV under `fbFeedSyncConstants.kvKey`.
- **Edit** `workers/fb-feed-sync/src/index.ts`
  - Replace the inline `Env` with the import from `./Env`.
  - Delegate `fetch` and `scheduled` to `fbFeedSyncService` (so `scheduled` calls `syncFeed` and surfaces errors so Sentry + cron retries see them).
- **Edit** `workers/fb-feed-sync/package.json`
  - Add `"@aurora/shared": "workspace:*"` to `dependencies` (already used by the contact worker — same pattern).
- **Edit** `workers/fb-feed-sync/wrangler.jsonc`
  - Update the secrets comment block to list `FB_MANUAL_SYNC_TOKEN`, `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`.

## Step 3 — `fb-feed-read` worker body

Same service-split pattern. Read-only, public, CORS-allowlisted.

- **New file** `workers/fb-feed-read/src/Env.ts`
  - `AURORA_COLONY_PUB_KV`, `RATE_LIMITER`.
- **New file** `workers/fb-feed-read/src/util/fbFeedReadConstants.ts`
  - `kvKey: 'fb:feed:latest'` (kept independent of the sync worker — small duplication is fine and avoids coupling the two workers through a shared module).
  - `allowedOrigins` — same list as `contactWorkerConstants.allowedOrigins`.
  - `cacheControl: 'public, max-age=120'` — matches the 2-minute browser cache called out in `worker-details.md`.
- **New file** `workers/fb-feed-read/src/services/FbFeedReadService.ts`
  - Singleton, `handleRequest(request, env)`:
    - CORS preflight handling and origin echoing (lift the helpers from `ContactService` — `isAllowedOrigin`, `corsHeaders`, `jsonResponse`; resist the urge to extract a shared module right now, it's two small workers).
    - Reject methods other than `GET`/`OPTIONS`.
    - IP rate-limit.
    - `await env.AURORA_COLONY_PUB_KV.get(kvKey, 'json')` → if null, return `{ posts: [], syncedAt: null }` with 200 (so the island degrades cleanly until the first sync runs).
    - Otherwise return the stored JSON verbatim with `Content-Type: application/json` and `Cache-Control: public, max-age=120`.
- **Edit** `workers/fb-feed-read/src/index.ts`
  - Replace inline `Env` with the new import, delegate `fetch` to `fbFeedReadService.handleRequest`.

## Step 4 — Frontend island

Loose mirror of the existing `ContactForm` island layout (folder with
`*.svelte`, `*.service.ts`, `*Constants.ts`, `index.ts` barrel).

- **Edit** `site/src/util/globalConstants.ts`
  - Add `fbFeedReadWorkerUrl: import.meta.env.DEV ? 'http://localhost:8788' : 'https://aurora-fb-feed-read.agneuhold.workers.dev'` (port 8788 matches the read worker's wrangler `dev.port`).
- **New file** `site/src/components-svelte/FacebookFeed/facebookFeedConstants.ts`
  - User-facing copy: loading / error / empty messages.
- **New file** `site/src/components-svelte/FacebookFeed/FacebookFeed.service.ts`
  - Singleton, `async fetchFeed(): Promise<FetchFeedResult>` returning a discriminated `{ ok: true; data: WorkerFbFeedResponse } | { ok: false; message: string }`. Mirrors the `submit` shape in the contact form service.
- **New file** `site/src/components-svelte/FacebookFeed/FacebookFeed.svelte`
  - State: `status: 'loading' | 'ready' | 'error'`, `posts`, `errorMessage`.
  - `$effect` on mount calls the service once and updates state. No polling, no auto-refresh — `Cache-Control` and the cron handle freshness.
  - Markup: `<section>` with a heading, then `{#if status === 'loading'}` / `{:else if status === 'error'}` / `{:else}` `<ul>` of posts. Each post: optional `<img>` (loading="lazy"), the `message` text, and a "View on Facebook" `<a>` to `permalink`. Bare Tailwind utilities matching the site's existing token palette (`text-[color:var(--foreground)]`, `border-[color:var(--border)]`).
- **New file** `site/src/components-svelte/FacebookFeed/index.ts` — `export { default } from './FacebookFeed.svelte';` (same single-public-export pattern as `ContactForm`).
- **Edit** `site/src/pages/index.astro`
  - Import `FacebookFeed` and drop it into `<main>` between `<About />` and `<ContactForm />`. Use `client:visible` so it only hydrates and fetches when it scrolls into view — keeps initial paint untouched.

## Step 5 — Tests

Update the existing placeholder tests; keep coverage focused on behavior.

- `workers/fb-feed-sync/src/index.integration.test.ts`
  - Replace the lone 401 test with: 401 without bearer, 429 when rate-limited (skip if awkward inside the pool), 502 when Graph fetch fails (stub `globalThis.fetch`), 200 + KV write on a manual call with a valid bearer (assert the KV value parses as `WorkerFbFeedResponse`).
  - Add a `scheduled` test that drives the cron handler and asserts the KV write happened (the `@cloudflare/vitest-pool-workers` `cloudflare:test` `createScheduledController` covers this).
- `workers/fb-feed-sync/src/index.e2e.test.ts` — leave the unauthenticated 401 check; add nothing that hits the real Graph API.
- `workers/fb-feed-read/src/index.integration.test.ts`
  - Replace the 200-on-GET stub with: 405 on POST, 200 + empty payload when KV is empty, 200 + stored payload when KV is pre-seeded, `Cache-Control: public, max-age=120` header present.
- `workers/fb-feed-read/src/index.e2e.test.ts` — keep the e2e check; assert the response is JSON parseable as `WorkerFbFeedResponse`.
- `site/src/components-svelte/FacebookFeed/FacebookFeed.service.test.ts`
  - Stub `globalThis.fetch` and verify the discriminated result for ok / non-2xx / network throw.
- No `FacebookFeed.svelte` render test for now — the existing setup tests components elsewhere only when they have non-trivial logic, and this one is mostly markup.

## Validation (must pass before "done")

From the repo root:

- `pnpm lint --fix`
- `pnpm check`
- `pnpm test`

Optional smoke checks the repo doesn't require, but worth doing once:

- `pnpm dev` — confirm the island renders an empty state with the read
  worker running but no KV data yet.
- `curl -X POST -H "Authorization: Bearer $FB_MANUAL_SYNC_TOKEN" http://localhost:8789` — trigger a manual sync and re-load the page to see real posts.

## Trade-offs / open questions

- **Single KV key vs. per-post keys.** Picked a single `fb:feed:latest`
  blob because the read worker always serves the whole feed and the post
  count is tiny (≤10). Per-post keys would only matter if we needed
  individual post lookups, which we don't.
- **Image hosting.** `full_picture` URLs are Facebook-hosted with short
  signed query strings — they expire and re-image when the sync refreshes.
  Good enough for v1; if Facebook ever stops returning them reliably we
  can copy images into R2, but that's well outside this task.
- **`@aurora/shared` reuse in the sync worker.** Adding the shared dep
  pulls the contact form types in too. That's fine — the package is
  tree-shakeable types-only — but worth noting in case we ever split
  `@aurora/shared` per-feature.
- **Cron retry behavior.** `scheduled` handlers in Workers don't retry on
  throw the way queue consumers do. Letting the error bubble still gives
  Sentry the event; the next 30-minute tick is the retry. Acceptable for
  a feed of pub posts.

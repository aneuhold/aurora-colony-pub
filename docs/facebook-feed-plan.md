# Facebook Feed Implementation Plan

Two-worker pipeline + a Svelte island, as described in `docs/worker-details.md`:
`aurora-fb-feed-sync` writes Facebook posts to KV (cron + manual trigger);
`aurora-fb-feed-read` reads KV and serves them to the browser; the island
fetches the read worker and renders the posts.

The read worker, the frontend island, and the shared types / transform /
worker-helpers package are already in place. The read worker serves a
hardcoded mock payload when KV is empty so the frontend has something to
render. The Facebook account/console setup is done — the non-expiring Page
Access Token is minted and wired into the sync worker's secrets
(`FB_PAGE_ACCESS_TOKEN`, `FB_MANUAL_SYNC_TOKEN`) and local `.env`; the Page
ID lives as the `fbFeedSyncConstants.pageId` constant. Remaining work: fill
in the sync worker (Step 1), then retire the mock (Step 2).

## Step 1 — `fb-feed-sync` worker body

Today `workers/fb-feed-sync/src/index.ts` declares an inline `Env`,
rate-limits and bearer-checks `fetch`, and has an empty `scheduled`.
Mirror the contact worker's service split — `index.ts` stays trivial,
`services/*` does the work.

- **New file** `workers/fb-feed-sync/src/Env.ts`
  - Move the `Env` interface out of `index.ts`: `AURORA_COLONY_PUB_KV`,
    `RATE_LIMITER`, `FB_MANUAL_SYNC_TOKEN`, `FB_PAGE_ACCESS_TOKEN`. (No
    `FB_PAGE_ID` — the Page ID is a constant, see below.)
- **New file** `workers/fb-feed-sync/src/util/fbFeedSyncConstants.ts`
  - `kvKey: 'fb:feed:latest'` — must match `fbFeedReadConstants.kvKey`;
    the small duplication is deliberate (see the note in the read
    worker's constants file).
  - `pageId: '465497836965753'` — the pub's public Page ID. Public,
    stable, environment-invariant, so it lives here rather than as a secret.
  - `graphApiVersion: 'v21.0'`.
  - `fields: 'id,message,permalink_url,created_time,full_picture'` (Graph API field list).
  - `postLimit: 10` — keep KV blob small; we only render a handful.
- **New file** `workers/fb-feed-sync/src/services/FbGraphService.ts`
  - Singleton, `async fetchLatestPosts(env: Env): Promise<FbGraphPostsResponse>`.
  - Calls `GET https://graph.facebook.com/{version}/{pageId}/posts?fields=…&limit=…&access_token=…`,
    where `version`/`pageId` come from `fbFeedSyncConstants` and
    `access_token` is `env.FB_PAGE_ACCESS_TOKEN`.
  - Throws on non-2xx so the orchestrator can return a 502 / let Sentry
    capture it.
  - Returns the raw Graph response unchanged — the orchestrator hands it
    to `graphPostsToWorkerPosts` from `@aurora/shared`.
- **New file** `workers/fb-feed-sync/src/services/FbFeedSyncService.ts`
  - Singleton with two public methods:
    - `handleRequest(request: Request, env: Env): Promise<Response>` —
      `checkIpRateLimit` (from `@aurora/workers-shared`), require
      `Authorization: Bearer ${FB_MANUAL_SYNC_TOKEN}`, then call
      `syncFeed`. Return 200 on success, 502 on Graph failure.
    - `syncFeed(env: Env): Promise<void>` — calls
      `FbGraphService.fetchLatestPosts`, runs the result through
      `graphPostsToWorkerPosts`, wraps as `WorkerFbFeedResponse` with
      `syncedAt = new Date().toISOString()`, writes to KV under
      `fbFeedSyncConstants.kvKey`.
- **Edit** `workers/fb-feed-sync/src/index.ts`
  - Drop the inline `Env` and inline rate-limit/bearer logic; import `Env`
    from `./Env` and delegate `fetch` and `scheduled` to
    `fbFeedSyncService` (so `scheduled` calls `syncFeed` and surfaces
    errors so Sentry + cron retries see them).
- **Edit** `workers/fb-feed-sync/package.json`
  - Add `"@aurora/shared": "workspace:*"` to `dependencies` (already
    declared on the contact and fb-feed-read workers — same pattern).
- **Edit** `workers/fb-feed-sync/wrangler.jsonc`
  - Update the secrets comment block to list `FB_MANUAL_SYNC_TOKEN` and
    `FB_PAGE_ACCESS_TOKEN` (Page ID is a code constant, not a secret).
- **Edit** `workers/fb-feed-sync/src/index.integration.test.ts`
  - Replace the lone 401 test with: 401 without bearer, 429 when
    rate-limited (skip if awkward inside the pool), 502 when Graph fetch
    fails (stub `globalThis.fetch`), 200 + KV write on a manual call
    with a valid bearer (assert the KV value parses as
    `WorkerFbFeedResponse`), and a `scheduled` case that drives the cron
    handler and asserts the KV write happened
    (`@cloudflare/vitest-pool-workers`'s `createScheduledController`
    covers this).

## Step 2 — Retire the read worker's mock branch

On the day the sync worker starts writing to KV, the read worker's
`stored !== null` branch silently takes over and the mock assembly
becomes dead code. Delete it:

- **Delete** `workers/fb-feed-read/src/util/mockFbGraphResponse.ts`.
- **Delete** `site/public/fb-mock/` (`costume-party.jpg`,
  `fried-chicken.jpg`, `happy-hour.jpg`, `live-music.jpg`, `patio.jpg`).
- **Edit** `workers/fb-feed-read/src/services/FbFeedReadService.ts`
  - Drop the `buildMockFbGraphResponse` and `graphPostsToWorkerPosts`
    imports.
  - Replace the post-KV mock-assembly branch with a clean degraded
    response: `jsonResponse({ posts: [], syncedAt: null }, 200, { ...cors,
    'Cache-Control': fbFeedReadConstants.cacheControl })`.
    `FacebookFeed.svelte` already renders the `empty` status for that
    shape.
- **Edit** `workers/fb-feed-read/src/util/fbFeedReadConstants.ts`
  - Drop `defaultPhotoOrigin` (no more photo hosts to resolve).
- **Edit** `packages/shared/src/fbFeedTypes.ts`
  - Loosen `WorkerFbFeedResponse.syncedAt` from `string` to
    `string | null` so the empty-state response type-checks.
- **Edit** `workers/fb-feed-read/src/index.integration.test.ts`
  - Drop the three mock-branch cases ("returns 200 with the transformed
    mock payload", "anchors photo URLs at the allowlisted caller
    origin", "falls back to the default photo origin").
  - Add a "returns 200 with `{ posts: [], syncedAt: null }` when KV is
    empty" case in their place.

## Validation (must pass before "done")

From the repo root: `pnpm lint --fix`, `pnpm check`, `pnpm test`.

Smoke check after Step 1: `curl -X POST -H "Authorization: Bearer
$FB_MANUAL_SYNC_TOKEN" http://localhost:8789` to trigger a manual sync,
then reload the page — the read worker should now serve real KV-stored
posts instead of the mock.

## Trade-offs / open questions

- **Single KV key vs. per-post keys.** Picked a single `fb:feed:latest`
  blob because the read worker always serves the whole feed and the post
  count is tiny (≤10). Per-post keys would only matter if we needed
  individual post lookups, which we don't.
- **Image hosting.** `full_picture` URLs are Facebook-hosted with short
  signed query strings — they expire and re-image when the sync refreshes.
  Good enough for v1; if Facebook ever stops returning them reliably we
  can copy images into R2, but that's well outside this task.
- **Cron retry behavior.** `scheduled` handlers in Workers don't retry on
  throw the way queue consumers do. Letting the error bubble still gives
  Sentry the event; the next 30-minute tick is the retry. Acceptable for
  a feed of pub posts.

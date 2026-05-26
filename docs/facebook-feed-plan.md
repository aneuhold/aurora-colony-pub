# Facebook Feed Implementation Plan

Two-worker pipeline + a Svelte island, as described in `docs/worker-details.md`:
`aurora-fb-feed-sync` writes Facebook posts to KV (cron + manual trigger);
`aurora-fb-feed-read` reads KV and serves them to the browser; the island
fetches the read worker and renders the posts.

The read worker, the frontend island, and the shared types / transform /
worker-helpers package are already in place. The read worker serves a
hardcoded mock payload when KV is empty so the frontend has something to
render while we wait on the prequel below. Remaining work: fill in the
sync worker (Step 1), then retire the mock (Step 2).

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
   - **Business Portfolio**: connect to the freelance portfolio.
3. **System User + non-expiring Page Access Token**
   ([docs](https://developers.facebook.com/docs/business-management-apis/system-users/),
   [token generation](https://developers.facebook.com/docs/business-management-apis/system-users/install-apps-and-generate-tokens/))
   - In Business Settings → Users → **System Users** → Add. Type: Admin.
   - Add Assets → Pages → select the pub's Page → grant content/management
     access.
   - **Generate New Token** → pick the app from step 2 → select scopes
     `pages_show_list` + `pages_read_engagement` → **leave
     "Set token expiration" off** so it's non-expiring (the alternative is
     a 60-day expiring token; we don't want that). Copy the token now —
     it's only shown once.
   - From the Page's About section, copy the **Page ID**.
4. **Smoke-test the token before wiring secrets**
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
5. **Wrangler secrets** (sync worker only — the read worker doesn't talk to
   Facebook)
   - `pnpm --filter ./workers/fb-feed-sync exec wrangler secret put FB_PAGE_ID`
   - `pnpm --filter ./workers/fb-feed-sync exec wrangler secret put FB_PAGE_ACCESS_TOKEN`
6. **Local `.env`** — add `FB_PAGE_ID` and `FB_PAGE_ACCESS_TOKEN` so
   `wrangler dev --env-file ../../.env` picks them up locally (matches the
   pattern already used for `FB_MANUAL_SYNC_TOKEN`).

Open question worth flagging: System User tokens don't expire by time, but
they can still be invalidated — Page admin role removed, password reset on
an account tied to the System User, scope revocation, Meta security
intervention
([reference](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/debugging-and-error-handling)).
If the token ever breaks, the sync worker will start returning 5xx —
Sentry catches it and we re-mint from the Business Settings console. Not
building auto-refresh now.

## Step 1 — `fb-feed-sync` worker body

Today `workers/fb-feed-sync/src/index.ts` declares an inline `Env`,
rate-limits and bearer-checks `fetch`, and has an empty `scheduled`.
Mirror the contact worker's service split — `index.ts` stays trivial,
`services/*` does the work.

- **New file** `workers/fb-feed-sync/src/Env.ts`
  - Move the `Env` interface out of `index.ts`: `AURORA_COLONY_PUB_KV`,
    `RATE_LIMITER`, `FB_MANUAL_SYNC_TOKEN`, `FB_PAGE_ID`,
    `FB_PAGE_ACCESS_TOKEN`.
- **New file** `workers/fb-feed-sync/src/util/fbFeedSyncConstants.ts`
  - `kvKey: 'fb:feed:latest'` — must match `fbFeedReadConstants.kvKey`;
    the small duplication is deliberate (see the note in the read
    worker's constants file).
  - `graphApiVersion: 'v21.0'`.
  - `fields: 'id,message,permalink_url,created_time,full_picture'` (Graph API field list).
  - `postLimit: 10` — keep KV blob small; we only render a handful.
- **New file** `workers/fb-feed-sync/src/services/FbGraphService.ts`
  - Singleton, `async fetchLatestPosts(env: Env): Promise<FbGraphPostsResponse>`.
  - Calls `GET https://graph.facebook.com/{version}/{pageId}/posts?fields=…&limit=…&access_token=…`.
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
  - Update the secrets comment block to list `FB_MANUAL_SYNC_TOKEN`,
    `FB_PAGE_ID`, `FB_PAGE_ACCESS_TOKEN`.
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

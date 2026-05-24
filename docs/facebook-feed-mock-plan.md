# Facebook Feed Placeholder Plan

The full Facebook Graph API integration (`docs/facebook-feed-plan.md`) is
blocked on the pub's Page access being approved into our business portfolio.
Until that lands we ship a wholesome, on-brand placeholder right now: the
already-deployed `aurora-fb-feed-read` worker returns mock posts that match
Graph API shape, a new Svelte island consumes them through the same wire
contract the real flow will use, and the front page is reordered so the feed
sits where regulars expect it — directly under the hero.

When the real Graph access lands, follow the real plan and delete the mock —
**wire format, transform helper, island, section, and design carry over
unchanged.** Only the data source swaps.

## Design call

Modern-rustic, restraint-first. **It does not look like Facebook.** It looks
like the rest of the pub site.

- **Section slot**: directly under the hero. Reordered home page:
  `Hero → FacebookFeed → TodayStrip → MenuTeaser → PatioCallout → Gallery →
  AboutTeaser`. The hero already carries `OpenNowChip` + today's hours, so
  demoting `TodayStrip` by one slot does not bury "are you open right now."
- **Look**: editorial post cards in a 3-up grid (1-up mobile). No FB-blue, no
  like/comment chrome, no logo washes. Reads as a wall-mounted bulletin
  board — paper background, `border-foreground/10`, no shadows. Same
  `hover:-translate-y-1 duration-snap ease-soft` lift as the `MenuTeaser`
  tiles so the page stays coherent.
- **Card anatomy**: 4:3 photo → eyebrow timestamp in `font-display uppercase
  tracking-[0.18em] text-foreground/60` (matches `TodayStrip` eyebrows) →
  3-line `line-clamp` message in `text-foreground/80` → "Read on Facebook →"
  inline link in `text-primary`. Image-less posts render cleanly without a
  placeholder block — eyebrow + message + link only.
- **Section header**: `<Heading level={2}>Lately at the pub.</Heading>` on
  the left, `Follow on Facebook →` link on the right (small primary-amber
  anchor, same eyebrow type treatment). Avoids saying "Facebook" twice — the
  heading speaks the pub's voice, the right-side anchor handles the
  platform-y bit.
- **Color budget**: stays inside tokens. Card border = `border-foreground/10`,
  hover border = `border-foreground/20`. Background = the paper. Primary
  amber only on the two "Facebook" anchors. No new color tokens.
- **Motion**: `.reveal` on entry (existing scroll-driven token), `duration-snap`
  hover lift. No carousels, no parallax.

## Mock-data architecture

The mock pretends to be Facebook all the way down to the Graph API response
shape so the real swap is a one-line change.

- **Wire contract** (same as real plan): `WorkerFbFeedResponse =
  { posts: WorkerFbFeedPost[]; syncedAt: string }`. Lives in `@aurora/shared`
  so the island and the worker import the same type.
- **Mock Graph response inline in the read worker**: a single exported
  literal matching the real `GET /{page-id}/posts?fields=id,message,
  permalink_url,created_time,full_picture&limit=10` response
  ([Graph Pages API ref](https://developers.facebook.com/docs/graph-api/reference/page/feed)).
  Fields per post: `id` (page-id underscore post-id), `message` (string,
  occasionally missing), `permalink_url` (full `https://www.facebook.com/...`
  URL pointing at the real pub Facebook page so clicks land somewhere real),
  `created_time` (ISO 8601 with `+0000` offset — Graph's actual format),
  `full_picture` (https URL, optional).
- **Transform is real code, not part of the mock**: a
  `graphPostsToWorkerPosts(data: FbGraphPostsResponse): WorkerFbFeedPost[]`
  helper that the read worker calls on the mock literal. Same helper the
  eventual sync worker will call on real Graph data. Tested directly in
  isolation.
- **Photo URLs**: six representative JPEGs copied from `site/src/assets/
  gallery/` into `site/public/fb-mock/` so they have stable, unhashed URLs
  (`https://auroracolonypub.com/fb-mock/<name>.jpg`). The worker emits
  absolute URLs, matching FB CDN behaviour. Local dev loads from the
  production URL — fine, the photos are checked in and will not drift.
- **No sync worker work right now**: the existing `aurora-fb-feed-sync`
  skeleton stays untouched. It cannot do anything useful without Page
  access, and writing speculative code against an unapproved API contract
  is wasted effort. The real plan covers it end-to-end once access lands.

## Step 1 — Shared types + transform (`packages/shared`)

- **New file** `packages/shared/src/fbFeedTypes.ts`
  - `FbGraphPost` — Graph-shape post:
    `{ id: string; message?: string; permalink_url: string; created_time: string; full_picture?: string }`.
  - `FbGraphPostsResponse` —
    `{ data: FbGraphPost[]; paging?: { cursors?: { before?: string; after?: string }; next?: string } }`.
    `paging` is optional so the mock literal does not need to fabricate
    cursor strings the frontend never reads.
  - `WorkerFbFeedPost` —
    `{ id: string; message: string; permalink: string; createdAt: string; imageUrl?: string }`.
  - `WorkerFbFeedResponse` —
    `{ posts: WorkerFbFeedPost[]; syncedAt: string }`.
- **New file** `packages/shared/src/fbFeedTransform.ts`
  - `graphPostsToWorkerPosts(data: FbGraphPostsResponse): WorkerFbFeedPost[]`.
  - Strict mapping: `message ?? ''`, `imageUrl` only set when `full_picture`
    present, `permalink` from `permalink_url`, `createdAt` from `created_time`.
  - Drops unknown fields. Pure function — no env, no fetch.
- **Edit** `packages/shared/src/index.ts` — add
  `export * from './fbFeedTypes';` and
  `export * from './fbFeedTransform';`.

## Step 2 — `aurora-fb-feed-read` worker body

Service-split pattern matching the contact worker. Read-only, public,
CORS-allowlisted.

- **New file** `workers/fb-feed-read/src/Env.ts`
  - `AURORA_COLONY_PUB_KV`, `RATE_LIMITER`. Re-export of the inline `Env`
    in the current `index.ts`.
- **New file** `workers/fb-feed-read/src/util/fbFeedReadConstants.ts`
  - `kvKey: 'fb:feed:latest'` — same key the eventual sync worker writes,
    so the read worker can lift over to KV-backed data with zero edits.
  - `allowedOrigins` — duplicate of `contactWorkerConstants.allowedOrigins`
    (small duplication, do not extract a shared module yet — two workers).
  - `cacheControl: 'public, max-age=120'`.
- **New file** `workers/fb-feed-read/src/util/mockFbGraphResponse.ts`
  - Single exported `mockFbGraphResponse: FbGraphPostsResponse` literal.
  - **Six posts** spanning the last ~3 weeks. Voice matches the menu
    ("A Pub Favorite", "We've got 'em chewy", "Just like grandma used to
    make"). Topics: live music tonight, fried-chicken Friday, patio
    reopened for the season, happy-hour reminder, costume-party recap,
    one text-only "closed for Thanksgiving" announcement.
  - Five posts include `full_picture`, one omits it to exercise the
    no-image path.
  - Each `permalink_url` points at the pub's real Facebook page
    (`https://www.facebook.com/theauroracolonypub/`) — cheaper than
    fabricating fake story IDs and produces a real working click
    destination.
  - `created_time` strings use the Graph format
    (`2026-05-22T19:30:00+0000`, UTC).
  - Comment block above the literal explains this is the placeholder and
    points at `docs/facebook-feed-plan.md` for the swap-out path.
- **New file** `workers/fb-feed-read/src/services/FbFeedReadService.ts`
  - Singleton, `async handleRequest(request: Request, env: Env): Promise<Response>`.
  - CORS preflight + origin echoing helpers lifted from `ContactService`
    (`isAllowedOrigin`, `corsHeaders`, `jsonResponse` — do not extract a
    shared module yet, two small workers).
  - Reject methods other than `GET` / `OPTIONS`.
  - IP rate-limit via `env.RATE_LIMITER.limit({ key: ip })`.
  - Read order:
    1. `await env.AURORA_COLONY_PUB_KV.get<WorkerFbFeedResponse>(kvKey, 'json')`.
       If non-null, return it verbatim (the day the sync worker starts
       writing real posts, this branch silently takes over).
    2. Otherwise transform `mockFbGraphResponse` via
       `graphPostsToWorkerPosts`, wrap as
       `{ posts, syncedAt: new Date().toISOString() }`, return.
  - `Cache-Control: public, max-age=120` on both branches.
- **Edit** `workers/fb-feed-read/src/index.ts`
  - Replace the inline `Env` with the import from `./Env`.
  - Delegate `fetch` to `fbFeedReadService.handleRequest`.
- **Edit** `workers/fb-feed-read/package.json` — add
  `"@aurora/shared": "workspace:*"` to `dependencies` (matches the
  contact worker pattern).
- **Edit** `workers/fb-feed-read/wrangler.jsonc` — no changes needed
  (KV + rate-limit bindings already configured).

## Step 3 — Frontend island

Folder pattern mirrors `ContactForm` — `*.svelte`, `*.service.ts`,
`*Constants.ts`, `index.ts` barrel.

- **Edit** `site/src/util/globalConstants.ts`
  - Add `fbFeedReadWorkerUrl: import.meta.env.DEV ? 'http://localhost:8788'
    : 'https://aurora-fb-feed-read.agneuhold.workers.dev'`. Port 8788
    matches the read worker's `dev.port`.
- **New file** `site/src/components-svelte/FacebookFeed/facebookFeedConstants.ts`
  - User-facing copy: loading skeleton count (3), empty-state line, error
    line, follow-link label.
  - Relative-time thresholds for `formatRelativeTime` (just-now cutoff,
    minute / hour / day breakpoints, switch-to-absolute-date threshold).
- **New file** `site/src/components-svelte/FacebookFeed/FacebookFeed.service.ts`
  - Singleton.
  - `async fetchFeed(): Promise<FetchFeedResult>` where `FetchFeedResult`
    is a discriminated union
    `{ ok: true; data: WorkerFbFeedResponse } | { ok: false; message: string }`.
    Mirrors `ContactForm.service.submit`. Handles non-2xx and network
    throws separately.
  - `formatRelativeTime(iso: string, now?: Date): string` — pure helper.
    "just now" / "12m ago" / "3h ago" / "2d ago", then switches to
    `MMM d` once past ~14 days. Tested directly.
- **New file** `site/src/components-svelte/FacebookFeed/FacebookFeed.svelte`
  - Runes: `status: 'loading' | 'ready' | 'error' | 'empty'`,
    `posts: WorkerFbFeedPost[]`, `errorMessage: string`.
  - `$effect` on mount → call `fetchFeed` once. No polling, no auto-refresh —
    worker `Cache-Control` and the eventual cron handle freshness.
  - Loading: 3 skeleton cards (`bg-foreground/5 animate-pulse` on a 4:3 box
    plus two `h-3` bars). Tailwind's built-in `animate-pulse` is fine — no
    new motion token.
  - Empty / error: single paragraph + the "Follow on Facebook →" link so
    the section never looks broken.
  - Ready: `<ul>` grid
    `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`. Each item is
    an `<a href={post.permalink} target="_blank" rel="noopener noreferrer">`
    wrapping an `<article>`:
    - `<figure>` (only when `post.imageUrl`): `<img>` with `loading="lazy"`,
      `alt=""` (decorative — see trade-offs), `aspect-[4/3] w-full
      object-cover`.
    - Eyebrow `<time>`: `font-display text-sm uppercase tracking-[0.18em]
      text-foreground/60`, content = `formatRelativeTime(post.createdAt)`.
    - Message `<p>`: `mt-2 text-foreground/80 leading-relaxed line-clamp-3`.
    - Read-more affordance: inline `<span class="text-primary">Read on
      Facebook →</span>` at the bottom of the card.
    - Card chrome: `block rounded-lg border border-foreground/10
      bg-background overflow-hidden transition-[transform,border-color]
      duration-snap ease-soft hover:-translate-y-1
      hover:border-foreground/20 reveal`.
  - `aria-label="Latest from our Facebook page"` on the wrapping `<section>`
    inside the island (Astro wrapper supplies the `<h2>`).
- **New file** `site/src/components-svelte/FacebookFeed/index.ts`
  - `export { default } from './FacebookFeed.svelte';` (single-public-export
    barrel, same as `ContactForm`).

## Step 4 — Front-page integration

- **New file** `site/src/components-astro/FacebookFeedSection.astro`
  - Thin Astro wrapper. Owns the section heading row + container so the
    island stays focused on the post list and is reusable.
  - `<Section>` (default padding, default background) → `<Container size="wide">`.
  - Header row: `<div class="flex flex-wrap items-baseline justify-between
    gap-3">` containing `<Heading level={2}>Lately at the pub.</Heading>`
    left and a `Follow on Facebook →` anchor right (
    `font-display text-sm uppercase tracking-[0.18em] text-primary
    underline-offset-4 hover:underline`,
    `target="_blank" rel="noopener noreferrer"`,
    href = `https://www.facebook.com/theauroracolonypub/`).
  - Below the header: `<FacebookFeed client:visible />` — hydrate + fetch
    only when scrolled into view, keeps initial paint untouched.
- **Edit** `site/src/pages/index.astro`
  - Import the new section component.
  - Reorder `<main>`:
    ```astro
    <Hero ... />
    <FacebookFeedSection />
    <TodayStrip />
    <MenuTeaser />
    <PatioCallout />
    <Gallery limit={9} />
    <AboutTeaser />
    ```

## Step 5 — Mock photos

- **New folder** `site/public/fb-mock/` — six images copied (not moved)
  from `site/src/assets/gallery/`:
  - `live-music.jpg` ← `event-live-music-band.jpg`
  - `fried-chicken.jpg` ← `food-fried-chicken.jpg`
  - `patio.jpg` ← `patio-outdoor-dining.jpg`
  - `happy-hour.jpg` ← `drink-beer-tap.jpg`
  - `costume-party.jpg` ← `event-costume-party.jpg`
  - (sixth post is text-only; no image file required)
- Names are descriptive so URLs read sensibly in DevTools when debugging.
- Already compressed JPEGs; no further processing. Note in code review if
  any single file lands above ~250 KB — recompress before merge.

## Step 6 — Tests

- **`packages/shared/src/fbFeedTransform.test.ts`** (new)
  - All fields present → straight 1:1 mapping including `imageUrl`.
  - `message` missing → empty string.
  - `full_picture` missing → `imageUrl` is `undefined` (assert with
    `'imageUrl' in result` plus value check).
  - Empty `data` → empty `posts` array.
- **`workers/fb-feed-read/src/index.integration.test.ts`** (replace the
  current 200-stub test)
  - 200 + transformed mock payload on `GET` when KV is empty; assert post
    count matches `mockFbGraphResponse.data.length`.
  - 200 + stored KV payload on `GET` when KV pre-seeded with a valid
    `WorkerFbFeedResponse`; assert the response is the KV blob verbatim.
  - 405 on `POST`.
  - 429 when the rate-limit binding returns `success: false`.
  - `Cache-Control: public, max-age=120` header on success.
  - Allowed-origin CORS header echoed; disallowed origin gets 403.
- **`workers/fb-feed-read/src/index.e2e.test.ts`** — keep the existing
  unauthenticated 200 check; tighten the assertion so the body parses as
  `WorkerFbFeedResponse` and has a non-empty `posts` array (mock guarantees
  this).
- **`site/src/components-svelte/FacebookFeed/FacebookFeed.service.test.ts`**
  (new)
  - Happy path: stub `globalThis.fetch` → ok JSON.
  - Non-2xx → `{ ok: false }` with the constants' server-error message.
  - Network throw → `{ ok: false }` with the constants' network-error
    message.
  - `formatRelativeTime` table-driven: just-now / minute / hour / day /
    week boundaries, plus the absolute-date fallback past the threshold.
- No `FacebookFeed.svelte` render test — markup-heavy, low logic, mirrors
  the existing convention (no `ContactForm.svelte` render test either,
  beyond the contact form's existing one).

## Step 7 — File hygiene

- This (placeholder) plan lives at `docs/facebook-feed-mock-plan.md`.
- The real-Facebook integration plan lives at `docs/facebook-feed-plan.md`
  — unchanged content. The first paragraph here links to it. When Page
  access lands, follow that plan and delete the mock literal + this
  document.

## Validation (must pass before "done")

From the repo root:

- `pnpm lint --fix`
- `pnpm check`
- `pnpm test`

Manual designer smoke:

- Start `pnpm dev` (ask the user to start it — do not start the dev
  server unattended), navigate to `/`, confirm six cards render with
  photos and the eyebrow timestamps look plausible.
- Run Playwright `browser_snapshot` on `/` and confirm the section is a
  reachable landmark with an `<h2>` and a labelled "Follow on Facebook"
  link.
- Resize to mobile width — cards stack to a single column, no horizontal
  overflow, image aspect stays 4:3.

## Trade-offs / open questions

- **Image alt text.** The real Graph `/posts` response does not carry alt
  text — Facebook users typically do not author it, and Graph does not
  surface descriptions. Mock images ship `alt=""` to match the real path
  (decorative; message text carries the meaning). If accessibility ever
  outweighs format fidelity, add `imageAlt?: string` to `WorkerFbFeedPost`
  and a per-post alt to the mock literal; the real flow stays alt-less
  until we add a second Graph call to the Photos endpoint. Logged, not
  fixed.
- **Photos in `site/public/`.** Skips Astro's image optimisation — they
  ship at original size. The chosen six are already compressed JPEGs from
  the gallery folder, so the cost is small. Worth re-checking once the
  files are in.
- **Section heading copy.** "Lately at the pub." is a designer call —
  feels right with the menu voice and avoids saying "Facebook" twice
  (the right-side anchor already does). Open to "Lately on Facebook,"
  "From the page," or "What's new" if the owner prefers something more
  literal.
- **Front-page reorder.** Moving `TodayStrip` below the feed slightly
  demotes the "are you open right now" answer, but the hero's
  `OpenNowChip` + "Today HH:MM – HH:MM" line already answers it inside
  the first viewport. Feed gets the prominence regulars asked for;
  practical info is one short scroll away.
- **Worker mock vs real Graph payload shape.** The mock literal omits
  `paging.cursors` (declared optional). A real Graph response always
  includes them; keeping them optional keeps the test suite loose on a
  field the frontend never reads.
- **Gallery on the home page.** Considered trimming `limit={9}` to 6 to
  lighten visual weight now that the FB feed adds another photo-heavy
  section. Left at 9 for v1 — easier to retune once we see the cards in
  context.
- **Permalink URLs all point at the page root.** Real Graph posts have
  unique permalinks like `/permalink.php?story_fbid=...&id=...`.
  Fabricating those introduces fake state we'd have to remember to delete.
  Pointing every mock card at the page root is honest about the mock and
  still lands the user on a real, useful destination.

# Move CMS media to R2

Move all CMS-managed inline images out of git into a Cloudflare R2 bucket.
Sveltia uploads directly to R2 using its built-in R2 mode; we deliver the R2
secret to the browser via a new authenticated endpoint on the existing
`cms-auth` Worker (so the dev never types a credential, but the same
bucket-scoped secret that Sveltia would otherwise prompt for is dropped into
Sveltia's `localStorage` automatically after a successful GitHub OAuth).
Astro consumes the remote images at build time using the documented
`remotePatterns` allowlist; the on-disk asset cache covers local dev. Logos,
icons, favicons, the OG image, and the FB-mock fixtures stay in git.

## Why this shape

Two facts pin the design:

1. **Sveltia has no custom-endpoint API.** The Sveltia docs explicitly state
   "Sveltia CMS does not support the undocumented custom media storage
   provider API" and "The `CMS.registerMediaLibrary` method is a noop". So we
   cannot proxy uploads through our own Worker — Sveltia must talk directly
   to R2 over the S3 protocol. See
   [Sveltia Media Storage overview](https://sveltiacms.app/en/docs/media).
2. **Sveltia's R2 mode wants the secret in browser `localStorage`.** Per
   [the Sveltia R2 doc](https://sveltiacms.app/en/docs/media/cloudflare-r2),
   the Secret Access Key "should be kept confidential and not exposed in
   client-side code", so it goes through a browser prompt and lives in
   `localStorage`. The Access Key ID goes in `config.yml`.

We don't want the dev (currently the only allowlisted GitHub user; the pub
owner will join later) to ever paste a key. So we keep Sveltia's R2 mode but
**deliver the secret to `localStorage` programmatically**, gated by the
existing GitHub OAuth flow. The secret is a permanent R2 API token narrowly
scoped to one bucket (R2 doesn't support session tokens in a way Sveltia can
consume — Sveltia's R2 config has no `session_token` field).

## Astro features this plan uses — docs links

- [Authorizing remote images](https://docs.astro.build/en/guides/images/#authorizing-remote-images)
  — explains the `image.domains` / `image.remotePatterns` allowlists. **What
  this actually does:** Astro only runs remote URLs through its image
  optimizer (Sharp, build-time fetch → hashed output in `dist/_astro/`) when
  the URL's host matches an entry in one of these allowlists. If a remote URL
  is *not* allowlisted, `<Image />` still renders it (so the page won't break)
  but it is **not** fetched or optimized — Astro just passes the URL through
  as-is. Allowlisting our R2 public host is what flips on the "pull and
  optimize at build time" behaviour we want.
- [`image.remotePatterns`](https://docs.astro.build/en/reference/configuration-reference/#imageremotepatterns)
  — config-reference for the allowlist. Pattern objects match by `protocol`,
  `hostname`, and `pathname`. We'll pin to one exact host with `https`.
- [`image.domains`](https://docs.astro.build/en/reference/configuration-reference/#imagedomains)
  — the simpler sibling: hostname strings, no wildcards. Either works for one
  host; `remotePatterns` is more explicit about protocol so we'll use it.
- [Remote images in content collections](https://docs.astro.build/en/guides/images/#images-in-content-collections)
  — the docs say the `image()` schema helper is **local paths only**. For
  remote URLs the documented pattern is a plain string schema (`z.url()`)
  passed to `<Image src={…} />`.
- [`<Image />` component](https://docs.astro.build/en/guides/images/#image--astroassets)
  — the component that triggers optimization. Already used everywhere in
  this codebase; the only call-site change is `inferSize` (or explicit
  `width`/`height`) for remote sources.
- [`output: 'static'` build behaviour](https://docs.astro.build/en/reference/configuration-reference/#output)
  — confirms image optimization for allowlisted remotes happens at build
  time, which is what we want for the Cloudflare Pages static deploy.
- [Astro asset cache](https://docs.astro.build/en/guides/images/#caching) —
  Astro caches fetched + optimized outputs under `node_modules/.astro/`.
  This is what makes local dev work after the first request: subsequent
  `astro dev` sessions don't re-download from R2.

## Scope summary

| Concern | Today | After |
| --- | --- | --- |
| Where CMS images live | `site/src/assets/{gallery,menus,about}/*` (git) | R2 bucket `aurora-colony-pub-media`, keys `gallery/…`, `menus/…`, `about/…` |
| How they're uploaded | Sveltia → GitHub commit (binary blob in repo) | Sveltia's built-in R2 mode → direct S3 PUT to R2 |
| How upload is authorized | Implicit (GitHub OAuth → commit) | R2 access key ID in `config.yml`, secret delivered to `localStorage` by `cms-auth` after the existing GitHub OAuth flow |
| How Astro consumes them | Local file via `image()` schema | Remote URL via `z.url()` schema + `image.remotePatterns` allowlist; Astro fetches + caches under `node_modules/.astro/` |
| Local dev | Files on disk | Astro fetches once from the public host, then re-uses the on-disk cache (no R2 keys locally) |
| Logos / icons / favicon / OG / fb-mock | git | git (unchanged) |

## Architectural decisions

1. **No new Worker.** Extend the existing `cms-auth` Worker with one endpoint
   that hands the bucket-scoped R2 secret to authenticated callers.
2. **Sveltia uses its native R2 mode.** Configured per
   [Sveltia's R2 doc](https://sveltiacms.app/en/docs/media/cloudflare-r2),
   with the Access Key ID in `config.yml` and the Secret Access Key
   pre-populated into `localStorage` by a small bridge script on the admin
   shell.
3. **Auth for the secret-fetch is the GitHub access token Sveltia already
   holds.** The new endpoint re-verifies the token against GitHub `/user`
   and the existing `isUserAllowed` allowlist.
4. **Astro image pipeline** = `z.url()` schemas + `image.remotePatterns` + the
   existing `<Image />` call sites with `inferSize` added.
5. **One-shot migration script** uploads the 35 existing images, rewrites
   the content JSON, removes the local copies.

---

## Step 1 — R2 bucket, public host, CORS, scoped API token

Ops-side work (not files in the repo, but document in
`docs/cloudflare-token-setup.md`):

- Create bucket: `pnpm wrangler r2 bucket create aurora-colony-pub-media`.
- Configure the public custom domain `media.auroracolonypub.aneuhold.dev`
  via Cloudflare's R2 custom-domain feature.
- Configure CORS on the bucket (per Sveltia's R2 doc verbatim, plus the
  `dev` origin):
  ```json
  [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedOrigins": [
        "https://aurora-colony-pub-frontend.pages.dev",
        "https://auroracolonypub.com",
        "http://localhost:4321"
      ],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
  ```
  (Pin the actual production origin once DNS flips.)
- Create an [R2 API token](https://developers.cloudflare.com/r2/api/tokens/)
  with **Object Read & Write** scoped to **only** `aurora-colony-pub-media`.
  Record the Access Key ID + Secret Access Key.
- Store both on the `cms-auth` Worker as secrets:
  `wrangler secret put R2_MEDIA_ACCESS_KEY_ID` (in `workers/cms-auth`),
  `wrangler secret put R2_MEDIA_SECRET_ACCESS_KEY`.
- Document the bucket name + public host in `README.md`'s infra section.

Trade-off: a custom domain takes a few minutes but avoids hard-coding the
`pub-…r2.dev` URL into every content JSON file. Worth it.

## Step 2 — `cms-auth` gains a `GET /r2-credentials` endpoint

Files:

- `workers/cms-auth/src/Env.ts` — add `R2_MEDIA_ACCESS_KEY_ID: string` and
  `R2_MEDIA_SECRET_ACCESS_KEY: string`.
- `workers/cms-auth/src/services/AuthService.ts` — add a third route:
  ```
  GET /r2-credentials
  ```
  Implementation:
  - Read `Authorization: Bearer <gh_token>` from the request.
  - Reuse `gitHubOAuthService.fetchUserLogin(token)`; return `401` if
    missing/invalid, `403` if `isUserAllowed(login)` is false.
  - Return `{ accessKeyId: env.R2_MEDIA_ACCESS_KEY_ID, secretAccessKey:
    env.R2_MEDIA_SECRET_ACCESS_KEY }` as JSON, with CORS headers
    (`Access-Control-Allow-Origin` matched against the existing allowed
    origins list — re-use `allowedOrigins` from `@aurora/workers-shared`).
  - Cache-Control: `no-store`. This is a secret being shipped to the browser.
- Add the existing `RATE_LIMITER` call (already in `index.ts`) — no change
  needed there.
- `workers/cms-auth/wrangler.jsonc` — update the secrets comment block to
  list the two new secrets.
- Tests: extend `workers/cms-auth/src/index.integration.test.ts` (or the
  service-level test if one exists) with:
  - happy path: valid GH token + allowlisted login → 200 + JSON body.
  - missing `Authorization` → 401.
  - GitHub `/user` returns a non-allowlisted login → 403.
  - GitHub `/user` returns 401 → 401.
  - `OPTIONS` preflight returns the right CORS headers.

The `/auth` + `/callback` routes and Sveltia `postMessage` contract are
untouched.

## Step 3 — Credential bridge in the admin shell

Files:

- `site/src/pages/admin/index.astro` — extend the inline script:
  - Before calling `init()`, look for the GitHub access token Sveltia caches
    (pin the exact `localStorage` key by reading
    `node_modules/@sveltia/cms/src/...` during implementation; document the
    key inline).
  - If absent → `init()` as today (user hasn't logged in yet).
  - If present → `fetch(`${BASE_URL}/r2-credentials`, { headers: {
    Authorization: `Bearer ${ghToken}` } })`, then write the returned
    `accessKeyId` and `secretAccessKey` to the Sveltia-known
    `localStorage` keys for `cloudflare_r2` (also pinned from the Sveltia
    source during implementation), then `init()`.
  - After a fresh login, re-run the same bridge once on the next admin page
    load (cheapest robust path; avoids hooking Sveltia's internal auth
    completion).
  - `BASE_URL` = `https://aurora-cms-auth.agneuhold.workers.dev` in
    production, `http://localhost:8790` when `import.meta.env.DEV`.
- No new files. No npm deps. ~30 lines of TS in the existing admin shell.

Failure modes to handle: if the `/r2-credentials` fetch returns 401/403 (e.g.
the GH token expired), clear any stale Sveltia R2 keys from `localStorage`
and fall through to `init()` so Sveltia re-prompts for login.

The bridge depends on two internal Sveltia `localStorage` key names that
could in principle change between releases. We're **not** pinning Sveltia
or adding a CI check — just put a clear comment above the two key constants
in the bridge that says something like:

```ts
// These two keys are internal to @sveltia/cms. If image uploads stop
// working after a Sveltia upgrade, check that the key names below still
// match what Sveltia reads — see node_modules/@sveltia/cms/src/...
const SVELTIA_GH_TOKEN_KEY = '...';
const SVELTIA_R2_ACCESS_KEY_ID_KEY = '...';
const SVELTIA_R2_SECRET_ACCESS_KEY_KEY = '...';
```

If a future Sveltia bump silently changes a key, the bridge will degrade
gracefully (Sveltia will fall back to prompting the dev for the secret).

## Step 4 — Sveltia config switch to R2

Files:

- `site/public/admin/config.yml`:
  - Add the top-level `media_libraries` block per the Sveltia R2 doc:
    ```yaml
    media_libraries:
      default:
        name: cloudflare_r2
      cloudflare_r2:
        account_id: <cloudflare-account-id>
        bucket: aurora-colony-pub-media
        public_url: https://media.auroracolonypub.aneuhold.dev
        access_key_id: <r2-token-access-key-id>
    ```
    (`account_id` and `access_key_id` are non-secret; safe to commit.
    `secret_access_key` is **not** here — Sveltia reads it from
    `localStorage`, which the bridge populates.)
  - Replace the top-level `media_folder: site/src/assets` / `public_folder: /`
    defaults with empty strings (URLs are absolute now).
  - Remove the per-collection `media_folder` / `public_folder` overrides
    from `about`, `menuImages`, and `gallery`.
  - Optionally add per-widget `prefix` so each collection writes to a
    different R2 folder — `gallery/`, `menus/`, `about/`. (Sveltia's R2 config
    supports a `prefix`; confirm the per-widget override syntax during
    implementation. Fallback: store everything at the bucket root and let the
    filenames namespace.)
  - Set [`max_file_size`](https://sveltiacms.app/en/docs/media#configuration)
    to `10485760` (10 MB) on the `media` block — guards against accidental
    huge originals. Sveltia enforces this client-side before the PUT.

No changes needed to the JSON content schemas in `config.yml` — the `image`
widget keeps working; it just stores a URL string instead of a relative path.

## Step 5 — Astro: switch the content pipeline to remote URLs

Files:

- `site/astro.config.ts` — add an
  [`image`](https://docs.astro.build/en/reference/configuration-reference/#image-options)
  block:
  ```ts
  image: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.auroracolonypub.aneuhold.dev' }
    ]
  }
  ```
  Single, hard-coded, https-only host. Without this entry, `<Image />` would
  still render the R2 URLs but would **not** fetch + optimize them — they'd
  pass through unprocessed. See
  [Authorizing remote images](https://docs.astro.build/en/guides/images/#authorizing-remote-images).
- `site/src/content.config.ts` — change `gallery.photo` and
  `menuImages.image` from `image()` to `z.url()`. The
  [`image()` helper is local-only](https://docs.astro.build/en/guides/images/#images-in-content-collections).
  Switching to a URL schema is the documented pattern. The site's components
  already pass these values straight to `<Image src={…} />`, so no consumer
  change is needed — but the TypeScript type of `entry.data.photo` / `.image`
  flips from `ImageMetadata` to `string`. Spot-check that nothing reads
  `.width` / `.height` / `.format` off the value (a quick grep over
  `Gallery.astro`, `MenuDisplay.astro`, `MenuTeaser.astro` during
  implementation).
- Content collection JSON files (`site/src/content/gallery/*.json`,
  `site/src/content/menu-images/*.json`) — `photo` / `image` fields change
  from `../../assets/gallery/foo.jpg` to
  `https://media.auroracolonypub.aneuhold.dev/gallery/foo.jpg`. Done by the
  migration script (step 7).
- Components that consume those entries (`Gallery/Gallery.astro`,
  `Menu/MenuDisplay.astro`, `Menu/MenuTeaser.astro`) — `<Image />` requires
  `width` + `height` (or `inferSize: true`) for remote sources because Astro
  can't infer dimensions from a path on disk. See
  [`<Image />` props for remote images](https://docs.astro.build/en/guides/images/#image--astroassets).
  Add `inferSize` (Astro fetches the image once at build to read its size)
  to each `<Image />` call site that consumes a CMS-driven URL; the
  optimized output is still hashed into `dist/_astro/`.
- `about.md` inline images use full URLs
  (`![…](https://media.auroracolonypub.aneuhold.dev/about/…)`). Astro's
  [Markdown image processing](https://docs.astro.build/en/guides/images/#images-in-markdown-files)
  auto-runs allowlisted remote URLs through `astro:assets`. No code change.
- Site `og-image.png`, logos, icons — left as-is in `site/public/` and
  `site/src/assets/`.

Local dev story (the [Astro-documented](https://docs.astro.build/en/guides/images/#caching)
flow):

- `astro dev` lazily fetches each referenced remote image on first request
  and stores the optimized output under `node_modules/.astro/`.
- `astro build` fetches anything not yet cached, optimizes via Sharp, emits
  hashed outputs into `dist/_astro/`.
- The cache lives under `node_modules`, so it's gitignored already. No R2
  API keys or `wrangler` login is needed locally for reads — every dev box
  talks to the public HTTPS host.

## Step 6 — Delete the local CMS image folders

After the migration script (step 7) finishes and the JSON diff has been
eyeballed, `git rm -r` the three folders:

- `site/src/assets/gallery/`
- `site/src/assets/menus/`
- `site/src/assets/about/`

No `.gitignore` entries needed — the folders simply cease to exist in the
repo.

## Step 7 — One-shot migration script

New file: `scripts/migrate-media-to-r2.ts` (matches existing
`scripts/generate-logos.ts` style — top-level TypeScript executed via `tsx`).

Behaviour:

1. Walks `site/src/assets/gallery/`, `site/src/assets/menus/`, and
   `site/src/assets/about/` (latter currently empty — handle gracefully).
2. For each file, uploads to R2 via `wrangler r2 object put` (shell out)
   under the key `<folder>/<basename>` with the right `--content-type`.
   Wrangler authentication uses the developer's existing `wrangler login`;
   no Worker auth is needed for a one-time migration.
3. After all uploads succeed, rewrites every JSON file under
   `site/src/content/gallery/` and `site/src/content/menu-images/`:
   replaces the `photo` / `image` field's relative path with the public
   R2 URL.
4. Rewrites any `![alt](relative)` references in `site/src/content/about.md`
   (none today, but cover for completeness).
5. Prints a summary and exits non-zero on any failure (no partial commit).
6. Does **not** delete the local files — Step 6's `git rm -r` does that
   after the dev has eyeballed the JSON diff and run `pnpm build` to
   verify the new URLs render.

Add a `migrate:media` script to root `package.json` for discoverability.

## Step 8 — Validation

Before considering the task complete, run from repo root:

- `pnpm lint --fix`
- `pnpm check`
- `pnpm test` (covers both site + the extended `cms-auth` Worker tests)
- `pnpm build` — confirm Astro successfully fetches every remote image and
  emits hashed outputs under `dist/_astro/`.
- `pnpm preview` and spot-check `/`, `/menu`, `/about` to verify images
  render.
- Deploy the Worker via `pnpm deploy:workers`, then in a fresh browser:
  1. Open `/admin`, log in via GitHub.
  2. Confirm DevTools → Application → Local Storage shows the R2 access
     key ID + secret were populated by the bridge.
  3. Upload a test image in the asset library; confirm it lands at
     `https://media.auroracolonypub.aneuhold.dev/<folder>/<name>` and the
     committed JSON references that URL.
  4. Hard-refresh the public site and confirm the new image renders
     through `<Image />`.

## Open questions

1. **Astro remote-image cache eviction.** `node_modules/.astro/` survives
   across `pnpm dev` restarts but is wiped by `rm -rf node_modules`.
   Acceptable cost; first-build-after-clean is slower.
2. **About markdown image uploads.** Sveltia's inline-image button in the
   markdown widget uses the global media library by default, so it should
   route to R2 without per-widget config. Verify during validation that
   uploading an image into the About body produces an R2 URL.

# Sveltia CMS Setup & First Two Components

## Goal

Stand up Sveltia CMS end-to-end on top of the existing Astro + Cloudflare Pages site, hooked up to three visible pieces of content (one per widget category we'll realistically use later):

1. **Homepage banner** (plain text — singleton file collection): drives the `Hero` title and tagline.
2. **Gallery** (media — folder collection): editor uploads/removes photos that render through Astro's `<Image>` for optimization.
3. **About** (markdown — singleton file collection): a rich-text block rendered as a homepage section, demonstrating the markdown widget pattern for any future pages with prose.

The `aurora-cms-auth` Worker is already scaffolded with Sentry + rate limit + GitHub username allowlist; this plan finishes wiring it.

## High-level architecture

```
site/public/admin/         ← Sveltia CMS admin UI (static HTML + YAML config)
  index.html               ← Loads @sveltia/cms from CDN (pinned)
  config.yml               ← Schema, backend pointing at the Worker

site/src/content/          ← Content collections (committed by Sveltia)
  hero.json                ← Singleton: { title, tagline }
  about.md                 ← Singleton: frontmatter { heading } + markdown body
  gallery/*.json           ← One file per photo: { photo, alt, order }

site/src/assets/gallery/   ← Uploaded gallery images live here (Vite-resolvable
site/src/assets/about/       and any inline images in about.md), so Astro's
                             image() schema + <Image> optimize them. We
                             deliberately do NOT use site/public/ for these —
                             public/ serves files verbatim with no <Image>
                             optimization or responsive srcset generation.

workers/cms-auth/          ← Completes GitHub OAuth, enforces allowlist
```

Editor flow: open `/admin` → "Login with GitHub" → CMS reads/writes content files via GitHub API → `git push` triggers Cloudflare Pages rebuild.

## Steps

### 1. Finish the `aurora-cms-auth` Worker (OAuth flow + allowlist)

Port the minimal OAuth handshake from `sveltia/sveltia-cms-auth` directly into our existing handler rather than adding a dependency — we already have the Sentry wrapper, rate limiter, and allowlist scaffolding that the upstream doesn't expose.

**File: `workers/cms-auth/src/index.ts`**

- Keep the existing `Sentry.withSentry` wrapper, `Env` interface, and `isAllowedGitHubUser` helper.
- Replace the placeholder `OK` response with a router on `request.url`:
  - `GET /auth` → build a GitHub authorize URL (`https://github.com/login/oauth/authorize`) with `client_id`, `scope=repo,user`, and a `state` value, and `Response.redirect(302)` to it. Persist `state` via a signed cookie (HMAC over `GITHUB_CMS_CLIENT_SECRET`) so `/callback` can verify it without any storage backend.
  - `GET /callback?code=…&state=…` →
    1. Verify the `state` cookie matches.
    2. `POST` to `https://github.com/login/oauth/access_token` with the code + client secret; parse JSON.
    3. `GET https://api.github.com/user` with the token; read `login`.
    4. If `!isAllowedGitHubUser(login, env)`, return `403`.
    5. Otherwise, return a tiny HTML page that calls `window.opener.postMessage('authorization:github:success:' + JSON.stringify({ token, provider: 'github' }), '*')` then `window.close()`. (This is the message format Sveltia/Decap expect.)
  - Anything else → `404`.
- Keep the rate-limit check at the top of `fetch`, before routing.
- Remove the TODO comment now that the allowlist is actually called.

No new dependencies. Total file should still be well under ~150 lines.

**File: `workers/cms-auth/src/index.integration.test.ts`**

Replace the single 200-check with:
- `GET /auth` returns 302 with `Location` starting with `https://github.com/login/oauth/authorize?` and includes the configured `client_id`, plus sets a `state` cookie.
- `GET /callback` with no `code` returns 400.
- `GET /callback` with a `code` but a mismatched `state` cookie returns 400.
- Unknown routes return 404.
- `isAllowedGitHubUser` unit-style check: returns `true`/`false` against the hard-coded allowlist in `AuthService.isUserAllowed`.

Outbound calls to GitHub for the success path are not exercised in integration tests — that would require mocking `fetch`, which adds noise for little value. The allowlist branch is testable via the helper directly. The e2e test stays as the smoke check.

**File: `workers/cms-auth/src/index.e2e.test.ts`**

Change the test to assert `GET /` returns `404` (since the catch-all is now `404`, not `200 OK`), and add an `auth` redirect assertion (`GET /auth` returns `302` with `Location` host `github.com`).

### 2. Add the Sveltia admin UI to the site

**New file: `site/public/admin/index.html`**

Standard Sveltia admin shell per their docs — a minimal HTML page with:
- `<meta name="robots" content="noindex,nofollow">` (don't surface admin in search)
- `<title>Aurora Colony Pub CMS</title>`
- `<script type="module" src="https://unpkg.com/@sveltia/cms@<pinned-version>/dist/sveltia-cms.js"></script>`

Pin to a specific minor version (look up the latest stable at implementation time; pinning avoids surprise breakage).

**New file: `site/public/admin/config.yml`**

```yaml
backend:
  name: github
  repo: aneuhold/aurora-colony-pub
  branch: main
  base_url: https://aurora-cms-auth.agneuhold.workers.dev
  auth_endpoint: auth

# Per-collection media folders are used (see below), so these top-level
# values exist only as a default and aren't relied on.
media_folder: site/src/assets
public_folder: /

collections:
  - name: site
    label: Site
    description: One-off pages and global text on the website.
    files:
      - name: hero
        label: Homepage banner
        file: site/src/content/hero.json
        format: json
        fields:
          - { name: title,   label: Title,    widget: string, hint: "Shown as the big headline on the homepage." }
          - { name: tagline, label: Subtitle, widget: string, hint: "One short line shown under the title. Leave blank for none.", required: false }

      - name: about
        label: About section
        file: site/src/content/about.md
        format: frontmatter
        media_folder: ../assets/about
        public_folder: ../assets/about
        fields:
          - { name: heading, label: Heading, widget: string, hint: "Section heading shown above the About text on the homepage." }
          - { name: body,    label: Text,    widget: markdown, hint: "Free-form text — supports bold, links, headings, and inline images." }

  - name: gallery
    label: Gallery photos
    description: Photos shown in the gallery on the homepage. Drag to reorder by setting the Display order field.
    folder: site/src/content/gallery
    create: true
    delete: true
    slug: "{{fields.alt | slugify}}-{{year}}{{month}}{{day}}"
    format: json
    media_folder: ../../assets/gallery
    public_folder: ../../assets/gallery
    fields:
      - { name: photo, label: Photo, widget: image, hint: "Upload a JPG or PNG. It will be optimized automatically." }
      - { name: alt,   label: Description, widget: string, hint: "Short description of the photo, used by screen readers and search engines." }
      - { name: order, label: Display order, widget: number, default: 0, hint: "Lower numbers show first. Leave at 0 if you don't care about order." }
```

Key decisions:
- **Per-collection `media_folder`/`public_folder`** for `gallery` are relative to the content entry. With content at `site/src/content/gallery/foo.json` and `public_folder: ../../assets/gallery`, the field is stored as `../../assets/gallery/foo.jpg`. That string resolves through Astro's `image()` schema to `site/src/assets/gallery/foo.jpg`, which Vite can import and Astro's `<Image>` can optimize.
- **JSON format** keeps the content files trivially parseable and avoids YAML-vs-frontmatter noise for content that's just a few fields.
- **Friendly labels and hints** on every field per the editor-UX point in `.claude/CLAUDE.md`.

### 3. Astro content collections

**New file: `site/src/content.config.ts`**

Define three collections using the Astro 5+ content layer (Sveltia groups `hero` and `about` under one "Site" UI collection — that's purely an editor-side affordance; on the Astro side they're disjoint singletons with different schemas, so each gets its own collection):

- `hero` — `file()` loader pointing at `src/content/hero.json`; schema is `z.object({ title: z.string(), tagline: z.string().optional() })`.
- `about` — `file()` loader pointing at `src/content/about.md`; schema is `z.object({ heading: z.string() })`. The markdown body is implicit — read it via the `render()` helper from `astro:content` (see step 4).
- `gallery` — `glob()` loader matching `src/content/gallery/*.json`; schema is `({ image }) => z.object({ photo: image(), alt: z.string(), order: z.number().default(0) })`.

`image()` is destructured from the schema callback so the field validates as a real image and yields an `ImageMetadata` object that `<Image>` consumes.

**New seed content** (so the build doesn't break and so there's something to render before the editor logs in):

- `site/src/content/hero.json` — `{ "title": "Aurora Colony Pub", "tagline": "Coming soon." }`
- `site/src/content/about.md` — frontmatter `heading: "About the pub"` and a one-line placeholder body.
- `site/src/content/gallery/.gitkeep` — empty placeholder so the folder exists. The `glob()` loader handles zero entries gracefully; the Gallery component renders nothing in that case.

### 4. Wire the components

**File: `site/src/components-astro/Hero.astro`**

No structural changes — keep the existing `Props` (`title`, optional `tagline`) and styling. It already does exactly what we need; the page just sources props from the collection instead of literals.

**New file: `site/src/components-astro/Gallery.astro`**

A zero-JS Astro component:
- Frontmatter: `await getCollection('gallery')`, sort by `data.order` then by `id` (via the helper added in step 5).
- Render a `<section class="gallery">` containing a responsive grid of `<figure>` items. Each `<figure>` uses `<Image>` from `astro:assets` with `src={entry.data.photo}`, `alt={entry.data.alt}`, explicit `widths` and `sizes` for `srcset`, and `loading="lazy"`.
- Scoped `<style>` using the existing `--foreground` / `--muted-foreground` / `--border` tokens from `global.css`. No Tailwind utility classes inside the `<style>` block — match the existing `Hero.astro` pattern of scoped CSS.
- Render nothing if the collection is empty (so the homepage looks fine until the editor adds photos).

**New file: `site/src/components-astro/About.astro`**

Also zero-JS:
- Frontmatter: `const entry = await getEntry('about', 'about'); const { Content } = await render(entry);`
- Render `<section class="about"><h2>{entry.data.heading}</h2><Content /></section>`.
- `<Content />` is Astro's rendered-markdown component, which automatically processes inline images (anything the editor inserts via the markdown widget into `src/assets/about/`) through Astro's image optimizer — same `srcset`/format-conversion treatment as `<Image>` in the Gallery, with no extra wiring.
- Scoped `<style>` block matching the project's existing pattern; lean on `global.css` tokens.

**File: `site/src/pages/index.astro`**

- Import `getEntry` from `astro:content`, `About` from `$components-astro/About.astro`, `Gallery` from `$components-astro/Gallery.astro`.
- Replace the hardcoded `title`/`tagline` props on `<Hero>` with values from `getEntry('hero', 'hero')`.
- Add `<About />` and `<Gallery />` below `<HelloIsland>`, in that order.

`HelloIsland` stays in place — out of scope to remove.

### 5. Tests

- **Worker tests**: updated in step 1 (covers the new routes + allowlist branch).
- **Site tests**: add `site/src/components-astro/Gallery.test.ts` covering rendering with a seeded set of fake entries via `getCollection` mocking is awkward in Astro components — instead, extract a tiny pure helper (e.g. `sortGalleryEntries(entries)`) into `site/src/util/gallery.ts` and unit-test that. Keeps Vitest doing what it's good at without dragging in Astro's renderer. (If `sortGalleryEntries` ends up trivially `entries.sort((a, b) => a.data.order - b.data.order)`, it's still worth a one-shot test to lock the ordering contract.)
- No new test infra; uses the existing Vitest + jsdom setup.

### 6. Validation

Per `.claude/CLAUDE.md` — run from the repo root, fix anything that fires:

```
pnpm lint --fix
pnpm check
pnpm test
```

Then a manual smoke check:

1. `pnpm --filter ./workers/cms-auth deploy` after secrets are set.
2. `pnpm build:site` and `pnpm preview`.
3. Open `/admin`, click "Login with GitHub," authorize, confirm the editor lands on the dashboard.
4. Edit the homepage banner subtitle, save → confirm a commit appears in `main`.
5. Edit the About section body (including inserting an inline image), save → confirm commit.
6. Add a photo to the Gallery collection, save → confirm commit.
7. After Cloudflare Pages rebuilds, confirm all three changes render on `/` with optimized `<img srcset>` markup on both the Gallery photo and the inline About image.
8. Try logging in from a GitHub account not in the `AuthService.isUserAllowed` allowlist → confirm 403.

## Decisions (resolved open questions)

1. **CDN-loaded Sveltia (pinned), not bundled through Astro.** Admin is a standalone static page at `/admin` that only the editor visits — the Sveltia bundle is never loaded by normal site visitors, so bundling-through-Astro would only affect editor load time, not site perf. Trade-off: an outage at unpkg breaks `/admin` (not the site). Switching to npm install + Astro bundling is mechanical if that ever becomes a real concern.
2. **Signed `state` cookie, not KV-backed state.** Keeps the Worker stateless and avoids touching `AURORA_COLONY_PUB_KV` for OAuth ephemera. The token round-trip is short (<1 min), so cookie expiry isn't a concern. Switching to KV later is straightforward if we ever need cross-request state.
3. **`src/assets/`, not `public/`, for uploaded media.** `public/` files are served verbatim — no `<Image>` integration, no format conversion, no responsive `srcset`. `src/` files are imported by Vite at build time and get the full optimization pipeline. The editor's raw multi-MB phone JPGs become hashed, AVIF/WebP-converted, multi-resolution `srcset` images. Trade-off: every upload triggers a Pages rebuild and reprocessing for changed photos — acceptable for a pub site with low edit frequency. If the editor ever needs to drop 50 photos at once and rebuild time becomes painful, the escape hatch is moving media to `public/uploads/` and rendering with `<img>` (lose optimization, gain O(1) rebuilds).
4. **JSON for structured singletons + folder items; markdown only for prose.** Hero and gallery items are pure structured data — JSON is the lightest fit. About is the one collection that needs a freeform body, so it uses `format: frontmatter` (YAML frontmatter + markdown body).
5. **Keep `HelloIsland` in place.** Out of scope. The current page still shows it; remove it whenever the site starts looking real.

## Files changed at a glance

Modified:
- `workers/cms-auth/src/index.ts`
- `workers/cms-auth/src/index.integration.test.ts`
- `workers/cms-auth/src/index.e2e.test.ts`
- `site/src/pages/index.astro`

Added:
- `site/public/admin/index.html`
- `site/public/admin/config.yml`
- `site/src/content.config.ts`
- `site/src/content/hero.json`
- `site/src/content/about.md`
- `site/src/content/gallery/.gitkeep`
- `site/src/components-astro/Gallery.astro`
- `site/src/components-astro/About.astro`
- `site/src/util/gallery.ts`
- `site/src/util/gallery.test.ts`

No deps added to any `package.json`. No `wrangler.jsonc` changes (rate limit + vars already in place).

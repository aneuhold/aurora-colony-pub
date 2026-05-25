# SEO Improvements Plan

Goal: make the Aurora Colony Pub site as discoverable as possible — especially for **local search** ("pub in Aurora OR", "Aurora Colony Pub menu", "breakfast Aurora Oregon", etc.) — while preserving the site's existing "incredibly performant frontend with outstanding SEO" stance (Astro static output, zero-JS where possible, Tailwind tokens).

Phases are split around the domain switch. The codebase work (Phase 1) is safe to ship before `auroracolonypub.com` is pointed at Cloudflare Pages because every URL derives from `astro.config.mjs` `site`. Phase 3 lists the work that can only happen once the domain is live.

---

## Current state (audit)

What's already good:

- Astro 5 `output: 'static'` + Cloudflare Pages — fast TTFB, no SSR overhead.
- `@astrojs/sitemap` installed (emits `sitemap-index.xml`/`sitemap-0.xml`).
- Per-page `<title>` + `<meta description>` already wired through `BaseLayout.astro`.
- Fonts self-served and preloaded via `astro:assets`.
- Images served through `astro:assets` with responsive `widths`/`sizes`.
- NAP exists in content collections (`hours`, `locationContact`, `socialMediaLinks`) — one source of truth, ready for structured data.

Gaps to close:

- No canonical URL, Open Graph, Twitter Card, or theme-color metadata.
- No JSON-LD structured data (huge miss for a local restaurant — `BarOrPub` is the single biggest local-SEO lever we have before GBP).
- No `robots.txt`. `/admin/` is currently included in the generated sitemap.
- No OG share image; link previews on Facebook/iMessage show nothing.
- About page uses `<h2>` as its top heading (should be `<h1>`).
- Per-page titles/descriptions don't include the city/state — costs us local CTR.
- No apple-touch-icon or web manifest.
- No `_redirects` for the legacy Wix URLs (`/breakfast-menu`, `/kids-menu`, `/happy-hour`, `/grid`).

---

## Phase 1 — Pre-domain (ship now)

Everything below is safe to merge before the DNS flip. Anything that needs an absolute URL is built from `Astro.site` so it automatically retargets when `astro.config.mjs` is updated in Phase 3.

### 1. Extend `BaseLayout.astro` with full SEO head

File: `site/src/layouts/BaseLayout.astro`

Widen `Props` to: `title`, `description?`, `ogImage?` (defaults to a sitewide share image), `ogType?` (default `website`), `noindex?` (default `false`).

In the `<head>`, add (built from `Astro.site` + `Astro.url`):

- `<link rel="canonical" href={canonicalUrl}>`
- `<meta name="robots" content={noindex ? 'noindex,nofollow' : 'index,follow'}>`
- `<meta name="theme-color" content="#…">` — use the existing `--color-primary` hex (read from `tokens.css`, hard-coded here to avoid a runtime CSS variable lookup).
- `<meta property="og:type" content={ogType}>`
- `<meta property="og:site_name" content="Aurora Colony Pub">`
- `<meta property="og:title" content={title}>`
- `<meta property="og:description" content={description}>`
- `<meta property="og:url" content={canonicalUrl}>`
- `<meta property="og:image" content={absOgImageUrl}>` + `og:image:width`/`height`/`alt`
- `<meta property="og:locale" content="en_US">`
- `<meta name="twitter:card" content="summary_large_image">`
- `<meta name="twitter:title" content={title}>`
- `<meta name="twitter:description" content={description}>`
- `<meta name="twitter:image" content={absOgImageUrl}>`
- `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`
- `<link rel="manifest" href="/site.webmanifest">`

Description becomes required in TS (every page already passes one).

### 2. Add sitewide structured data component

New file: `site/src/components-astro/SeoSchema.astro`

Renders a single `<script type="application/ld+json">` block. Reads the existing `hours`, `locationContact`, `socialMediaLinks`, and `titleTagline` content entries and emits a `BarOrPub` (subtype of `Restaurant` + `LocalBusiness`) graph with:

- `@type: 'BarOrPub'`, `name`, `description`, `url` (from `Astro.site`), `image` (OG image), `logo`.
- `address` as `PostalAddress` (parse the existing `address` string into street/city/state/postal — Aurora, OR 97002 is stable enough to hard-code city/state/zip in the parser).
- `telephone`, `email`.
- `geo` as `GeoCoordinates` — pull lat/lon for `21568 Hwy 99E NE, Aurora, OR 97002` and store as constants in this component (one-time lookup; do not embed a map iframe).
- `openingHoursSpecification[]` derived from `hours.json` — convert `"Mon–Thu"`/`"11:00 AM"`/`"10:00 PM"` into Schema.org day codes + 24-hour times. Add a separate spec entry per day range.
- `servesCuisine: ['American']`.
- `priceRange: '$$'`.
- `paymentAccepted`, `currenciesAccepted: 'USD'`.
- `sameAs`: array built from `social-media-links.json`.
- `hasMenu` linking to `${site}/menu`.
- `acceptsReservations`: omit until the owner confirms (see open question at the bottom).

Wire it into `BaseLayout.astro` so it renders on every page. (One component, one JSON-LD block — keeps the head tidy.)

### 3. Per-page titles & descriptions tuned for local search

Update the four pages so titles include "Aurora, OR" and descriptions sell the visit in <160 chars.

- `site/src/pages/index.astro`
  - `title="Aurora Colony Pub — Historic Neighborhood Pub in Aurora, OR"`
  - `description="Family-friendly historic pub on old Hwy 99E in Aurora, Oregon. Burgers, breakfast on weekends, happy hour Mon–Fri 3–6, patio in season."`
- `site/src/pages/menu.astro`
  - `title="Menus — Aurora Colony Pub | Aurora, OR"`
  - `description="Main, breakfast, kids, and happy-hour menus for Aurora Colony Pub in Aurora, Oregon. Tap any page for the full image."`
- `site/src/pages/about.astro`
  - `title="About — Aurora Colony Pub | Aurora, OR"`
  - `description="A 1930s tavern halfway between Salem and Portland on old 99E. The Aurora Colony Pub's history, owners, and neighborhood roots."`
- `site/src/pages/contact.astro`
  - `title="Contact — Aurora Colony Pub | Aurora, OR"`
  - `description="Address, phone, hours, and a contact form for the Aurora Colony Pub in Aurora, Oregon."`

### 4. Fix heading hierarchy on About

File: `site/src/components-astro/About.astro`

Change the page heading from `<Heading level={2}>` to `<Heading level={1}>`. Every page must have exactly one `<h1>`; right now `/about` has none. (`Heading` already supports `level={1}`.)

### 5. Add `robots.txt`

New file: `site/public/robots.txt`

```
User-agent: *
Allow: /
Disallow: /admin/

Sitemap: https://aurora-colony-pub-frontend.pages.dev/sitemap-index.xml
```

The `Sitemap:` line must be edited in Phase 3 along with `astro.config.mjs site`. Note the file in `docs/post-acceptance-steps.md` (Step 1 update) so it isn't forgotten.

### 6. Keep `/admin` out of the sitemap

File: `site/astro.config.mjs`

Pass a `filter` option to the `sitemap()` integration that excludes any URL containing `/admin`. Also drop a `<meta name="robots" content="noindex,nofollow">` for the admin shell — easiest path is to pass `noindex` into `BaseLayout` from wherever `/admin` is rendered (or, if `/admin` is purely a static HTML file served from `public/`, add the meta tag directly to it). Verify by rebuilding and checking `dist/sitemap-0.xml`.

### 7. Favicons + web manifest

New assets in `site/public/`:

- `apple-touch-icon.png` — 180×180, pub logo on background tile.
- `icon-192.png`, `icon-512.png` — for the web manifest.
- `site.webmanifest` — `name`, `short_name`, `theme_color`, `background_color`, `icons[]`, `display: 'standalone'`.

Generating these from `site/src/assets/logo.svg` is a one-time task. Commit the PNGs directly. (`og-image.png` already builds via `pnpm generate:assets`.)

### 8. Sitemap config polish

File: `site/astro.config.mjs`

In addition to the admin filter, add to `sitemap()`:

- `changefreq: 'weekly'`
- `priority: 0.7` (page-level)
- `lastmod: new Date()` — fine because the build runs on every push.

(Don't over-engineer per-page priorities — Google ignores them in practice but they're cheap to include consistently.)

### 9. Image alt text pass

- `site/src/components-astro/MenuDisplay.astro`: alt is `entry.data.title`. Prefix with "Aurora Colony Pub" so screen readers and image search both win. Inline expression: `alt={\`Aurora Colony Pub \${entry.data.title.toLowerCase()}\`}` — no template changes elsewhere.
- `site/src/components-astro/Gallery/Gallery.astro`: alt is `entry.data.alt`, which is editor-controlled. No code change; add a note in `cms-content` / the CMS hints (config.yml `hint:` for the alt field) telling editors to write descriptive alts like "Bartender pouring a beer at Aurora Colony Pub" rather than "drink".
- `site/src/components-astro/Nav.astro` & `Footer.astro`: logos are decorative SVG; `aria-label="Aurora Colony Pub home"` on the home link is already correct. No change.

### 10. `_redirects` for legacy Wix URLs (pre-author, activates with domain)

New file: `site/public/_redirects` (Cloudflare Pages picks this up automatically).

```
/breakfast-menu  /menu#breakfast    301
/kids-menu       /menu#kids         301
/happy-hour      /menu#happy-hour   301
/grid            /#gallery          301
```

The `#gallery` target requires adding `id="gallery"` to the `<Section>` in `site/src/components-astro/Gallery/Gallery.astro` so the anchor lands correctly. Use the existing `Section` component's id prop (matches the pattern already used in `MenuDisplay.astro`).

These redirects do nothing while the site lives only at the `pages.dev` URL — they exist to preserve link equity from any incoming backlinks to the old Wix paths the moment DNS flips.

### 11. `_headers` for security + cache (optional but recommended)

New file: `site/public/_headers`

Add response headers for all routes:

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
```

Skip CSP for now — Sveltia CMS, Turnstile, and the FB feed Worker each have script/connect origins that would need allowlisting, and a misconfigured CSP breaks the contact form. Revisit in Phase 3 if desired.

### 12. Add "Get directions" link near the address

File: `site/src/components-astro/SiteInfo.astro`

Append a `Get directions →` link below the address that opens `https://maps.google.com/?q=21568+Hwy+99E+NE+Aurora+OR+97002` in a new tab. No iframe (slow + privacy cost). The Google Maps link gives users a one-tap path to navigation and reinforces the entity to crawlers when combined with the schema's `geo` block.

### 13. Hero LCP polish

File: `site/src/components-astro/Hero.astro`

LCP on `/` is the `<h1>` text — already great. Confirm with a Lighthouse run after Phase 1 lands (the existing PR Lighthouse workflow gives this automatically) and only intervene if LCP regresses.

### 14. Validation gates

Before considering Phase 1 complete:

- `pnpm lint --fix`
- `pnpm check`
- `pnpm test`
- `pnpm build` then inspect `site/dist/sitemap-0.xml` — must not contain `/admin/`.
- Manually view-source on `/`, `/menu`, `/about`, `/contact` from `pnpm preview` and confirm: canonical, OG tags, Twitter tags, JSON-LD parses (paste into [validator.schema.org](https://validator.schema.org/)), `<h1>` count = 1 per page.

---

## Phase 2 — Domain switch (the existing post-acceptance work)

Owned by `docs/post-acceptance-steps.md`. This plan adds a tiny patch to that doc rather than duplicating its steps.

Update `docs/post-acceptance-steps.md` Step 1 ("Update the GitHub action for lighthouse…") to also call out:

- `site/public/robots.txt` — replace the `Sitemap:` URL with `https://auroracolonypub.com/sitemap-index.xml`.
- Re-run `pnpm build` so the sitemap regenerates with the new origin.

(The codebase change set here is one line of `astro.config.mjs` + the robots line + the two Lighthouse workflow URLs that doc already covers.)

---

## Phase 3 — Post-domain (after `auroracolonypub.com` is live on Pages)

These are SEO actions that fundamentally require the production domain to exist.

### 1. Google Search Console

1. Verify ownership of `auroracolonypub.com` — **prefer DNS TXT** (Cloudflare DNS is already in our control after Phase 2). Falls back to a meta tag in `BaseLayout.astro` if DNS verification is undesirable.
2. Submit `https://auroracolonypub.com/sitemap-index.xml`.
3. Request indexing for `/`, `/menu`, `/about`, `/contact`.
4. Watch Core Web Vitals + Coverage for 2 weeks; act on any errors.

### 2. Bing Webmaster Tools

1. Sign in with the same Google account; import the GSC property (one click).
2. Submit the same sitemap.

### 3. Google Business Profile (highest local-SEO ROI)

1. Owner-coordinated: claim/verify the existing `Aurora Colony Pub` listing (may need a postcard).
2. Set the website URL to `https://auroracolonypub.com`.
3. Confirm hours match `hours.json`; if they drift, the JSON is the source of truth.
4. Upload current photos.
5. Once the GBP URL is known, add it to `site/src/content/social-media-links.json` so it flows automatically into the `sameAs` array of the JSON-LD schema. No code change required.

### 4. NAP citation cleanup

For each of: Facebook page, Yelp, TripAdvisor, Apple Maps, Foursquare, OpenStreetMap, Yellow Pages.

- Confirm name = "Aurora Colony Pub", address verbatim from `location-contact.json`, phone `(503) 678-9994`.
- Replace any stale `wix`/old-domain URLs with `https://auroracolonypub.com`.

### 5. Verify the `_redirects` file fires

Smoke-test in a browser:

- `https://auroracolonypub.com/breakfast-menu` → 301 → `/menu#breakfast`
- `https://auroracolonypub.com/kids-menu` → 301
- `https://auroracolonypub.com/happy-hour` → 301
- `https://auroracolonypub.com/grid` → 301

In GSC, mark the old URLs for re-crawl so the 301s propagate.

### 6. Lighthouse / CrUX baseline

1. Run Lighthouse against `https://auroracolonypub.com` (the PR action already does this; just re-enable the prod URL in `pull-request-site.yml` per the existing post-acceptance doc).
2. Note baseline LCP / INP / CLS in `docs/`; revisit in 4 weeks once CrUX field data accrues.

### 7. (Optional) CSP

With all third-party origins now known and stable (Turnstile, FB Worker, Resend's tracking pixel if any, Sveltia OAuth Worker, Google Fonts is bundled by Astro so not a CSP origin), consider adding a Content-Security-Policy to `site/public/_headers`. Defer until something specifically motivates it — easy to break the contact form.

---

## Files touched (Phase 1 summary)

Edits:

- `site/src/layouts/BaseLayout.astro` — full SEO head
- `site/src/components-astro/About.astro` — h2 → h1
- `site/src/components-astro/MenuDisplay.astro` — alt prefix
- `site/src/components-astro/SiteInfo.astro` — directions link
- `site/src/components-astro/Gallery/Gallery.astro` — `id="gallery"` on Section
- `site/src/pages/index.astro` — title + description
- `site/src/pages/menu.astro` — title + description
- `site/src/pages/about.astro` — title + description
- `site/src/pages/contact.astro` — title + description
- `site/astro.config.mjs` — sitemap `filter` + `changefreq`/`priority`/`lastmod`
- `site/public/admin/config.yml` — add CMS hint encouraging descriptive gallery alts
- `docs/post-acceptance-steps.md` — add robots.txt + sitemap rebuild note to Step 1

New files:

- `site/src/components-astro/SeoSchema.astro` — JSON-LD `BarOrPub`
- `site/public/robots.txt`
- `site/public/_redirects`
- `site/public/_headers`
- `site/public/apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `site.webmanifest`

No new dependencies. No abstractions beyond a single `SeoSchema.astro` component (justified — JSON-LD construction is 40+ lines that would otherwise pollute `BaseLayout`).

---

## Resolved decisions

- Geo coordinates: already in place.
- `servesCuisine: ['American']` only (drop "Pub Food").
- CSP in Phase 3: skip.

## Open question (blocks one schema field)

- **`acceptsReservations`** — owner conversation pending. Until then, omit the field entirely from the `BarOrPub` schema rather than guessing. Once known, add it as a single line in `SeoSchema.astro` and to the GBP setup in Phase 3.

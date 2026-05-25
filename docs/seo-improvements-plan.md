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
- About page uses `<h2>` as its top heading (should be `<h1>`).
- Per-page titles/descriptions don't include the city/state — costs us local CTR.
- No apple-touch-icon or web manifest.
- No `_redirects` for the legacy Wix URLs (`/breakfast-menu`, `/kids-menu`, `/happy-hour`, `/grid`).

---

## Phase 1 — Pre-domain (ship now)

Everything below is safe to merge before the DNS flip. Anything that needs an absolute URL is built from `Astro.site` so it automatically retargets when `astro.config.mjs` is updated in Phase 3.

### 1. Install `@jdevalk/astro-seo-graph` and wire `<Seo>` in `BaseLayout.astro`

Install the dep:

```sh
pnpm --filter site add @jdevalk/astro-seo-graph
```

Register the build-time validation hook in `site/astro.config.mjs`:

```js
import { seoGraph } from '@jdevalk/astro-seo-graph';
// ...
integrations: [/* existing */, seoGraph()],
```

The hook runs entirely at build time (no client JS). It fails the build on: pages missing or duplicating `<h1>`, duplicate `<title>` / `<meta description>` across pages, images without `alt`, and internal links with inconsistent trailing slashes.

Replace `site/src/layouts/BaseLayout.astro`'s head with the `<Seo>` component. Widen `Props` to: `title`, `description` (required), `ogImage?` (defaults to a sitewide share image), `ogType?` (default `website'`), `noindex?` (default `false`).

```astro
---
import Seo from '@jdevalk/astro-seo-graph/Seo.astro';
import { buildSeoGraph } from '$util/seoGraph';

interface Props {
  title: string;
  description: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
}

const { title, description, ogImage = '/og-image.png', ogType = 'website', noindex = false } = Astro.props;
const absOgImage = new URL(ogImage, Astro.site).href;
const graph = await buildSeoGraph({ site: Astro.site!, pageUrl: Astro.url, pageName: title, description });
---

<Seo
  title={title}
  description={description}
  ogType={ogType}
  ogImage={absOgImage}
  ogImageAlt="Aurora Colony Pub"
  ogImageWidth={1200}
  ogImageHeight={630}
  siteName="Aurora Colony Pub"
  locale="en_US"
  twitter={{ card: 'summary_large_image' }}
  noindex={noindex}
  graph={graph}
  extraLinks={[
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    { rel: 'manifest', href: '/site.webmanifest' },
  ]}
  extraMeta={[
    { name: 'theme-color', content: '#XXXXXX' }, // hex pulled from --color-primary in tokens.css
  ]}
/>
```

`<Seo>` emits: `<title>`, `<meta description>`, canonical (auto-derived from `Astro.url`), `<meta robots>`, OG (type/title/description/url/image/site_name/locale), Twitter Card, the JSON-LD `@graph`, plus the apple-touch-icon / manifest / theme-color tags wired through `extraLinks`/`extraMeta`.

### 2. Build the JSON-LD `@graph`

New file: `site/src/util/seoGraph.ts`

Exports `buildSeoGraph({ site, pageUrl, pageName, description })` returning the assembled graph object that `<Seo graph={...}>` consumes. Reads the existing `hours`, `locationContact`, and `socialMediaLinks` content entries via `getEntry` from `astro:content`.

Builds three linked entities via `@jdevalk/astro-seo-graph`'s re-exports of the core builders (`makeIds`, `buildWebSite`, `buildWebPage`, `buildPiece`, `assembleGraph`):

1. `WebSite` (sitewide) — `buildWebSite({ url, name: 'Aurora Colony Pub', publisher: { '@id': ids.organization('pub') }, ... }, ids)`.
2. `WebPage` (per-page) — `buildWebPage({ url: pageUrl.href, name: pageName, isPartOf: { '@id': ids.website }, ... }, ids)`.
3. `BarOrPub` (sitewide, the local-SEO payload) — `buildPiece<Restaurant>({ '@type': 'BarOrPub', '@id': ids.organization('pub'), ... })` from `schema-dts`. Properties:
   - `name`, `description`, `url`, `image` (OG image), `logo`.
   - `address` as `PostalAddress` — parse the existing `address` string into street/city/state/postal (Aurora, OR 97002 is stable enough to hard-code city/state/zip in the parser).
   - `telephone`, `email`.
   - `geo` as `GeoCoordinates` — store lat/lon for `21568 Hwy 99E NE, Aurora, OR 97002` as constants in this file (one-time lookup; do not embed a map iframe).
   - `openingHoursSpecification[]` derived from `hours.json` — convert `"Mon–Thu"` / `"11:00 AM"` / `"10:00 PM"` into Schema.org day codes + 24-hour times; one entry per day range.
   - `servesCuisine: ['American']`.
   - `priceRange: '$$'`.
   - `paymentAccepted`, `currenciesAccepted: 'USD'`.
   - `sameAs[]` built from `social-media-links.json`.
   - `hasMenu` linking to `${site}/menu`.
   - `acceptsReservations` — omit until the owner confirms (see open question at the bottom).

Return value: `assembleGraph([website, webPage, barOrPub])`. The Astro package's component dedups and emits one `<script type="application/ld+json">` block per page.

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

Change the page heading from `<Heading level={2}>` to `<Heading level={1}>`. Every page must have exactly one `<h1>`; right now `/about` has none. (`Heading` already supports `level={1}`.) Future regressions on any page are caught by the `seoGraph()` build-time hook from Section 1.

### 5. Add `robots.txt` endpoint

New file: `site/src/pages/robots.txt.ts`

```ts
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL('sitemap-index.xml', site).href;
  const body = `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${sitemap}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
};
```

Astro prerenders this to `dist/robots.txt` at build time (static endpoints work with `output: 'static'`). The `Sitemap:` URL derives from `Astro.site`, so the DNS flip in Phase 2 needs no robots edit — updating `site` in `astro.config.mjs` cascades.

### 6. Keep `/admin` out of the sitemap

File: `site/astro.config.mjs`

Pass a `filter` option to the `sitemap()` integration that excludes any URL containing `/admin`. Also drop a `<meta name="robots" content="noindex,nofollow">` for the admin shell — easiest path is to pass `noindex` into `BaseLayout` from wherever `/admin` is rendered (or, if `/admin` is purely a static HTML file served from `public/`, add the meta tag directly to it). Verify by rebuilding and checking `dist/sitemap-0.xml`.

### 7. Favicons + web manifest

Extend `scripts/generate-logos.ts` to additionally emit the PWA icons from the existing `logo-on-white.svg` source:

- `site/public/apple-touch-icon.png` — 180×180.
- `site/public/icon-192.png` — 192×192.
- `site/public/icon-512.png` — 512×512.

`generate-logos-utils.ts` already has the `renderSquarePng` helper that backs `renderSquareIco`; export it (currently private) and call it three times from `generate-logos.ts` alongside the existing favicon outputs. Add the three paths and sizes to the script's `getConfig()` object so the rest of the file stays config-driven. Run `pnpm generate:assets` and commit the resulting PNGs.

New hand-written file in `site/public/`:

- `site.webmanifest` — `name`, `short_name`, `theme_color`, `background_color`, `icons[]` (referencing `icon-192.png` + `icon-512.png`), `display: 'standalone'`.

The `<link rel="apple-touch-icon">` and `<link rel="manifest">` tags are emitted by `<Seo extraLinks={...}>` in Section 1 — no separate head wiring.

### 8. Sitemap config polish

File: `site/astro.config.mjs`

In addition to the admin filter, add to `sitemap()`:

- `changefreq: 'weekly'`
- `priority: 0.7` (page-level)
- Per-page `lastmod` via `serialize`, using `gitLastmod` from `@jdevalk/astro-seo-graph` against the page's source file. Map known routes to their `.astro` source paths (four entries today: `/`, `/menu/`, `/about/`, `/contact/`); fall back to build time when `gitLastmod` returns `null`. Per-page accuracy beats a single sitewide build timestamp for crawlers.

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
- `pnpm build` — the `seoGraph()` hook from Section 1 enforces `<h1>` count, title/description uniqueness, image `alt` presence, and trailing-slash consistency. Build fails on violation.
- Inspect `site/dist/sitemap-0.xml` — must not contain `/admin/`.
- Inspect `site/dist/robots.txt` — `Sitemap:` URL matches `Astro.site`.
- Paste the JSON-LD from any built page into [validator.schema.org](https://validator.schema.org/) — confirm it parses and `BarOrPub` resolves cleanly.

---

## Phase 2 — Domain switch (the existing post-acceptance work)

Owned by `docs/post-acceptance-steps.md`. The robots.txt endpoint and sitemap both derive their absolute URLs from `Astro.site`, so updating the `site` value in `astro.config.mjs` is the only codebase change in this phase (plus the two Lighthouse workflow URLs that doc already covers). No edits to this plan's outputs are required at the DNS flip.

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

- `site/src/layouts/BaseLayout.astro` — replace head with `<Seo>`
- `site/astro.config.mjs` — register `seoGraph()` integration; sitemap `filter` + `changefreq`/`priority` + `serialize` for `gitLastmod`
- `site/src/components-astro/About.astro` — h2 → h1
- `site/src/components-astro/MenuDisplay.astro` — alt prefix
- `site/src/components-astro/SiteInfo.astro` — directions link
- `site/src/components-astro/Gallery/Gallery.astro` — `id="gallery"` on Section
- `site/src/pages/index.astro` — title + description
- `site/src/pages/menu.astro` — title + description
- `site/src/pages/about.astro` — title + description
- `site/src/pages/contact.astro` — title + description
- `site/public/admin/config.yml` — add CMS hint encouraging descriptive gallery alts
- `site/package.json` — add `@jdevalk/astro-seo-graph`
- `scripts/generate-logos.ts` — emit apple-touch-icon + 192/512 PWA icons alongside existing favicons
- `scripts/generate-logos-utils.ts` — export the `renderSquarePng` helper

New files:

- `site/src/util/seoGraph.ts` — `buildSeoGraph()` returning the JSON-LD `@graph` for `<Seo>`
- `site/src/pages/robots.txt.ts` — dynamic robots.txt endpoint
- `site/public/_redirects`
- `site/public/_headers`
- `site/public/site.webmanifest`

Generated outputs (via `pnpm generate:assets`, committed):

- `site/public/apple-touch-icon.png`, `site/public/icon-192.png`, `site/public/icon-512.png`

One new dependency: `@jdevalk/astro-seo-graph` — provides the `<Seo>` component, builders, `gitLastmod`, and the build-time `seoGraph()` validation hook. Build-time only; no client JS.

---

## Resolved decisions

- Geo coordinates: already in place.
- `servesCuisine: ['American']` only (drop "Pub Food").
- CSP in Phase 3: skip.

## Open question (blocks one schema field)

- **`acceptsReservations`** — owner conversation pending. Until then, omit the field entirely from the `BarOrPub` schema rather than guessing. Once known, add it as a single line in `SeoSchema.astro` and to the GBP setup in Phase 3.

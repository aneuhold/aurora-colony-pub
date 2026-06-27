# Post-Acceptance Steps

The steps that need to be completed if the owner of Aurora Colony Pub accepts the new system.

## 1. Migrate DNS from Wix to Cloudflare and switch Domain

Owner-coordinated. At [GoDaddy](https://dcc.godaddy.com/control/portfolio/auroracolonypub.com/settings?ventureId=3a633d8f-d9a6-4440-a605-6ad548b13ef9&ua_placement=shared_header), change `auroracolonypub.com` nameservers to the two Cloudflare assigns when the zone is added (free plan). Before flipping NS, audit Cloudflare's auto-imported records against Wix — keep Google `MX`, apex SPF TXT, and any Google site-verification TXT intact. Apex `A`/`CNAME` stays **DNS only** (gray cloud).

Immediately afterwards (because Wix will probably not let the domain live anymore after the nameservers are moved to CF), setup the domain on the [Pages site](https://dash.cloudflare.com/f5fee77ff79a01ea91f541b825d003a3/pages/view/aurora-colony-pub-frontend/domains).

## 2. Point all prod-URL references at `auroracolonypub.com` + Have Corey create GitHub Account

While having Corey create their GitHub account from their Microsoft account:

Two files still hard-code the `pages.dev` URL:

- `.github/workflows/pull-request-site.yml` — the `urls:` block under `Run Lighthouse CI` (line ~66) **and** the `prodUrl` constant in the `Post sticky Lighthouse comment` script (line ~82). Replace both with `https://auroracolonypub.com`.
- `site/astro.config.ts` — change `site:` from `https://aurora-colony-pub-frontend.pages.dev` to `https://auroracolonypub.com`. This is what every canonical URL, OG URL, sitemap entry, and the `Sitemap:` line in `robots.txt` is built from, so it has to flip before the build that gets deployed to the real domain.

Then re-run `pnpm build` so `sitemap-index.xml`/`sitemap-0.xml` and `robots.txt` regenerate with the new origin, and confirm a couple of canonical/OG tags in `site/dist/` reference the new domain.

## 3. Finalize Resend sending domain

1. In [Resend](https://resend.com/domains/add/3b909ea5-d584-4197-892e-f479d76e1f1a), add domain `mail.auroracolonypub.com`. Paste the displayed records into Cloudflare DNS and wait for green checks.
1. In `workers/contact/src/util/contactWorkerConstants.ts`, update the two constants:
   - `fromEmail`: `'Aurora Colony Pub <noreply@mail.auroracolonypub.com>'`
   - `ownerEmail`: `'acpmanagement@auroracolonypub.com'`
1. `pnpm deploy:workers` to push the new worker build.
1. Submit a real test message through the contact form and confirm delivery to the `acpmanagement@auroracolonypub.com` inbox.

## 4. SEO Updates

### Google Search Console

1. Verify ownership of `auroracolonypub.com` — **prefer DNS TXT**. Fallback is a `<meta name="google-site-verification">` tag in `site/src/layouts/BaseLayout.astro`.
1. Submit `https://auroracolonypub.com/sitemap-index.xml`.
1. Request indexing for `/`, `/menu`, `/about`, `/contact`.
1. Watch Core Web Vitals + Coverage for ~2 weeks; act on any errors.

### Bing Webmaster Tools

1. Sign in with the same Google account; import the GSC property (one click).
1. Submit the same sitemap.

### Google Business Profile

Highest local-SEO ROI of any step in this doc.

1. Owner-coordinated: claim/verify the existing `Aurora Colony Pub` listing (may require a postcard).
1. Set the website URL to `https://auroracolonypub.com`.
1. Confirm hours match `site/src/content/hours.json`; if they drift, the JSON is the source of truth.
1. Upload current photos.
1. Once the GBP URL is known, add it to `site/src/content/social-media-links.json` — it flows automatically into the `sameAs` array of the `BarOrPub` JSON-LD schema; no code change required.

### NAP citation cleanup

For each of: Facebook page, Yelp, TripAdvisor, Apple Maps, Foursquare, OpenStreetMap, Yellow Pages.

- Confirm name = "Aurora Colony Pub", address verbatim from `site/src/content/location-contact.json`, phone `(503) 678-9994`.
- Replace any stale Wix or old-domain URLs with `https://auroracolonypub.com`.

### Verify legacy Wix URL redirects fire

`site/public/_redirects` was authored pre-domain but is inert until DNS is live. Smoke-test in a browser:

- `https://auroracolonypub.com/breakfast-menu` → 301 → `/menu#breakfast`
- `https://auroracolonypub.com/kids-menu` → 301 → `/menu#kids`
- `https://auroracolonypub.com/happy-hour` → 301 → `/menu#happy-hour`
- `https://auroracolonypub.com/grid` → 301 → `/#gallery`

In GSC, mark the old URLs for re-crawl so the 301s propagate.

# Bring the pub to life — design implementation plan

Goal: take the current quiet shell to an editorial, photo-led site that immediately answers "what is this place and is it open right now," without sliding into kitsch. Persona stays: modern rustic, warm Americana, restrained. No UI kit, no scoped styles, tokens first, opacity before new colors.

This plan is a full pass: tokens + primitives, global chrome (Nav, Footer, BaseLayout), and all four pages (Home, Menu, About, Contact). It also opens with a gallery cleanup pass so every later step can reference photos by what they actually show.

---

## 0. Gallery image classification + cleanup (prerequisite)

Runs before any design code lands so every subsequent step ("hero photo", "patio shot", "exterior shot") can reference the gallery by descriptive filename instead of `gallery-02.jpg`. Menu images are explicitly out of scope — they're already named semantically and the owner is happy with current naming.

### 0.1 Sub-agent scope

- Spawn one general-purpose agent on **Haiku** (`model: "haiku"`) and give it the full list of files under `site/src/assets/gallery/*.jpg` (28 photos).
- For each file the agent uses `Read` (multimodal) to look at the image and returns a structured row:
  - `category`: one of `interior`, `patio`, `food`, `drink`, `exterior`, `event`, `staff`, `other`.
  - `alt`: 12–20 words, room-specific, matches the menu voice (honest, first-person plural where natural, no "artisan"/"curated"/"elevated"). Example: "The original meat-locker door behind the bar, still keeping kegs cold." Not: "A door in a bar."
  - `suggested_filename`: kebab-case, no date suffix, category-led. Example: `interior-bar-meat-locker.jpg`, `patio-evening-string-lights.jpg`, `food-burger-fries.jpg`. Collisions get a numeric suffix (`-2`, `-3`).
  - `suggested_order`: integer the agent picks to produce a pleasing gallery sequence — exteriors and wide-room shots first to set the room, then patio, then food/drink, then detail shots. The agent returns a globally-ordered list; we trust its sequencing.
- Agent returns the rows as JSON for review before any file moves happen.

### 0.2 Rename + rewrite pass (executed after the agent returns)

- For each row: move `site/src/assets/gallery/<old>.jpg` → `site/src/assets/gallery/<suggested_filename>`.
- For each corresponding `site/src/content/gallery/gallery-NN-20260524.json`: update the `photo` path, update the `alt`, set `order` to the new value, and rename the JSON file itself to match the asset basename (e.g. `interior-bar-meat-locker.json`). The Astro content collection uses the JSON filename as the entry id; the gallery has no schema constraint on the id, so renaming is safe.
- Verify nothing else in the codebase imports a gallery path by name (grep `assets/gallery/`) — at present only the content JSON references them.
- Run `pnpm build:site` once afterwards to confirm Astro's image pipeline still resolves everything.

### 0.3 Outputs

- Cleaner asset and content directories.
- §8 ("Content / asset decisions to confirm") collapses from "TBD which gallery photo plays hero" to "first photo whose filename starts with `interior-`" etc. — picking the hero/patio/exterior shots becomes a one-line code reference, not a manual review.

---

## 1. Token + primitive extensions

These are the only system-level additions. Everything else composes from them.

### 1.1 `site/src/styles/tokens.css`

- Add `--color-accent: oklch(0.42 0.06 150);` — a deep, slightly desaturated forest green for the "Family Friendly" / patio callouts. Keep the comment block honest about why this exists (opacity-on-`foreground` lands warm-brown, not green). Tailwind will generate `bg-accent`, `text-accent`, `border-accent`.
- Add `--color-accent-foreground: var(--color-background);` so the green can host short white text where needed (chips, buttons).
- Add `--bg-paper-texture` as an inline SVG noise data URI (single octave, ~6% opacity), applied to `<body>` via a new utility class `bg-paper` declared with `@utility` in `tokens.css`. Keep it whisper-faint — it must not read as "texture" on a phone screen, just as warmth.

### 1.2 `site/src/styles/motion.css`

- Add `--duration-slow: 700ms;` for the hero fade-in only. Document the existing two-duration rule still holds for interactive bits.
- Add `--animate-fade-in: fade-in var(--duration-slow) var(--ease-soft) both;` plus a `fade-in` keyframe (opacity 0 → 1, no transform). Used by hero copy so the photo doesn't visibly shift on first paint.

### 1.3 `site/src/components-astro/ui/Heading.astro`

- Add a fifth level `0` mapped to `h1` for hero display type: `text-5xl md:text-7xl lg:text-8xl`, slightly tighter `tracking-tight leading-[1.05]`. Existing levels stay untouched. Used only by the home hero — every other page keeps `level={1}` at the current scale.

### 1.4 `site/src/components-astro/ui/Section.astro`

- Add a `padding="hero" | "default" | "tight"` prop. `default` keeps `py-16 md:py-24`. `tight` becomes `py-10 md:py-14` (used for the home "today" info strip + menu page intro). `hero` removes vertical padding entirely (`px-0 py-0`) so the hero can be full-bleed and own its own min-height. Don't add a new wrapper — just extend Section.

### 1.5 `site/src/components-astro/ui/Container.astro`

- No change. The three sizes are enough.

### 1.6 `site/src/components-astro/ui/Button.astro`

- Add an `accent` variant mirroring `primary` but using `bg-accent text-accent-foreground hover:bg-accent/90`. Used by the hero CTA ("See the menu") so the primary amber is reserved for transactional moments (Contact form submit).

---

## 2. Global chrome

### 2.1 `BaseLayout.astro`

- Apply the new `bg-paper` utility on `<body>` alongside `bg-background`.
- Add `<link rel="preconnect" href="https://www.google.com" />` for the static-map image used on Contact (lazy-loaded, but warming the handshake is cheap).
- No other layout changes — `ClientRouter` and font wiring stay.

### 2.2 `Nav.astro`

- Two-row to single-row, full-width: crest on the left, links right-aligned. Use `import { Image } from 'astro:assets'` to render `logo.svg` at `h-10 md:h-12`, wrapped in `<a href="/" aria-label="Aurora Colony Pub home">`.
- Crest tints with current color via `currentColor`. Set the link color to `text-foreground` so the crest reads ink-warm.
- Right-side links: keep four labels, raise to `font-display` at `text-base md:text-lg` to give the slab serif presence in the chrome. Underline-on-current-page via `aria-current="page"` styled with `[&[aria-current=page]]:underline underline-offset-8 decoration-2 decoration-accent`.
- Wrap in `<Container size="wide">` so the nav respects the same horizontal gutter as the rest of the page.
- Sticky behavior: `sticky top-0 z-40 bg-background/85 backdrop-blur` so the nav rides over the photo hero without obscuring it. Border bottom is `border-b border-foreground/10`, fades in on scroll using a tiny CSS-only trick: `border-transparent` by default, `[&:not(:where(:has(~main)))]:border-foreground/10` is overkill — instead use a single `<div class="h-px bg-foreground/10">` _outside_ the sticky `<nav>` so the border lives on the page, not the floating nav. (Avoids a JS scroll listener.)

### 2.3 `Footer.astro`

- Keep the three-column grid but swap the column order to put "Find us" first on mobile (it's what people are reaching the footer to get). Headings move to `font-display text-xl tracking-tight`.
- Add a fourth row above the grid: full-width `<p class="font-display text-3xl md:text-5xl tracking-tight">Family friendly until 9 pm.</p>` left-aligned with a small crest mark to its left (`logo.svg` at `h-12 md:h-16`, `text-foreground/70`). This is the tagline supergraphic — quiet because it's the closer, not the opener.
- Replace the `bg-foreground/5` background with `bg-foreground/[0.04]` and add `border-t border-foreground/10` only (no other dividers).
- Year and copyright collapse to a single bottom row beneath the grid, separated by a hairline. Add a small `<a href="/admin">Staff</a>` link in `text-foreground/40` so the CMS entrance lives somewhere unobtrusive (currently only reachable by typing the URL).

---

## 3. Home page (`site/src/pages/index.astro` + components)

Rebuild the stack so a first-time visitor sees, in order: a warm photo with the name + tagline + open status, a "today" practical strip (hours / address / phone), a menu teaser with imagery (not just text links), a patio/family-friendly callout, the gallery, and an About teaser that links to `/about`. Then footer.

### 3.1 `Hero.astro` (full rewrite)

- Section becomes `<Section padding="hero" class="relative min-h-[88svh] flex items-end">`.
- Background `<Image>` from the gallery (TBD — see §7), full-bleed, `class="absolute inset-0 h-full w-full object-cover"`, `loading="eager"`, `fetchpriority="high"`, `widths={[768, 1280, 1920, 2560]}`, `sizes="100vw"`.
- Overlay: a single `<div class="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/30 to-transparent">`. One gradient stop, not a stack — keeps it honest.
- Overlay content sits inside `<Container size="wide" class="relative pb-16 md:pb-24 text-background">`:
  - Crest at top-left (`logo-inverted.svg`, `h-16 md:h-20`).
  - `<Heading level={0}>Aurora Colony Pub</Heading>` — title pulled from `titleTagline.data.title`.
  - Tagline rendered as a separate `<p class="mt-3 font-display text-xl md:text-2xl text-background/85">` (Zilla Slab at body weight for a sub-deck feel).
  - One row of three pieces of information, each separated by a thin `·`: `<OpenNowChip />`, hours short ("Today 11 AM – 10 PM"), address city ("Aurora, OR"). Class: `mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 font-body text-sm md:text-base text-background/85`.
  - CTA row beneath: `<Button variant="accent" href="/menu">See the menu</Button>` and `<Button variant="ghost" href="/contact" class="text-background hover:bg-background/10">Get directions</Button>`. The ghost variant inverts here because we're on a dark gradient — pass a `class` override; do not introduce an `inverted` variant.
- Hero copy block wraps `.reveal` (the existing fade-up) so the photo paints first, the copy fades in second.

### 3.2 New: `site/src/components-astro/TodayStrip.astro`

- Reads `hours.json` and `location-contact.json` server-side. Renders three blocks in a 3-column grid (collapses to 1 column on mobile): "Today" (computed weekday + open/close window with happy-hour note when applicable), "Find us" (address + a small "Get directions" link to a `https://www.google.com/maps/?q=…` URL constructed from the address), "Call" (phone tel: link, large).
- Display headings use `font-display text-lg uppercase tracking-[0.18em] text-foreground/60` — the only place we use uppercase, because this is utility chrome, not editorial type.
- Wrapped in `<Section padding="tight" background="muted">` so it visually anchors the hero with a quiet horizontal band.

### 3.3 Home content blocks (replace the current "Our menus" + Gallery stack)

- Replace `Our menus` link strip with `<MenuTeaser />` (new): three large clickable cards, one each for "Main", "Breakfast", and "Happy hour". Each card is a `<a>` wrapping an `<Image>` of the menu thumbnail (re-use the existing `menuImages` collection — pull the first image per category) plus an overlaid label using `font-display text-2xl`. Hover: `transition-transform duration-snap ease-soft hover:-translate-y-1` and the image gets `[&_img]:transition-transform [&_img]:duration-glide [&_img]:hover:scale-[1.02]`. Layout `grid md:grid-cols-3 gap-4`. The fourth menu (Kids) is mentioned as a small text link beneath the grid to keep the visual rhythm at three.
- New: `<PatioCallout />` — single `<Section background="muted">` with a 2-column grid (`md:grid-cols-2`). Left column: a patio photo (TBD from gallery). Right column: `<Heading level={2}>Out on the patio.</Heading>` + a one-paragraph blurb sourced from the About copy ("weary antique shoppers and the locals alike") + a small `<span class="inline-block rounded-full bg-accent/15 px-3 py-1 text-sm font-medium text-accent">Family friendly until 9 pm</span>` chip. This is the only place the accent green appears as a colored chip — its job is to signal "yes, you can bring the kids."
- Keep `<Gallery />` but cap to the first 9 entries on the home page (the full grid stays on… see §7 open question). Add `<Heading level={2}>From the room.</Heading>` above the grid and wrap each `<li>` in a stagger by adding `[&>li:nth-child(odd)]:reveal-left [&>li:nth-child(even)]:reveal-right` so the cards alternate slide direction. Currently every card is `reveal-right` — alternating is more interesting and stays inside the existing token vocabulary.
- New: `<AboutTeaser />` — a `<Section>` with two columns: a small standalone photo of the building exterior on one side, and a one-paragraph excerpt + `<Button variant="link" href="/about">Read the story →</Button>` on the other. Excerpt is hand-written here (a tighter rewrite of the opening About paragraph) so the home page doesn't dump the full markdown.

### 3.4 `index.astro` order

1. `<Hero />`
2. `<TodayStrip />`
3. `<MenuTeaser />`
4. `<PatioCallout />`
5. `<Gallery limit={9} />` (Gallery prop added — see §5.2)
6. `<AboutTeaser />`

Footer stays under the layout.

---

## 4. Menu page (`site/src/pages/menu.astro` + `MenuDisplay.astro`)

### 4.1 `menu.astro`

- Promote the intro to a proper editorial header: `<Heading level={1}>Menus.</Heading>` + a tightened deck `<p class="mt-4 max-w-prose text-lg text-foreground/70 font-display">Breakfast, the main menu, kids, and happy hour. Tap any page to enlarge — pricing and availability may vary.</p>`. Move into a `<Section padding="tight">`.
- Below the header, render a `<MenuSectionIndex />` (new component) — a horizontal pill row on mobile, sticky right-rail on desktop. Each pill is an anchor to `#main`, `#breakfast`, `#kids`, `#happy-hour`. On desktop it positions `sticky top-24` inside the same `Container size="wide"` as `MenuDisplay`, using a CSS grid `md:grid-cols-[1fr_12rem]`. Plain anchors, no JS — `scroll-margin-top: 6rem` on the section ids handles the sticky-nav offset.

### 4.2 `MenuDisplay.astro`

- Drop the alternating `background="muted"` — the constant flipping reads busy. Use plain `<Section>` for all four categories.
- Increase category heading weight to `<Heading level={2}>` (already) but add `font-display text-foreground/90` and a small Zilla Slab eyebrow `<p class="font-display text-sm uppercase tracking-[0.2em] text-accent">Menu {n}</p>` where n is `01`–`04`, just above each heading. Numbered eyebrows make the categories feel like chapters without a graphic divider.
- Replace the menu-image card border with `rounded-lg border border-foreground/10 shadow-[0_1px_0_oklch(0.2_0.012_60/0.04)]` — a single 1px shadow, not a soft cushion, so the image lifts a hair off the paper.
- Keep `loading="eager"` only on the very first image (already done).
- Allergen footnote: move out of `menu.astro`'s bottom Section and into a small `<aside>` inside the last category section, so the disclaimer travels with the menu, not with the page chrome.

---

## 5. About page (`site/src/pages/about.astro` + `About.astro`)

The page is currently 100% markdown render. We add structure without losing the editorial voice.

### 5.1 `about.astro` & `About.astro`

- Top of page: a `<Section padding="hero" class="relative min-h-[40svh] flex items-end">` with a full-bleed warm interior photo and a single overlay block: `<Heading level={1} class="text-background">About the pub.</Heading>` (no deck). Smaller cousin to the home hero — same pattern, shorter.
- Body becomes a `<Section><Container size="narrow">` (matches today). Add a drop-cap utility via arbitrary variants on the first paragraph: `[&_p:first-of-type::first-letter]:font-display [&_p:first-of-type::first-letter]:text-6xl [&_p:first-of-type::first-letter]:float-left [&_p:first-of-type::first-letter]:mr-3 [&_p:first-of-type::first-letter]:mt-1 [&_p:first-of-type::first-letter]:leading-[0.85]`. Honors the persona — drop cap is editorial, not themed.
- After the markdown body, append a small two-up "facts" grid (built statically in `About.astro`, not in markdown): "Since 2015" (Corey & Janae Barton), "Built in the 1930s" (original wood-frame on 99E), "Sloping concrete floors" (original meat-locker door behind the bar). Each is a `<div>` with `<p class="font-display text-3xl">…</p>` over a `<p class="text-foreground/60">…</p>`. Three vertical-rule-free cells separated only by generous whitespace. This catches the visitors who don't read paragraphs.
- Remove the `.reveal-left` from the outer Section — at a single-column About page the slide-from-left reads like a glitch. Use `.reveal` on the facts grid only.

### 5.2 `Gallery.astro`

- Accept a `limit?: number` prop and slice entries after `sortEntries`. Defaults to "all". Used by `index.astro` to show 9, and by `about.astro` to render a full grid beneath the facts as "More from the room."

---

## 6. Contact page (`site/src/pages/contact.astro`)

Currently a heading and a form, missing the whole point of a contact page for a brick-and-mortar.

### 6.1 New layout

- `<Section padding="tight">` with intro: `<Heading level={1}>Stop in, or send a note.</Heading>` + deck `<p class="mt-4 text-lg text-foreground/70 font-display">We'll get back to you as soon as we can. For the fastest response, give us a call during open hours.</p>`.
- Two-column grid `<Section><Container><div class="grid md:grid-cols-[1fr_1.2fr] gap-12">`:
  - Left column: a "Find us" card using `<SiteInfo />` (existing) at a larger size, plus `<Hours />` (existing) beneath, plus a "Get directions" `<Button variant="primary">` linking to Google Maps. Wrap in `<div class="rounded-lg border border-foreground/10 p-6 md:p-8 bg-foreground/[0.03]">`.
  - Right column: a small intro paragraph + `<ContactForm client:idle />`.
- Below the two-column block, a third `<Section>` hosting an interactive Leaflet + OSM map (see §7.7 for the island). The Astro host renders `<PubMap client:visible geo={...} label={address} />` inside a fixed-aspect frame (`aspect-[16/9] rounded-lg border border-foreground/10 overflow-hidden`) so there's no layout shift before hydration. Caption beneath: "Right on old 99E between Salem and Portland."
- New dependency: `leaflet` + `@types/leaflet` added to `site/package.json`. No other deps. No API key, no tile-provider account.
- `site/src/content/location-contact.json` gains a `geo: { lat: number, lng: number }` block (Aurora Colony Pub sits at roughly `45.2347, -122.7548` — verify against the existing address). `content.config.ts` `locationContact` schema gets a matching `geo: z.object({ lat: z.number(), lng: z.number() })` field.

### 6.2 `ContactForm.svelte` styling sweep

- The form is a Svelte 5 island — re-skin only via Tailwind classes (already uses the token system). One pass for: input borders to `border-foreground/15 focus:border-primary`, labels to `font-display text-sm uppercase tracking-[0.18em] text-foreground/70`, submit button uses the new `accent` variant of `Button` if simple to refactor, otherwise leave on `primary`.
- Do not introduce a UI kit. Do not change form logic.

---

## 7. New islands and components

### 7.1 `site/src/components-svelte/OpenNowChip/OpenNowChip.svelte` (new island)

- A small Svelte 5 component used in the hero overlay (and optionally Nav later — not in scope for this plan).
- Props: `weekly: { label: string; open: string; close: string }[]` and `happyHour: { label: string; start: string; end: string }`. The host `Hero.astro` reads `hours.json` via `getEntry` and passes the parsed payload as a prop — keep all I/O on the server.
- Uses runes: `$state` for "now" (refreshed every 60s via `$effect` + `setInterval`), `$derived` for `isOpen` and `closesAtLabel` / `opensAtLabel`.
- Render: a pill with a dot. `<span class="inline-flex items-center gap-2 rounded-full bg-background/10 px-3 py-1 text-sm font-medium text-background ring-1 ring-background/20"><span class="h-2 w-2 rounded-full" :class={isOpen ? 'bg-accent' : 'bg-foreground/50'} /> {isOpen ? `Open until ${closesAtLabel}`:`Closed · opens ${opensAtLabel}`}</span>`.
- Loaded with `client:idle` so it doesn't block initial paint. Renders nothing until hydrated (or renders a static "Hours below" fallback that the client replaces) — pick the static fallback so SSR HTML is meaningful and there's no layout shift.
- Parsing strategy: keep `hours.json` strings ("11:00 AM") and parse with a tiny pure function (`parseTimeOfDay`) defined alongside the component. Includes the cross-midnight Friday case (12:00 AM means next-day midnight, so Friday 11 PM is still "Open"). Co-locate `OpenNowChip.service.ts` + `OpenNowChip.service.test.ts` per repo convention.

### 7.2 `site/src/components-astro/TodayStrip.astro` (new, §3.2)

### 7.3 `site/src/components-astro/MenuTeaser.astro` (new, §3.3)

### 7.4 `site/src/components-astro/PatioCallout.astro` (new, §3.3)

### 7.5 `site/src/components-astro/AboutTeaser.astro` (new, §3.3)

### 7.6 `site/src/components-astro/MenuSectionIndex.astro` (new, §4.1)

### 7.7 `site/src/components-svelte/PubMap/PubMap.svelte` (new island, §6.1)

- Svelte 5 component. Props: `geo: { lat: number; lng: number }`, `label: string`, `directionsUrl: string` (built by the Astro host from the address).
- Imports `leaflet` and its CSS at the top of the component (`import 'leaflet/dist/leaflet.css'`). Vite bundles the CSS with the island.
- `$effect` on mount: creates the map (`L.map(el, { zoomAnimation, fadeAnimation })` — both animations gated on `!matchMedia('(prefers-reduced-motion: reduce)').matches`), centers on `geo` at zoom 15, adds the OSM tile layer (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, attribution required: `'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'`), drops a marker, opens a popup once with `<strong>{label}</strong><br><a href={directionsUrl} target="_blank" rel="noopener noreferrer">Get directions →</a>`. Cleanup tears down the map on unmount.
- Container: `<div bind:this={el} class="h-full w-full"></div>`. Sizing comes from the parent in `contact.astro` — never set a height in the component.
- Loaded with `client:visible` so the Leaflet bundle (~56 KB JS + CSS) only ships when the contact page scrolls the map into view.
- Co-locate `PubMap.service.ts` (pure helpers: build the directions URL from `geo`, build the popup HTML) and `PubMap.service.test.ts` per repo convention. The component itself stays thin — DOM + lifecycle.
- SSR: Leaflet touches `window` on import. Vite handles this fine for `client:visible` components (the import only runs in the browser bundle), but the `service` module must stay free of Leaflet imports so it's safely unit-testable in jsdom.

---

## 8. Content / asset decisions

After §0 runs, image selection collapses to one-line code references rather than manual review:

- **Hero photo** (home): first asset in the `interior` category sorted by `order` (the classifier's lead pick).
- **About page hero photo**: first asset in the `exterior` category, or the second `interior` if no exteriors exist.
- **Patio photo** (PatioCallout): first asset in the `patio` category.
- **AboutTeaser photo** (home): first `exterior`, falling back to a wide interior.
- **Map coordinates** (Contact): added to `location-contact.json` as `geo: { lat, lng }`. Verify against the street address before commit.

If the classifier reports zero entries in `patio` or `exterior`, the implementer should fall back to a strong interior shot and leave a code comment so we know to swap later. No silent guessing.

---

## 9. What this plan deliberately does not do

- No mobile hamburger. Four nav links fit in the row alongside the crest at all viewports we care about.
- No newsletter modal. No promo popups. No "are you 21" gate.
- No second display font, no decorative icon set.
- No JS-driven scroll spy on the menu page (anchor links + `scroll-margin-top` are enough).
- No live food-and-drink menu data model. The menu is and stays photographs of paper menus; this plan only improves how those photos are framed.
- No design "year supergraphic" or hairline ornament dividers — the user picked Editorial Confidence, not Push Further.
- No menu image renames or alt rewrites — the owner is happy with current menu naming. Classifier scope is gallery-only.
- No third-party map embed (no Google Maps iframe, no Mapbox). Leaflet + OSM keeps it tracking-free.
- No changes to workers or build config beyond the Astro fonts already wired. The `locationContact` content schema gains one `geo` field; the `gallery` collection's schema is unchanged (only its row contents).

---

## 10. Implementation order

Doing this top-down so each PR-sized chunk is independently shippable:

0. **Gallery classification + cleanup** (§0) — runs first so every later step references photos by descriptive name. No design code yet; just renames, alt rewrites, and `order` updates. Verify with `pnpm build:site`.
1. **Tokens + primitives** (§1) — `--color-accent`, `bg-paper` utility, `--duration-slow`, Heading `level={0}`, Section `padding`, Button `accent`. No visual change yet on existing pages.
2. **Nav + Footer + BaseLayout** (§2) — chrome upgrade lands on every page at once.
3. **Hero + OpenNowChip + TodayStrip** (§3.1, §3.2, §7.1) — biggest visible change. Validate in browser.
4. **Home body blocks** (§3.3, §3.4) — MenuTeaser, PatioCallout, AboutTeaser, Gallery `limit` prop.
5. **Menu page** (§4).
6. **About page** (§5).
7. **Contact page** (§6) — includes the Leaflet `PubMap` island, `leaflet` dep install, and `location-contact.json` `geo` field.

Each step ends with the standard checks (§11).

---

## 11. Validation (run after each step above)

From the repo root:

- `pnpm lint --fix`
- `pnpm check`
- `pnpm test`

For UI changes, ask the user to start `pnpm dev`, then drive Playwright MCP:

- `browser_navigate` to the touched route
- `browser_snapshot` to verify structure (catches missing landmarks, alt text, heading order)
- `browser_take_screenshot` to verify look — delete the screenshot file after viewing
- `browser_console_messages` to catch hydration warnings on the OpenNowChip island
- For the home page, drive a real scroll before screenshotting the lower sections so `.reveal` content actually animates in (otherwise stitched screenshots will look "blank")

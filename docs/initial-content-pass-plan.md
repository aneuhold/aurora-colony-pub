# Initial Content Pass — Plan

Wire the real Aurora Colony Pub content (hours, contact info, About copy, menus, disclaimers) into the existing scaffolding from `design-system-plan.md`. **Structural only** — no new design tokens, no new motion, no UI kit. Compose from the existing primitives (`Section`, `Container`, `Heading`, `Button`) and put every editorial value behind Sveltia CMS so a non-developer can update it later.

Source-of-truth for copy: `docs/original-site-content.md`.

## Design persona check (applied throughout)

- **Honest hierarchy** — home page surfaces "are we open / where are we / what's on the menu" before the welcome essay. The full About copy lives on `/about`.
- **No new tokens.** Every layout uses Tailwind utilities derived from the existing `tokens.css` + `motion.css`.
- **No new abstractions.** New components only where multiple pages reuse the same block (`Hours`, `SiteInfo`, `Footer`) or where grouping/sort logic doesn't belong inline.
- **Voice** — first-person plural, plain. "Stop by", "We're open", "Find us at..." — never "elevated", "curated".

## 1. CMS content model (new + edited)

Two files change in lockstep (per the `cms-content` skill): `site/public/admin/config.yml` (Sveltia) and `site/src/content.config.ts` (Astro/Zod).

### 1a. New singletons added to the existing `site` collection group

| Singleton | File | Purpose |
| --- | --- | --- |
| `siteInfo` | `site/src/content/siteInfo.json` | Address, phone, email, Facebook URL, food-safety disclaimer. Used by home, contact, menu, footer. |
| `hours` | `site/src/content/hours.json` | Weekly schedule (list of `{ label, open, close }`) + `happyHour` object. Used by home, contact, footer. |

**Sveltia config** (added to the `site` group's `files:` list, next to `hero` and `about`):

- `siteInfo` — singleton with fields: `address` (string), `phone` (string), `email` (string), `facebookUrl` (string), `eatingDisclaimer` (text). Every field gets a plain-English `hint:` per repo CMS conventions.
- `hours` — singleton with:
  - `weekly` (list widget, sub-fields `label`/`open`/`close`, each a string with a hint like `e.g. Mon–Thu` / `e.g. 11:00 AM`)
  - `happyHour` (object widget, sub-fields `label`/`start`/`end`/`note` — `note` is `required: false`)

**Astro schema** (added to `content.config.ts`):

- `siteInfo`: `z.object({ address, phone, email, facebookUrl: z.string().url(), eatingDisclaimer }).` All strings.
- `hours`: `z.object({ weekly: z.array(z.object({ label, open, close })), happyHour: z.object({ label, start, end, note: z.string().optional() }) })`.

Both registered under `export const collections`.

### 1b. New folder collection: `menus`

Per the design decision (image-based, CMS-editable), each menu image is a CMS entry.

| Field | Widget / Type | Notes |
| --- | --- | --- |
| `title` | string | e.g. "Main Menu — Page 1" |
| `category` | select | one of `main`, `breakfast`, `kids`, `happy-hour` |
| `image` | image | Lives under `site/src/assets/menus/` |
| `order` | number (default 0) | Lower numbers render first **within the same category** |

**Sveltia**:

```yaml
- name: menus
  label: Menus
  description: Menu images shown on /menu. One entry per menu page.
  folder: site/src/content/menus
  create: true
  delete: true
  slug: "{{fields.category}}-{{fields.order}}"
  format: json
  media_folder: ../../assets/menus
  public_folder: ../../assets/menus
  fields:
    - { name: title, label: Title, widget: string, hint: "e.g. Main Menu — Page 1" }
    - { name: category, label: Category, widget: select, options: [main, breakfast, kids, happy-hour], default: main, hint: "Which menu does this page belong to?" }
    - { name: image, label: Image, widget: image, hint: "Upload the menu image. JPG or PNG." }
    - { name: order, label: Display order, widget: number, default: 0, hint: "Lower numbers show first within the same menu." }
```

**Astro schema** (callback form is required for `image()`):

```ts
const menus = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/content/menus' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      category: z.enum(['main', 'breakfast', 'kids', 'happy-hour']),
      image: image(),
      order: z.number().default(0)
    })
});
```

Registered in `collections`.

### 1c. Existing collections — content updates only (no schema change)

- `site/src/content/hero.json` — change `tagline` from `"Coming soon."` to `"Family Friendly until 9 pm"`. Title stays `Aurora Colony Pub`.
- `site/src/content/about.md` — replace placeholder body with the full "Welcome to the Aurora Colony Pub!" copy from `docs/original-site-content.md` (six paragraphs). Heading stays `About the pub`.

## 2. Seed content files

Create:

- `site/src/content/siteInfo.json` — address `21568 Hwy 99E NE, Aurora, OR 97002`, phone `(503) 678-9994`, email `shelby@auroracolonypub.com`, facebook `https://www.facebook.com/theauroracolonypub/`, disclaimer from the original site (`Consuming raw or under-cooked eggs and meats...`).
- `site/src/content/hours.json` — four `weekly` entries (Mon–Thu / Fri / Sat / Sun) + `happyHour` object (Mon–Fri, 3:00 PM – 6:00 PM, note `Dine-in only. No substitutions.`). All values come verbatim from the original content doc.
- `site/src/content/menus/` (new folder) — 7 JSON files, each referencing an existing image in `../../assets/menus/`:
  - `main-1.json` → `menu-page-1.jpg`, order `1`
  - `main-2.json` → `menu-page-2.jpg`, order `2`
  - `main-3.json` → `menu-page-3.jpg`, order `3`
  - `main-4.json` → `menu-page-4.jpg`, order `4`
  - `breakfast-1.json` → `menu-breakfast.png`, order `1`
  - `kids-1.json` → `menu-kids.jpg`, order `1`
  - `happy-hour-1.json` → `menu-happy-hour.png`, order `1`

No asset files are moved — they already live in `site/src/assets/menus/`.

## 3. New components

All under `site/src/components-astro/`. No folder/service/barrel for any of these — each is a single `.astro` file because the logic is trivial. (`Gallery/` has a service because its sort is shared; the new components either don't sort or sort inline once.) No barrel files (per `CLAUDE.md` rule — only when a folder has a single public export with internal-only siblings).

| Component | Reads | Purpose |
| --- | --- | --- |
| `Hours.astro` | `getEntry('site', 'hours')` | Renders the weekly table + happy hour line. Used on home, contact, footer. Plain `<dl>` / `<table>` markup with Tailwind utilities (`grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2`, `text-foreground/70` for muted labels). |
| `SiteInfo.astro` | `getEntry('site', 'siteInfo')` | Renders address (with `tel:` and `mailto:` links for phone/email). Used on home, contact, footer. |
| `Footer.astro` | `siteInfo` + `hours` | Site chrome (sits alongside `Nav.astro`, outside `ui/`). Three short columns at `md:` and stacked on mobile: hours summary, address + phone + email, social + copyright (`© {currentYear} Aurora Colony Pub`, computed at build time via `new Date().getFullYear()`). Background `bg-foreground/5`, top border `border-t border-foreground/10`. |
| `MenuDisplay.astro` | `getCollection('menus')` | Renders each category as a `<Section>` with the menu images stacked vertically. Groups inline (`Object.groupBy` over a sorted copy, then iterates `['main', 'breakfast', 'kids', 'happy-hour']` in display order). Uses `<Image>` from `astro:assets` with `widths={[640, 960, 1280]}` and `loading="lazy"` after the first. |

All Tailwind utilities derive from existing tokens (`bg-foreground/5`, `text-foreground/70`, `border-foreground/10`, `font-display`, `duration-snap`, `ease-soft`). **No new tokens, no scoped `<style>` blocks.**

## 4. Page updates

### 4a. `pages/index.astro` — home

Replace today's `<Hero /> + <Gallery />` with the structural sequence:

1. `<Hero />` (unchanged props — now with the real tagline)
2. **"Visit us" section** — `<Section background="muted">` with `<Container size="narrow">`, `<Heading level={2}>Visit us</Heading>`, two-column layout (`grid md:grid-cols-2 gap-8`): left column `<Hours />`, right column `<SiteInfo />`. This is the "are we open / where are we" answer the design persona calls for above the fold.
3. **"Our menus" section** — `<Section>` with `<Heading level={2}>Our menus</Heading>` + a short list of links (Main · Breakfast · Kids · Happy Hour) that anchor to the corresponding section on `/menu`. Plain `<Button variant="link">` chips, no image thumbnails (keeps the home page light; the menu page is one click away).
4. `<Gallery />` (existing, unchanged)
5. **CTA section** — `<Section background="primary">` with a one-line "Got a question or want to book a party?" heading and a `<Button href="/contact">Get in touch</Button>`.

### 4b. `pages/menu.astro`

Replace the "coming soon" stub with:

- `<Section><Container>` → `<Heading level={1}>Menus</Heading>` + intro line.
- `<MenuDisplay />` — renders all four category sections.
- Disclaimer at the bottom (small, `text-foreground/60 text-sm italic`), pulled from `siteInfo.eatingDisclaimer` so the editor controls the wording.

### 4c. `pages/about.astro`

No structural change — `<About />` already renders the markdown body. The content swap in step 1c lights this page up automatically. Verify the markdown body renders with the right rhythm against the multi-paragraph copy (the existing `[&_a]:text-primary` etc. should be enough).

### 4d. `pages/contact.astro`

Add a "Find us" section above the existing `<ContactForm client:idle />`:

- `<Section><Container size="narrow">` → `<Heading level={1}>Contact us</Heading>` + two-column `<Hours /> + <SiteInfo />` block (same pattern as the home page's Visit Us section, so they share rhythm).
- Then `<ContactForm client:idle />` underneath.

Note: `ContactForm.svelte` already renders its own `<h2>Contact us</h2>`. Drop the heading from inside `ContactForm.svelte` so the page heading isn't duplicated (one-line edit — delete line 99). The Svelte component stays an island; everything else is `.astro`.

## 5. Layout — add footer

`site/src/layouts/BaseLayout.astro`:

- Import the new `Footer.astro` from `$components-astro/Footer.astro`.
- Render `<Footer />` after `<slot />` (still inside `<body>`, so it appears on every route).
- No changes to the existing `<head>` / `<Nav />` wiring.

## 6. Implementation order

Each step leaves the site rendering. Run `pnpm lint --fix && pnpm check && pnpm test` between groups freely; the final command is mandatory.

1. **CMS schema** — edit `config.yml` (Sveltia: add `siteInfo` + `hours` singletons to the `site` group; add `menus` folder collection). Edit `content.config.ts` (Zod schemas for `siteInfo`, `hours`, `menus`; register in `collections`).
2. **Seed content** — write `siteInfo.json`, `hours.json`, and the 7 `menus/*.json` files. Update `hero.json` tagline. Replace `about.md` body with the full Welcome copy.
3. **New components** — `Hours.astro`, `SiteInfo.astro`, `Footer.astro`, `MenuDisplay.astro`.
4. **Layout** — wire `<Footer />` into `BaseLayout.astro`.
5. **Home page rewrite** — rebuild `pages/index.astro` per §4a.
6. **Menu page rewrite** — rebuild `pages/menu.astro` per §4b.
7. **Contact page** — add `Hours` + `SiteInfo` block, remove the duplicate heading from `ContactForm.svelte`.
8. **Validation** — `pnpm lint --fix && pnpm check && pnpm test && pnpm build:site` (last one to confirm Sveltia ↔ Zod ↔ seed-file shapes match end-to-end).
9. **Manual verify** — ask the user to `pnpm dev`, then use Playwright MCP to walk `/`, `/menu`, `/about`, `/contact`. Confirm: hours/address render on home + contact + footer, menu page renders 7 images grouped by category, About shows full welcome copy, footer is present on every route. Delete every screenshot after use per the `pub-design` skill rule.

## 7. Out of scope (explicitly)

- **No "open now" indicator.** Computing real-time open/closed needs JS + timezone handling. Hours table answers the question for now; defer the live indicator.
- **No structured menu items.** Per the user's choice in this round — menus stay image-based. A `menu_items` collection is a separate future task.
- **No new design tokens.** All colors/typography/motion already exist.
- **No font swap.** The current `--font-display` / `--font-body` (Fraunces + Inter) inherits from the design-system plan; tuning these is a separate design pass.
- **No reservation/booking widget, no events calendar, no newsletter signup.** Not in the original site, not in this scope.
- **No social-media embeds** in the footer. Just a link to the Facebook page.
- **No Svelte islands** added. `ContactForm.svelte` stays the only island.

## 8. Open questions

- **Home-page welcome blurb.** This plan puts the full Welcome copy only on `/about` (home leads with hours + address + menu links, per "honest hierarchy"). If a short 1-paragraph intro on home is wanted, add it as a `home` singleton with `welcomeBody` (markdown) and slot it between Hero and "Visit us". Trivial follow-up — not blocking.
- **`hours.weekly` schema rigor.** Today's shape is a free-text list — editor types `Mon–Thu` / `11:00 AM`. Easier for editors, no validation. Stricter alternative: enum day + time-input widget. Probably overkill until an editor mis-types a value.
- **`facebookUrl` validation.** Using `z.string().url()` will hard-fail the build if an editor pastes a non-URL. Acceptable trade — the error surfaces during the CMS commit's CI build.
- **Menu image ordering across categories.** This plan orders within each category. If we ever want a single flat list, the `category` enum's iteration order in `MenuDisplay.astro` is the answer — change the array literal.

## 9. File-count sanity check

Per the `cms-content` skill's checklist:

| Operation | Files modified | Files added |
| --- | --- | --- |
| Add `siteInfo` singleton | `config.yml`, `content.config.ts` | `siteInfo.json` |
| Add `hours` singleton | `config.yml`, `content.config.ts` | `hours.json` |
| Add `menus` folder collection | `config.yml`, `content.config.ts` | 7 × `menus/*.json` |
| Update existing content | `hero.json`, `about.md` | — |
| New components | — | `Hours.astro`, `SiteInfo.astro`, `Footer.astro`, `MenuDisplay.astro` |
| Page edits | `index.astro`, `menu.astro`, `contact.astro`, `ContactForm.svelte`, `BaseLayout.astro` | — |

Total: ~11 modified + ~12 added. About right for a content pass that touches every route.

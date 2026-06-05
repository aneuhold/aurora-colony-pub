# Site reorganization + heritage redesign — implementation plan

Implements Corey Barton's 6/3/2026 direction: a **family-meal-first, restaurant-forward** read that screams _"bring your family here for a great meal"_ on open, plus a **woody / cast-iron / old-text heritage touch** — executed the modern way (no tiled plank wallpaper, no chalkboard fonts, no sepia/letterpress grunge).

## Settled decisions (do not re-litigate)

- **Scope: whole site.** Heritage system + hierarchy emphasis across home, about, menu, contact, and the shared Nav/Footer/BaseLayout.
- **Facebook feed stays high** on the home page. No section reshuffle — owner is fine with the current section order.
- **Footer is the single heritage surface, site-wide.** Because the footer renders on every page, one wood-ground footer satisfies "at most one wood/aged-paper surface per page" for the entire site. **No second wood/paper surface is added anywhere** (hero, about card, etc. stay clean). The script accent and the Zilla-caps old-text lockups are _type_ treatments, not surfaces, so they may appear more broadly under the restraint rules below.
- **Restraint guardrail (anti-scatter):** Yellowtail script appears in exactly **two coherent moments** — the home hero welcome and the footer lockup. The structural "old-text" layer (Zilla caps section labels) is the consistent per-page heritage thread. We do **not** pepper script across every section.

## Design rationale (why this fits the persona)

- **Footer wood band = the menu's dark-wood-field model**, executed as a sectional accent, not wallpaper. It's the one place every visitor lands, so the heritage signature is consistent without touching the clean editorial body above it.
- **Zilla Slab caps lockups** ("HISTORIC AURORA, OR · ESTABLISHED 1856") are the _structural_ old-text layer — enamel-signage / railroad-timetable energy the owner asked for, no distressed display face needed.
- **Yellowtail** delivers the "old text" _warmth_ the menu already uses ("Welcome", "fresh"), caged to 1–3 accent words at display size.
- **Cast iron = heavier hairlines + iron-bracket framing on the wood band**, never bolt-head clip art or metal gradients.
- **Family-meal hierarchy** is strengthened in the hero copy (the first thing on open) rather than by adding a section — keeps the practical info (open-now chip, today's hours, address, CTAs) exactly where regulars expect it.

---

## Phase 1 — Heritage tokens & font wiring (foundation)

**`site/astro.config.ts`** — add a third entry to the `fonts` array:
- `name: 'Yellowtail'`, `cssVariable: '--font-yellowtail'`, `provider: fontProviders.google()`, `weights: [400]`, `styles: ['normal']`, `fallbacks: ['cursive']`.

**`site/src/styles/tokens.css`** — under `@theme`:
- Add `--font-script: var(--font-yellowtail);` beside the existing `--font-display` / `--font-body` (generates the `font-script` utility). Update the typography comment to document the three-role system and the accent-only cage for the script.
- Add two color tokens (mirrors the existing `--color-primary` / `--color-primary-foreground` pairing so a Section variant is self-contained):
  - `--color-surface-wood: oklch(0.27 0.03 55);` — deep espresso walnut, low chroma so it reads brown (not orange pine), warm hue in the primary's family.
  - `--color-surface-wood-foreground: oklch(0.95 0.012 80);` — warm cream for type on the wood.
  - Add a short comment explaining these back the **footer wood band only** (the one heritage surface) and were minted because opacity-on-foreground can't produce a dark warm-brown.
- **Do not** add crest navy — no lockup needs it; minting it would be speculative. (Note deferred in this plan.)

**`site/src/layouts/BaseLayout.astro`** — in `<head>`, after the two existing `<Font>` tags add:
- `<Font cssVariable="--font-yellowtail" />` **without `preload`** (the component is required to emit the `@font-face`; we skip preload because it's accent-only and below the fold-critical path).

_Validation checkpoint:_ `pnpm check` should still pass; Tailwind now generates `font-script`, `bg-surface-wood`, `text-surface-wood-foreground`, `border-surface-wood`.

## Phase 2 — Extend the UI primitives (no forks)

**`site/src/components-astro/ui/Section.astro`** — add `'wood'` to the `Background` type and to `backgroundClass`:
- `wood: 'bg-surface-wood text-surface-wood-foreground'`.
- This is the sanctioned way to get the heritage surface; the footer band uses it instead of inventing a wrapper.

**New `site/src/components-astro/ui/Eyebrow.astro`** — the canonical "old-text" lockup primitive (single home for the structural heritage layer that's currently copy-pasted in three files):
- Props: `as?: keyof HTMLElementTagNameMap` (default `'p'`), `class?: string`.
- Renders `<Tag class:list={['font-display text-sm uppercase tracking-[0.18em] text-foreground/60', className]}><slot /></Tag>`.
- Rationale: the lockup string appears in `TodayStrip` (×3), `contact.astro` (×3), and the Footer will need it. One primitive keeps the railroad-timetable label consistent and tokenizable. This is the **only** new component in the plan.

_Heading and Button are NOT changed_ — script accents are inline `<span class="font-script">` within existing copy, not a Heading mode.

## Phase 3 — Footer: the heritage anchor (highest-impact change)

**`site/src/components-astro/Footer.astro`** — restructure into a top **wood band** + the existing (unchanged) info grid:

- **Wood band** at the top of the `<footer>`, rendered with `Section`/markup using `bg-surface-wood text-surface-wood-foreground` (via the new `'wood'` variant or equivalent classes), `bg-paper` layered for grain:
  - Keep the `Logo` + `Family friendly until 9 pm.` line, recolored for the dark surface (currently `text-foreground/70` → `text-surface-wood-foreground/80`).
  - Add a Yellowtail script accent — **locked: `See you soon`** set in `font-script` at display size, lightened via a solid lighter color/`color-mix` toward the cream (NOT opacity, per the script rules).
  - Add the old-text lockup via `Eyebrow`: `HISTORIC AURORA, OR · ESTABLISHED 1856` (grounded in `docs/original-site-content.md`). On the wood it needs the muted-cream tone, so pass `class="text-surface-wood-foreground/60"` to override the default `text-foreground/60`.
  - **Cast-iron framing:** a simple inner bracket frame — a thin `border border-surface-wood-foreground/20` rule/inset on the band (line + weight only, no texture).
- **Info grid + copyright bar stay as-is on the light surface.** They embed the shared `SiteInfo` / `Hours` components, which are also used on the light `contact` page — keeping them out of the wood band avoids any dark/light recolor coupling on shared components. (The wood band content is all footer-owned copy, so it colors cleanly.)

**Locked: flat wood band for v1** — type, script accent, and lockup sit directly on the dark wood with the iron-bracket frame. (The menu's nested cream torn-paper card is deferred as a possible later enhancement.)

## Phase 4 — Home hero: family-meal-first read

**`site/src/components-astro/Hero.astro`** — strengthen the "great meal, whole family" message without disturbing the practical info:
- Add one short welcome line near the tagline carrying the family-meal message with a Yellowtail accent. **Locked copy:**
  > Bring the whole family in for _a great meal._
  (`a great meal` in `font-script` at display size; the most literal echo of the owner's "bring your family here for a great meal.")
- Keep the existing `OpenNowChip` + today's hours + city + the three CTAs untouched and in place (regulars still get "are you open?" within two seconds). CTA order already leads with **See the menu** (food-first) — keep it.
- **Imagery: keep the current hero photo as-is** — the owner updated it to a shot that best matches the vibe. No image change in this work.

## Phase 5 — Structural old-text layer across pages (consistency, low risk)

Swap the hand-rolled lockup markup for the new `Eyebrow` primitive so every page carries the same heritage label treatment:
- **`site/src/components-astro/TodayStrip.astro`** — replace the three `font-display text-sm uppercase tracking-[0.18em] text-foreground/60` paragraphs (Today / Find us / Call) with `<Eyebrow>`.
- **`site/src/pages/contact.astro`** — replace the three `<h2>` lockups (Find us / Hours / Send a note) with `<Eyebrow as="h2">`.
- **Locked: keep minimal** — adopt `Eyebrow` only where lockups already exist (TodayStrip, contact). **No new** section labels added to MenuTeaser/AboutTeaser, to avoid scatter.

No script accents are added in this phase (held to hero + footer).

## Phase 6 — Cast-iron line pass (restrained)

- Confine the cast-iron read to **framed elements**: bump the footer wood-band frame and, optionally, the home figure/card borders (`AboutTeaser`, `PatioCallout`, `MenuTeaser` cards) from `border-foreground/10` → `border-foreground/20` so they read as heavier iron hairlines.
- Keep body/section hairlines at `/10`. No global border change — this is a targeted weight bump on objects that look "framed," nothing textural.

---

## Validation (required before done)

From the repo root:
1. `pnpm lint --fix`
2. `pnpm check`
3. `pnpm test`
4. **Browser verify via Playwright MCP** — ask the user to start `pnpm dev` and confirm it's up first. Then:
   - `browser_navigate` to `/`, `/about`, `/menu`, `/contact`.
   - `browser_snapshot` (accessibility tree) on each — confirm the new welcome line, Eyebrow labels, and footer lockup are present and structurally sane.
   - **Drive a real scroll** before screenshotting long pages — `.reveal` content reads as `opacity:0` in stitched full-page captures.
   - `browser_console_messages` — confirm no font-load or hydration errors.
   - Confirm Yellowtail actually renders (not the `cursive` fallback) and the wood band contrast is legible.
   - **Delete every screenshot** taken from the repo root when done.

## Resolved decisions (all owner-approval items closed)

1. **Hero welcome copy** — _"Bring the whole family in for **a great meal**."_ (script accent on `a great meal`).
2. **Footer script word** — **`See you soon`**.
3. **Wood band build** — **flat v1**; nested cream paper card deferred.
4. **Hero photo** — **keep the owner's current image.**
5. **Per-section Eyebrow labels** — **keep minimal**; only where lockups already exist.

No open questions remain — the plan is ready to implement.

## Files touched (summary)

- `site/astro.config.ts` — Yellowtail font entry.
- `site/src/styles/tokens.css` — `--font-script`, `--color-surface-wood(+ -foreground)`.
- `site/src/layouts/BaseLayout.astro` — non-preload `<Font>` for Yellowtail.
- `site/src/components-astro/ui/Section.astro` — `'wood'` background variant.
- `site/src/components-astro/ui/Eyebrow.astro` — **new** old-text lockup primitive.
- `site/src/components-astro/Footer.astro` — wood band + script accent + lockup + iron frame.
- `site/src/components-astro/Hero.astro` — family-meal welcome line + script accent.
- `site/src/components-astro/TodayStrip.astro`, `site/src/pages/contact.astro` — adopt `Eyebrow`.
- `site/src/components-astro/Menu/MenuTeaser.astro`, `AboutTeaser.astro`, `PatioCallout.astro` — optional Eyebrow labels + cast-iron border bump.

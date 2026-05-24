# Design System Plan

Tokens are the design system. Components are a thin, deliberate layer on top. This plan establishes the token foundation, wires it into Tailwind v4's `@theme`, adds the minimum set of UI primitives, and splits the existing single-page content into routes (`/`, `/menu`, `/about`) so the nav + view transitions are exercised on a real multi-page site.

Existing styles and content placement on the site are PoC — feel free to wipe them out during the migration. Nothing about the current visual layout is preserved on purpose.

## 1. Token File Layout

Two files under `site/src/styles/`, both imported from `global.css` (the single import surface that `BaseLayout.astro:2` already references):

```
site/src/styles/
  global.css     # imports tailwindcss + tokens.css + motion.css
  tokens.css     # @theme: colors + typography
  motion.css     # @theme: motion tokens + @keyframes + ::view-transition + .reveal @supports
```

Two files, not three:

- Motion (tokens + keyframes + view-transition pseudos + scroll-reveal) is structurally distinct from declarative color/type tokens — co-locating keyframes with the durations/easings they consume keeps each motion swap contained.
- **No `themes.css` yet.** The first real theme is the second use case; until then, theme overrides land directly in `tokens.css` with a comment. Create `themes.css` when seasonal/branded variants actually appear.

Order in `global.css` matters: `@import 'tailwindcss'` first, then `tokens.css`, then `motion.css`.

## 2. `@theme` Sketch — Minimum Day-One Tokens

Tailwind v4 generates utilities from `@theme` automatically: each `--color-*` becomes `bg-*` / `text-*` / `border-*` / `ring-*`; each `--font-*` becomes `font-*`; each `--duration-*` becomes `duration-*`; each `--ease-*` becomes `ease-*`; each `--animate-*` becomes `animate-*`. Opacity modifiers (`bg-primary/80`, `text-foreground/60`) work on any `--color-*` via `color-mix` with **no extra tokens needed**.

Bare-minimum set — define the **fewest** vars that unlock the design space, lean on opacity modifiers and Tailwind's built-in defaults for everything else:

```css
/* tokens.css */
@theme {
  /* Colors — 4 vars. Tints/shades/state colors come from opacity modifiers
     (e.g. text-foreground/60 for muted, bg-primary/80 for hover, border-foreground/10 for borders).
     Expand when needed:
       - Add --color-muted / --color-border if opacity-on-foreground gives the wrong hue.
       - Add --color-primary-50..-900 numbered shades only if you need a step ramp that
         color-mix can't express (multi-stop gradients, distinct semantic states).
       - Add a :root primitives layer (palette → semantic) when a second theme exists. */
  --color-background: oklch(0.99 0 0);
  --color-foreground: oklch(0.15 0 0);
  --color-primary: oklch(0.55 0.16 70);
  --color-primary-foreground: oklch(0.99 0 0);

  /* Typography — 2 vars. Tailwind generates font-display and font-body.
     Expand when needed: add --font-mono if monospace is required. */
  --font-display: 'Fraunces', ui-serif, Georgia, serif;
  --font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;
}
```

```css
/* motion.css */
@theme {
  /* Motion — 2 durations, 1 easing, 1 named animation.
     Tailwind generates duration-snap, duration-glide, ease-soft, animate-fade-up.
     Expand when needed:
       - Additional durations (--duration-slow) for a longer beat.
       - Additional easings (--ease-bounce) for a different feel.
       - Additional named animations (--animate-fade-in, --animate-slide-up) per pattern. */
  --duration-snap: 150ms;
  --duration-glide: 400ms;
  --ease-soft: cubic-bezier(0.2, 0.8, 0.2, 1);
  --animate-fade-up: fade-up var(--duration-glide) var(--ease-soft) both;
}

@keyframes fade-up {
  from { opacity: 0; transform: translateY(1rem); }
  to   { opacity: 1; transform: translateY(0); }
}
```

What is intentionally **not** tokenized day one:

- **Spacing scale.** Tailwind's `--spacing` base + the `p-1`..`p-96` ladder is enough. `Section.astro` is the single source of truth for section padding; if section rhythm needs swapping, edit that one file. Promote to a `--spacing-section` token only when a non-`Section` caller needs the same value.
- **Radii.** Tailwind's `rounded-sm`..`rounded-2xl` defaults cover what we need; override `--radius-*` only when the defaults are wrong.
- **Breakpoints.** Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536) stay.

## 3. Scroll-Reveal Mechanism (recommendation: CSS-only with `@supports`)

**Use CSS scroll-driven animations. No Svelte island, no IntersectionObserver.**

Findings from MDN / caniuse, May 2026:

- `animation-timeline: view()` is **not yet Baseline.**
- Chromium 115+ and Safari 18+ support it fully. Firefox: behind a flag.
- caniuse reports ~85% global support.

This is acceptable because reveals are decoration. The fallback path must leave content visible, not hidden-forever. Pattern:

```css
/* motion.css */
@supports (animation-timeline: view()) {
  .reveal {
    animation: var(--animate-fade-up);
    animation-timeline: view();
    animation-range: entry 0% entry 40%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reveal { animation: none; }
}
```

Outside the `@supports` block, `.reveal` has no styles — Firefox users (and any unsupported browser) see fully visible, un-animated content. No JS ships, no Svelte component exists, no opacity-0 trap.

Components opt in by adding `class="reveal"` to a section or element. If a future requirement genuinely needs JS-driven coordination (e.g. sequenced reveals across an island), revisit then — do not pre-build it.

## 4. View Transitions

- Import `ClientRouter` from `astro:transitions` in `BaseLayout.astro` and place it inside `<head>`. (Renamed from `<ViewTransitions />` in Astro 5; confirmed for Astro 6 which the site is on.)
- Root crossfade in `motion.css`, consuming the motion tokens so a token swap retunes the transition:

```css
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: var(--duration-glide);
  animation-timing-function: var(--ease-soft);
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) { animation: none; }
}
```

- Add named transitions (`transition:name="..."` on persistent elements like the nav or logo) **only** when the root crossfade feels janky for a specific element. Don't pre-build them.

## 5. Site Structure — Routes + Nav

Today: a single `pages/index.astro` containing Hero + HelloIsland + About + Gallery + ContactForm.

Target:

```
site/src/pages/
  index.astro    # Hero + Gallery + ContactForm
  menu.astro     # placeholder menu page (no CMS collection yet)
  about.astro    # the rewritten <About /> component on its own route
  admin/         # unchanged
```

- **`Nav.astro`** at `site/src/components-astro/Nav.astro`. Site chrome, not a composable primitive — lives outside `ui/`. Renders an `<a>` per route, highlights the current route by comparing `Astro.url.pathname`. With 3 links, a single horizontal row fits at every viewport — no drawer, no JS, no hamburger.
- Place `<Nav />` and a wrapping `<header>` in `BaseLayout.astro` so every page gets it.
- The existing `HelloIsland` PoC component is deleted.
- The `/menu` page is a placeholder — wiring a `menu` content collection is a separate task handled by the `cms-content` skill. Day one: `<Section>` + `<Heading level={1}>Menu</Heading>` + a "coming soon" line so the route is reachable and styled.

## 6. UI Primitives to Add

Folder: `site/src/components-astro/ui/`. **No barrel file** (multiple unrelated exports, per CLAUDE.md). Imports use `$components-astro/ui/Section.astro` etc.

| File | Props | Purpose |
| --- | --- | --- |
| `Section.astro` | `background?: 'default' \| 'muted' \| 'primary'` (default `'default'`), `as?: keyof HTMLElementTagNameMap` (default `'section'`) | Single source of truth for section padding and background. Vertical rhythm via Tailwind utilities (e.g. `py-16 md:py-24`), horizontal gutter (`px-6`), background via the 3 variants (`muted` = `bg-foreground/5`, `primary` = `bg-primary text-primary-foreground`). |
| `Container.astro` | `size?: 'narrow' \| 'default' \| 'wide'` (default `'default'`) | Max-width wrapper (`max-w-3xl` / `max-w-5xl` / `max-w-7xl`), centered. `Section` owns gutter; `Container` doesn't pad. |
| `Heading.astro` | `level: 1 \| 2 \| 3 \| 4`, `as?: 'h1' \| 'h2' \| 'h3' \| 'h4' \| 'p'` (defaults to matching tag) | Owns the type scale, applies `font-display`. `level` chooses visual size; `as` lets semantic level differ from visual size when needed. |
| `Button.astro` | `variant?: 'primary' \| 'ghost' \| 'link'` (default `'primary'`), `href?: string`, `type?: 'button' \| 'submit'`, `disabled?: boolean` | Renders `<a>` when `href` is set, otherwise `<button>`. Primary: `bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-snap ease-soft`. No internal state. |

Existing files that get **wiped and rewritten** (current styling is PoC, not preserved):

- `site/src/components-astro/Hero.astro` — rewritten using `<Section>` + `<Container size="narrow">` + `<Heading level={1}>`. Scoped `<style>` deleted.
- `site/src/components-astro/About.astro` — rewritten with `<Section>` + `<Container size="narrow">` + `<Heading level={2}>`. The `:global(a)` and `:global(img)` markdown-body styling stays in a scoped `<style>` block (that's content-specific, not design-system concern). Used by `pages/about.astro`, not `pages/index.astro`.
- `site/src/components-astro/Gallery/Gallery.astro` — rewritten with `<Section>` + `<Container>` + Tailwind grid utilities (`grid grid-cols-[repeat(auto-fill,minmax(16rem,1fr))] gap-4`). Figure styling becomes `border border-foreground/10 rounded-md overflow-hidden`. Scoped `<style>` deleted. The service (`Gallery.service.ts`) and `index.ts` barrel are untouched.
- `site/src/components-svelte/ContactForm/ContactForm.svelte` — its submit button gets the same utility classes as `Button.astro`'s primary variant, **inline**. No `Button.svelte` mirror is created day one.
- `site/src/components-svelte/HelloIsland.svelte` — deleted. PoC.

Svelte UI mirrors are not built. Add them when a feature genuinely requires interactivity that the `.astro` primitive can't express.

## 7. Implementation Order

Each step leaves the site rendering. Run `pnpm lint --fix && pnpm check && pnpm test` after the final step (and freely between).

1. **Create `tokens.css` and `motion.css`** with the day-one `@theme` blocks from section 2. Replace `global.css` contents with the three `@import`s. The semantic token names (`--color-background`, `--color-foreground`, `--color-primary`) coincidentally match the existing custom-prop names in `global.css:4-10` for the three colors we kept; the other three (`--muted`, `--muted-foreground`, `--border`) are removed — any leftover references break here and get cleaned up in step 7.
2. **Wire `<ClientRouter />`** in `BaseLayout.astro` inside `<head>`.
3. **Add `Nav.astro`** at `site/src/components-astro/Nav.astro` (3 links: Home, Menu, About; current-route highlight via `Astro.url.pathname`). Render it inside a `<header>` in `BaseLayout.astro` before the `<slot />`.
4. **Add the 4 UI primitives** (`Section`, `Container`, `Heading`, `Button`) under `site/src/components-astro/ui/`.
5. **Create `pages/menu.astro`** — `<BaseLayout>` + `<Section>` + `<Heading level={1}>Menu</Heading>` + a "coming soon" line.
6. **Create `pages/about.astro`** — `<BaseLayout>` + the rewritten `<About />` component.
7. **Rewrite `Hero.astro`, `About.astro`, `Gallery.astro`** using the primitives. Delete `HelloIsland.svelte` and its import from `index.astro`. Rewrite `index.astro` to render `<Hero />` + `<Gallery />` + `<ContactForm client:idle />`. Remove `<About />` from `index.astro` (now lives on `/about`).
8. **Update `ContactForm.svelte`** submit-button utility classes to match `Button.astro`'s primary variant (inline; no new component).
9. **(Optional)** Add `class="reveal"` to one or two sections to validate scroll-driven animation in Chrome/Safari and graceful degradation in Firefox.

## 8. Explicitly Out of Scope

Per CLAUDE.md's "no features beyond what the task requires":

- **No `themes.css`.** First theme override goes in `tokens.css` with a comment until a second theme exists.
- **No `:root` palette/primitive layer.** Single-layer semantic tokens until a second theme proves the layering is worth its overhead.
- **No spacing/radii/breakpoint tokens.** Tailwind defaults cover them; promote to tokens when a non-primitive caller needs to share a value.
- **No font-loading mechanism.** Token values fall back to system fonts. Add `@font-face` (or Astro's Fonts integration) when typefaces are chosen.
- **No Svelte UI primitives** (`Button.svelte` etc.). Add when interactivity is genuinely required.
- **No `tailwind.config.{js,ts}` file.** Tailwind v4 reads `@theme` directly.
- **No named view transitions** (`transition:name="..."`) — root crossfade only.
- **No JS scroll-reveal fallback** for Firefox. Graceful degradation is "content visible, no animation."
- **No additional UI primitives** (`Card`, `Input`, `Badge`, etc.) — created in response to a second use case, never speculatively.
- **No `menu` content collection.** The menu route is a styled placeholder; modeling menu content is a future task using the `cms-content` skill.
- **No site footer.** Add when content for it exists.
- **No mobile drawer / hamburger.** Three nav links fit at every viewport.

## 9. Validation

Per `.claude/CLAUDE.md` § "Before Considering a Task Complete":

```
pnpm lint --fix
pnpm check
pnpm test
```

Manually verify in `pnpm dev`:

- `/`, `/menu`, `/about` all render and link to each other via the nav.
- Nav highlights the current route.
- Cross-page navigation fades via the root view transition.
- `.reveal` (if applied) animates in Chrome/Safari, static (visible) in Firefox.
- `prefers-reduced-motion` disables both reveals and view transitions.

## Open Questions

- `--font-display` and `--font-body` are placeholders (Fraunces + Inter). If a brand pairing is known, swap the families; if not, the two-family setup is trivially collapsible to one.
- `--color-primary` placeholder is amber — swap when the actual brand color is decided.

Sources:

- [Astro View Transitions guide](https://docs.astro.build/en/guides/view-transitions/)
- [Astro Transitions Router API reference](https://docs.astro.build/en/reference/modules/astro-transitions/)
- [Tailwind v4 transition-duration docs (`--duration-*` namespace)](https://tailwindcss.com/docs/transition-duration)
- [MDN — Scroll-driven animation timelines](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations/Timelines)
- [MDN — `animation-timeline`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline)
- [caniuse — `animation-timeline: scroll()`](https://caniuse.com/mdn-css_properties_animation-timeline_scroll)

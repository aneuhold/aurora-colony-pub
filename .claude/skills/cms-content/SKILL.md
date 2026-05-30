---
name: cms-content
description: Add, update, rename, move, or remove a Sveltia CMS collection or its fields, or upload an image to R2 and point an entry at it. Use whenever the editable content model changes or media is added — e.g. "add an events collection", "rename the gallery 'alt' field to 'caption'", "drop the tagline field", "move about into its own page", "upload these photos to the gallery". Keeps Sveltia config, Astro content collections, and seed files in lockstep.
argument-hint: "<what to change>"
---

You are changing the CMS content model. Sveltia and Astro each describe the collections separately — miss one side and either the editor sees a broken UI or the build breaks. Whatever the operation, the same two files almost always need paired edits:

- `site/public/admin/config.yml` (Sveltia — what the editor sees)
- `site/src/content.config.ts` (Astro — what the build validates and renders)

Plus possibly: seed content in `site/src/content/...` + any Astro component that renders the collection, and upload R2 files.

## Step 1 — Identify the operation

Pick the row that matches what's being asked. Most asks are a combination.

| Operation | What changes |
|---|---|
| **Add collection** | New entry in Sveltia + Astro, new seed file(s), maybe new render component. |
| **Update fields** (add/remove/rename a field, change widget, change required) | Edit field list in Sveltia, edit Zod schema in Astro, update existing content files to match, update any component that reads the field. |
| **Rename collection** | Rename in Sveltia (`name:`), rename in Astro (`collections` export key), move content files/folder, update `getCollection`/`getEntry` callers. |
| **Move content path** (e.g. `src/content/foo.json` → `src/content/foo/index.json`) | Update Sveltia `file:`/`folder:`, update Astro `glob()` pattern/base, move files. |
| **Remove collection** | Delete from Sveltia, delete from Astro `collections` export, delete content files, delete render component + caller references. |
| **Create image** | Upload a local file to R2, then point an entry's image field at the returned URL. No schema change — see *Creating an image* below. |

## Step 2 — Apply Sveltia + Astro edits in lockstep

Whatever the change, treat Sveltia and Astro as a single transaction. The two sides describe the same shape from different angles:

- Sveltia `widget: string` ↔ Zod `z.string()`
- Sveltia `widget: number` ↔ Zod `z.number()` (often `.default(...)`)
- Sveltia `widget: markdown` ↔ markdown body (no Zod field; read via `render(entry)`)
- Sveltia `widget: image` ↔ Zod `z.url()` (the file's R2 URL, not the `image()` callback)
- Sveltia `required: false` ↔ Zod `.optional()`
- Sveltia singleton (`files:` entry) ↔ Astro `glob({ pattern: '<name>.<ext>', base: 'src/content' })`
- Sveltia folder collection ↔ Astro `glob({ pattern: '*.<ext>', base: 'src/content/<name>' })`

Always use `import { z } from 'astro/zod'` in `content.config.ts`. `astro:content`'s `z` is deprecated.

### Sveltia config snippets to copy from

**Singleton** (group related ones under one `files:` entry):

```yaml
- name: site
  label: Site
  files:
    - name: <name>
      label: <Human label>
      file: site/src/content/<name>.<json|md>
      format: <json|frontmatter>
      fields:
        - { name: <field>, label: <Label>, widget: <type>, hint: "<editor-facing explanation>" }
```

**Folder collection**:

```yaml
- name: <name>
  label: <Human label>
  description: <One sentence the editor will read.>
  folder: site/src/content/<name>
  create: true
  delete: true
  slug: "{{fields.<slug-source> | slugify}}-{{year}}{{month}}{{day}}"
  format: json
  fields:
    - { name: <field>, label: <Label>, widget: <type>, hint: "<editor-facing explanation>" }
```

No `media_folder` / `public_folder` on either form — image uploads route to R2 via the top-level `media_libraries.cloudflare_r2` block, not per collection.

**Editor-facing rules** that apply to every field, regardless of operation:

- Every field gets a `hint:` in plain language ("Lower numbers show first", not "ascending sort order").
- Labels are human-friendly (`Display order`, not `order`).
- Image fields need no per-field media config — uploads go to R2.

### Astro `content.config.ts` snippets

**Singleton, no images**:

```ts
const <name> = defineCollection({
  loader: glob({ pattern: '<name>.<json|md>', base: 'src/content' }),
  schema: z.object({ /* ... */ })
});
```

**Folder collection with an image field**:

```ts
const <name> = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/content/<name>' }),
  schema: z.object({
    photo: z.url(),
    alt: z.string(),
    order: z.number().default(0)
  })
});
```

Use the plain `z.object(...)` form — image fields are `z.url()`, not the `({ image }) =>` callback. The bucket host is allow-listed in `astro.config.ts`'s `image.remotePatterns`, so `<Image inferSize />` still optimizes the remote URL at build time.

Don't forget to register/unregister the collection in the `collections` export at the bottom.

## Step 3 — Reconcile existing content

Mismatches between the new schema and existing content files are the most common cause of a broken build after an edit.

- **Add a required field**: every existing entry needs the field set. Either backfill the files or mark the field `required: false` + `.optional()`.
- **Rename a field**: rename it in every existing content file too (`jq` or sed across the folder).
- **Remove a field**: leaving stale keys in JSON is harmless to Astro but confuses the editor — strip them.
- **Change widget type** (e.g. string → number): old data needs converting.
- **Rename a collection**: rename the corresponding folder/file under `src/content/...`. Update every `getCollection('<old>')` / `getEntry('<old>', ...)` caller.
- **Remove a collection**: delete the folder/file under `src/content/...`. Delete its render component. Delete callers.

For new singletons, write a seed file with placeholder values matching the schema — otherwise `getEntry` will throw at build time. For new folder collections, `mkdir` the directory and add a `.gitkeep` so the empty folder is committed.

## Step 4 — Update or remove the render component

If the collection is rendered on a page, the component lives under `site/src/components-astro/`. The convention for non-trivial components is the folder form used by `Gallery/`:

```
<Name>/
  <Name>.astro          # the component
  <Name>.service.ts     # pure logic (sort/filter/group) as a singleton class
  <Name>.service.test.ts
  index.ts              # barrel — re-exports Gallery.astro as default so callers can `import X from '$components-astro/<Name>'`
```

A single `.astro` file in `components-astro/` is fine for components that just dump fields into the DOM with no logic worth unit-testing.

When updating a field, also update the component that reads it (the Astro check usually catches missed renames; missed widget-type changes can sneak through).

When removing a collection, delete the component and every caller — don't leave a dangling `import Gallery from ...` that silently renders nothing.

## Step 5 — Validate

From the repo root:

```
pnpm lint --fix
pnpm check
pnpm test
pnpm build:site
```

- `pnpm check` catches schema mismatches between Sveltia + Astro and missing field references in components.
- `pnpm build:site` catches missing seed files (hard fail) and prints "The collection X does not exist or is empty" for empty folder collections (benign).
- For any collection with uploaded media, confirm hashed image variants appear under `dist/_astro/`. If they don't, the remote image shipped unoptimized — usually `<Image>` isn't being used, or the host is missing from `astro.config.ts`'s `image.remotePatterns`. Optimization fetches the URL over the network at build time, so the R2 object must already exist — a `z.url()` pointing at a missing key fails the build.

If `pnpm build:site` errors with `Could not find Sharp` once real images exist, the workspace's `allowBuilds: sharp: false` in `pnpm-workspace.yaml` is blocking sharp's native build — flip to `true` and re-install. Without sharp, the remote-image optimization can't run.

## Step 6 — File-count sanity check

| Operation | Files modified | Files added | Files deleted |
|---|---|---|---|
| Add collection (no media) | `config.yml`, `content.config.ts` | 1 seed | — |
| Add collection (with image field) | `config.yml`, `content.config.ts` | seed `.gitkeep` + (component) | — |
| Update field (rename/add/remove) | `config.yml`, `content.config.ts`, each existing content file, render component | — | — |
| Rename collection | `config.yml`, `content.config.ts`, every caller | — | — (content folder moved) |
| Move content path | `config.yml`, `content.config.ts` | — | — (files moved) |
| Remove collection | `config.yml`, `content.config.ts`, callers | — | content folder, render component |
| Create image | — | 1 entry JSON per image | — |

If the touched-file count is much larger than the row above, something probably went sideways — back up and re-check the checklist.

## Creating an image

A `widget: image` field holds a URL, not a file, so adding a photo is two moves: get the file into R2, then write an entry that points at it. The editor does this in one step through Sveltia's upload UI; to do it by hand (e.g. seeding many photos at once), use the upload script.

1. Upload the local file(s) to R2:

   ```
   pnpm upload:images <file-or-folder>
   ```

   It uploads each image and prints the public URL of each — the same value Sveltia would store.

2. For each URL, create the entry whose image field is that URL. For the `gallery` folder collection that's a new `site/src/content/gallery/<slug>.json`:

   ```json
   { "photo": "https://media.auroracolonypub.aneuhold.dev/<key>.jpg", "alt": "...", "order": 0 }
   ```

The object must be in R2 before `pnpm build:site` runs, since Astro fetches it to optimize (see Step 5).

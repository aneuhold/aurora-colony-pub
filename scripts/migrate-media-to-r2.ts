import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { globalConstants } from '../site/src/util/globalConstants';

const MEDIA_HOST = globalConstants.mediaHost;

const ROOT = resolve(import.meta.dirname, '..');
const ASSETS_ROOT = join(ROOT, 'site/src/assets');
const CONTENT_ROOT = join(ROOT, 'site/src/content');
const BUCKET = 'aurora-colony-pub-media';

/**
 * Local subfolders we walk. The bucket itself is **flat** — every file ends
 * up at the bucket root, regardless of which folder it came from.
 */
const SOURCE_FOLDERS = ['gallery', 'menus', 'about'] as const;

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

interface DiscoveredFile {
  /** Bucket-root key — the filename itself. */
  key: string;
  /** Absolute path on disk. */
  source: string;
  /** Where it came from (`gallery`, `menus`, `about`). */
  origin: (typeof SOURCE_FOLDERS)[number];
  /** MIME type to set on the object. */
  contentType: string;
}

/**
 * Walks the three asset subfolders and produces one bucket-root entry per
 * file. Throws if two source files would write to the same bucket key —
 * we go in pre-flight so the upload either succeeds end-to-end or not at
 * all (no partial-state). The existing 35 files are already unique.
 */
const discoverFiles = (): DiscoveredFile[] => {
  const all: DiscoveredFile[] = [];
  const seen = new Map<string, string>();
  for (const origin of SOURCE_FOLDERS) {
    const localDir = join(ASSETS_ROOT, origin);
    if (!existsSync(localDir)) continue;
    const files = readdirSync(localDir).filter((name) => !name.startsWith('.'));
    for (const file of files) {
      const ext = extname(file).toLowerCase();
      const contentType = CONTENT_TYPES[ext];
      if (!contentType) {
        throw new Error(`Unsupported file extension for ${origin}/${file} (extension ${ext})`);
      }
      const previous = seen.get(file);
      if (previous) {
        throw new Error(
          `Duplicate filename '${file}' across asset folders (${previous} and ${origin}). ` +
            `Rename one before re-running — the bucket is flat and same-key uploads overwrite.`
        );
      }
      seen.set(file, origin);
      all.push({ key: file, source: join(localDir, file), origin, contentType });
    }
  }
  return all;
};

/**
 * Shells out to `wrangler r2 object put` for a single file. Uses the
 * developer's existing `wrangler login` — no Worker auth needed for a
 * one-time migration.
 *
 * @param file Discovered file to upload
 */
const uploadOne = (file: DiscoveredFile): void => {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'wrangler',
      'r2',
      'object',
      'put',
      `${BUCKET}/${file.key}`,
      '--file',
      file.source,
      '--content-type',
      file.contentType,
      '--remote'
    ],
    { cwd: ROOT, stdio: 'inherit' }
  );
  if (result.status !== 0) {
    throw new Error(
      `wrangler r2 object put failed for ${file.key} (exit ${result.status ?? 'null'})`
    );
  }
};

/**
 * Rewrites every `field` in a folder of JSON content entries from a
 * relative local path (e.g. `../../assets/gallery/foo.jpg`) to the flat
 * R2 URL. Files whose field is already a full URL are left alone.
 *
 * @param folder Folder under `site/src/content/` to walk
 * @param field JSON field name to rewrite
 */
const rewriteContentJson = (folder: string, field: string): number => {
  const dir = join(CONTENT_ROOT, folder);
  if (!existsSync(dir)) return 0;
  const files = readdirSync(dir).filter((name) => name.endsWith('.json'));
  let rewritten = 0;
  for (const file of files) {
    const filePath = join(dir, file);
    const raw = readFileSync(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) continue;
    const data: Record<string, unknown> = { ...parsed };
    const value = data[field];
    if (typeof value !== 'string') continue;
    if (value.startsWith('http://') || value.startsWith('https://')) continue;
    const basename = value.split('/').pop();
    if (!basename) continue;
    data[field] = `${MEDIA_HOST}/${basename}`;
    writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
    rewritten += 1;
  }
  return rewritten;
};

/**
 * Rewrites `![alt](relative)` markdown image references in `about.md` to
 * point at the flat R2 URL. Today the file has zero inline images, but the
 * script covers it for completeness.
 */
const rewriteAboutMarkdown = (): number => {
  const filePath = join(CONTENT_ROOT, 'about.md');
  if (!existsSync(filePath)) return 0;
  const raw = readFileSync(filePath, 'utf8');
  let rewritten = 0;
  const next = raw.replace(/(!\[[^\]]*\])\(([^)]+)\)/g, (match, alt: string, src: string) => {
    if (src.startsWith('http://') || src.startsWith('https://')) return match;
    const basename = src.split('/').pop();
    if (!basename) return match;
    rewritten += 1;
    return `${alt}(${MEDIA_HOST}/${basename})`;
  });
  if (rewritten > 0) {
    writeFileSync(filePath, next);
  }
  return rewritten;
};

const main = (): void => {
  const files = discoverFiles();
  if (files.length === 0) {
    console.log('No source files found — nothing to upload.');
    return;
  }

  console.log(`Uploading ${files.length} files to R2 bucket ${BUCKET} (flat layout)…`);
  for (const file of files) {
    console.log(`  ${file.origin}/${file.key} → ${file.key}`);
    uploadOne(file);
  }

  console.log(`\nRewriting content JSON references…`);
  const galleryRewritten = rewriteContentJson('gallery', 'photo');
  console.log(`  gallery/: rewrote ${galleryRewritten} entries`);
  const menuRewritten = rewriteContentJson('menu-images', 'image');
  console.log(`  menu-images/: rewrote ${menuRewritten} entries`);
  const aboutRewritten = rewriteAboutMarkdown();
  console.log(`  about.md: rewrote ${aboutRewritten} inline image links`);

  console.log(
    `\nDone. Uploaded ${files.length} files; rewrote ${galleryRewritten + menuRewritten + aboutRewritten} content references.`
  );
  console.log(
    `Eyeball the JSON diff, run \`pnpm build\` to confirm Astro fetches the new URLs, then \`git rm -r site/src/assets/{gallery,menus,about}\`.`
  );
};

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}

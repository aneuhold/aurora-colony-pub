import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import imageMediaType from './services/ImageMediaType.service';
import mediaBucket from './services/MediaBucket.service';

/** One image queued for upload: its source path, bucket key, and MIME type. */
interface UploadTarget {
  filePath: string;
  key: string;
  contentType: string;
}

/** Outcome of a single upload, used to build the closing summary. */
interface UploadResult {
  key: string;
  url: string;
  ok: boolean;
}

/**
 * Expands a single CLI path into the image files it contributes. A file path
 * yields itself (if it's a recognized image type); a directory yields every
 * recognized image directly inside it (non-recursive, sorted for stable
 * output). Throws if the path doesn't exist.
 *
 * @param inputPath File or directory path from the command line
 */
const collectImages = async (inputPath: string): Promise<string[]> => {
  const absolute = resolve(inputPath);
  const stats = await stat(absolute);

  if (stats.isDirectory()) {
    const entries = await readdir(absolute);
    return entries
      .filter((entry) => imageMediaType.isSupportedImage(entry))
      .sort()
      .map((entry) => resolve(absolute, entry));
  }

  if (imageMediaType.isSupportedImage(absolute)) {
    return [absolute];
  }

  console.warn(`Skipping ${inputPath} — not a recognized image type.`);
  return [];
};

/**
 * Reads one image off disk and uploads it to the R2 bucket. Logs the failure
 * detail (HTTP status + response body) when the upload doesn't succeed.
 *
 * @param target Image queued for upload
 */
const uploadOne = async (target: UploadTarget): Promise<boolean> => {
  const body = await readFile(target.filePath);
  const outcome = await mediaBucket.uploadObject(target.key, body, target.contentType);
  if (!outcome.ok) {
    const status = outcome.status === 0 ? 'request failed' : `HTTP ${outcome.status}`;
    console.error(`  ${target.key}: ${status}${outcome.detail ? ` — ${outcome.detail}` : ''}`);
  }
  return outcome.ok;
};

/**
 * Turns the collected file paths into upload targets, computing each one's
 * bucket key and content type. Files whose slugified name collides with one
 * already queued are dropped with a warning — the flat bucket would otherwise
 * have the later file silently overwrite the earlier.
 *
 * @param filePaths Absolute paths to the images to upload
 */
const toTargets = (filePaths: string[]): UploadTarget[] => {
  const targets: UploadTarget[] = [];
  const seenKeys = new Map<string, string>();
  for (const filePath of filePaths) {
    const key = mediaBucket.keyForFile(filePath);
    const existing = seenKeys.get(key);
    if (existing) {
      console.warn(
        `Key collision: "${filePath}" and "${existing}" both map to "${key}" — skipping the former.`
      );
      continue;
    }
    const contentType = imageMediaType.contentTypeForFile(filePath);
    if (!contentType) continue;
    seenKeys.set(key, filePath);
    targets.push({ filePath, key, contentType });
  }
  return targets;
};

/**
 * Reads the image paths off the command line, uploads each to R2, and prints a
 * copy-paste block of public URLs so the matching CMS media entries can be
 * created by hand. Accepts any mix of file and directory paths; there is no
 * default path, so at least one argument is required.
 */
const uploadImages = async (): Promise<void> => {
  // Load the repo-root .env so the R2 upload picks up the R2_MEDIA_* credentials.
  process.loadEnvFile(resolve(fileURLToPath(import.meta.url), '../../.env'));

  const inputs = process.argv.slice(2);
  if (inputs.length === 0) {
    console.error('Usage: tsx scripts/upload-images-to-r2.ts <file-or-folder> [...more]');
    process.exitCode = 1;
    return;
  }

  const filePaths: string[] = [];
  for (const input of inputs) {
    filePaths.push(...(await collectImages(input)));
  }

  if (filePaths.length === 0) {
    console.error('No uploadable images found in the given path(s).');
    process.exitCode = 1;
    return;
  }

  const targets = toTargets(filePaths);

  console.log(`Uploading ${targets.length} image(s) to ${mediaBucket.bucket}…`);
  const results: UploadResult[] = [];
  for (const target of targets) {
    const ok = await uploadOne(target);
    results.push({ key: target.key, url: mediaBucket.publicUrl(target.key), ok });
    console.log(`${ok ? '✓' : '✗'} ${target.key}`);
  }

  const succeeded = results.filter((result) => result.ok);
  const failed = results.filter((result) => !result.ok);

  if (succeeded.length > 0) {
    console.log('\nPublic URLs (paste into the matching CMS media entries):');
    for (const result of succeeded) {
      console.log(result.url);
    }
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} upload(s) failed — see the errors above.`);
    process.exitCode = 1;
  }
};

await uploadImages();

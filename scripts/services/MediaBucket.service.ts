import { basename, extname } from 'node:path';
import { globalConstants } from '../../site/src/util/globalConstants';

/**
 * Identity of, and key/URL helpers for, the `aurora-colony-pub-media`
 * Cloudflare R2 bucket that backs CMS media. The bucket name and account ID
 * mirror the `media_libraries.cloudflare_r2` block in
 * `site/public/admin/config.yml` (kept in sync by hand); the public host comes
 * from the site's `globalConstants`. `upload-images-to-r2.ts` uploads here and
 * prints the public URLs this service computes.
 */
class MediaBucketService {
  /** Bucket name. Mirrors config.yml `media_libraries.cloudflare_r2.bucket`. */
  readonly bucket = 'aurora-colony-pub-media';

  /**
   * Account that owns the bucket, passed to `wrangler` as
   * `CLOUDFLARE_ACCOUNT_ID` so an upload is unambiguous when the logged-in
   * user can see more than one account. Mirrors `...cloudflare_r2.account_id`.
   */
  readonly accountId = 'f5fee77ff79a01ea91f541b825d003a3';

  /**
   * Builds the flat bucket key for a local image path: its base name slugified
   * to match Sveltia's `slugify_filename: true`, plus the lowercased original
   * extension (e.g. `My Photo.JPG` → `my-photo.jpg`). Matching Sveltia's
   * slugify keeps a hand-uploaded file on the same key Sveltia itself would
   * have produced.
   *
   * @param filePath Path to the local image file
   */
  keyForFile(filePath: string): string {
    const extension = extname(filePath).toLowerCase();
    const base = basename(filePath, extname(filePath));
    return `${this.slugify(base)}${extension}`;
  }

  /**
   * Public URL for a bucket key — the same value Sveltia would store in an
   * entry's image field.
   *
   * @param key Flat bucket key, e.g. `my-photo.jpg`
   */
  publicUrl(key: string): string {
    return globalConstants.mediaUrl(key);
  }

  /**
   * Slugifies a file's base name the way Sveltia's `slugify_filename` does:
   * lowercased, accents stripped, every run of non-alphanumerics collapsed to
   * a single hyphen, and leading/trailing hyphens trimmed.
   *
   * @param name File base name without its extension
   */
  private slugify(name: string): string {
    return name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

const mediaBucketService = new MediaBucketService();
export default mediaBucketService;

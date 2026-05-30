import { createHash, createHmac } from 'node:crypto';
import { basename, extname } from 'node:path';
import { globalConstants } from '../../site/src/util/globalConstants';

/**
 * Identity of, and key/URL/upload helpers for, the `aurora-colony-pub-media`
 * Cloudflare R2 bucket that backs CMS media. The bucket name and account ID
 * mirror the `media_libraries.cloudflare_r2` block in
 * `site/public/admin/config.yml` (kept in sync by hand); the public host comes
 * from the site's `globalConstants`. Uploads go through R2's S3-compatible API
 * authenticated with the same `R2_MEDIA_ACCESS_KEY_ID` /
 * `R2_MEDIA_SECRET_ACCESS_KEY` credentials Sveltia uses, read from the
 * environment. `upload-images-to-r2.ts` is the caller.
 */
class MediaBucketService {
  /** Bucket name. Mirrors config.yml `media_libraries.cloudflare_r2.bucket`. */
  readonly bucket = 'aurora-colony-pub-media';

  /**
   * Account that owns the bucket, used to derive the S3 API endpoint. Mirrors
   * config.yml `media_libraries.cloudflare_r2.account_id`.
   */
  readonly accountId = 'f5fee77ff79a01ea91f541b825d003a3';

  /** R2's S3 region token — always `auto`. */
  private static readonly REGION = 'auto';

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
   * Uploads an object to the bucket via R2's S3-compatible API, signing the
   * request with SigV4 using the `R2_MEDIA_*` credentials from the
   * environment. Overwrites any existing object at the same key.
   *
   * @param key Flat bucket key to write
   * @param body Object bytes
   * @param contentType MIME type stored on the object
   */
  async uploadObject(
    key: string,
    body: Buffer,
    contentType: string
  ): Promise<{
    ok: boolean;
    /** HTTP status, or 0 if the request never completed (network error). */
    status: number;
    /** Failure detail (response body or error message); absent on success. */
    detail?: string;
  }> {
    const credentials = this.readCredentials();
    const host = `${this.accountId}.r2.cloudflarestorage.com`;
    const canonicalUri = `/${this.bucket}/${encodeURIComponent(key)}`;
    const amzDate = this.amzDate();
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = createHash('sha256').update(body).digest('hex');

    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalHeaders =
      `host:${host}\n` + `x-amz-content-sha256:${payloadHash}\n` + `x-amz-date:${amzDate}\n`;
    const canonicalRequest = [
      'PUT',
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const scope = `${dateStamp}/${MediaBucketService.REGION}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      createHash('sha256').update(canonicalRequest).digest('hex')
    ].join('\n');

    const signingKey = this.signingKey(credentials.secretAccessKey, dateStamp);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const authorization =
      `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    let response: Response;
    try {
      response = await fetch(`https://${host}${canonicalUri}`, {
        method: 'PUT',
        headers: {
          Authorization: authorization,
          'x-amz-content-sha256': payloadHash,
          'x-amz-date': amzDate,
          'Content-Type': contentType
        },
        // `new Uint8Array(body)` yields a Uint8Array<ArrayBuffer>, which fetch's
        // BodyInit accepts — a raw Buffer is typed Buffer<ArrayBufferLike> and isn't.
        body: new Uint8Array(body)
      });
    } catch (error) {
      return {
        ok: false,
        status: 0,
        detail: error instanceof Error ? error.message : String(error)
      };
    }
    if (response.ok) {
      return { ok: true, status: response.status };
    }
    return { ok: false, status: response.status, detail: (await response.text()).trim() };
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

  /**
   * Reads the R2 access-key credentials from the environment, throwing a clear
   * error if either is missing (they live in the repo-root `.env`).
   */
  private readCredentials(): { accessKeyId: string; secretAccessKey: string } {
    const accessKeyId = process.env.R2_MEDIA_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_MEDIA_SECRET_ACCESS_KEY;
    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        'R2_MEDIA_ACCESS_KEY_ID and R2_MEDIA_SECRET_ACCESS_KEY must be set (they live in the repo-root .env).'
      );
    }
    return { accessKeyId, secretAccessKey };
  }

  /**
   * Derives the SigV4 signing key from the secret access key and request date.
   *
   * @param secretAccessKey R2 secret access key
   * @param dateStamp Request date as `YYYYMMDD`
   */
  private signingKey(secretAccessKey: string, dateStamp: string): Buffer {
    const kDate = createHmac('sha256', `AWS4${secretAccessKey}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(MediaBucketService.REGION).digest();
    const kService = createHmac('sha256', kRegion).update('s3').digest();
    return createHmac('sha256', kService).update('aws4_request').digest();
  }

  /**
   * Current UTC time as a SigV4 `x-amz-date` stamp (`YYYYMMDDTHHMMSSZ`).
   */
  private amzDate(): string {
    return new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  }
}

const mediaBucketService = new MediaBucketService();
export default mediaBucketService;

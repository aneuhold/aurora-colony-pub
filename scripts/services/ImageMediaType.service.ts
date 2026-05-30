import { extname } from 'node:path';

/**
 * Shared image extension ↔ MIME-type knowledge for the repo's image scripts.
 * `pull-fb-images.ts` needs MIME → extension (to name downloaded files);
 * `upload-images-to-r2.ts` needs extension → MIME (to set the R2 object's
 * content type) and a supported-type check. Both directions live here so the
 * mapping has a single home instead of one inverse table per script.
 */
class ImageMediaTypeService {
  /** Canonical extension (leading dot, lowercase) → MIME type. */
  private static readonly BY_EXTENSION: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.avif': 'image/avif'
  };

  /** Extension (no dot) returned when a content type isn't recognized. */
  private static readonly FALLBACK_EXTENSION = 'jpg';

  /**
   * Picks a file extension (without the leading dot) for a downloaded image
   * from its response content-type, falling back to `jpg` for unknown or
   * missing types.
   *
   * @param contentType Value of a response `content-type` header
   */
  extensionForContentType(contentType: string | null): string {
    if (contentType) {
      for (const [extension, mimeType] of Object.entries(ImageMediaTypeService.BY_EXTENSION)) {
        // `.jpg` and `.jpeg` share `image/jpeg`; skip `.jpeg` so a JPEG
        // resolves to the shorter, more conventional `jpg`.
        if (extension === '.jpeg') continue;
        const subtype = mimeType.slice(mimeType.indexOf('/') + 1);
        if (contentType.includes(subtype)) return extension.slice(1);
      }
    }
    return ImageMediaTypeService.FALLBACK_EXTENSION;
  }

  /**
   * Resolves the MIME content type for a local image path by its extension,
   * or `undefined` when the extension isn't a recognized image type.
   *
   * @param filePath Path whose extension is inspected (case-insensitive)
   */
  contentTypeForFile(filePath: string): string | undefined {
    return ImageMediaTypeService.BY_EXTENSION[extname(filePath).toLowerCase()];
  }

  /**
   * Whether a local path looks like a supported image, judged by its
   * extension.
   *
   * @param filePath Path whose extension is inspected (case-insensitive)
   */
  isSupportedImage(filePath: string): boolean {
    return this.contentTypeForFile(filePath) !== undefined;
  }
}

const imageMediaTypeService = new ImageMediaTypeService();
export default imageMediaTypeService;

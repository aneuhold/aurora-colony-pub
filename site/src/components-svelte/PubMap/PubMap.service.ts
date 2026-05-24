export interface Geo {
  lat: number;
  lng: number;
}

/**
 * Escapes a string for safe interpolation into an HTML attribute or text node.
 * Used by the popup HTML builder so a malicious address can't inject markup.
 *
 * @param input Untrusted string
 */
const escapeHtml = (input: string): string =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

class PubMapService {
  /**
   * Builds a Google Maps directions URL from a geo coordinate. We use Google
   * here because most visitors have it as their default maps app; the page
   * itself is tracking-free because the tile layer is OSM, not Google.
   *
   * @param geo Lat/lng pair
   */
  buildDirectionsUrl(geo: Geo): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${geo.lat},${geo.lng}`;
  }

  /**
   * Builds the popup HTML for the map marker. Both `label` and
   * `directionsUrl` are escaped.
   *
   * @param label Place label shown in bold
   * @param directionsUrl URL the "Get directions" link points to
   */
  buildPopupHtml(label: string, directionsUrl: string): string {
    return (
      `<strong>${escapeHtml(label)}</strong><br>` +
      `<a href="${escapeHtml(directionsUrl)}" target="_blank" rel="noopener noreferrer">Get directions →</a>`
    );
  }

  /**
   * Returns true when the user has requested reduced motion. Wrapping
   * `matchMedia` keeps callers untouched by jsdom's missing implementation
   * (we return `false` in that case).
   */
  prefersReducedMotion(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}

export default new PubMapService();

import { globalConstants } from '../globalConstants';

class PubMapService {
  /** Opens a Google Maps search result for the address. */
  readonly mapsSearchUrl = `https://www.google.com/maps/?q=${encodeURIComponent(globalConstants.fullAddress)}`;

  /**
   * Google Maps directions URL pointing at the pub. We use Google here
   * because most visitors have it as their default maps app; the page itself
   * is tracking-free because the tile layer is OSM, not Google.
   */
  readonly directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${globalConstants.geo.lat},${globalConstants.geo.lng}`;

  /**
   * Pre-built popup HTML for the Leaflet map marker. All inputs are
   * hardcoded constants — no escaping needed because nothing untrusted ever
   * reaches this string.
   */
  readonly popupHtml =
    `<strong>${globalConstants.fullAddress}</strong><br>` +
    `<a href="${this.directionsUrl}" target="_blank" rel="noopener noreferrer">Get directions →</a>`;

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

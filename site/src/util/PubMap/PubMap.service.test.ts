import { describe, expect, it } from 'vitest';
import pubMapService from './PubMap.service';

describe('pubMapService precomputed location info', () => {
  it('encodes the address in the maps search URL', () => {
    expect(pubMapService.mapsSearchUrl).toBe(
      `https://www.google.com/maps/?q=${encodeURIComponent(pubMapService.address)}`
    );
  });

  it('exposes the hardcoded "City, ST" label', () => {
    expect(pubMapService.cityLabel).toBe('Aurora, OR');
  });

  it('builds the directions URL from the pub geo', () => {
    expect(pubMapService.directionsUrl).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${pubMapService.geo.lat},${pubMapService.geo.lng}`
    );
  });

  it('precomputes popup HTML containing the address and directions URL', () => {
    expect(pubMapService.popupHtml).toContain(`<strong>${pubMapService.address}</strong>`);
    expect(pubMapService.popupHtml).toContain(`href="${pubMapService.directionsUrl}"`);
    expect(pubMapService.popupHtml).toContain('target="_blank"');
    expect(pubMapService.popupHtml).toContain('rel="noopener noreferrer"');
  });
});

describe('pubMapService.prefersReducedMotion', () => {
  it('returns false in jsdom without matchMedia', () => {
    expect(pubMapService.prefersReducedMotion()).toBe(false);
  });
});

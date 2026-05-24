import { describe, expect, it } from 'vitest';
import pubMapService from './PubMap.service';

describe('pubMapService.buildDirectionsUrl', () => {
  it('builds a Google directions URL from lat/lng', () => {
    const url = pubMapService.buildDirectionsUrl({ lat: 45.2347, lng: -122.7548 });
    expect(url).toBe('https://www.google.com/maps/dir/?api=1&destination=45.2347,-122.7548');
  });
});

describe('pubMapService.buildPopupHtml', () => {
  it('wraps the label in <strong> and links the directions URL', () => {
    const html = pubMapService.buildPopupHtml('Aurora Colony Pub', 'https://example.com/dir');
    expect(html).toContain('<strong>Aurora Colony Pub</strong>');
    expect(html).toContain('href="https://example.com/dir"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('escapes HTML in the label', () => {
    const html = pubMapService.buildPopupHtml('<img src=x>', 'https://example.com');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x&gt;');
  });

  it('escapes HTML in the directions URL', () => {
    const html = pubMapService.buildPopupHtml('Place', 'https://example.com/"><script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&quot;');
  });
});

describe('pubMapService.prefersReducedMotion', () => {
  it('returns false in jsdom without matchMedia', () => {
    expect(pubMapService.prefersReducedMotion()).toBe(false);
  });
});

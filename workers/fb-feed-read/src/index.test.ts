import { SELF } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';

describe('fb-feed-read', () => {
  it('returns 200 on GET /', async () => {
    const response = await SELF.fetch('https://example.com/');
    expect(response.status).toBe(200);
  });
});

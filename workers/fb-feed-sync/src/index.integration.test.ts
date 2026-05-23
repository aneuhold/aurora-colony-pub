import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('fb-feed-sync', () => {
  it('returns 401 on GET / without a bearer token', async () => {
    const response = await exports.default.fetch('https://example.com/');
    expect(response.status).toBe(401);
  });
});

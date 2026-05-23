import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

describe('cms-auth', () => {
  it('returns 200 on GET /', async () => {
    const response = await exports.default.fetch('https://example.com/');
    expect(response.status).toBe(200);
  });
});

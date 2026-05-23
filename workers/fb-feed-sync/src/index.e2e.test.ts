import { describe, expect, it } from 'vitest';

const WORKER_URL = 'https://aurora-fb-feed-sync.agneuhold.workers.dev';

describe('fb-feed-sync e2e', () => {
  it('returns 401 on GET / without a bearer token', async () => {
    const response = await fetch(`${WORKER_URL}/`);
    expect(response.status).toBe(401);
  });
});

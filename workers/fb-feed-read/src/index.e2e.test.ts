import { describe, expect, it } from 'vitest';

const WORKER_URL = 'https://aurora-fb-feed-read.agneuhold.workers.dev';

describe('fb-feed-read e2e', () => {
  it('returns 200 OK on GET /', async () => {
    const response = await fetch(`${WORKER_URL}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
  });
});

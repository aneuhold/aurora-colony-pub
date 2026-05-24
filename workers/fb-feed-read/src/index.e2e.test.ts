import type { WorkerFbFeedResponse } from '@aurora/shared';
import { describe, expect, it } from 'vitest';

const WORKER_URL = 'https://aurora-fb-feed-read.agneuhold.workers.dev';

describe('fb-feed-read e2e', () => {
  it('returns 200 with a WorkerFbFeedResponse on GET /', async () => {
    const response = await fetch(`${WORKER_URL}/`);
    expect(response.status).toBe(200);
    const body: WorkerFbFeedResponse = await response.json();
    expect(Array.isArray(body.posts)).toBe(true);
    expect(body.posts.length).toBeGreaterThan(0);
    expect(typeof body.syncedAt).toBe('string');
  });
});

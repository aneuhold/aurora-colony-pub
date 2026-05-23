import { describe, expect, it } from 'vitest';

const WORKER_URL = 'https://aurora-cms-auth.agneuhold.workers.dev';

describe('cms-auth e2e', () => {
  it('returns 200 OK on GET /', async () => {
    const response = await fetch(`${WORKER_URL}/`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('OK');
  });
});

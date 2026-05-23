import { describe, expect, it } from 'vitest';

const WORKER_URL = 'https://aurora-cms-auth.agneuhold.workers.dev';

describe('cms-auth e2e', () => {
  it('returns 404 on GET /', async () => {
    const response = await fetch(`${WORKER_URL}/`);
    expect(response.status).toBe(404);
  });

  it('redirects to GitHub on GET /auth', async () => {
    const response = await fetch(`${WORKER_URL}/auth`, { redirect: 'manual' });
    expect(response.status).toBe(302);
    const location = response.headers.get('Location') ?? '';
    expect(new URL(location).host).toBe('github.com');
  });
});

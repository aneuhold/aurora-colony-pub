import { exports } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import authService from './services/AuthService';

const ORIGIN = 'https://example.com';

describe('cms-auth', () => {
  it('GET /auth redirects to GitHub authorize with client_id and sets a state cookie', async () => {
    const response = await exports.default.fetch(`${ORIGIN}/auth`, { redirect: 'manual' });
    expect(response.status).toBe(302);
    const location = response.headers.get('Location') ?? '';
    expect(location.startsWith('https://github.com/login/oauth/authorize?')).toBe(true);
    const locationUrl = new URL(location);
    expect(locationUrl.searchParams.get('client_id')).toBe('test-client-id');
    expect(locationUrl.searchParams.get('scope')).toBe('repo,user');
    expect(locationUrl.searchParams.get('state')).toBeTruthy();
    const setCookie = response.headers.get('Set-Cookie') ?? '';
    expect(setCookie.startsWith('aurora_cms_oauth_state=')).toBe(true);
  });

  it('GET /callback without a code returns 400', async () => {
    const response = await exports.default.fetch(`${ORIGIN}/callback`);
    expect(response.status).toBe(400);
  });

  it('GET /callback with a code but mismatched state cookie returns 400', async () => {
    const response = await exports.default.fetch(`${ORIGIN}/callback?code=abc&state=xyz`, {
      headers: { Cookie: 'aurora_cms_oauth_state=other.signature' }
    });
    expect(response.status).toBe(400);
  });

  it('returns 404 for unknown routes', async () => {
    const response = await exports.default.fetch(`${ORIGIN}/`);
    expect(response.status).toBe(404);
  });

  it('isUserAllowed honors the configured allowlist', () => {
    expect(authService.isUserAllowed('aneuhold')).toBe(true);
    expect(authService.isUserAllowed('someone-else')).toBe(false);
  });
});

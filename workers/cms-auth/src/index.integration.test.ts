import { allowedOrigins } from '@aurora/workers-shared';
import {
  createTestIpGenerator,
  fetchInputUrl,
  sentryIngestAwareFetch
} from '@aurora/workers-shared/test-utils';
import { env as workerEnv, exports } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import authService from './services/AuthService';

const ORIGIN = 'https://example.com';
const ALLOWED_ORIGIN = allowedOrigins[0];

interface GitHubUserMockOptions {
  status?: number;
  login?: string;
}

const setupGitHubUserMock = (options: GitHubUserMockOptions = {}): void => {
  const { status = 200, login = 'aneuhold' } = options;
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    sentryIngestAwareFetch((input) => {
      const url = fetchInputUrl(input);
      if (url === 'https://api.github.com/user') {
        return Promise.resolve(
          new Response(JSON.stringify({ login }), {
            status,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }
      return Promise.reject(new Error(`Unexpected outbound fetch in test: ${url}`));
    })
  );
};

const nextIp = createTestIpGenerator();

const fetchR2Credentials = (
  init: { token?: string | null; origin?: string | null; method?: string } = {}
): Promise<Response> => {
  const headers: Record<string, string> = {
    'CF-Connecting-IP': nextIp()
  };
  if (init.origin !== null) {
    headers.Origin = init.origin ?? ALLOWED_ORIGIN;
  }
  if (init.token !== null && init.token !== undefined) {
    headers.Authorization = `Bearer ${init.token}`;
  }
  return exports.default.fetch(`${ORIGIN}/r2-credentials`, {
    method: init.method ?? 'GET',
    headers
  });
};

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

  describe('GET /r2-credentials', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns 204 with CORS headers on OPTIONS preflight from an allowed origin', async () => {
      const response = await fetchR2Credentials({ method: 'OPTIONS', token: null });
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ALLOWED_ORIGIN);
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
      expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
    });

    it('returns 401 when the Authorization header is missing', async () => {
      const response = await fetchR2Credentials({ token: null });
      expect(response.status).toBe(401);
    });

    it('returns 401 when GitHub rejects the supplied token', async () => {
      setupGitHubUserMock({ status: 401 });
      const response = await fetchR2Credentials({ token: 'bad-gh-token' });
      expect(response.status).toBe(401);
    });

    it('returns 403 when GitHub returns a login not on the allowlist', async () => {
      setupGitHubUserMock({ login: 'someone-else' });
      const response = await fetchR2Credentials({ token: 'gh-token' });
      expect(response.status).toBe(403);
    });

    it('returns 200 with the R2 access key id + secret for an allowlisted login', async () => {
      setupGitHubUserMock();
      const response = await fetchR2Credentials({ token: 'gh-token' });
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      const body = await response.json<{ secretAccessKey: string }>();
      expect(body).toEqual({ secretAccessKey: 'test-r2-secret-access-key' });
    });

    it('returns the secret without a token when ALLOW_NO_AUTH_FOR_R2_KEY is set', async () => {
      const original = workerEnv.ALLOW_NO_AUTH_FOR_R2_KEY;
      workerEnv.ALLOW_NO_AUTH_FOR_R2_KEY = 'true';
      try {
        const response = await fetchR2Credentials({ token: null });
        expect(response.status).toBe(200);
        const body = await response.json<{ secretAccessKey: string }>();
        expect(body).toEqual({ secretAccessKey: 'test-r2-secret-access-key' });
      } finally {
        workerEnv.ALLOW_NO_AUTH_FOR_R2_KEY = original;
      }
    });
  });
});

import type { WorkerFbFeedResponse } from '@aurora/shared';
import { env, exports } from 'cloudflare:workers';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fbFeedReadConstants } from './util/fbFeedReadConstants';
import { mockFbGraphResponse } from './util/mockFbGraphResponse';

const ORIGIN = fbFeedReadConstants.allowedOrigins[0];
const FORBIDDEN_ORIGIN = 'https://evil.example.com';

let ipCounter = 0;
const nextIp = (): string => {
  ipCounter += 1;
  return `203.0.113.${ipCounter}`;
};

const get = (init: { origin?: string | null; method?: string } = {}): Promise<Response> => {
  const headers: Record<string, string> = { 'CF-Connecting-IP': nextIp() };
  if (init.origin !== null && init.origin !== undefined) {
    headers.Origin = init.origin;
  } else if (init.origin !== null) {
    headers.Origin = ORIGIN;
  }
  return exports.default.fetch('https://fb-feed-read.example.com/', {
    method: init.method ?? 'GET',
    headers
  });
};

const allowSentryFetch = (): void => {
  // The Sentry SDK fires-and-forgets to its ingest. Allow those and reject
  // any other outbound call so the test only sees what we expect.
  vi.spyOn(globalThis, 'fetch').mockImplementation((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (/^https:\/\/[^/]*\.ingest\.[^/]*sentry\.io\//.test(url)) {
      return Promise.resolve(new Response(null, { status: 200 }));
    }
    return Promise.reject(new Error(`Unexpected outbound fetch in test: ${url}`));
  });
};

const seedKv = async (payload: WorkerFbFeedResponse): Promise<void> => {
  await env.AURORA_COLONY_PUB_KV.put(fbFeedReadConstants.kvKey, JSON.stringify(payload));
};

const clearKv = async (): Promise<void> => {
  await env.AURORA_COLONY_PUB_KV.delete(fbFeedReadConstants.kvKey);
};

describe('fb-feed-read worker', () => {
  beforeAll(async () => {
    // Pay miniflare's first-call cold start here so the first real test
    // doesn't trip the 5s default timeout.
    allowSentryFetch();
    const response = await exports.default.fetch('https://fb-feed-read.example.com/', {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN }
    });
    await response.text();
    vi.restoreAllMocks();
  }, 30_000);

  beforeEach(() => {
    allowSentryFetch();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await clearKv();
  });

  it('returns 204 with CORS headers on OPTIONS preflight from an allowed origin', async () => {
    const response = await get({ method: 'OPTIONS' });
    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
    expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
  });

  it('returns 200 with the transformed mock payload when KV is empty', async () => {
    const response = await get();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe(fbFeedReadConstants.cacheControl);
    const body = await response.json<WorkerFbFeedResponse>();
    expect(body.posts).toHaveLength(mockFbGraphResponse.data.length);
    expect(body.posts[0].id).toBe(mockFbGraphResponse.data[0].id);
    expect(typeof body.syncedAt).toBe('string');
  });

  it('returns the KV-stored payload verbatim when one is present', async () => {
    const stored: WorkerFbFeedResponse = {
      posts: [
        {
          id: 'stored_1',
          message: 'from kv',
          permalink: 'https://www.facebook.com/theauroracolonypub/',
          createdAt: '2026-05-20T00:00:00+0000'
        }
      ],
      syncedAt: '2026-05-20T00:00:01.000Z'
    };
    await seedKv(stored);
    const response = await get();
    expect(response.status).toBe(200);
    const body = await response.json<WorkerFbFeedResponse>();
    expect(body).toEqual(stored);
  });

  it('returns 405 on POST', async () => {
    const response = await get({ method: 'POST' });
    expect(response.status).toBe(405);
  });

  it('returns 403 when an Origin header is sent but not allowlisted', async () => {
    const response = await get({ origin: FORBIDDEN_ORIGIN });
    expect(response.status).toBe(403);
  });

  it('echoes the allowed origin on a 200 response', async () => {
    const response = await get();
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(ORIGIN);
  });

  it('returns 429 when the rate-limit binding rejects the request', async () => {
    vi.spyOn(env.RATE_LIMITER, 'limit').mockResolvedValueOnce({ success: false });
    const response = await get();
    expect(response.status).toBe(429);
  });
});

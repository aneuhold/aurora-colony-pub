import type { WorkerFbFeedResponse } from '@aurora/shared';
import { allowedOrigins } from '@aurora/workers-shared';
import {
  createTestIpGenerator,
  installSentryOnlyFetchMock
} from '@aurora/workers-shared/test-utils';
import { env, exports } from 'cloudflare:workers';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fbFeedReadConstants } from './util/fbFeedReadConstants';
import { buildMockFbGraphResponse, mockFbPostCount } from './util/mockFbGraphResponse';

const ORIGIN = allowedOrigins[0];
const FORBIDDEN_ORIGIN = 'https://evil.example.com';

const nextIp = createTestIpGenerator();

const get = (init: { origin?: string | null; method?: string } = {}): Promise<Response> => {
  const headers: Record<string, string> = { 'CF-Connecting-IP': nextIp() };
  if (typeof init.origin === 'string') {
    headers.Origin = init.origin;
  } else if (init.origin === undefined) {
    headers.Origin = ORIGIN;
  }
  return exports.default.fetch('https://fb-feed-read.example.com/', {
    method: init.method ?? 'GET',
    headers
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
    installSentryOnlyFetchMock();
    const response = await exports.default.fetch('https://fb-feed-read.example.com/', {
      method: 'OPTIONS',
      headers: { Origin: ORIGIN }
    });
    await response.text();
    vi.restoreAllMocks();
  }, 30_000);

  beforeEach(() => {
    installSentryOnlyFetchMock();
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
    expect(body.posts).toHaveLength(mockFbPostCount);
    const firstSeedId = buildMockFbGraphResponse('https://example.test').data[0].id;
    expect(body.posts[0].id).toBe(firstSeedId);
    expect(typeof body.syncedAt).toBe('string');
  });

  it('anchors photo URLs at the allowlisted caller origin', async () => {
    const response = await get();
    const body = await response.json<WorkerFbFeedResponse>();
    const firstWithImage = body.posts.find((post) => post.imageUrl !== undefined);
    expect(firstWithImage?.imageUrl).toMatch(new RegExp(`^${ORIGIN}/fb-mock/.+\\.jpg$`));
  });

  it('falls back to the default photo origin when no Origin header is present', async () => {
    const response = await exports.default.fetch('https://fb-feed-read.example.com/', {
      method: 'GET',
      headers: { 'CF-Connecting-IP': nextIp() }
    });
    const body = await response.json<WorkerFbFeedResponse>();
    const firstWithImage = body.posts.find((post) => post.imageUrl !== undefined);
    expect(firstWithImage?.imageUrl?.startsWith(fbFeedReadConstants.defaultPhotoOrigin)).toBe(true);
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

import type { FbGraphPostsResponse, WorkerFbFeedResponse } from '@aurora/shared';
import {
  createTestIpGenerator,
  fetchInputUrl,
  installSentryOnlyFetchMock,
  sentryIngestAwareFetch
} from '@aurora/workers-shared/test-utils';
import {
  createExecutionContext,
  createScheduledController,
  waitOnExecutionContext
} from 'cloudflare:test';
import { env, exports } from 'cloudflare:workers';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from './index';
import { fbFeedSyncConstants } from './util/fbFeedSyncConstants';

const VALID_BEARER = 'Bearer test-manual-sync-token';

const nextIp = createTestIpGenerator();

const GRAPH_RESPONSE: FbGraphPostsResponse = {
  data: [
    {
      id: '465497836965753_111',
      message: 'Live music tonight at 8.',
      permalink_url: 'https://www.facebook.com/theauroracolonypub/posts/111',
      created_time: '2026-05-23T19:00:00+0000',
      full_picture: 'https://scontent.example.com/live-music.jpg'
    },
    {
      id: '465497836965753_112',
      permalink_url: 'https://www.facebook.com/theauroracolonypub/posts/112',
      created_time: '2026-05-22T11:30:00+0000'
    }
  ]
};

/**
 * Installs a fetch mock that answers the Graph `/posts` request and rejects
 * any other (non-Sentry) outbound call.
 *
 * @param graphResponse Status + JSON body to return for the Graph call
 * @param graphResponse.status HTTP status the mocked Graph call returns
 * @param graphResponse.body JSON body the mocked Graph call returns
 */
const setupGraphFetchMock = (graphResponse: { status?: number; body?: unknown } = {}): void => {
  const { status = 200, body = GRAPH_RESPONSE } = graphResponse;
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    sentryIngestAwareFetch((input) => {
      const url = fetchInputUrl(input);
      if (url.startsWith('https://graph.facebook.com/')) {
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' }
          })
        );
      }
      return Promise.reject(new Error(`Unexpected outbound fetch in test: ${url}`));
    })
  );
};

const post = (init: { bearer?: string } = {}): Promise<Response> => {
  const headers: Record<string, string> = { 'CF-Connecting-IP': nextIp() };
  if (init.bearer !== undefined) {
    headers.Authorization = init.bearer;
  }
  return exports.default.fetch('https://fb-feed-sync.example.com/', {
    method: 'POST',
    headers
  });
};

const readStoredFeed = (): Promise<WorkerFbFeedResponse | null> =>
  env.AURORA_COLONY_PUB_KV.get<WorkerFbFeedResponse>(fbFeedSyncConstants.kvKey, 'json');

const clearKv = async (): Promise<void> => {
  await env.AURORA_COLONY_PUB_KV.delete(fbFeedSyncConstants.kvKey);
};

describe('fb-feed-sync worker', () => {
  beforeAll(async () => {
    // Pay miniflare's first-call cold start here so the first real test
    // doesn't trip the 5s default timeout.
    installSentryOnlyFetchMock();
    const response = await exports.default.fetch('https://fb-feed-sync.example.com/', {
      method: 'POST',
      headers: { 'CF-Connecting-IP': nextIp() }
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

  it('returns 401 without a bearer token', async () => {
    const response = await post();
    expect(response.status).toBe(401);
  });

  it('returns 429 when the rate-limit binding rejects the request', async () => {
    vi.spyOn(env.RATE_LIMITER, 'limit').mockResolvedValueOnce({ success: false });
    const response = await post({ bearer: VALID_BEARER });
    expect(response.status).toBe(429);
  });

  it('returns 502 when the Graph fetch fails', async () => {
    setupGraphFetchMock({ status: 500, body: { error: 'boom' } });
    const response = await post({ bearer: VALID_BEARER });
    expect(response.status).toBe(502);
    expect(await readStoredFeed()).toBeNull();
  });

  it('returns 200 and writes a WorkerFbFeedResponse to KV on a valid manual call', async () => {
    setupGraphFetchMock();
    const response = await post({ bearer: VALID_BEARER });
    expect(response.status).toBe(200);

    const stored = await readStoredFeed();
    expect(stored).not.toBeNull();
    expect(stored?.posts).toHaveLength(GRAPH_RESPONSE.data.length);
    expect(stored?.posts[0].id).toBe(GRAPH_RESPONSE.data[0].id);
    expect(stored?.posts[0].imageUrl).toBe(GRAPH_RESPONSE.data[0].full_picture);
    expect(stored?.posts[1].message).toBe('');
    expect(typeof stored?.syncedAt).toBe('string');
  });

  it('writes to KV when driven by the scheduled (cron) handler', async () => {
    setupGraphFetchMock();
    const controller = createScheduledController({
      scheduledTime: new Date(),
      cron: '*/30 * * * *'
    });
    const ctx = createExecutionContext();
    if (worker.scheduled === undefined) {
      throw new Error('Worker does not export a scheduled handler');
    }
    await worker.scheduled(controller, env, ctx);
    await waitOnExecutionContext(ctx);

    const stored = await readStoredFeed();
    expect(stored).not.toBeNull();
    expect(stored?.posts).toHaveLength(GRAPH_RESPONSE.data.length);
  });
});

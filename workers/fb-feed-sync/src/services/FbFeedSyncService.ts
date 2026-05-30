import { graphPostsToWorkerPosts, type WorkerFbFeedResponse } from '@aurora/shared';
import { checkIpRateLimit } from '@aurora/workers-shared';
import * as Sentry from '@sentry/cloudflare';
import type { Env } from '../Env';
import { fbFeedSyncConstants } from '../util/fbFeedSyncConstants';
import fbGraphService from './FbGraphService';

/**
 * Sync orchestration singleton. Fetches the latest Graph posts, normalises
 * them to the wire format, and writes the snapshot to KV under
 * `fbFeedSyncConstants.kvKey`. Driven by the cron `scheduled` handler and
 * by an authenticated manual POST. Keeps the worker entry point trivial.
 */
class FbFeedSyncService {
  /**
   * Manual-trigger dispatcher. Rate limits by IP, requires the shared
   * bearer token, then runs a sync. Returns 200 on success, 502 when the
   * Graph fetch fails.
   *
   * @param request Incoming request
   * @param env Worker env (secrets + rate limiter binding)
   */
  async handleRequest(request: Request, env: Env): Promise<Response> {
    if (!(await checkIpRateLimit(request, env))) {
      return new Response('Too Many Requests', { status: 429 });
    }
    if (request.headers.get('Authorization') !== `Bearer ${env.FB_MANUAL_SYNC_TOKEN}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    try {
      await this.syncFeed(env);
    } catch (error) {
      // The cron path lets errors bubble to the withSentry wrapper; the
      // manual path swallows them to return a clean 502, so capture here
      // explicitly to keep manual-trigger failures visible in Sentry.
      Sentry.captureException(error);
      return new Response('Bad Gateway', { status: 502 });
    }
    return new Response('OK', { status: 200 });
  }

  /**
   * Fetches the latest posts, transforms them, and writes the snapshot to
   * KV. Throws on a Graph failure so callers (manual + cron) surface the
   * error to Sentry.
   *
   * To test this manually locally, run with dev and trigger with:
   *
   * ```
   * curl -i -X POST -H "Authorization: Bearer $FB_MANUAL_SYNC_TOKEN" http://localhost:8789
   * ```
   *
   * @param env Worker env (KV + secrets)
   */
  async syncFeed(env: Env): Promise<void> {
    const graphResponse = await fbGraphService.fetchLatestPosts(env);
    const payload: WorkerFbFeedResponse = {
      posts: graphPostsToWorkerPosts(graphResponse),
      syncedAt: new Date().toISOString()
    };
    await env.AURORA_COLONY_PUB_KV.put(fbFeedSyncConstants.kvKey, JSON.stringify(payload));
  }
}

export default new FbFeedSyncService();

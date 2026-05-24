import { graphPostsToWorkerPosts, type WorkerFbFeedResponse } from '@aurora/shared';
import {
  checkIpRateLimit,
  corsHeaders,
  isAllowedOrigin,
  jsonResponse
} from '@aurora/workers-shared';
import type { Env } from '../Env';
import { fbFeedReadConstants } from '../util/fbFeedReadConstants';
import { buildMockFbGraphResponse } from '../util/mockFbGraphResponse';

const CORS_METHODS = ['GET', 'OPTIONS'] as const;

/**
 * Read-only Facebook feed singleton. Returns the latest snapshot the sync
 * Worker wrote to KV when present; otherwise transforms the in-repo mock
 * Graph response so the frontend has something to render today.
 */
class FbFeedReadService {
  /**
   * Top-level dispatcher. CORS allowlist, method gate, IP rate limit, then
   * read order: KV first (the day the sync Worker starts producing data,
   * this branch silently takes over), mock literal second.
   *
   * @param request Incoming request
   * @param env Worker env (KV + rate limiter bindings)
   */
  async handleRequest(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const echoedOrigin = origin && isAllowedOrigin(origin) ? origin : '';
    const cors: Record<string, string> = echoedOrigin
      ? corsHeaders(echoedOrigin, CORS_METHODS)
      : { Vary: 'Origin' };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { Allow: 'GET, OPTIONS', ...cors }
      });
    }
    if (origin !== null && !echoedOrigin) {
      return jsonResponse({ error: 'Forbidden origin' }, 403, cors);
    }

    if (!(await checkIpRateLimit(request, env))) {
      return jsonResponse({ error: 'Too Many Requests' }, 429, cors);
    }

    const stored = await env.AURORA_COLONY_PUB_KV.get<WorkerFbFeedResponse>(
      fbFeedReadConstants.kvKey,
      'json'
    );
    if (stored !== null) {
      return jsonResponse(stored, 200, {
        ...cors,
        'Cache-Control': fbFeedReadConstants.cacheControl
      });
    }

    const photoBaseOrigin = echoedOrigin || fbFeedReadConstants.defaultPhotoOrigin;
    const payload: WorkerFbFeedResponse = {
      posts: graphPostsToWorkerPosts(buildMockFbGraphResponse(photoBaseOrigin)),
      syncedAt: new Date().toISOString()
    };
    return jsonResponse(payload, 200, {
      ...cors,
      'Cache-Control': fbFeedReadConstants.cacheControl
    });
  }
}

export default new FbFeedReadService();

import type { WorkerFbFeedResponse } from '@aurora/shared';
import { checkIpRateLimit, jsonResponse, resolveCors } from '@aurora/workers-shared';
import { fbFeedReadConstants } from '../util/fbFeedReadConstants';

/**
 * Read-only Facebook feed singleton. Returns the latest snapshot the sync
 * Worker wrote to KV when present; otherwise serves a degraded empty feed
 * the frontend renders as its `empty` state.
 */
class FbFeedReadService {
  /**
   * Top-level dispatcher. CORS allowlist, method gate, IP rate limit, then
   * the KV snapshot when present, falling back to an empty feed.
   *
   * @param request Incoming request
   * @param env Worker env (KV + rate limiter bindings)
   */
  async handleRequest(request: Request, env: Env): Promise<Response> {
    const { headers: cors, originAllowed, response: corsResponse } = resolveCors(request, ['GET']);
    if (corsResponse) return corsResponse;
    // Requests without an `Origin` header (not sent by a browser) are allowed.
    if (request.headers.has('Origin') && !originAllowed) {
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

    const empty: WorkerFbFeedResponse = { posts: [], syncedAt: null };
    return jsonResponse(empty, 200, {
      ...cors,
      'Cache-Control': fbFeedReadConstants.cacheControl
    });
  }
}

const fbFeedReadService = new FbFeedReadService();
export default fbFeedReadService;

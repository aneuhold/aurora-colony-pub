import { graphPostsToWorkerPosts, type WorkerFbFeedResponse } from '@aurora/shared';
import type { Env } from '../Env';
import { fbFeedReadConstants } from '../util/fbFeedReadConstants';
import { mockFbGraphResponse } from '../util/mockFbGraphResponse';

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
    const echoedOrigin = origin && this.isAllowedOrigin(origin) ? origin : '';
    const cors: Record<string, string> = echoedOrigin
      ? this.corsHeaders(echoedOrigin)
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
      return this.jsonResponse({ error: 'Forbidden origin' }, 403, cors);
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { success: rateOk } = await env.RATE_LIMITER.limit({ key: ip });
    if (!rateOk) {
      return this.jsonResponse({ error: 'Too Many Requests' }, 429, cors);
    }

    const stored = await env.AURORA_COLONY_PUB_KV.get<WorkerFbFeedResponse>(
      fbFeedReadConstants.kvKey,
      'json'
    );
    if (stored !== null) {
      return this.jsonResponse(stored, 200, {
        ...cors,
        'Cache-Control': fbFeedReadConstants.cacheControl
      });
    }

    const payload: WorkerFbFeedResponse = {
      posts: graphPostsToWorkerPosts(mockFbGraphResponse),
      syncedAt: new Date().toISOString()
    };
    return this.jsonResponse(payload, 200, {
      ...cors,
      'Cache-Control': fbFeedReadConstants.cacheControl
    });
  }

  private isAllowedOrigin(origin: string): boolean {
    return fbFeedReadConstants.allowedOrigins.includes(origin);
  }

  private corsHeaders(origin: string): Record<string, string> {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin'
    };
  }

  private jsonResponse(
    body: unknown,
    status: number,
    extraHeaders: Record<string, string>
  ): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...extraHeaders }
    });
  }
}

export default new FbFeedReadService();

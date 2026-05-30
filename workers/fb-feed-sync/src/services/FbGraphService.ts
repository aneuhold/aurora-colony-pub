import type { FbGraphPostsResponse } from '@aurora/shared';
import type { Env } from '../Env';
import { fbFeedSyncConstants } from '../util/fbFeedSyncConstants';

/**
 * Thin Facebook Graph API client singleton. Owns the single outbound call
 * the sync worker makes; the orchestrator hands the raw response to
 * `graphPostsToWorkerPosts` from `@aurora/shared`.
 */
class FbGraphService {
  /**
   * Fetches the latest posts for the pub's Page via the Graph `/posts`
   * edge. Throws on a non-2xx response so the orchestrator can surface a
   * 502 and let Sentry capture the failure.
   *
   * The Page access token is sent as an `Authorization: Bearer` header
   * rather than a query param so it never lands in fetch-instrumentation
   * spans, Sentry breadcrumbs, or Cloudflare request logs.
   *
   * @param env Worker env (supplies the Page access token)
   */
  async fetchLatestPosts(env: Env): Promise<FbGraphPostsResponse> {
    const { graphApiVersion, pageId, fields, postLimit } = fbFeedSyncConstants;
    const url = new URL(`https://graph.facebook.com/${graphApiVersion}/${pageId}/posts`);
    url.searchParams.set('fields', fields);
    url.searchParams.set('limit', String(postLimit));

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${env.FB_PAGE_ACCESS_TOKEN}` }
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Graph API request failed (${response.status}): ${detail}`);
    }
    return response.json<FbGraphPostsResponse>();
  }
}

export default new FbGraphService();

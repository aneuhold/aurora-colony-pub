import type { FbGraphPostsResponse } from '@aurora/shared';
import type { Env } from '../Env';
import { fbFeedSyncConstants } from '../util/fbFeedSyncConstants';

/**
 * Thin Facebook Graph API client singleton. Owns the single outbound call
 * the sync worker makes; the orchestrator hands the raw response to
 * `graphPostsToWorkerPosts` from `@aurora/shared`.
 */
class FbGraphService {
  /** Extra attempts after the first on a transient (5xx / network) failure. */
  private static readonly maxRetries = 2;
  /** Base delay for the exponential backoff between retries, in ms. */
  private static readonly retryBaseDelayMs = 250;

  /**
   * Fetches the latest posts for the pub's Page via the Graph `/posts`
   * edge. Retries transient failures (5xx responses and network errors)
   * with exponential backoff — Graph routinely returns a 500
   * `OAuthException` code 1 ("An unknown error has occurred") that clears
   * on a retry. Client errors (4xx — auth, permissions) won't self-heal,
   * so they fail fast. After the retries are exhausted it throws so the
   * orchestrator can surface a 502 and let Sentry capture the failure.
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

    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= FbGraphService.maxRetries; attempt++) {
      if (attempt > 0) {
        await this.sleep(FbGraphService.retryBaseDelayMs * 2 ** (attempt - 1));
      }

      let response: Response;
      try {
        response = await fetch(url.toString(), {
          headers: { Authorization: `Bearer ${env.FB_PAGE_ACCESS_TOKEN}` }
        });
      } catch (networkError) {
        // Network-level failure (DNS, connection reset). Transient — retry.
        lastError = networkError instanceof Error ? networkError : new Error(String(networkError));
        continue;
      }

      if (response.ok) {
        return response.json<FbGraphPostsResponse>();
      }

      const detail = await response.text();
      const error = new Error(`Graph API request failed (${response.status}): ${detail}`);
      if (response.status < 500) {
        // Client error (auth, permissions, bad request) — won't self-heal.
        throw error;
      }
      lastError = error;
    }

    throw lastError ?? new Error('Graph API request failed after retries');
  }

  /**
   * Resolves after the given delay. Used to space out retry attempts.
   *
   * @param ms Delay in milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const fbGraphService = new FbGraphService();
export default fbGraphService;

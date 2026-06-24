import type { FbGraphPost, FbGraphPostsResponse } from '@aurora/shared';
import type { Env } from '../Env';
import { fbFeedSyncConstants } from '../util/fbFeedSyncConstants';

/**
 * Thin Facebook Graph API client singleton.
 */
class FbGraphService {
  /** Extra attempts after the first on a transient (5xx / network) failure. */
  private static readonly maxRetries = 2;
  /** Base delay for the exponential backoff between retries, in ms. */
  private static readonly retryBaseDelayMs = 250;

  /**
   * Fetches the latest posts for the pub's Page.
   *
   * @param env Worker env (supplies the Page access token)
   */
  async fetchLatestPosts(env: Env): Promise<FbGraphPostsResponse> {
    const { fields, pageId, postLimit } = fbFeedSyncConstants;
    const response = await this.graphGet<FbGraphPostsResponse>(
      env,
      `${pageId}/posts?fields=${fields}&limit=${postLimit}`
    );
    // See if any have a parent that needs to be fetched (a repost or something along those lines)
    for (const post of response.data) {
      if (post.parent_id === undefined) {
        continue;
      }
      const parent = await this.fetchPost(env, post.parent_id);
      // Message from the pub goes first, then the content of the parent
      post.message = [post.message?.trim(), parent.message?.trim()].filter(Boolean).join('\n\n');
      post.full_picture ??= parent.full_picture;
    }
    return response;
  }

  /**
   * Fetches a single post by ID with the standard field set.
   *
   * @param env Worker env (supplies the Page access token)
   * @param id Graph post ID
   */
  private fetchPost(env: Env, id: string): Promise<FbGraphPost> {
    return this.graphGet<FbGraphPost>(env, `${id}?fields=${fbFeedSyncConstants.fields}`);
  }

  /**
   * GETs a Graph API path and parses the JSON body. Transient failures (5xx
   * responses and network errors) retry with exponential backoff — Graph
   * routinely returns a 500 `OAuthException` code 1 that clears on a retry.
   * Client errors (4xx — auth, permissions) won't self-heal, so they fail
   * fast. The Page access token rides an `Authorization: Bearer` header rather
   * than a query param so it never lands in spans, breadcrumbs, or logs.
   *
   * @param env Worker env (supplies the Page access token)
   * @param path Graph path after the pinned version segment
   */
  private async graphGet<T>(env: Env, path: string): Promise<T> {
    const url = `https://graph.facebook.com/${fbFeedSyncConstants.graphApiVersion}/${path}`;
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= FbGraphService.maxRetries; attempt++) {
      if (attempt > 0) {
        await this.sleep(FbGraphService.retryBaseDelayMs * 2 ** (attempt - 1));
      }

      let response: Response;
      try {
        response = await fetch(url, {
          headers: { Authorization: `Bearer ${env.FB_PAGE_ACCESS_TOKEN}` }
        });
      } catch (networkError) {
        // Network-level failure (DNS, connection reset). Transient — retry.
        lastError = networkError instanceof Error ? networkError : new Error(String(networkError));
        continue;
      }

      if (response.ok) {
        return response.json<T>();
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

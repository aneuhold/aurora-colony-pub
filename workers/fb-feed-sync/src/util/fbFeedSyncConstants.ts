/**
 * Public, non-secret constants for the fb-feed-sync Worker. CORS origins
 * are shared across all workers — see `@aurora/workers-shared`.
 */
export const fbFeedSyncConstants = {
  /**
   * KV key the latest feed snapshot is written to. Must match
   * `fbFeedReadConstants.kvKey`; the small duplication is deliberate — the
   * two workers don't share a package and the read worker's constants file
   * documents the contract.
   */
  kvKey: 'fb:feed:latest',
  /**
   * The pub's public Facebook Page ID. Public, stable, and
   * environment-invariant, so it lives here rather than as a secret.
   */
  pageId: '465497836965753',
  /** Graph API version pinned for the `/posts` request. */
  graphApiVersion: 'v25.0',
  /** Graph API field list requested for each post. */
  fields: 'id,message,permalink_url,created_time,full_picture,parent_id',
  /** Cap on posts fetched per sync — keeps the KV blob small. */
  postLimit: 10
};

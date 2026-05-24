/**
 * Public, non-secret constants for the fb-feed-read Worker. CORS origins
 * are shared across all workers — see `@aurora/workers-shared`.
 */
export const fbFeedReadConstants = {
  /**
   * KV key the eventual sync Worker writes the latest feed snapshot to.
   * The read Worker checks this first; on the day the sync Worker starts
   * writing real Graph data, the read path silently lifts over with no
   * code change.
   */
  kvKey: 'fb:feed:latest',
  /**
   * Browser cache hint. Two minutes keeps the island snappy without
   * holding stale posts long once the real sync worker is producing data.
   */
  cacheControl: 'public, max-age=120'
};

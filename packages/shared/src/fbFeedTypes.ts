/**
 * Facebook Graph API response shape for `GET /{page-id}/posts?fields=id,
 * message,permalink_url,created_time,full_picture` — see
 * https://developers.facebook.com/docs/graph-api/reference/page/feed. Both the
 * eventual sync Worker (consuming the real Graph response) and the read
 * Worker's placeholder mock literal import these types so the two paths stay
 * structurally identical.
 */
export interface FbGraphPost {
  id: string;
  message?: string;
  permalink_url: string;
  created_time: string;
  full_picture?: string;
}

export interface FbGraphPostsResponse {
  data: FbGraphPost[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
  };
}

/**
 * Wire-format Facebook post the read Worker hands the frontend island.
 * Normalised from the Graph shape: required `message` (empty string when
 * absent on the source), `imageUrl` only present when the source supplies
 * `full_picture`.
 */
export interface WorkerFbFeedPost {
  id: string;
  message: string;
  permalink: string;
  createdAt: string;
  imageUrl?: string;
}

/**
 * Payload returned by the `aurora-fb-feed-read` Worker. `syncedAt` is set
 * when the read worker last produced the response (or when the sync worker
 * last wrote to KV, once that lands).
 */
export interface WorkerFbFeedResponse {
  posts: WorkerFbFeedPost[];
  syncedAt: string;
}

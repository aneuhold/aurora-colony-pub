import type { FbGraphPostsResponse, WorkerFbFeedPost } from './fbFeedTypes';

/**
 * Maps the Graph `/posts` response to the frontend wire format. Pure
 * function — no env, no fetch. Used by the read Worker against the mock
 * literal today; the sync Worker will call the same helper against the real
 * Graph response once Page access lands, so the wire contract stays put.
 *
 * Parent posts are resolved upstream in the sync Worker (parent post merged into
 * `message`/`full_picture`), so this stays a straight field map.
 *
 * @param data Graph `/posts` response (real or mocked)
 */
export const graphPostsToWorkerPosts = (data: FbGraphPostsResponse): WorkerFbFeedPost[] =>
  data.data.map((post) => {
    const mapped: WorkerFbFeedPost = {
      id: post.id,
      message: post.message ?? '',
      permalink: post.permalink_url,
      createdAt: post.created_time
    };
    if (post.full_picture !== undefined) {
      mapped.imageUrl = post.full_picture;
    }
    return mapped;
  });

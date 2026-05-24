import { describe, expect, it } from 'vitest';
import { graphPostsToWorkerPosts } from './fbFeedTransform';
import type { FbGraphPostsResponse } from './fbFeedTypes';

describe('graphPostsToWorkerPosts', () => {
  it('maps all fields 1:1 when every field is present', () => {
    const input: FbGraphPostsResponse = {
      data: [
        {
          id: '123_456',
          message: 'Hello there',
          permalink_url: 'https://www.facebook.com/p/123',
          created_time: '2026-05-22T19:30:00+0000',
          full_picture: 'https://example.com/p.jpg'
        }
      ]
    };
    expect(graphPostsToWorkerPosts(input)).toEqual([
      {
        id: '123_456',
        message: 'Hello there',
        permalink: 'https://www.facebook.com/p/123',
        createdAt: '2026-05-22T19:30:00+0000',
        imageUrl: 'https://example.com/p.jpg'
      }
    ]);
  });

  it('substitutes an empty string when `message` is missing', () => {
    const input: FbGraphPostsResponse = {
      data: [
        {
          id: '1_1',
          permalink_url: 'https://www.facebook.com/p/1',
          created_time: '2026-05-01T00:00:00+0000'
        }
      ]
    };
    const [post] = graphPostsToWorkerPosts(input);
    expect(post.message).toBe('');
  });

  it('omits `imageUrl` entirely when `full_picture` is missing', () => {
    const input: FbGraphPostsResponse = {
      data: [
        {
          id: '1_1',
          message: 'text only',
          permalink_url: 'https://www.facebook.com/p/1',
          created_time: '2026-05-01T00:00:00+0000'
        }
      ]
    };
    const [post] = graphPostsToWorkerPosts(input);
    expect('imageUrl' in post).toBe(false);
    expect(post.imageUrl).toBeUndefined();
  });

  it('returns an empty array when `data` is empty', () => {
    expect(graphPostsToWorkerPosts({ data: [] })).toEqual([]);
  });
});

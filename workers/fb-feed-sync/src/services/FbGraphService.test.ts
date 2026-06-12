import type { FbGraphPostsResponse } from '@aurora/shared';
import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import fbGraphService from './FbGraphService';

const GRAPH_RESPONSE: FbGraphPostsResponse = {
  data: [
    {
      id: '465497836965753_111',
      message: 'Live music tonight at 8.',
      permalink_url: 'https://www.facebook.com/theauroracolonypub/posts/111',
      created_time: '2026-05-23T19:00:00+0000',
      full_picture: 'https://scontent.example.com/live-music.jpg'
    }
  ]
};

const TRANSIENT_BODY = {
  error: {
    message: 'An unknown error has occurred.',
    type: 'OAuthException',
    code: 1,
    fbtrace_id: 'A3dZ_alvybExaQH47Owuelq'
  }
};

/**
 * Builds a JSON Response with the given status and body.
 *
 * @param status HTTP status code
 * @param body JSON body
 */
const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

describe('FbGraphService.fetchLatestPosts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns posts on a first-try success', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(200, GRAPH_RESPONSE));
    const result = await fbGraphService.fetchLatestPosts(env);
    expect(result.data).toHaveLength(GRAPH_RESPONSE.data.length);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('retries a transient 500 and succeeds', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(500, TRANSIENT_BODY))
      .mockResolvedValueOnce(jsonResponse(200, GRAPH_RESPONSE));
    const result = await fbGraphService.fetchLatestPosts(env);
    expect(result.data).toHaveLength(GRAPH_RESPONSE.data.length);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('retries a network failure and succeeds', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce(jsonResponse(200, GRAPH_RESPONSE));
    const result = await fbGraphService.fetchLatestPosts(env);
    expect(result.data).toHaveLength(GRAPH_RESPONSE.data.length);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries on persistent 500s', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(500, TRANSIENT_BODY))
      .mockResolvedValueOnce(jsonResponse(500, TRANSIENT_BODY))
      .mockResolvedValueOnce(jsonResponse(500, TRANSIENT_BODY));
    await expect(fbGraphService.fetchLatestPosts(env)).rejects.toThrow(
      'Graph API request failed (500)'
    );
    // 1 initial attempt + 2 retries.
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('fails fast on a 4xx without retrying', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse(400, { error: { message: '(#10) permission' } }));
    await expect(fbGraphService.fetchLatestPosts(env)).rejects.toThrow(
      'Graph API request failed (400)'
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

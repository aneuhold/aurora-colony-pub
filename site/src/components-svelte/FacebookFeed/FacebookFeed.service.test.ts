import type { WorkerFbFeedResponse } from '@aurora/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import facebookFeedService from './FacebookFeed.service';
import { facebookFeedConstants } from './facebookFeedConstants';

const samplePayload: WorkerFbFeedResponse = {
  posts: [
    {
      id: '1',
      message: 'hi',
      permalink: 'https://www.facebook.com/theauroracolonypub/',
      createdAt: '2026-05-20T00:00:00+0000'
    }
  ],
  syncedAt: '2026-05-20T00:00:00.000Z'
};

describe('FacebookFeedService.fetchFeed', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns ok with the parsed payload on a 200 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(samplePayload), { status: 200 })
    );
    const result = await facebookFeedService.fetchFeed();
    expect(result).toEqual({ ok: true, data: samplePayload });
  });

  it('returns the user-facing error message on a non-2xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status: 500 }));
    const result = await facebookFeedService.fetchFeed();
    expect(result).toEqual({
      ok: false,
      message: facebookFeedConstants.errorMessage
    });
  });

  it('returns the user-facing error message when the fetch throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const result = await facebookFeedService.fetchFeed();
    expect(result).toEqual({
      ok: false,
      message: facebookFeedConstants.errorMessage
    });
  });
});

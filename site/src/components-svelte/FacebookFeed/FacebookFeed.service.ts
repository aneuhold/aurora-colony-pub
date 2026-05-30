import type { WorkerFbFeedResponse } from '@aurora/shared';
import { globalConstants } from '$util/globalConstants';
import { facebookFeedConstants } from './facebookFeedConstants';

export type FetchFeedResult =
  | { ok: true; data: WorkerFbFeedResponse }
  | { ok: false; message: string };

/**
 * Pure-logic singleton for the FacebookFeed island. Owns the worker fetch
 * + response interpretation so `FacebookFeed.svelte` stays focused on state
 * and markup. Date formatting lives on the shared `dateTimeService`.
 */
class FacebookFeedService {
  /**
   * GETs the read Worker and translates the response into a discriminated
   * union the component can pattern-match on. Network failures and non-2xx
   * responses both surface the same user-facing error message.
   */
  async fetchFeed(): Promise<FetchFeedResult> {
    try {
      const response = await fetch(globalConstants.fbFeedReadWorkerUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });
      if (!response.ok) {
        return { ok: false, message: facebookFeedConstants.errorMessage };
      }
      const data: WorkerFbFeedResponse = await response.json();
      return { ok: true, data };
    } catch {
      return { ok: false, message: facebookFeedConstants.errorMessage };
    }
  }
}

const facebookFeedService = new FacebookFeedService();
export default facebookFeedService;

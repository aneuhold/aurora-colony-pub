import type { FbGraphPost, FbGraphPostsResponse } from '@aurora/shared';

interface MockPostSeed {
  id: string;
  message: string;
  permalink_url: string;
  created_time: string;
  /** File under `/fb-mock/` in `site/public/`; omit for a text-only post. */
  photoFile?: string;
}

/**
 * Placeholder Facebook Graph posts served by fb-feed-read while Page
 * access is pending business-portfolio approval. Stored as relative-
 * filename seeds so the photo origin can be resolved per request — local
 * dev gets `http://localhost:4321/fb-mock/...`, production gets the
 * deployed host. `buildMockFbGraphResponse` does the final assembly.
 *
 * Swap-out path: see `docs/facebook-feed-plan.md`. Delete this file and
 * the mock branch in `FbFeedReadService` once the sync Worker is writing
 * live data to KV.
 *
 * Permalink URLs all point at the pub's real Facebook page. Fabricating
 * unique `permalink.php?story_fbid=...` URLs would invent state we'd have
 * to remember to delete; pointing every card at the page root is honest
 * about the mock and lands the click on a working destination.
 */
const MOCK_POSTS: readonly MockPostSeed[] = [
  {
    id: '122104159688362_823901456111240',
    message:
      'Tonight! Wes is back behind the keys from 8 to late. Pull up a stool, grab a beer, and let him take requests. Family friendly until 9 pm.',
    permalink_url: 'https://www.facebook.com/theauroracolonypub/',
    created_time: '2026-05-23T19:00:00+0000',
    photoFile: 'live-music.jpg'
  },
  {
    id: '122104159688362_823744120998451',
    message:
      'Fried chicken Friday is back. Two big pieces, mashed potatoes, gravy, and a biscuit — just like grandma used to make. $14, off the line at 4.',
    permalink_url: 'https://www.facebook.com/theauroracolonypub/',
    created_time: '2026-05-22T11:30:00+0000',
    photoFile: 'fried-chicken.jpg'
  },
  {
    id: '122104159688362_822987651003782',
    message:
      'The patio is officially open for the season. Burgers, cold beers, and a little sunshine — weary antique shoppers and locals alike, come find us out back.',
    permalink_url: 'https://www.facebook.com/theauroracolonypub/',
    created_time: '2026-05-18T16:00:00+0000',
    photoFile: 'patio.jpg'
  },
  {
    id: '122104159688362_822103998765432',
    message:
      'Happy hour, 3 to 6, Monday through Friday. House drafts $4, well drinks $5, full $7 appetizer menu. Bring a friend.',
    permalink_url: 'https://www.facebook.com/theauroracolonypub/',
    created_time: '2026-05-14T17:00:00+0000',
    photoFile: 'happy-hour.jpg'
  },
  {
    id: '122104159688362_821554120994401',
    message:
      "What a turnout last weekend — best costume night we've had in years. Big thanks to everyone who came out (and to whoever showed up as the Hamburglar, you nailed it).",
    permalink_url: 'https://www.facebook.com/theauroracolonypub/',
    created_time: '2026-05-09T22:00:00+0000',
    photoFile: 'costume-party.jpg'
  },
  {
    id: '122104159688362_820998877665544',
    message:
      "Heads up: we'll be closed Memorial Day Monday so the crew can be with their families. Back on regular hours Tuesday. Thanks for understanding!",
    permalink_url: 'https://www.facebook.com/theauroracolonypub/',
    created_time: '2026-05-05T15:00:00+0000'
  }
];

/** Number of mocked posts (lets tests assert without rebuilding the response). */
export const mockFbPostCount = MOCK_POSTS.length;

/**
 * Assembles the mock Graph `/posts` response with photo URLs anchored at
 * the given origin. Pass the request's allowlisted Origin in production
 * so the frontend serves photos from the same host it loaded from.
 *
 * @param photoBaseOrigin Scheme + host (no trailing slash) the photos
 *   are served from — typically the calling frontend's origin
 */
export const buildMockFbGraphResponse = (photoBaseOrigin: string): FbGraphPostsResponse => ({
  data: MOCK_POSTS.map(({ photoFile, ...rest }): FbGraphPost => {
    if (photoFile === undefined) return { ...rest };
    return { ...rest, full_picture: `${photoBaseOrigin}/fb-mock/${photoFile}` };
  })
});

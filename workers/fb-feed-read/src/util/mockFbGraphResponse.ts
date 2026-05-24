import type { FbGraphPostsResponse } from '@aurora/shared';

/**
 * Placeholder Facebook Graph response served by the fb-feed-read Worker
 * while Page access is pending business-portfolio approval. Shape matches
 * `GET /{page-id}/posts?fields=id,message,permalink_url,created_time,
 * full_picture&limit=10` 1:1 so the eventual sync Worker can drop in real
 * Graph data without any downstream transform changes.
 *
 * Swap-out path: see `docs/facebook-feed-plan.md`. Delete this literal and
 * the `mockFbGraphResponse` branch in `FbFeedReadService` once the sync
 * Worker is writing live data to KV.
 *
 * Permalink URLs all point at the pub's real Facebook page. Fabricating
 * unique `permalink.php?story_fbid=...` URLs would invent state we'd have
 * to remember to delete; pointing every card at the page root is honest
 * about the mock and lands the click on a working destination.
 */
export const mockFbGraphResponse: FbGraphPostsResponse = {
  data: [
    {
      id: '122104159688362_823901456111240',
      message:
        'Tonight! Wes is back behind the keys from 8 to late. Pull up a stool, grab a beer, and let him take requests. Family friendly until 9 pm.',
      permalink_url: 'https://www.facebook.com/theauroracolonypub/',
      created_time: '2026-05-23T19:00:00+0000',
      full_picture: 'https://auroracolonypub.com/fb-mock/live-music.jpg'
    },
    {
      id: '122104159688362_823744120998451',
      message:
        'Fried chicken Friday is back. Two big pieces, mashed potatoes, gravy, and a biscuit — just like grandma used to make. $14, off the line at 4.',
      permalink_url: 'https://www.facebook.com/theauroracolonypub/',
      created_time: '2026-05-22T11:30:00+0000',
      full_picture: 'https://auroracolonypub.com/fb-mock/fried-chicken.jpg'
    },
    {
      id: '122104159688362_822987651003782',
      message:
        'The patio is officially open for the season. Burgers, cold beers, and a little sunshine — weary antique shoppers and locals alike, come find us out back.',
      permalink_url: 'https://www.facebook.com/theauroracolonypub/',
      created_time: '2026-05-18T16:00:00+0000',
      full_picture: 'https://auroracolonypub.com/fb-mock/patio.jpg'
    },
    {
      id: '122104159688362_822103998765432',
      message:
        'Happy hour, 3 to 6, Monday through Friday. House drafts $4, well drinks $5, full $7 appetizer menu. Bring a friend.',
      permalink_url: 'https://www.facebook.com/theauroracolonypub/',
      created_time: '2026-05-14T17:00:00+0000',
      full_picture: 'https://auroracolonypub.com/fb-mock/happy-hour.jpg'
    },
    {
      id: '122104159688362_821554120994401',
      message:
        "What a turnout last weekend — best costume night we've had in years. Big thanks to everyone who came out (and to whoever showed up as the Hamburglar, you nailed it).",
      permalink_url: 'https://www.facebook.com/theauroracolonypub/',
      created_time: '2026-05-09T22:00:00+0000',
      full_picture: 'https://auroracolonypub.com/fb-mock/costume-party.jpg'
    },
    {
      id: '122104159688362_820998877665544',
      message:
        "Heads up: we'll be closed Memorial Day Monday so the crew can be with their families. Back on regular hours Tuesday. Thanks for understanding!",
      permalink_url: 'https://www.facebook.com/theauroracolonypub/',
      created_time: '2026-05-05T15:00:00+0000'
    }
  ]
};

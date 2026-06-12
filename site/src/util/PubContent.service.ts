import type { CollectionEntry } from 'astro:content';
import { getEntry } from 'astro:content';

/**
 * Typed accessors for the site's singleton content entries. Each pub-info
 * collection is backed by exactly one file, so these wrap `getEntry` with the
 * fixed entry id and a not-found guard — callers get a guaranteed-present,
 * fully-typed entry instead of repeating the lookup-and-throw dance at every
 * call site.
 */
class PubContentService {
  /**
   * Home-page content — hero title/tagline/image and the patio callout.
   */
  async home(): Promise<CollectionEntry<'home'>> {
    return this.required(await getEntry('home', 'home'), 'home');
  }

  /**
   * About-page heading, markdown body, and the three highlight blocks.
   */
  async about(): Promise<CollectionEntry<'about'>> {
    return this.required(await getEntry('about', 'about'), 'about');
  }

  /**
   * Intro text shown under the title on the menu page.
   */
  async menuIntro(): Promise<CollectionEntry<'menuIntro'>> {
    return this.required(await getEntry('menuIntro', 'menu-intro'), 'menuIntro');
  }

  /**
   * Phone, email, and DoorDash order URL.
   */
  async contact(): Promise<CollectionEntry<'contact'>> {
    return this.required(await getEntry('contact', 'contact'), 'contact');
  }

  /**
   * Weekly hours and happy-hour window.
   */
  async hours(): Promise<CollectionEntry<'hours'>> {
    return this.required(await getEntry('hours', 'hours'), 'hours');
  }

  /**
   * Required Facebook link plus any other social links.
   */
  async socialMediaLinks(): Promise<CollectionEntry<'socialMediaLinks'>> {
    return this.required(
      await getEntry('socialMediaLinks', 'social-media-links'),
      'socialMediaLinks'
    );
  }

  /**
   * Throws a consistent "missing entry" error when a singleton lookup comes
   * back undefined, narrowing the result to a present entry.
   *
   * @param entry The entry returned by `getEntry`, possibly undefined
   * @param collection Collection name, used only for the error message
   */
  private required<T>(entry: T | undefined, collection: string): T {
    if (!entry) {
      throw new Error(`Missing ${collection} content entry`);
    }
    return entry;
  }
}

const pubContentService = new PubContentService();
export default pubContentService;

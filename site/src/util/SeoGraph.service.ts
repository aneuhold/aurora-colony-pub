import {
  assembleGraph,
  buildPiece,
  buildWebPage,
  buildWebSite,
  type GraphEntity,
  makeIds
} from '@jdevalk/seo-graph-core';
import { getEntry } from 'astro:content';
import type { BarOrPub } from 'schema-dts';
import brandingService from './Branding.service';
import dateTimeService from './DateTime.service';
import pubMapService from './PubMap/PubMap.service';

class SeoGraphService {
  /** Stable slug for the BarOrPub `@id` URI. */
  private static readonly PUB_SLUG = 'pub';

  /**
   * Builds the JSON-LD `@graph` for the current page: a sitewide `WebSite`
   * and `BarOrPub`, plus a per-page `WebPage` linked to both. The result is
   * consumed by `<Seo graph={...}>` from `@jdevalk/astro-seo-graph`.
   *
   * @param args - Site, page, and image inputs used to populate the entities
   * @param args.site - Canonical site origin (e.g. `https://auroracolonypub.com`)
   * @param args.pageUrl - Absolute URL of the current page
   * @param args.pageName - Page name used for the WebPage entity
   * @param args.description - Page description, reused on the WebPage
   * @param args.ogImage - Absolute URL of the share image for the BarOrPub
   */
  async buildGraph(args: {
    site: URL;
    pageUrl: URL;
    pageName: string;
    description: string;
    ogImage: string;
  }): Promise<Record<string, unknown>> {
    const { site, pageUrl, pageName, description, ogImage } = args;
    const siteUrl = site.href;
    const ids = makeIds({ siteUrl });
    const pubId = ids.organization(SeoGraphService.PUB_SLUG);

    const [hoursEntry, contactEntry, socialEntry] = await Promise.all([
      getEntry('hours', 'hours'),
      getEntry('contact', 'contact'),
      getEntry('socialMediaLinks', 'social-media-links')
    ]);
    if (!hoursEntry) throw new Error('Missing hours content entry');
    if (!contactEntry) throw new Error('Missing contact content entry');
    if (!socialEntry) throw new Error('Missing socialMediaLinks content entry');

    const address = this.parseAddress(pubMapService.address);
    const { lat, lng } = pubMapService.geo;
    const logoUrl = new URL('/favicon.svg', site).href;
    const menuUrl = new URL('/menu', site).href;

    const openingHours = hoursEntry.data.weekly.flatMap((row) => {
      const opens = dateTimeService.to24HourTime(row.open);
      const closes = dateTimeService.to24HourTime(row.close);
      const days = dateTimeService.longDayNameForLabel(row.label);
      if (!opens || !closes || days.length === 0) return [];
      return [
        {
          '@type': 'OpeningHoursSpecification' as const,
          dayOfWeek: days,
          opens,
          closes
        }
      ];
    });

    const website = buildWebSite(
      {
        url: siteUrl,
        name: brandingService.siteName,
        description,
        publisher: { '@id': pubId }
      },
      ids
    );

    const webPage = buildWebPage(
      {
        url: pageUrl.href,
        name: pageName,
        description,
        isPartOf: { '@id': ids.website }
      },
      ids
    );

    const barOrPub = buildPiece<BarOrPub>({
      '@type': 'BarOrPub',
      '@id': pubId,
      name: brandingService.siteName,
      description,
      url: siteUrl,
      image: ogImage,
      logo: logoUrl,
      telephone: contactEntry.data.phone,
      email: contactEntry.data.email,
      address: {
        '@type': 'PostalAddress',
        ...address
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: lat,
        longitude: lng
      },
      openingHoursSpecification: openingHours,
      servesCuisine: ['American'],
      priceRange: '$$',
      paymentAccepted: ['Cash', 'Credit Card'],
      currenciesAccepted: 'USD',
      sameAs: socialEntry.data.links.map((link) => link.url),
      hasMenu: menuUrl
    });

    return assembleGraph([this.toEntity(website), this.toEntity(webPage), this.toEntity(barOrPub)]);
  }

  /**
   * Narrows a builder-output `Record<string, unknown>` to a `GraphEntity` by
   * re-spreading with the runtime `@type` value. The core builders all set
   * `@type` but their declared return is the wider `Record` shape, so we
   * verify-then-narrow here rather than reach for a type assertion.
   *
   * @param piece - Raw piece returned by a `buildXxx` call from `seo-graph-core`
   */
  private toEntity(piece: Record<string, unknown>): GraphEntity {
    const type = piece['@type'];
    const validString = typeof type === 'string';
    const validArray = Array.isArray(type) && type.every((t) => typeof t === 'string');
    if (!validString && !validArray) {
      throw new Error("Builder output is missing a string '@type' value.");
    }
    return { ...piece, '@type': type };
  }

  /**
   * Parses the canonical pub address (`21568 Hwy 99E NE, Aurora, OR 97002`)
   * into a `PostalAddress` shape. Falls back to dropping the whole address
   * into `streetAddress` if the format ever drifts.
   *
   * @param raw - Full address line
   */
  private parseAddress(raw: string) {
    const match = /^(.+),\s*([^,]+),\s*([A-Z]{2})\s*(\d{5})$/.exec(raw.trim());
    if (!match) {
      return {
        streetAddress: raw,
        addressLocality: 'Aurora',
        addressRegion: 'OR',
        postalCode: '97002',
        addressCountry: 'US'
      };
    }
    const [, streetAddress, addressLocality, addressRegion, postalCode] = match;
    return {
      streetAddress,
      addressLocality,
      addressRegion,
      postalCode,
      addressCountry: 'US'
    };
  }
}

export default new SeoGraphService();

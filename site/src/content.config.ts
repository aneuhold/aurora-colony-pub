// See the docs for this file here: https://docs.astro.build/en/guides/content-collections/#defining-build-time-content-collections

import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { defineCollection } from 'astro:content';

const home = defineCollection({
  loader: glob({ pattern: 'home.json', base: 'src/content' }),
  schema: z.object({
    title: z.string(),
    tagline: z.string().optional(),
    heroImage: z.url(),
    heroImageAlt: z.string(),
    patio: z.object({
      heading: z.string(),
      body: z.string()
    })
  })
});

const about = defineCollection({
  loader: glob({ pattern: 'about.md', base: 'src/content' }),
  schema: z.object({
    heading: z.string(),
    highlights: z.array(
      z.object({
        headline: z.string(),
        body: z.string()
      })
    )
  })
});

const menuIntro = defineCollection({
  loader: glob({ pattern: 'menu-intro.json', base: 'src/content' }),
  schema: z.object({
    body: z.string()
  })
});

const contact = defineCollection({
  loader: glob({ pattern: 'contact.json', base: 'src/content' }),
  schema: z.object({
    phone: z.string(),
    email: z.string(),
    orderUrl: z.url().optional(),
    note: z.string()
  })
});

const hours = defineCollection({
  loader: glob({ pattern: 'hours.json', base: 'src/content' }),
  schema: z.object({
    weekly: z.array(
      z.object({
        label: z.string(),
        open: z.string(),
        close: z.string()
      })
    ),
    happyHour: z.object({
      label: z.string(),
      start: z.string(),
      end: z.string(),
      note: z.string().optional()
    })
  })
});

const socialMediaLinks = defineCollection({
  loader: glob({ pattern: 'social-media-links.json', base: 'src/content' }),
  schema: z.object({
    facebookLink: z.url(),
    otherSocialMediaLinks: z
      .array(
        z.object({
          label: z.string(),
          url: z.url()
        })
      )
      .default([])
  })
});

const menuImages = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/content/menu-images' }),
  schema: z.object({
    title: z.string(),
    category: z.enum(['main', 'breakfast', 'kids', 'happy-hour']),
    image: z.url(),
    order: z.number().default(0)
  })
});

const gallery = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/content/gallery' }),
  schema: z.object({
    photo: z.url(),
    alt: z.string(),
    order: z.number().default(0)
  })
});

export const collections = {
  home,
  about,
  menuIntro,
  contact,
  hours,
  socialMediaLinks,
  menuImages,
  gallery
};

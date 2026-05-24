// See the docs for this file here: https://docs.astro.build/en/guides/content-collections/#defining-build-time-content-collections

import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { defineCollection } from 'astro:content';

const titleTagline = defineCollection({
  loader: glob({ pattern: 'title-tagline.json', base: 'src/content' }),
  schema: z.object({
    title: z.string(),
    tagline: z.string().optional()
  })
});

const about = defineCollection({
  loader: glob({ pattern: 'about.md', base: 'src/content' }),
  schema: z.object({
    heading: z.string()
  })
});

const contact = defineCollection({
  loader: glob({ pattern: 'contact.json', base: 'src/content' }),
  schema: z.object({
    phone: z.string(),
    email: z.string(),
    orderUrl: z.url().optional()
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
    links: z.array(
      z.object({
        label: z.string(),
        url: z.url()
      })
    )
  })
});

const menuImages = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/content/menu-images' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      category: z.enum(['main', 'breakfast', 'kids', 'happy-hour']),
      image: image(),
      order: z.number().default(0)
    })
});

const gallery = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/content/gallery' }),
  schema: ({ image }) =>
    z.object({
      photo: image(),
      alt: z.string(),
      order: z.number().default(0)
    })
});

export const collections = {
  titleTagline,
  about,
  contact,
  hours,
  socialMediaLinks,
  menuImages,
  gallery
};

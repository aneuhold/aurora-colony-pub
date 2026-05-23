// See the docs for this file here: https://docs.astro.build/en/guides/content-collections/#defining-build-time-content-collections

import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { defineCollection } from 'astro:content';

const hero = defineCollection({
  loader: glob({ pattern: 'hero.json', base: 'src/content' }),
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

const gallery = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/content/gallery' }),
  schema: ({ image }) =>
    z.object({
      photo: image(),
      alt: z.string(),
      order: z.number().default(0)
    })
});

export const collections = { hero, about, gallery };

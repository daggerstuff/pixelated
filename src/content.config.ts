import { defineCollection, z } from 'astro:content'
import { i18nLoader, pagesLoader } from 'astro-vitesse/loaders'
import { i18nSchema, pagesSchema } from 'astro-vitesse/schema'

// Keep existing blog schema for compatibility
const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
  updatedDate: z.coerce.date().optional(),
  lastModDate: z.coerce.date().optional(),
  author: z.string(),
  image: z
    .object({
      url: z.string(),
      alt: z.string(),
    })
    .optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
  readingTime: z.number().optional(),
  category: z
    .enum(['Technical', 'Research', 'Case Study', 'Tutorial', 'News'])
    .optional(),
  canonicalUrl: z.string().url().optional(),
  slug: z.string().optional(),
  series: z.string().optional(),
  seriesOrder: z.number().optional(),
  toc: z.boolean().default(true),
  share: z.boolean().default(true),
})

// Keep existing collections for compatibility
const blog = defineCollection({
  type: 'content',
  schema: blogSchema,
})

const docs = defineCollection({
  type: 'content',
  schema: blogSchema,
})

const projects = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
  }),
})

const changelog = defineCollection({
  type: 'content',
  schema: blogSchema,
})

// Astro-vitesse collections
const pages = defineCollection({
  loader: pagesLoader(),
  schema: pagesSchema(),
})

const i18n = defineCollection({
  loader: i18nLoader(),
  schema: i18nSchema({
    extend: z.object({
      'sponsor.thanks': z.string().optional(),
      'sponsor.to-suport': z.string().optional(),
    }),
  }),
})

export const collections = {
  // Keep existing collections
  blog,
  docs,
  projects,
  changelog,
  // Add vitesse collections
  pages,
  i18n,
}

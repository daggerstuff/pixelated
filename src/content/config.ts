// import { feedLoader } from '@ascorbic/feed-loader'
import { defineCollection, z } from 'astro:content'
import { postSchema, projectsSchema, techniqueSchema } from './schema'

// Remove glob import to simplify things
// import { glob } from 'astro/loaders'

// Simplify config to just the essential collections
const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
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
  }),
})

// Add the missing docs collection referenced in content.d.ts
const docsCollection = defineCollection({
  type: 'content',
  schema: postSchema,
})

// Simple projects collection
const projects = defineCollection({
  type: 'data',
  schema: projectsSchema,
})

// Simple changelog collection
const changelog = defineCollection({
  type: 'content',
  schema: postSchema,
})

// Simple data schema for all other collections
const simpleDataSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
})

const home = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.date().optional(),
    draft: z.boolean().optional(),
    featured: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    image: z.string().optional(),
  }),
})

// Simplified collections exports
export const collections = {
  blog: blogCollection,
  docs: docsCollection,
  projects,
  changelog,
  // Use simple schema for these collections to avoid complexity
  streams: defineCollection({
    type: 'data',
    schema: simpleDataSchema,
  }),
  // Minimal config for remaining collections
  feeds: defineCollection({
    type: 'data',
    schema: simpleDataSchema,
  }),
  releases: defineCollection({
    type: 'data',
    schema: simpleDataSchema,
  }),
  prs: defineCollection({
    type: 'data',
    schema: simpleDataSchema,
  }),
  highlights: defineCollection({
    type: 'data',
    schema: simpleDataSchema,
  }),
  home,
  techniques: defineCollection({
    type: 'data',
    schema: techniqueSchema,
  }),
}

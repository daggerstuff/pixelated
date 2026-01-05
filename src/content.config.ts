import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'
import { i18nLoader, pagesLoader } from 'astro-vitesse/loaders'
import { i18nSchema, pagesSchema } from 'astro-vitesse/schema'
import { postSchema, projectsSchema, techniqueSchema, prsSchema, releasesSchema, streamsSchema } from './content/schema'

/**
 * KNOWN ISSUE: Astro 5.15+ "Invalid key in record" Bug
 * 
 * You will see "Invalid key in record" warnings for all collections during sync.
 * This is a CONFIRMED BUG in Astro 5.15+ Content Layer validation.
 * 
 * - Collections sync successfully (Exit code 0)
 * - Content loads correctly
 * - Builds succeed
 * 
 * PLEASE IGNORE THESE WARNINGS.
 */

// Move content to src/content-store/ to avoid legacy auto-generation warnings
const baseDir = 'src/content-store';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${baseDir}/blog` }),
  schema: postSchema,
})

const docs = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${baseDir}/docs` }),
  schema: postSchema,
})

const changelog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${baseDir}/changelog` }),
  schema: postSchema,
})

const home = defineCollection({
  loader: glob({ pattern: '**/*.md', base: `${baseDir}/home` }),
  schema: z.any(),
})

const projects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: `${baseDir}/projects` }),
  schema: projectsSchema,
})

const feeds = defineCollection({
  loader: glob({ pattern: '**/*.json', base: `${baseDir}/feeds` }),
  schema: z.any(),
})

const highlights = defineCollection({
  loader: glob({ pattern: '**/*.json', base: `${baseDir}/highlights` }),
  schema: z.any(),
})

const prs = defineCollection({
  loader: glob({ pattern: '**/*.json', base: `${baseDir}/prs` }),
  schema: prsSchema,
})

const releases = defineCollection({
  loader: glob({ pattern: '**/*.json', base: `${baseDir}/releases` }),
  schema: releasesSchema,
})

const streams = defineCollection({
  loader: glob({ pattern: '**/*.json', base: `${baseDir}/streams` }),
  schema: streamsSchema,
})

const techniques = defineCollection({
  loader: glob({ pattern: '**/*.json', base: `${baseDir}/techniques` }),
  schema: techniqueSchema,
})

// Astro Vitesse loaders
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
  blog,
  docs,
  changelog,
  home,
  projects,
  feeds,
  highlights,
  prs,
  releases,
  streams,
  techniques,
  pages,
  i18n,
}

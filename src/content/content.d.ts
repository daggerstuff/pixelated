import type {
  PageSchema,
  PostSchema,
  ProjectsSchema,
  PrsSchema,
  StreamsSchema,
} from './schema'

declare module 'astro:content' {
  interface DataEntryMap {
    blog: PostSchema
    docs: PostSchema
    pages: PageSchema
    projects: ProjectsSchema
    changelog: PostSchema
    streams: StreamsSchema
    feeds: any
    releases: ProjectsSchema
    prs: PrsSchema
    highlights: ProjectsSchema
  }
}

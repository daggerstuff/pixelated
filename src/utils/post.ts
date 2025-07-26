import type { CollectionEntry as AstroCollectionEntry } from 'astro:content'

// Define the base data interface that matches our schema
export interface PostData {
  title: string
  description: string
  pubDate: Date
  share?: boolean
  toc?: boolean
  ogImage?: boolean
  lastModDate?: Date
  updatedDate?: Date
  tags?: string[]
  author?: string
  readingTime?: number
  draft?: boolean
}

export type PostCollectionType = 'blog' | 'docs'

// Helper type for our collection entries
export type PostCollectionEntry =
  | AstroCollectionEntry<'blog'>
  | AstroCollectionEntry<'docs'>

export function filterDrafts(
  entries: PostCollectionEntry[],
): PostCollectionEntry[] {
  return entries.filter(
    (entry) => !('draft' in entry.data) || !entry.data.draft,
  )
}

export function sortByDate<T extends { data: { pubDate: Date } }>(
  entries: T[],
): T[] {
  return entries.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  )
}

export async function getPosts(
  contentCollectionType: PostCollectionType,
  filterFn?: (entry: PostCollectionEntry) => boolean,
): Promise<PostCollectionEntry[]> {
  const { getCollection } = await import('astro:content')
  return getCollection(contentCollectionType, filterFn)
}

export function sortPosts(posts: PostCollectionEntry[]): PostCollectionEntry[] {
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  )
}

export function filterDraftPosts() {
  return function filterDraftPosts(entry: PostCollectionEntry) {
    return !('draft' in entry.data) || !entry.data.draft
  }
}

/**
 * Get filtered and sorted posts for a collection
 * @param collectionType The collection type ('blog' or 'docs')
 * @param filterFn Optional custom filter function
 * @returns Filtered and sorted posts
 */
export async function getFilteredPosts(
  collectionType: PostCollectionType,
  filterFn?: (entry: PostCollectionEntry) => boolean,
): Promise<PostCollectionEntry[]> {
  // Get all posts
  const posts = await getPosts(collectionType, filterFn)

  // Filter out drafts in production (unless explicitly filtered)
  const filteredPosts =
    import.meta.env.PROD && !filterFn ? filterDrafts(posts) : posts

  // Sort by date
  return sortPosts(filteredPosts)
}

/**
 * Get sorted posts for a collection (without draft filtering)
 * @param collectionType The collection type ('blog' or 'docs')
 * @param filterFn Optional custom filter function
 * @returns Sorted posts
 */
export async function getSortedPosts(
  collectionType: PostCollectionType,
  filterFn?: (entry: PostCollectionEntry) => boolean,
): Promise<PostCollectionEntry[]> {
  const posts = await getPosts(collectionType, filterFn)
  return sortPosts(posts)
}

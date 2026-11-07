import type { CollectionEntry as AstroCollectionEntry } from 'astro:content'

export type PostCollectionType = 'blog' | 'docs'

// Helper type for our collection entries
export type PostCollectionEntry = AstroCollectionEntry<'blog'>

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

export function sortPosts(posts: PostCollectionEntry[]): PostCollectionEntry[] {
  return posts.sort(
    (a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf(),
  )
}

export function filterDraftPosts() {
  return function filterDraftPosts(entry: PostCollectionEntry): boolean {
    return !('draft' in entry.data) || !entry.data.draft
  }
}

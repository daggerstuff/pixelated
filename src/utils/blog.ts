import type { CollectionEntry } from 'astro:content'

export interface BlogPostFilters {
  excludeDrafts?: boolean
  tag?: string
  limit?: number
}

export interface BlogPostMetrics {
  readingTime: number
  wordCount: number
}

/**
 * Calculates reading time for a blog post
 * @param content - The post content
 * @param wordsPerMinute - Reading speed (default: 200)
 * @returns Reading time in minutes
 */
export function calculateReadingTime(
  content: string,
  wordsPerMinute = 200,
): number {
  if (!content || typeof content !== 'string') return 0
  
  const words = content.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / wordsPerMinute))
}

/**
 * Calculates word count for a blog post
 * @param content - The post content
 * @returns Word count
 */
export function calculateWordCount(content: string): number {
  if (!content || typeof content !== 'string') return 0
  return content.trim().split(/\s+/).filter(Boolean).length
}

/**
 * Formats a date for display
 * @param date - The date to format
 * @returns Formatted date string
 */
export function formatBlogDate(date: Date): string {
  if (!date || !(date instanceof Date)) return ''
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

/**
 * Validates blog post data
 * @param post - The blog post to validate
 * @returns Validation result
 */
export function validateBlogPost(
  post: CollectionEntry<'blog'>,
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  if (!post) {
    errors.push('Post is required')
    return { isValid: false, errors }
  }
  
  if (!post.data) {
    errors.push('Post data is required')
    return { isValid: false, errors }
  }
  
  if (!post.data.title || typeof post.data.title !== 'string') {
    errors.push('Post title is required and must be a string')
  }
  
  if (!post.data.description || typeof post.data.description !== 'string') {
    errors.push('Post description is required and must be a string')
  }
  
  if (!post.data.pubDate || !(post.data.pubDate instanceof Date)) {
    errors.push('Post publication date is required and must be a Date')
  }
  
  if (!Array.isArray(post.data.tags)) {
    errors.push('Post tags must be an array')
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  }
}

/**
 * Gets blog post metrics
 * @param post - The blog post
 * @returns Post metrics
 */
export function getBlogPostMetrics(post: CollectionEntry<'blog'>): BlogPostMetrics {
  const wordCount = calculateWordCount(post.body || '')
  const readingTime = calculateReadingTime(post.body || '')
  
  return {
    wordCount,
    readingTime,
  }
}

/**
 * Filters blog posts based on criteria
 * @param posts - Array of blog posts
 * @param filters - Filter criteria
 * @returns Filtered posts
 */
export function filterBlogPosts(
  posts: CollectionEntry<'blog'>[],
  filters: BlogPostFilters = {},
): CollectionEntry<'blog'>[] {
  let filtered = [...posts]
  
  if (filters.excludeDrafts !== false) {
    filtered = filtered.filter(post => !post.data.draft)
  }
  
  if (filters.tag) {
    filtered = filtered.filter(post => 
      post.data.tags && post.data.tags.includes(filters.tag)
    )
  }
  
  // Sort by publication date (newest first)
  filtered.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
  
  if (filters.limit) {
    filtered = filtered.slice(0, filters.limit)
  }
  
  return filtered
}

/**
 * Creates a slug from a string
 * @param text - Text to slugify
 * @returns URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
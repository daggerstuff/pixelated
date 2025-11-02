import { describe, it, expect } from 'vitest'
import { calculateReadingTime, calculateWordCount, formatBlogDate, validateBlogPost } from '@/utils/blog'
import type { CollectionEntry } from 'astro:content'

describe('Blog utilities', () => {
  describe('calculateReadingTime', () => {
    it('should calculate reading time correctly', () => {
      const content = 'This is a test post with several words to calculate reading time.'
      expect(calculateReadingTime(content, 200)).toBe(1)
    })

    it('should handle empty content', () => {
      expect(calculateReadingTime('')).toBe(0)
    })

    it('should handle very long content', () => {
      const content = 'word '.repeat(1000)
      expect(calculateReadingTime(content, 200)).toBe(5)
    })
  })

  describe('calculateWordCount', () => {
    it('should count words correctly', () => {
      const content = 'This has exactly five words in it right now'
      expect(calculateWordCount(content)).toBe(9)
    })

    it('should handle empty content', () => {
      expect(calculateWordCount('')).toBe(0)
    })
  })

  describe('formatBlogDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-01-15T12:00:00Z')
      expect(formatBlogDate(date)).toBe('January 15, 2024')
    })

    it('should handle invalid date', () => {
      expect(formatBlogDate(new Date('invalid'))).toBe('')
    })
  })

  describe('validateBlogPost', () => {
    it('should validate valid post', () => {
      const mockPost = {
        data: {
          title: 'Test Post',
          description: 'Test description',
          pubDate: new Date(),
          tags: ['test', 'blog'],
          draft: false,
        },
        body: 'Test content',
        slug: 'test-post',
        collection: 'blog',
      } as CollectionEntry<'blog'>

      const result = validateBlogPost(mockPost)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should invalidate post with missing title', () => {
      const mockPost = {
        data: {
          description: 'Test description',
          pubDate: new Date(),
          tags: ['test'],
        },
        body: 'Test content',
        slug: 'test-post',
        collection: 'blog',
      } as CollectionEntry<'blog'>

      const result = validateBlogPost(mockPost)
      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Post title is required and must be a string')
    })
  })
})
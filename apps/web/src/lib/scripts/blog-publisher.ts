#!/usr/bin/env node

import fs from 'fs/promises'

import {
  safeJoin,
  ALLOWED_DIRECTORIES,
  sanitizeFilename,
  validatePath,
} from '../../utils/path-security'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import {
  BlogPublishingService,
  PostStatus,
} from '../lib/services/BlogPublishingService'

const logger = createBuildSafeLogger('blog-publisher')

/**
 * Blog Publisher Script
 *
 * This script provides a command-line interface for managing the blog publication pipeline.
 *
 * Usage:
 *   npm run blog-publisher -- [command]
 *
 * Commands:
 *   init       - Initialize the blog publication service
 *   status     - Show the current status of all blog posts
 *   report     - Generate a comprehensive content pipeline report
 *   series     - List all blog series with their posts
 *   upcoming   - Show upcoming scheduled publications
 *   overdue    - Show overdue publications
 *   generate   - Generate a new blog post template
 *   publish    - Manually publish a post by setting draft to false
 */

// Initialize the blog publishing service
const service = new BlogPublishingService()

// Parse command line arguments
const args = process.argv.slice(2)
const command = args[0] ?? 'status'

// Execute the command
;void (async () => {
  try {
    await service.initialize()

    switch (command) {
      case 'init':
        logger.info('Blog publishing service initialized')
        break

      case 'status':
        await showStatus()
        break

      case 'report':
        await generateReport()
        break

      case 'series':
        await listSeries()
        break

      case 'upcoming':
        await showUpcoming()
        break

      case 'overdue':
        await showOverdue()
        break

      case 'generate':
        await generatePost(args[1], args[2])
        break

      case 'publish':
        await publishPost(args[1])
        break

      default:
        logger.info('Unknown command. Available commands:')
        logger.info(
          '  init, status, report, series, upcoming, overdue, generate, publish',
        )
        break
    }
  } catch (error: unknown) {
    logger.error('Error executing command', { command, error })
    process.exit(1)
  }
})()

/**
 * Show the current status of all blog posts
 */
async function showStatus(): Promise<void> {
  const allPosts = service.getAllPosts()
  const draftPosts = service.getPostsByStatus(PostStatus.DRAFT)
  const scheduledPosts = service.getPostsByStatus(PostStatus.SCHEDULED)
  const publishedPosts = service.getPostsByStatus(PostStatus.PUBLISHED)
  const overduePosts = service.getPostsByStatus(PostStatus.OVERDUE)

  logger.info('Blog Post Status:')
  logger.info('----------------')
  logger.info(`Total Posts: ${allPosts.length}`)
  logger.info(`Published: ${publishedPosts.length}`)
  logger.info(`Scheduled: ${scheduledPosts.length}`)
  logger.info(`Draft: ${draftPosts.length}`)
  logger.info(`Overdue: ${overduePosts.length}`)
  logger.info('')

  if (overduePosts.length > 0) {
    logger.info('⚠️ Overdue posts:')
    for (const post of overduePosts) {
      logger.info(`  - ${post.metadata.title}`)
    }
    logger.info('')
  }

  if (scheduledPosts.length > 0) {
    logger.info('⏳ Upcoming publications:')
    for (const post of scheduledPosts) {
      const pubDate = new Date(post.metadata.pubDate)
      logger.info(`  - ${post.metadata.title} (${pubDate.toDateString()})`)
    }
  }
}

/**
 * Generate a comprehensive content pipeline report
 */
async function generateReport(): Promise<void> {
  const report = service.generateContentReport()

  // Output to console
  logger.info(report)

  // Save to file
  const reportDir = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, 'reports')
  const filename = sanitizeFilename(
    `blog-pipeline-${new Date().toISOString().split('T')[0]}.md`,
  )
  const reportPath = safeJoin(reportDir, filename)

  try {
    // Ensure reports directory exists
    await fs.mkdir(reportDir, { recursive: true })

    // Write the report
    await fs.writeFile(reportPath, report, 'utf8')

    logger.info(`Report saved to: ${reportPath}`)
  } catch (error: unknown) {
    logger.error('Error saving report', { error })
  }
}

/**
 * List all blog series with their posts
 */
async function listSeries(): Promise<void> {
  const allPosts = service.getAllPosts()

  // Create a map of series to posts
  const seriesMap = new Map<string, (typeof allPosts)[0][]>()

  for (const post of allPosts) {
    if (post.metadata.series) {
      if (!seriesMap.has(post.metadata.series)) {
        seriesMap.set(post.metadata.series, [])
      }
      seriesMap.get(post.metadata.series)?.push(post)
    }
  }

  if (seriesMap.size === 0) {
    logger.info('No series found.')
    return
  }

  logger.info('Blog Series:')
  logger.info('-----------')

  for (const [seriesName, posts] of seriesMap.entries()) {
    logger.info(`\n${seriesName}:`)

    // Sort posts by seriesOrder
    posts.sort((a, b) => {
      if (a.metadata.seriesOrder && b.metadata.seriesOrder) {
        return a.metadata.seriesOrder - b.metadata.seriesOrder
      }
      return 0
    })

    for (const post of posts) {
      const pubDate = new Date(post.metadata.pubDate)
      const status = getStatusEmoji(post.status)
      const order = post.metadata.seriesOrder
        ? `[${post.metadata.seriesOrder}]`
        : ''

      logger.info(
        `  ${status} ${order} ${post.metadata.title} (${pubDate.toDateString()})`,
      )
    }
  }
}

/**
 * Show upcoming scheduled publications
 */
async function showUpcoming(): Promise<void> {
  const scheduledPosts = service.getUpcomingPosts()

  if (scheduledPosts.length === 0) {
    logger.info('No upcoming publications.')
    return
  }

  logger.info('Upcoming Publications:')
  logger.info('---------------------')

  const now = new Date()

  for (const post of scheduledPosts) {
    const pubDate = new Date(post.metadata.pubDate)
    const daysUntil = Math.ceil(
      (pubDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    )

    logger.info(`${pubDate.toDateString()} (in ${daysUntil} days):`)
    logger.info(`  Title: ${post.metadata.title}`)
    logger.info(`  Author: ${post.metadata.author}`)

    if (post.metadata.series) {
      const seriesInfo = post.metadata.seriesOrder
        ? `[Part ${post.metadata.seriesOrder}]`
        : ''
      logger.info(`  Series: ${post.metadata.series} ${seriesInfo}`)
    }

    logger.info('')
  }
}

/**
 * Show overdue publications
 */
async function showOverdue(): Promise<void> {
  const overduePosts = service.getOverduePosts()

  if (overduePosts.length === 0) {
    logger.info('No overdue publications.')
    return
  }

  logger.info('⚠️ Overdue Publications:')
  logger.info('----------------------')

  const now = new Date()

  for (const post of overduePosts) {
    const pubDate = new Date(post.metadata.pubDate)
    const daysOverdue = Math.ceil(
      (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24),
    )

    logger.info(`${pubDate.toDateString()} (${daysOverdue} days overdue):`)
    logger.info(`  Title: ${post.metadata.title}`)
    logger.info(`  File: ${post.filePath}`)
    logger.info('')
  }
}

/**
 * Generate a new blog post template
 */
async function generatePost(
  seriesName?: string,
  postTitle?: string,
): Promise<void> {
  if (!postTitle) {
    logger.info('Error: Post title is required.')
    logger.info(
      'Usage: npm run blog-publisher -- generate [series] "Post Title"',
    )
    return
  }

  // Determine the target directory
  let targetDir = safeJoin(ALLOWED_DIRECTORIES.CONTENT, 'blog')

  if (seriesName) {
    // Convert series name to kebab-case directory name
    const seriesDirName = sanitizeFilename(
      seriesName.toLowerCase().replace(/\s+/g, '-'),
    )
    targetDir = safeJoin(targetDir, seriesDirName)

    // Ensure series directory exists
    await fs.mkdir(targetDir, { recursive: true })
  }

  // Create a slug from the title
  const slug = sanitizeFilename(
    postTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-'),
  )

  const filePath = safeJoin(targetDir, `${slug}.mdx`)

  // Check if file already exists
  try {
    await fs.access(filePath)
    logger.info(`Error: File already exists: ${filePath}`)
    return
  } catch {
    // File doesn't exist, proceed
  }

  // Determine post order if part of a series
  let seriesOrder = 1

  if (seriesName) {
    const seriesPosts = service.getPostsBySeries(seriesName)

    if (seriesPosts.length > 0) {
      // Get the highest seriesOrder and add 1
      seriesOrder =
        Math.max(...seriesPosts.map((post) => post.metadata.seriesOrder ?? 0)) +
        1
    }
  }

  // Generate a publication date 1 week from now
  const pubDate = new Date()
  pubDate.setDate(pubDate.getDate() + 7)

  // Create frontmatter
  const frontmatter = `---
title: ${postTitle}
description: >-
  Add your description here
author: Research & Clinical Team
pubDate: ${pubDate.toISOString()}
draft: true
tags:
  - tag1
  - tag2
${
  seriesName
    ? `series: ${seriesName}
seriesOrder: ${seriesOrder}`
    : ''
}
category: Research
---

# ${postTitle}

## Introduction

Your introduction text here...

## Section 1

Your content here...

## Section 2

Your content here...

## Conclusion

Your conclusion here...
`

  // Write the file
  await fs.writeFile(filePath, frontmatter, 'utf8')

  logger.info(`Created new blog post: ${filePath}`)
}

/**
 * Manually publish a post by setting draft to false
 */
async function publishPost(postPath?: string): Promise<void> {
  if (!postPath) {
    logger.info('Error: Post path is required.')
    logger.info('Usage: npm run blog-publisher -- publish path/to/post.mdx')
    return
  }

  const allPosts = service.getAllPosts()
  const targetPost = allPosts.find((post) => post.filePath.includes(postPath))

  if (!targetPost) {
    logger.info(`Error: Post not found: ${postPath}`)
    return
  }

  try {
    // Validate file path to prevent path traversal
    const validatedFilePath = validatePath(
      targetPost.filePath,
      ALLOWED_DIRECTORIES.CONTENT,
    )
    const content = await fs.readFile(validatedFilePath, 'utf8')

    // Update the draft status in frontmatter
    const updatedContent = content.replace(/draft:\s*true/i, 'draft: false')

    // Write back to the file
    await fs.writeFile(validatedFilePath, updatedContent, 'utf8')

    logger.info(`Published post: ${targetPost.metadata.title}`)
  } catch (error: unknown) {
    logger.error('Error publishing post', { error })
  }
}

/**
 * Get an emoji representing the post status
 */
function getStatusEmoji(status: PostStatus): string {
  switch (status) {
    case PostStatus.PUBLISHED:
      return '✅'
    case PostStatus.SCHEDULED:
      return '⏳'
    case PostStatus.DRAFT:
      return '📝'
    case PostStatus.OVERDUE:
      return '⚠️'
    default:
      return '❓'
  }
}

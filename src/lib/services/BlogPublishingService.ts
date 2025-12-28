import { z } from 'zod'
import * as cron from 'node-cron'
import fs from 'fs/promises'
import path from 'path'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { securePathJoin } from '../utils/index'
import { validatePath, ALLOWED_DIRECTORIES } from '../../utils/path-security'

const logger = createBuildSafeLogger('blog-publishing')

// Schema for blog post metadata
const BlogPostSchema = z.object({
  title: z.string(),
  description: z.string(),
  author: z.string(),
  pubDate: z.string(),
  draft: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional(),
  series: z.string().optional(),
  seriesOrder: z.number().optional(),
  category: z.string().optional(),
})

// Post status types
enum PostStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  PUBLISHED = 'published',
  OVERDUE = 'overdue',
}

// Interface for extended post information
interface PostInfo {
  filePath: string
  metadata: z.infer<typeof BlogPostSchema>
  status: PostStatus
  scheduled?: Date
}

/**
 * Blog Publishing Service to manage the content pipeline
 *
 * Features:
 * - Scan content directory for upcoming posts
 * - Track status of posts based on publication dates
 * - Schedule post publication using cron jobs
 * - Provide insights into content pipeline
 */
export class BlogPublishingService {
  private contentDir: string
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map()
  private posts: Map<string, PostInfo> = new Map()

  constructor(contentDir = 'src/content/blog') {
    this.contentDir = contentDir
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    try {
      logger.info('Initializing Blog Publishing Service')
      await this.scanContentDirectory()
      this.scheduleAllPosts()
      // Set up a daily job to check for overdue posts
      cron.schedule('0 0 * * *', () => this.checkForOverduePosts())
      logger.info('Blog Publishing Service initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize Blog Publishing Service', { error })
      throw error
    }
  }

  /**
   * Scan the content directory for blog posts
   */
  public async scanContentDirectory(): Promise<void> {
    try {
      logger.info(`Scanning content directory: ${this.contentDir}`)
      await this.walkDirectory(this.contentDir)
      logger.info(`Found ${this.posts.size} posts`)
    } catch (error: unknown) {
      logger.error('Error scanning content directory', { error })
      throw error
    }
  }

  /**
   * Schedule all posts based on their publication dates
   */
  private scheduleAllPosts() {
    const now = new Date()

    for (const [id, post] of this.posts.entries()) {
      try {
        const pubDate = new Date(post.metadata.pubDate)

        // Update post status
        if (post.metadata.draft) {
          post.status = PostStatus.DRAFT
        } else if (pubDate <= now) {
          post.status = PostStatus.PUBLISHED
        } else {
          post.status = PostStatus.SCHEDULED
          post.scheduled = pubDate
          this.schedulePost(id, post)
        }
      } catch (error: unknown) {
        logger.error(`Error scheduling post ${id}`, { error })
      }
    }
  }

  /**
   * Schedule an individual post
   */
  private schedulePost(id: string, post: PostInfo): void {
    try {
      const pubDate = new Date(post.metadata.pubDate)

      // Cancel any existing job
      if (this.scheduledJobs.has(id)) {
        this.scheduledJobs.get(id)?.stop()
        this.scheduledJobs.delete(id)
      }

      // Create cron expression for the publication date
      const minute = pubDate.getMinutes()
      const hour = pubDate.getHours()
      const dayOfMonth = pubDate.getDate()
      const month = pubDate.getMonth() + 1 // 0-indexed to 1-indexed

      const cronExpression = `${minute} ${hour} ${dayOfMonth} ${month} *`

      if (cron.validate(cronExpression)) {
        const job = cron.schedule(cronExpression, () => {
          this.publishPost(id)
        })

        this.scheduledJobs.set(id, job)
        logger.info(
          `Scheduled post ${id} for publication on ${pubDate.toISOString()}`,
          {
            cronExpression,
            title: post.metadata.title,
          },
        )
      } else {
        logger.error(`Invalid cron expression for post ${id}`, {
          cronExpression,
        })
      }
    } catch (error: unknown) {
      logger.error(`Error scheduling post ${id}`, { error })
    }
  }

  /**
   * Publish a post by setting draft to false
   */
  private async publishPost(id: string): Promise<void> {
    try {
      const post = this.posts.get(id)
      if (!post) {
        logger.error(`Post ${id} not found`)
        return
      }

      logger.info(`Publishing post: ${post.metadata.title}`)

      // Read the file (validate path first)
      const validatedPath = validatePath(post.filePath, ALLOWED_DIRECTORIES.CONTENT)
      const content = await fs.readFile(validatedPath, 'utf8')

      // Update the draft status in frontmatter
      const updatedContent = content.replace(/draft:\s*true/i, 'draft: false')

      // Write back to the file
      await fs.writeFile(validatedPath, updatedContent, 'utf8')

      // Update post status
      post.status = PostStatus.PUBLISHED
      post.metadata.draft = false

      logger.info(`Post published successfully: ${post.metadata.title}`)
    } catch (error: unknown) {
      logger.error(`Error publishing post ${id}`, { error })
    }
  }

  /**
   * Check for posts that should have been published but weren't
   */
  private checkForOverduePosts() {
    const now = new Date()

    for (const [id, post] of this.posts.entries()) {
      try {
        const pubDate = new Date(post.metadata.pubDate)

        if (pubDate <= now && post.status === PostStatus.SCHEDULED) {
          logger.warn(`Post overdue for publication: ${post.metadata.title}`, {
            scheduled: pubDate.toISOString(),
            current: now.toISOString(),
          })

          post.status = PostStatus.OVERDUE
        }
      } catch (error: unknown) {
        logger.error(`Error checking post ${id}`, { error })
      }
    }
  }

  /**
   * Recursively walk the directory to find all blog posts
   */
  private async walkDirectory(dirPath: string): Promise<void> {
    try {
      // Validate directory path to prevent path traversal
      const validatedDirPath = validatePath(dirPath, ALLOWED_DIRECTORIES.CONTENT)
      const entries = await fs.readdir(validatedDirPath, { withFileTypes: true })

      for (const entry of entries) {
        // Validate entry name for security - prevent path traversal
        if (
          !entry.name ||
          entry.name.includes('..') ||
          entry.name.includes('/') ||
          entry.name.includes('\\')
        ) {
          logger.warn(`Skipping potentially unsafe file entry: ${entry.name}`)
          continue
        }

        // Use securePathJoin with validated path to prevent path traversal
        const fullPath = securePathJoin(validatedDirPath, entry.name)

        if (entry.isDirectory()) {
          await this.walkDirectory(fullPath)
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.mdx') || entry.name.endsWith('.md'))
        ) {
          await this.processFile(fullPath)
        }
      }
    } catch (error: unknown) {
      logger.error(`Error walking directory ${dirPath}`, { error })
    }
  }

  /**
   * Process a blog post file
   */
  private async processFile(filePath: string): Promise<void> {
    try {
      // Validate file path
      const validatedPath = validatePath(filePath, ALLOWED_DIRECTORIES.CONTENT)
      const content = await fs.readFile(validatedPath, 'utf8')

      // Extract frontmatter between --- markers
      const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/)

      if (frontmatterMatch && frontmatterMatch[1]) {
        const frontmatter = frontmatterMatch[1]

        // Parse YAML frontmatter
        const metadata = this.parseFrontmatter(frontmatter)

        if (metadata) {
          const id = path.relative(this.contentDir, filePath)
          this.posts.set(id, {
            filePath,
            metadata,
            status: PostStatus.DRAFT, // Default status, will be updated in scheduleAllPosts
          })
        }
      }
    } catch (error: unknown) {
      logger.error(`Error processing file ${filePath}`, { error })
    }
  }

  /**
   * Parse YAML frontmatter
   */
  private parseFrontmatter(
    frontmatter: string,
  ): z.infer<typeof BlogPostSchema> | null {
    try {
      // Simple YAML parser for frontmatter
      const lines = frontmatter.split('\n')
      const data: Record<string, unknown> = {}

      for (const line of lines) {
        const match = line.match(/^\s*(\w+):\s*(.+)$/)
        if (match && match[1] && match[2]) {
          const key = match[1]
          const value = match[2]

          if (key === 'tags' || key === 'categories') {
            // Parse array values
            const arrayMatch = value.match(/\[(.*)\]/)
            if (arrayMatch && arrayMatch[1]) {
              data[key] = arrayMatch[1].split(',').map((item) => item.trim())
            } else {
              data[key] = [value.trim()]
            }
          } else if (value === 'true' || value === 'false') {
            // Parse boolean values
            data[key] = value === 'true'
          } else if (!isNaN(Number(value)) && value.trim() !== '') {
            // Parse numeric values
            data[key] = Number(value)
          } else {
            // String values
            data[key] = value.trim()
          }
        }
      }

      // Validate against schema
      return BlogPostSchema.parse(data)
    } catch (error: unknown) {
      logger.error('Error parsing frontmatter', { error, frontmatter })
      return null
    }
  }

  /**
   * Get all posts with their current status
   */
  public getAllPosts(): PostInfo[] {
    return Array.from(this.posts.values())
  }

  /**
   * Get posts by status
   */
  public getPostsByStatus(status: PostStatus): PostInfo[] {
    return Array.from(this.posts.values()).filter(
      (post) => post.status === status,
    )
  }

  /**
   * Get posts by series
   */
  public getPostsBySeries(seriesName: string): PostInfo[] {
    return Array.from(this.posts.values())
      .filter((post) => post.metadata.series === seriesName)
      .sort((a, b) => {
        // Sort by seriesOrder if available
        if (a.metadata.seriesOrder && b.metadata.seriesOrder) {
          return a.metadata.seriesOrder - b.metadata.seriesOrder
        }
        // Fall back to pubDate
        return (
          new Date(a.metadata.pubDate).getTime() -
          new Date(b.metadata.pubDate).getTime()
        )
      })
  }

  /**
   * Get upcoming posts (scheduled for future publication)
   */
  public getUpcomingPosts(): PostInfo[] {
    return Array.from(this.posts.values())
      .filter((post) => post.status === PostStatus.SCHEDULED)
      .sort(
        (a, b) =>
          new Date(a.metadata.pubDate).getTime() -
          new Date(b.metadata.pubDate).getTime(),
      )
  }

  /**
   * Get overdue posts
   */
  public getOverduePosts(): PostInfo[] {
    return this.getPostsByStatus(PostStatus.OVERDUE)
  }

  /**
   * Generate a content pipeline report
   */
  public generateContentReport(): string {
    const now = new Date()
    const allPosts = this.getAllPosts()
    const scheduledPosts = this.getPostsByStatus(PostStatus.SCHEDULED)
    const draftPosts = this.getPostsByStatus(PostStatus.DRAFT)
    const publishedPosts = this.getPostsByStatus(PostStatus.PUBLISHED)
    const overduePosts = this.getPostsByStatus(PostStatus.OVERDUE)

    let report = '# Blog Content Pipeline Report\n\n'
    report += `Generated: ${now.toISOString()}\n\n`
    report += `Total Posts: ${allPosts.length}\n`
    report += `Published: ${publishedPosts.length}\n`
    report += `Scheduled: ${scheduledPosts.length}\n`
    report += `Draft: ${draftPosts.length}\n`
    report += `Overdue: ${overduePosts.length}\n\n`

    // Series breakdown
    const seriesMap = new Map<string, PostInfo[]>()
    for (const post of allPosts) {
      if (post.metadata.series) {
        if (!seriesMap.has(post.metadata.series)) {
          seriesMap.set(post.metadata.series, [])
        }
        seriesMap.get(post.metadata.series)?.push(post)
      }
    }

    report += '## Series Breakdown\n\n'
    for (const [seriesName, posts] of seriesMap.entries()) {
      report += `### ${seriesName}\n\n`

      // Sort posts by series order
      posts.sort((a, b) => {
        if (a.metadata.seriesOrder && b.metadata.seriesOrder) {
          return a.metadata.seriesOrder - b.metadata.seriesOrder
        }
        return 0
      })

      for (const post of posts) {
        const pubDate = new Date(post.metadata.pubDate)
        const statusEmoji = this.getStatusEmoji(post.status)
        const seriesInfo = post.metadata.seriesOrder
          ? `[Part ${post.metadata.seriesOrder}]`
          : ''

        report += `${statusEmoji} ${seriesInfo} ${post.metadata.title} (${pubDate.toDateString()})\n`
      }
      report += '\n'
    }

    report += '## Upcoming Publications\n\n'
    if (scheduledPosts.length === 0) {
      report += 'No upcoming publications scheduled.\n\n'
    } else {
      for (const post of scheduledPosts) {
        const pubDate = new Date(post.metadata.pubDate)
        const daysUntil = Math.ceil(
          (pubDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        )

        report += `- **${post.metadata.title}** - ${pubDate.toDateString()} (in ${daysUntil} days)\n`
      }
      report += '\n'
    }

    if (overduePosts.length > 0) {
      report += '## ⚠️ Overdue Publications\n\n'
      for (const post of overduePosts) {
        const pubDate = new Date(post.metadata.pubDate)
        const daysOverdue = Math.ceil(
          (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60 * 24),
        )

        report += `- **${post.metadata.title}** - ${pubDate.toDateString()} (${daysOverdue} days overdue)\n`
      }
    }

    return report
  }

  /**
   * Get an emoji representing the post status
   */
  private getStatusEmoji(status: PostStatus): string {
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
}

export { PostStatus }

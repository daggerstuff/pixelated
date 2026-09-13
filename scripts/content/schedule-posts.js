/**
 * Blog Post Scheduler
 *
 * This script automates the publishing of scheduled blog posts by:
 * 1. Finding all blog posts with future publication dates
 * 2. Checking if any are due to be published today
 * 3. Setting their draft status to false when their date is reached
 * 4. Committing changes back to the repository
 */

import fs from 'fs/promises'
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

import { globby } from 'globby'
const require = createRequire(import.meta.url)
const matter = require('gray-matter')
import simpleGit from 'simple-git'

// Directory paths
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.join(__dirname, '..')
const contentDir = path.join(rootDir, 'src', 'content', 'blog')

// Determine if we're running in GitHub Actions
const isGitHubActions = process.env.GITHUB_ACTIONS === 'true'

/**
 * Main function to schedule posts
 */
async function schedulePost() {
  console.log('🚀 Starting blog post scheduler...')

  try {
    // Get all .md and .mdx files recursively in the blog directory
    const blogFilePaths = await globby([
      path.join(contentDir, '**/*.md'),
      path.join(contentDir, '**/*.mdx'),
    ])

    console.log(`📚 Found ${blogFilePaths.length} blog post files`)

    const today = new Date()
    today.setHours(0, 0, 0, 0) // Set to beginning of day

    let postsPublished = 0

    // Check each file
    for (const filePath of blogFilePaths) {
      const fileContent = await fs.readFile(filePath, 'utf-8')
      const { data, content } = matter(fileContent)

      // Skip if there's no publication date or if it's not in draft mode
      if (!data.pubDate || data.draft === false) {
        continue
      }

      const pubDate = new Date(data.pubDate)
      pubDate.setHours(0, 0, 0, 0) // Set to beginning of day

      // If publication date is today or in the past, and post is still in draft
      if (pubDate <= today && data.draft === true) {
        console.log(
          `📅 Publishing post: ${path.basename(filePath)} (scheduled for ${pubDate.toDateString()})`,
        )

        // Update draft status
        data.draft = false

        // Write back to file
        const updatedFileContent = matter.stringify(content, data)
        await fs.writeFile(filePath, updatedFileContent, 'utf-8')

        postsPublished++
      }
    }

    // If any posts were published, commit changes
    if (postsPublished > 0) {
      console.log(`✅ Updated ${postsPublished} post(s)`)

      // Only attempt to commit and push if we're in GitHub Actions
      if (isGitHubActions) {
        try {
          const git = simpleGit(rootDir)

          await git.add('.')
          await git.commit(
            `🤖 Published ${postsPublished} scheduled blog post(s) [skip ci]`,
          )
          await git.push('origin', 'main')

          console.log('✅ Pushed changes to repository')
        } catch (gitError) {
          console.error('⚠️ Git operation failed:', gitError.message)
          console.log(
            '✅ Files were updated locally but not committed to the repository',
          )

          // Only exit with error code if we're in GitHub Actions
          if (isGitHubActions) {
            process.exit(1)
          }
        }
      } else {
        console.log(
          'ℹ️ Running in test mode - changes were not committed to the repository',
        )
      }
    } else {
      console.log('ℹ️ No posts scheduled for publishing today')
    }

    console.log('✅ Blog post scheduler completed successfully')
  } catch (error) {
    console.error('❌ Error in blog post scheduler:', error)
    process.exit(1)
  }
}

// Run the scheduler
void schedulePost()

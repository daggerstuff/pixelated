#!/usr/bin/env node

/**
 * Tag Manager - Comprehensive tagging strategy implementation
 * Handles creation, validation, and management of deployment tags
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import simpleGit from 'simple-git'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const git = simpleGit(projectRoot)

// Tag naming conventions
const TAG_PATTERNS = {
  production: 'production',
  staging: 'staging',
  development: 'dev',
  hotfix: 'hotfix',
  release: 'release',
  rollback: 'rollback',
}

// Helper functions
function runCommand(command, silent = false) {
  try {
    return execSync(command, {
      stdio: silent ? 'pipe' : 'inherit',
      cwd: projectRoot,
      encoding: 'utf8',
    }).trim()
  } catch (error) {
    if (!silent) {
      console.error(chalk.red(`Command failed: ${error.message}`))
    }
    throw error
  }
}

function generateTimestamp() {
  const now = new Date()
  return now.toISOString().replace(/[:.]/g, '-').substring(0, 19) // YYYY-MM-DDTHH-MM-SS
}

function generateDateStamp() {
  return new Date().toISOString().split('T')[0] // YYYY-MM-DD
}

async function getCurrentCommitInfo() {
  const hash = (await git.revparse(['HEAD'])).trim().substring(0, 8)
  const branch = (await git.branch()).current
  const { latest } = await git.log(['-1', '--pretty=format:%s'])
  const message = latest ? latest.message : 'No commit message'

  return { hash, branch, message }
}

async function getPackageVersion() {
  const packagePath = path.join(projectRoot, 'package.json')
  if (fs.existsSync(packagePath)) {
    const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
    return packageJson.version || '0.0.1'
  }
  return '0.0.1'
}

// Tag creation functions
async function createProductionTag(options = {}) {
  const { hash, branch } = await getCurrentCommitInfo()
  const version = await getPackageVersion()
  const timestamp = generateTimestamp()
  const dateStamp = generateDateStamp()

  console.log(chalk.cyan('\n📋 Creating production tags...'))

  // Create multiple tag formats for different use cases
  const tags = []

  // Main production tag with timestamp
  const mainTag = `production-${timestamp}`
  tags.push(mainTag)

  // Date-based production tag (for easy rollback by date)
  const dateTag = `production-${dateStamp}`
  tags.push(dateTag)

  // Version-based production tag
  const versionTag = `production-v${version}`
  tags.push(versionTag)

  // Semantic release tag (if version is semantic)
  if (version.match(/^\d+\.\d+\.\d+/)) {
    const releaseTag = `v${version}`
    tags.push(releaseTag)
  }

  // Create all tags
  for (const tag of tags) {
    try {
      await git.addTag(tag)
      console.log(chalk.green(`✅ Created tag: ${tag}`))
    } catch (error) {
      console.log(chalk.yellow(`⚠️ Tag ${tag} already exists, skipping`))
    }
  }

  // Add metadata as annotated tag
  const metadataTag = `${mainTag}-metadata`
  const tagMessage = `Production deployment
Branch: ${branch}
Commit: ${hash}
Version: ${version}
Timestamp: ${new Date().toISOString()}
${options.message ? `Message: ${options.message}` : ''}`

  try {
    await git.addAnnotatedTag(metadataTag, tagMessage)
    console.log(chalk.green(`✅ Created metadata tag: ${metadataTag}`))
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Metadata tag ${metadataTag} already exists`))
  }

  return { mainTag, tags }
}

async function createStagingTag(options = {}) {
  const { hash, branch } = await getCurrentCommitInfo()
  const timestamp = generateTimestamp()

  console.log(chalk.cyan('\n📋 Creating staging tag...'))

  const tag = `staging-${timestamp}`

  try {
    await git.addTag(tag)
    console.log(chalk.green(`✅ Created staging tag: ${tag}`))
    return tag
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Tag ${tag} already exists`))
    return tag
  }
}

async function createHotfixTag(version, options = {}) {
  const { hash } = await getCurrentCommitInfo()
  const timestamp = generateTimestamp()

  console.log(chalk.cyan('\n📋 Creating hotfix tag...'))

  const tag = `hotfix-${version}-${timestamp}`

  try {
    const message = `Hotfix ${version}
Commit: ${hash}
Timestamp: ${new Date().toISOString()}
${options.message ? `Description: ${options.message}` : ''}`

    await git.addAnnotatedTag(tag, message)
    console.log(chalk.green(`✅ Created hotfix tag: ${tag}`))
    return tag
  } catch (error) {
    console.log(chalk.red(`❌ Failed to create hotfix tag: ${error.message}`))
    throw error
  }
}

async function createRollbackTag(environment, rolledBackTo) {
  const timestamp = generateTimestamp()
  const tag = `rollback-${environment}-${timestamp}`

  try {
    const message = `Rollback ${environment} to ${rolledBackTo}
Timestamp: ${new Date().toISOString()}`

    await git.addAnnotatedTag(tag, message)
    console.log(chalk.green(`✅ Created rollback tag: ${tag}`))
    return tag
  } catch (error) {
    console.log(chalk.red(`❌ Failed to create rollback tag: ${error.message}`))
    throw error
  }
}

// Tag management functions
async function listTags(pattern = null) {
  const tags = await git.tags()
  let filteredTags = tags.all || []

  if (pattern) {
    filteredTags = filteredTags.filter((tag) => tag.includes(pattern))
  }

  return filteredTags.sort().reverse()
}

async function getLatestTag(environment) {
  const pattern = `${environment}-`
  const tags = await listTags(pattern)
  return tags.length > 0 ? tags[0] : null
}

async function getPreviousTag(environment, excludeCurrent = true) {
  const pattern = `${environment}-`
  const tags = await listTags(pattern)

  if (tags.length < 2 && excludeCurrent) {
    return null
  }

  return excludeCurrent && tags.length >= 2 ? tags[1] : tags[0]
}

async function validateTagsForRollback(environment) {
  const pattern = `${environment}-`
  const tags = await listTags(pattern)

  if (tags.length === 0) {
    throw new Error(`No ${environment} tags found`)
  }

  if (tags.length === 1) {
    throw new Error(`Only one ${environment} tag exists, cannot rollback`)
  }

  return {
    current: tags[0],
    previous: tags[1],
    count: tags.length,
  }
}

// Cleanup functions
async function cleanupOldTags(environment, keepCount = 10) {
  console.log(chalk.cyan(`\n📋 Cleaning up old ${environment} tags...`))

  const tags = await listTags(`${environment}-`)

  if (tags.length <= keepCount) {
    console.log(
      chalk.green(`✅ No cleanup needed, only ${tags.length} tags exist`),
    )
    return
  }

  const tagsToDelete = tags.slice(keepCount)

  for (const tag of tagsToDelete) {
    try {
      await git.tag(['-d', tag])
      console.log(chalk.yellow(`🗑️ Deleted local tag: ${tag}`))

      // Also delete from remote if it exists
      try {
        await git.push('origin', `:refs/tags/${tag}`)
        console.log(chalk.yellow(`🗑️ Deleted remote tag: ${tag}`))
      } catch (remoteError) {
        // Remote tag might not exist, that's okay
      }
    } catch (error) {
      console.log(chalk.red(`❌ Failed to delete tag ${tag}: ${error.message}`))
    }
  }

  console.log(
    chalk.green(`✅ Cleanup complete, kept ${keepCount} most recent tags`),
  )
}

// Push tags to remote
async function pushTags(tags = null) {
  console.log(chalk.cyan('\n📋 Pushing tags to remote...'))

  if (tags && Array.isArray(tags)) {
    // Push specific tags
    for (const tag of tags) {
      try {
        await git.push('origin', tag)
        console.log(chalk.green(`✅ Pushed tag: ${tag}`))
      } catch (error) {
        console.log(chalk.red(`❌ Failed to push tag ${tag}: ${error.message}`))
      }
    }
  } else {
    // Push all tags
    try {
      await git.push('origin', '--tags')
      console.log(chalk.green('✅ Pushed all tags'))
    } catch (error) {
      console.log(chalk.red(`❌ Failed to push tags: ${error.message}`))
      throw error
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]
  const environment = args[1]
  const options = {}

  // Parse additional options
  for (let i = 2; i < args.length; i++) {
    args[i].startsWith('--message=')
      ? (options.message = args[i].split('=')[1])
      : args[i] === '--push'
        ? (options.push = true)
        : args[i] === '--cleanup'
          ? (options.cleanup = true)
          : null
  }

  try {
    switch (command) {
      case 'create':
        if (environment === 'production') {
          const result = await createProductionTag(options)
          if (options.push) {
            await pushTags(result.tags)
          }
        } else if (environment === 'staging') {
          const tag = await createStagingTag(options)
          if (options.push) {
            await pushTags([tag])
          }
        } else {
          console.error(
            chalk.red('❌ Invalid environment. Use: production, staging'),
          )
          process.exit(1)
        }
        break

      case 'hotfix':
        const version = environment // reuse environment arg for version
        const message = args[2]
        const tag = await createHotfixTag(version, { message })
        if (options.push) {
          await pushTags([tag])
        }
        break

      case 'list':
        const pattern = environment || null
        const tags = await listTags(pattern)
        console.log(
          chalk.cyan(`\n📋 Tags${pattern ? ` matching "${pattern}"` : ''}:`),
        )
        tags.forEach((tag) => console.log(`  ${tag}`))
        break

      case 'validate':
        const validation = await validateTagsForRollback(environment)
        console.log(
          chalk.green(`✅ Rollback validation passed for ${environment}`),
        )
        console.log(`  Current: ${validation.current}`)
        console.log(`  Previous: ${validation.previous}`)
        console.log(`  Total tags: ${validation.count}`)
        break

      case 'cleanup':
        const keepCount = parseInt(args[2]) || 10
        await cleanupOldTags(environment, keepCount)
        break

      case 'push':
        await pushTags()
        break

      default:
        console.log(
          chalk.cyan(`
📋 Tag Manager Usage:

  Create tags:
    node tag-manager.js create production [--message="Deployment message"] [--push]
    node tag-manager.js create staging [--push]
    node tag-manager.js hotfix 1.2.3 "Fix critical bug" [--push]

  Manage tags:
    node tag-manager.js list [pattern]
    node tag-manager.js validate production|staging
    node tag-manager.js cleanup production|staging [keepCount]
    node tag-manager.js push

  Examples:
    node tag-manager.js create production --message="Release v1.2.0" --push
    node tag-manager.js list production
    node tag-manager.js validate production
    node tag-manager.js cleanup staging 5
        `),
        )
    }
  } catch (error) {
    console.error(chalk.red(`❌ ${error.message}`))
    process.exit(1)
  }
}

// Export functions for use in other scripts
export {
  createProductionTag,
  createStagingTag,
  createHotfixTag,
  createRollbackTag,
  listTags,
  getLatestTag,
  getPreviousTag,
  validateTagsForRollback,
  cleanupOldTags,
  pushTags,
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

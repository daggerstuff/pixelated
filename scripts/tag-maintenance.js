#!/usr/bin/env node

/**
 * Tag Maintenance Script
 * Handles cleanup, validation, and maintenance of deployment tags
 */

import chalk from 'chalk'
import simpleGit from 'simple-git'
import { fileURLToPath } from 'url'
import path from 'path'
import {
  listTags,
  cleanupOldTags,
  validateTagsForRollback,
  pushTags,
} from './tag-manager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const git = simpleGit(projectRoot)

// Tag validation functions
async function validateTagStructure() {
  console.log(chalk.cyan('\n📋 Validating tag structure...'))

  const allTags = await listTags()
  const issues = []

  const patterns = {
    production:
      /^production-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2}|\d{8}-\d{6}|v\d+\.\d+\.\d+|.*-metadata)$/,
    staging: /^staging-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/,
    version: /^v\d+\.\d+\.\d+/,
    rollback:
      /^rollback-(production|staging)-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/,
    hotfix: /^hotfix-\d+\.\d+\.\d+-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}$/,
  }

  const categorizedTags = {
    production: [],
    staging: [],
    version: [],
    rollback: [],
    hotfix: [],
    unknown: [],
  }

  // Categorize tags
  allTags.forEach((tag) => {
    let categorized = false
    for (const [category, pattern] of Object.entries(patterns)) {
      if (pattern.test(tag)) {
        categorizedTags[category].push(tag)
        categorized = true
        break
      }
    }
    if (!categorized) {
      categorizedTags.unknown.push(tag)
    }
  })

  // Report findings
  console.log(chalk.cyan('\n📋 Tag Structure Analysis:'))

  Object.entries(categorizedTags).forEach(([category, tags]) => {
    if (tags.length > 0) {
      console.log(`  ${category.toUpperCase()}: ${tags.length} tags`)
      if (category === 'unknown' && tags.length > 0) {
        console.log(
          chalk.yellow(
            `    Unknown tags: ${tags.slice(0, 5).join(', ')}${tags.length > 5 ? '...' : ''}`,
          ),
        )
        issues.push(`${tags.length} unknown tag format(s) found`)
      }
    }
  })

  // Check for deployment tag patterns
  const environments = ['production', 'staging']

  for (const env of environments) {
    if (categorizedTags[env].length === 0) {
      issues.push(`No ${env} deployment tags found`)
    } else if (categorizedTags[env].length === 1) {
      issues.push(
        `Only one ${env} deployment tag found - limited rollback capability`,
      )
    }
  }

  return { categorizedTags, issues }
}

async function validateTagConsistency() {
  console.log(chalk.cyan('\n📋 Validating tag consistency...'))

  const issues = []

  try {
    // Check production tags
    await validateTagsForRollback('production')
    console.log(chalk.green('✅ Production tags are consistent'))
  } catch (error) {
    issues.push(`Production tags: ${error.message}`)
  }

  try {
    // Check staging tags
    await validateTagsForRollback('staging')
    console.log(chalk.green('✅ Staging tags are consistent'))
  } catch (error) {
    if (error && error.message) {
      issues.push(`Staging tags: ${error.message}`)
    } else {
      issues.push('Staging tags: validation failed')
    }
  }

  return issues
}

async function syncRemoteTags() {
  console.log(chalk.cyan('\n📋 Syncing with remote tags...'))

  try {
    // Fetch all tags from remote
    await git.fetch(['--tags', '--force'])
    console.log(chalk.green('✅ Fetched remote tags'))

    // Get local and remote tags
    const localTags = await listTags()
    const remoteTags = await git.listRemote(['--tags', 'origin'])

    const remoteTagNames = remoteTags
      .split('\n')
      .filter((line) => line.includes('refs/tags/'))
      .map((line) => line.split('/').pop())
      .filter((tag) => tag && !tag.includes('^{}'))

    // Find tags that exist remotely but not locally
    const missingLocal = remoteTagNames.filter(
      (tag) => !localTags.includes(tag),
    )

    // Find tags that exist locally but not remotely
    const missingRemote = localTags.filter(
      (tag) => !remoteTagNames.includes(tag),
    )

    console.log(chalk.cyan('\n📋 Tag Sync Status:'))
    console.log(`  Local tags: ${localTags.length}`)
    console.log(`  Remote tags: ${remoteTagNames.length}`)
    console.log(`  Missing locally: ${missingLocal.length}`)
    console.log(`  Missing remotely: ${missingRemote.length}`)

    if (missingLocal.length > 0) {
      console.log(
        chalk.yellow(
          `  Tags missing locally: ${missingLocal.slice(0, 3).join(', ')}${missingLocal.length > 3 ? '...' : ''}`,
        ),
      )
    }

    if (missingRemote.length > 0) {
      console.log(
        chalk.yellow(
          `  Tags missing remotely: ${missingRemote.slice(0, 3).join(', ')}${missingRemote.length > 3 ? '...' : ''}`,
        ),
      )
    }

    return { missingLocal, missingRemote }
  } catch (error) {
    console.error(chalk.red(`❌ Failed to sync remote tags: ${error.message}`))
    throw error
  }
}

async function generateTagReport() {
  console.log(chalk.cyan('\n📋 Generating comprehensive tag report...'))

  const validation = await validateTagStructure()
  const consistency = await validateTagConsistency()
  const sync = await syncRemoteTags()

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalTags: Object.values(validation.categorizedTags).flat().length,
      productionTags: validation.categorizedTags.production.length,
      stagingTags: validation.categorizedTags.staging.length,
      versionTags: validation.categorizedTags.version.length,
      rollbackTags: validation.categorizedTags.rollback.length,
      hotfixTags: validation.categorizedTags.hotfix.length,
      unknownTags: validation.categorizedTags.unknown.length,
    },
    issues: [...validation.issues, ...consistency],
    sync: {
      missingLocal: sync.missingLocal.length,
      missingRemote: sync.missingRemote.length,
    },
    recommendations: [],
  }

  // Generate recommendations
  if (report.summary.productionTags === 0) {
    report.recommendations.push('Create initial production deployment tags')
  } else if (report.summary.productionTags === 1) {
    report.recommendations.push(
      'Create additional production deployments to enable rollback capability',
    )
  }

  if (report.summary.stagingTags === 0) {
    report.recommendations.push('Create initial staging deployment tags')
  }

  if (report.summary.unknownTags > 0) {
    report.recommendations.push('Review and cleanup unknown tag formats')
  }

  if (sync.missingRemote.length > 0) {
    report.recommendations.push('Push missing tags to remote repository')
  }

  if (report.summary.totalTags > 50) {
    report.recommendations.push('Consider cleaning up old deployment tags')
  }

  // Display report
  console.log(chalk.cyan('\n📋 Tag Report Summary:'))
  console.log(`  Total Tags: ${report.summary.totalTags}`)
  console.log(`  Production: ${report.summary.productionTags}`)
  console.log(`  Staging: ${report.summary.stagingTags}`)
  console.log(`  Version: ${report.summary.versionTags}`)
  console.log(`  Issues Found: ${report.issues.length}`)

  if (report.issues.length > 0) {
    console.log(chalk.yellow('\n⚠️ Issues:'))
    report.issues.forEach((issue) => console.log(`  - ${issue}`))
  }

  if (report.recommendations.length > 0) {
    console.log(chalk.cyan('\n💡 Recommendations:'))
    report.recommendations.forEach((rec) => console.log(`  - ${rec}`))
  }

  return report
}

async function autoFixIssues(options = {}) {
  console.log(chalk.cyan('\n📋 Running auto-fix for common issues...'))

  const fixes = []

  try {
    // Fix 1: Sync remote tags
    if (!options.skipSync) {
      await syncRemoteTags()
      fixes.push('Synced remote tags')
    }

    // Fix 2: Push missing tags
    if (!options.skipPush) {
      const sync = await syncRemoteTags()
      if (sync.missingRemote.length > 0 && sync.missingRemote.length < 10) {
        await pushTags()
        fixes.push(`Pushed ${sync.missingRemote.length} missing tags`)
      }
    }

    // Fix 3: Create initial tags if none exist
    if (!options.skipInitial) {
      const productionTags = await listTags('production-')
      const stagingTags = await listTags('staging-')

      if (productionTags.length === 0) {
        console.log(chalk.yellow('Creating initial production tag...'))
        const { createProductionTag } = await import('./tag-manager.js')
        await createProductionTag({
          message: 'Initial production tag created by maintenance script',
        })
        fixes.push('Created initial production tag')
      }

      if (stagingTags.length === 0) {
        console.log(chalk.yellow('Creating initial staging tag...'))
        const { createStagingTag } = await import('./tag-manager.js')
        await createStagingTag({
          message: 'Initial staging tag created by maintenance script',
        })
        fixes.push('Created initial staging tag')
      }
    }

    console.log(
      chalk.green(`✅ Auto-fix completed: ${fixes.length} issues fixed`),
    )
    fixes.forEach((fix) => console.log(`  - ${fix}`))
  } catch (error) {
    console.error(chalk.red(`❌ Auto-fix failed: ${error.message}`))
    throw error
  }

  return fixes
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]

  const options = {}

  // Parse options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--skip-sync') {
      options.skipSync = true
    } else if (arg === '--skip-push') {
      options.skipPush = true
    } else if (arg === '--skip-initial') {
      options.skipInitial = true
    } else if (arg.startsWith('--keep=')) {
      options.keep = parseInt(arg.split('=')[1])
    }
  }

  try {
    switch (command) {
      case 'validate':
        await validateTagStructure()
        await validateTagConsistency()
        break

      case 'sync':
        await syncRemoteTags()
        break

      case 'report':
        await generateTagReport()
        break

      case 'cleanup':
        const env = args[1] || 'all'
        const keep = options.keep || 10

        if (env === 'all') {
          await cleanupOldTags('production', keep)
          await cleanupOldTags('staging', keep)
        } else {
          await cleanupOldTags(env, keep)
        }
        break

      case 'autofix':
        await autoFixIssues(options)
        break

      case 'full-maintenance':
        console.log(chalk.cyan.bold('🔧 Running full maintenance cycle...'))
        await generateTagReport()
        await autoFixIssues(options)
        console.log(chalk.green.bold('\n✅ Full maintenance completed!'))
        break

      default:
        console.log(
          chalk.cyan(`
🔧 Tag Maintenance Script

Usage:
  node tag-maintenance.js <command> [options]

Commands:
  validate           Validate tag structure and consistency
  sync              Sync with remote tags
  report            Generate comprehensive tag report
  cleanup [env]     Clean up old tags (env: production, staging, or all)
  autofix           Automatically fix common issues
  full-maintenance  Run complete maintenance cycle

Options:
  --skip-sync       Skip remote synchronization
  --skip-push       Skip pushing missing tags
  --skip-initial    Skip creating initial tags
  --keep=N          Number of tags to keep during cleanup (default: 10)

Examples:
  node tag-maintenance.js report
  node tag-maintenance.js cleanup production --keep=5
  node tag-maintenance.js autofix --skip-initial
  node tag-maintenance.js full-maintenance
        `),
        )
    }
  } catch (error) {
    console.error(chalk.red(`❌ ${error.message}`))
    process.exit(1)
  }
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

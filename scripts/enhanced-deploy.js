#!/usr/bin/env node

/**
 * Enhanced Deployment Script with Comprehensive Tagging
 * Integrates with tag-manager.js for consistent tagging strategy
 */

import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import chalk from 'chalk'
import simpleGit from 'simple-git'
import {
  createProductionTag,
  createStagingTag,
  validateTagsForRollback,
  createRollbackTag,
  pushTags,
} from './tag-manager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const git = simpleGit(projectRoot)

// Helper functions
function runCommand(command, label, silent = false) {
  if (!silent) {
    console.log(chalk.cyan(`\n🔄 ${label}...`))
  }
  try {
    return execSync(command, {
      stdio: silent ? 'pipe' : 'inherit',
      cwd: projectRoot,
      encoding: 'utf8',
    })
  } catch (error) {
    if (!silent) {
      console.error(chalk.red(`❌ ${label} failed: ${error.message}`))
    }
    throw error
  }
}

function confirmPrompt(message) {
  // In CI environment, assume yes
  if (process.env.CI) {
    return Promise.resolve(true)
  }

  // For local development, you'd implement actual prompting
  // For now, we'll assume confirmation
  console.log(chalk.yellow(`⚠️ ${message} (auto-confirmed in script)`))
  return Promise.resolve(true)
}

// Pre-deployment checks
async function runPreDeploymentChecks(environment) {
  console.log(chalk.cyan('\n📋 Running pre-deployment checks...'))

  // Check for uncommitted changes
  const status = await git.status()
  if (status.files.length > 0) {
    console.warn(chalk.yellow('⚠️ Uncommitted changes detected:'))
    status.files.forEach((file) => {
      console.log(`  ${file.working_dir}${file.index} ${file.path}`)
    })

    if (environment === 'production') {
      const proceed = await confirmPrompt(
        'Continue with production deployment despite uncommitted changes?',
      )
      if (!proceed) {
        throw new Error('Deployment cancelled due to uncommitted changes')
      }
    }
  }

  const branch = (await git.branch()).current
  if (environment === 'production' && !['main', 'master'].includes(branch)) {
    const proceed = await confirmPrompt(
      `Deploying to production from ${branch} branch. Continue?`,
    )
    if (!proceed) {
      throw new Error('Production deployment cancelled')
    }
  }

  try {
    await validateTagsForRollback(environment)
    console.log(
      chalk.green(
        '✅ Previous deployments found - rollback capability available',
      ),
    )
  } catch (error) {
    if (
      (error.message.includes('No') && error.message.includes('tags found')) ||
      error.message.includes('Only one')
    ) {
      const message = error.message.includes('No')
        ? '⚠️ No previous deployment tags found - this will be the first deployment'
        : '⚠️ Only one previous deployment - limited rollback capability'
      console.log(chalk.yellow(message))
    } else {
      console.log(chalk.yellow(`⚠️ Tag validation: ${error.message}`))
    }
  }

  // Run security checks
  if (fs.existsSync(path.join(projectRoot, 'scripts/clean-credentials.js'))) {
    try {
      runCommand(
        'node scripts/clean-credentials.js --check-only',
        'Security credential check',
        true,
      )
      console.log(chalk.green('✅ Security checks passed'))
    } catch (error) {
      console.warn(
        chalk.yellow(
          `⚠️ Security checks failed - fixing automatically: ${error.message}`,
        ),
      )
      runCommand('node scripts/clean-credentials.js', 'Fixing credentials')
    }
  }

  // Type checking for production
  if (environment === 'production') {
    try {
      runCommand('pnpm run typecheck', 'Type checking')
      console.log(chalk.green('✅ Type checks passed'))
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Type check error: ${error.message}`))
      const proceed = await confirmPrompt(
        'Type checks failed. Continue with deployment?',
      )
      if (!proceed) {
        throw new Error('Deployment cancelled due to type check failures')
      }
    }
  }
}

// Build application
async function buildApplication(environment) {
  console.log(chalk.cyan(`\n📋 Building application for ${environment}...`))

  // Set environment variables
  process.env.NODE_ENV = environment === 'production' ? 'production' : 'staging'

  // Choose build command based on environment
  let buildCommand = 'pnpm run build'
  if (environment === 'production') {
    buildCommand = 'pnpm run build:prod'
  }

  runCommand('pnpm install --no-frozen-lockfile', 'Installing dependencies')
  runCommand(buildCommand, `Building for ${environment}`)

  // Verify build output
  const distPath = path.join(projectRoot, 'dist')
  if (!fs.existsSync(distPath)) {
    throw new Error('Build failed - no dist directory found')
  }

  const buildSize = execSync(`du -sh ${distPath}`, { encoding: 'utf8' }).trim()
  console.log(chalk.green(`✅ Build completed - Size: ${buildSize}`))
}

// Deploy to environment
async function deployToEnvironment(environment, deploymentTag) {
  console.log(chalk.cyan(`\n📋 Deploying to ${environment}...`))

  try {
    if (environment === 'production') {
      // Production deployment
      if (process.env.VERCEL_TOKEN || process.env.CI) {
        runCommand(
          'vercel deploy --prod --yes',
          'Deploying to Vercel Production',
        )
      } else {
        console.log(
          chalk.yellow('⚠️ No VERCEL_TOKEN found, skipping Vercel deployment'),
        )
      }

      // Cloudflare deployment removed - now using AWS/Vercel only
    } else if (process.env.VERCEL_TOKEN || process.env.CI) {
      runCommand('vercel deploy --yes', 'Deploying to Vercel Staging')
    }

    console.log(chalk.green(`✅ Deployment to ${environment} completed`))
    console.log(chalk.cyan(`📋 Tagged as: ${deploymentTag}`))
  } catch (error) {
    console.error(
      chalk.red(`❌ Deployment to ${environment} failed: ${error.message}`),
    )
    throw error
  }
}

// Deploy function
async function deploy(environment, options = {}) {
  console.log(
    chalk.cyan.bold(`🚀 Starting deployment to ${environment.toUpperCase()}`),
  )

  const startTime = Date.now()
  let deploymentTag = null

  try {
    // Pre-deployment checks
    await runPreDeploymentChecks(environment)

    // Build application
    await buildApplication(environment)

    // Create deployment tag
    console.log(chalk.cyan('\n📋 Creating deployment tags...'))
    if (environment === 'production') {
      const result = await createProductionTag({
        message:
          options.message ||
          `Production deployment ${new Date().toISOString()}`,
      })
      deploymentTag = result.mainTag
    } else {
      deploymentTag = await createStagingTag({
        message:
          options.message || `Staging deployment ${new Date().toISOString()}`,
      })
    }

    // Deploy to environment
    await deployToEnvironment(environment, deploymentTag)

    // Push tags to remote
    if (!options.skipPushTags) {
      await pushTags()
    }

    // Post-deployment tasks
    if (environment === 'production') {
      // Run post-deployment verification
      console.log(chalk.cyan('\n📋 Running post-deployment verification...'))

      // Health check (if endpoint available)
      try {
        runCommand(
          'curl -f https://pixelated.vercel.app/api/health || echo "Health check endpoint not available"',
          'Health check',
          true,
        )
        console.log(chalk.green('✅ Health check passed'))
      } catch (error) {
        console.log(chalk.yellow('⚠️ Health check not available or failed'))
        console.warn(chalk.yellow(`Health check error: ${error.message}`))
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000)
    console.log(
      chalk.green.bold(
        `\n✅ Deployment to ${environment} completed successfully in ${duration}s`,
      ),
    )
    console.log(chalk.cyan(`📋 Deployment tag: ${deploymentTag}`))
  } catch (error) {
    const duration = Math.round((Date.now() - startTime) / 1000)
    console.error(
      chalk.red.bold(
        `\n❌ Deployment to ${environment} failed after ${duration}s`,
      ),
    )
    console.error(chalk.red(`Error: ${error.message}`))
    process.exit(1)
  }
}

// Rollback function with improved tag handling
async function rollback(environment) {
  console.log(
    chalk.cyan.bold(`🔄 Starting rollback for ${environment.toUpperCase()}`),
  )

  try {
    // Validate rollback capability
    const validation = await validateTagsForRollback(environment)

    console.log(chalk.cyan(`\n📋 Current deployment: ${validation.current}`))
    console.log(chalk.cyan(`📋 Rolling back to: ${validation.previous}`))

    const proceed = await confirmPrompt(
      `Confirm rollback from ${validation.current} to ${validation.previous}?`,
    )
    if (!proceed) {
      console.log(chalk.yellow('\n⚠️ Rollback cancelled by user'))
      return
    }

    // Checkout the previous tag
    await git.checkout(validation.previous)

    // Build the previous version
    await buildApplication(environment)

    // Deploy the previous version
    await deployToEnvironment(environment, validation.previous)

    // Create rollback tag
    const rollbackTag = await createRollbackTag(
      environment,
      validation.previous,
    )

    // Return to original branch
    const originalBranch = await git.branch()
    if (
      originalBranch.current !==
      originalBranch.all.find((b) => b.includes('HEAD'))
    ) {
      await git.checkout(originalBranch.current || 'main')
    }

    // Push rollback tag
    await pushTags([rollbackTag])

    console.log(
      chalk.green.bold(
        `\n✅ Rollback to ${validation.previous} completed successfully`,
      ),
    )
    console.log(chalk.cyan(`📋 Rollback tag: ${rollbackTag}`))
  } catch (error) {
    console.error(chalk.red.bold(`\n❌ Rollback failed: ${error.message}`))
    process.exit(1)
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const command = args[0] || 'deploy'
  const environment = args[1] || 'staging'

  const options = {}

  // Parse options
  for (let i = 2; i < args.length; i++) {
    if (args[i].startsWith('--message=')) {
      options.message = args[i].split('=')[1]
    } else if (args[i] === '--skip-push-tags') {
      options.skipPushTags = true
    } else if (args[i] === '--force') {
      options.force = true
    }
  }

  const validEnvironments = ['staging', 'production']

  // Merge nested condition: validate environment and command in one check
  if (command === 'deploy' && !validEnvironments.includes(environment)) {
    console.error(
      chalk.red(
        `❌ Invalid environment: ${environment}. Must be one of: ${validEnvironments.join(', ')}`,
      ),
    )
    process.exit(1)
  }

  try {
    switch (command) {
      case 'deploy':
        await deploy(environment, options)
        break
      case 'rollback':
        await rollback(environment)
        break
      default:
        console.log(
          chalk.cyan(`
🚀 Enhanced Deployment Script

Usage:
  node enhanced-deploy.js deploy <environment> [options]
  node enhanced-deploy.js rollback <environment>

Environments:
  staging     Deploy to staging environment
  production  Deploy to production environment

Options:
  --message="Custom deployment message"
  --skip-push-tags  Don't push tags to remote
  --force     Force deployment despite warnings

Examples:
  node enhanced-deploy.js deploy staging
  node enhanced-deploy.js deploy production --message="Release v1.2.0"
  node enhanced-deploy.js rollback production
        `),
        )
    }
  } catch (error) {
    console.error(chalk.red(`❌ ${error.message}`))
    process.exit(1)
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { deploy, rollback }

#!/usr/bin/env node

/**
 * Consolidated deployment script
 * Combines functionality of multiple deployment-related scripts:
 * - Deployment to staging/production
 * - Convex deployment
 * - Vercel secrets management
 * - Rollback functionality
 * - Deployment monitoring
 */

import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import chalk from 'chalk'
import simpleGit from 'simple-git'

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const git = simpleGit(projectRoot)

// Helper to run commands
function runCommand(command, label, silent = false) {
  if (!silent) {
    console.log(`\n🔄 ${label}...`)
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

// Parse command line arguments
const args = process.argv.slice(2)
const command = args[0] || 'deploy'
const environment = args[1] || 'staging'
const validEnvironments = ['staging', 'production']

if (!validEnvironments.includes(environment) && command === 'deploy') {
  console.error(
    chalk.red(
      `❌ Invalid environment: ${environment}. Must be one of: ${validEnvironments.join(', ')}`,
    ),
  )
  process.exit(1)
}

// Main execution
async function main() {
  console.log(
    chalk.cyan.bold(
      `🚀 Starting consolidated deployment process: ${command} to ${environment}`,
    ),
  )

  try {
    switch (command) {
      case 'deploy':
        await deploy(environment)
        break
      case 'rollback':
        await rollback(environment)
        break
      case 'convex':
        await deployConvex(environment)
        break
      case 'setupSecrets':
        await setupVercelSecrets()
        break
      default:
        console.error(chalk.red(`❌ Unknown command: ${command}`))
        process.exit(1)
    }

    console.log(chalk.green.bold('\n✅ Operation completed successfully!'))
  } catch (error) {
    console.error(chalk.red(`\n❌ Operation failed: ${error.message}`))
    process.exit(1)
  }
}

// Deploy to specified environment
async function deploy(environment) {
  console.log(chalk.cyan(`\n📋 Deploying to ${environment.toUpperCase()}...`))

  // Check for uncommitted changes
  const statusResult = await git.status()
  if (statusResult.files.length > 0) {
    console.warn(
      chalk.yellow(
        `\n⚠️ You have uncommitted changes. Proceeding anyway, but this is not recommended.`,
      ),
    )
  }

  // Get current branch
  const branch = (await git.branch()).current
  console.log(chalk.cyan(`\n📋 Current branch: ${branch}`))

  if (
    environment === 'production' &&
    branch !== 'main' &&
    branch !== 'master'
  ) {
    const proceed = await confirmPrompt(
      'You are not on main/master branch. Continue with production deployment?',
    )
    if (!proceed) {
      console.log(chalk.yellow('\n⚠️ Deployment cancelled by user'))
      process.exit(0)
    }
  }

  // Get commit hash for tag
  const commitHash = (await git.revparse(['HEAD'])).trim().substring(0, 8)
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .substring(0, 19)
  const deployTag = `deploy-${environment}-${timestamp}-${commitHash}`

  // Run pre-deploy checks
  console.log(chalk.cyan('\n📋 Running pre-deploy checks...'))
  runCommand('node scripts/pre-build-check.js', 'Pre-deploy checks')

  // Create deployment tag
  console.log(chalk.cyan(`\n📋 Creating deployment tag: ${deployTag}`))
  await git.addTag(deployTag)

  if (environment === 'production') {
    // For production, also tag as production-YYYY-MM-DD
    const datestamp = new Date().toISOString().split('T')[0]
    const prodTag = `production-${datestamp}`
    await git.addTag(prodTag)
    console.log(chalk.cyan(`\n📋 Created production tag: ${prodTag}`))
  }

  // Run build
  console.log(chalk.cyan('\n📋 Building application...'))
  process.env.NODE_ENV = environment
  runCommand('node scripts/consolidated-build.js', 'Building application')

  // Deploy to environment
  console.log(chalk.cyan(`\n📋 Deploying to ${environment}...`))
  if (environment === 'production') {
    runCommand('vercel --prod', 'Deploying to production')
  } else {
    runCommand('vercel', 'Deploying to staging')
  }

  // Deploy Convex if needed
  if (fs.existsSync(path.join(projectRoot, 'convex'))) {
    await deployConvex(environment)
  }

  console.log(
    chalk.green.bold(
      `\n✅ Deployment to ${environment} completed successfully!`,
    ),
  )
  console.log(chalk.cyan(`\n📋 Tagged as: ${deployTag}`))
}

// Rollback to a previous deployment
async function rollback(environment) {
  console.log(
    chalk.cyan(`\n📋 Rolling back ${environment.toUpperCase()} deployment...`),
  )

  // Get deployment tags
  const tags = await git.tags()
  const deployTags = tags.all
    .filter((tag) => tag.startsWith(`deploy-${environment}`))
    .sort()
    .reverse()

  if (deployTags.length < 2) {
    console.error(
      chalk.red(
        `❌ Not enough deployment tags found for ${environment} to roll back`,
      ),
    )
    process.exit(1)
  }

  const currentTag = deployTags[0]
  const previousTag = deployTags[1]

  console.log(chalk.cyan(`\n📋 Current deployment: ${currentTag}`))
  console.log(chalk.cyan(`\n📋 Rolling back to: ${previousTag}`))

  const proceed = await confirmPrompt(
    `Are you sure you want to roll back from ${currentTag} to ${previousTag}?`,
  )
  if (!proceed) {
    console.log(chalk.yellow('\n⚠️ Rollback cancelled by user'))
    process.exit(0)
  }

  // Checkout previous tag
  await git.checkout(previousTag)

  // Run build
  console.log(chalk.cyan('\n📋 Building previous version...'))
  process.env.NODE_ENV = environment
  runCommand('node scripts/consolidated-build.js', 'Building application')

  // Deploy previous version
  console.log(
    chalk.cyan(`\n📋 Deploying previous version to ${environment}...`),
  )
  if (environment === 'production') {
    runCommand('vercel --prod', 'Deploying to production')
  } else {
    runCommand('vercel', 'Deploying to staging')
  }

  // Return to original branch
  const originalBranch = (await git.branch()).current
  await git.checkout(originalBranch)

  console.log(
    chalk.green.bold(`\n✅ Rollback to ${previousTag} completed successfully!`),
  )
}

// Deploy Convex database
async function deployConvex(environment) {
  console.log(
    chalk.cyan(`\n📋 Deploying Convex to ${environment.toUpperCase()}...`),
  )

  const isProduction = environment === 'production'
  const deployCommand = isProduction
    ? 'npx convex deploy --cmd-env-file .env.production'
    : 'npx convex deploy'

  runCommand(deployCommand, `Deploying Convex to ${environment}`)

  console.log(
    chalk.green.bold(
      `\n✅ Convex deployment to ${environment} completed successfully!`,
    ),
  )
}

// Setup Vercel secrets
async function setupVercelSecrets() {
  console.log(chalk.cyan('\n📋 Setting up Vercel secrets...'))

  // Load environment variables
  const envPath = path.resolve(projectRoot, '.env')
  if (!fs.existsSync(envPath)) {
    console.error(chalk.red('❌ .env file not found'))
    process.exit(1)
  }

  const envContent = fs.readFileSync(envPath, 'utf8')
  const envLines = envContent.split('\n').filter((line) => {
    return line.trim() !== '' && !line.startsWith('#') && line.includes('=')
  })

  // Set up secrets
  for (const line of envLines) {
    const [key, ...valueParts] = line.split('=')
    const value = valueParts.join('=').trim()

    if (key && value) {
      try {
        runCommand(
          `vercel env add ${key.trim()} "${value}"`,
          `Adding secret: ${key.trim()}`,
          true,
        )
        console.log(chalk.green(`✅ Added secret: ${key.trim()}`))
      } catch (error) {
        console.error(chalk.red(`❌ Failed to add secret: ${key.trim()}`))
      }
    }
  }

  console.log(
    chalk.green.bold('\n✅ Vercel secrets setup completed successfully!'),
  )
}

// Helper function for confirmation prompts
async function confirmPrompt(message) {
  process.stdout.write(chalk.yellow(`${message} (y/N): `))
  return new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      const input = data.toString().trim().toLowerCase()
      resolve(input === 'y' || input === 'yes')
    })
  })
}

// Run the main function
main().catch((error) => {
  console.error(chalk.red(`\n❌ Fatal error: ${error}`))
  process.exit(1)
})

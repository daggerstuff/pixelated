#!/usr/bin/env node

/**
 * Deployment Rollback Scrip
 *
 * This script performs an automatic rollback when a deployment fails.
 * It restores the previous stable version and notifies the team.
 */

import { spawnSync } from 'node:child_process'
import { parseArgs } from 'node:util'
import fetch from 'node-fetch'

interface RollbackOptions {
  environment: string
  notify: boolean
  version?: string
  fallbackBranch?: string
}

interface DeploymentInfo {
  url: string
  state: string
  meta?: {
    rollback?: boolean
  }
  // Add other deployment fields as needed
  deploymentId?: string
  createdAt?: string
  target?: string
}

async function sendNotification(message: string, environment: string) {
  try {
    console.log(`Sending notification for ${environment} rollback...`)

    // Send to Slack
    await fetch(process.env.SLACK_WEBHOOK || '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚨 *ROLLBACK ALERT* 🚨\n${message}\nEnvironment: ${environment}`,
      }),
    })

    // Send to email
    if (process.env.EMAIL_API_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.EMAIL_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'alerts@pixelatedempathy.com',
          to: 'devops@pixelatedempathy.com',
          subject: `🚨 Rollback Alert: ${environment}`,
          html: `<p><strong>ROLLBACK ALERT</strong></p><p>${message}</p><p>Environment: ${environment}</p>`,
        }),
      })
    }

    console.log('✓ Notifications sent')
  } catch (error) {
    console.error('Failed to send notification:', error)
  }
}

/**
 * Get the last stable version from git tags or deployment history
 */
async function getLastStableVersion(
  environment: string,
  options: RollbackOptions,
): Promise<string> {
  try {
    // First try to find the previous production tag
    console.log('Looking for previous production tag...')
    const tagResult = spawnSync('git', [
      'tag',
      '-l',
      'production-*',
      '--sort=-committerdate',
    ])

    if (tagResult.status === 0 && tagResult.stdout.toString().trim()) {
      const tags = tagResult.stdout.toString().trim().split('\n')
      console.log(`Found ${tags.length} production tags`)

      // If we have at least two tags, get the second most recent one (skip current)
      if (tags.length >= 2) {
        const rollbackTag = tags[1]
        console.log(`Using tag ${rollbackTag} for rollback`)
        return rollbackTag
      } else if (tags.length === 1) {
        console.log(`Only one production tag found: ${tags[0]}`)
        // Use it if explicitly allowed through options
        if (options.fallbackBranch === 'use-current-tag') {
          console.log('Using the only available tag for rollback')
          return tags[0]
        }
      }
    } else {
      console.log('No production tags found')
    }

    // If no suitable tag found, try Vercel deployment history
    console.log('Trying Vercel deployment history...')
    const result = spawnSync('pnpm', [
      'vercel',
      'list',
      '--environment',
      environment,
      '--limit',
      '10',
      '--json',
    ])

    if (result.status !== 0) {
      throw new Error(
        `Failed to get deployment history: ${result.stderr.toString()}`,
      )
    }

    const deployments = JSON.parse(result.stdout.toString()) as DeploymentInfo[]

    // Find last successful deployment (not the current failing one)
    const lastStable = deployments.find(
      (d) => d.state === 'READY' && !d.meta?.rollback,
    )

    if (!lastStable) {
      // If no stable version found and a fallback branch is specified, use i
      if (
        options.fallbackBranch &&
        options.fallbackBranch !== 'use-current-tag'
      ) {
        console.log(
          `No stable version found in deployments, using fallback branch: ${options.fallbackBranch}`,
        )
        return options.fallbackBranch
      }
      throw new Error('No stable version found in recent deployments')
    }

    console.log(`Found stable deployment: ${lastStable.url}`)
    return lastStable.url
  } catch (error) {
    console.error('Error finding last stable version:', error)

    // If fallback branch is specified, use i
    if (
      options.fallbackBranch &&
      options.fallbackBranch !== 'use-current-tag'
    ) {
      console.log(`Using fallback branch: ${options.fallbackBranch}`)
      return options.fallbackBranch
    }

    // Last resort: use main branch
    console.log('Using main branch as last resort fallback')
    return 'main'
  }
}

async function performRollback(options: RollbackOptions) {
  try {
    console.log(`=== Initiating Rollback for ${options.environment} ===`)

    // Get version to roll back to
    const version =
      options.version ||
      (await getLastStableVersion(options.environment, options))
    console.log(`Target rollback version: ${version}`)

    // Determine rollback method based on version forma
    if (
      version.startsWith('production-') ||
      version === 'main' ||
      (options.fallbackBranch && version === options.fallbackBranch)
    ) {
      // Git tag or branch rollback
      console.log(`Performing git-based rollback to ${version}...`)

      // Checkout the specified tag or branch
      const checkoutResult = spawnSync('git', ['checkout', version])
      if (checkoutResult.status !== 0) {
        throw new Error(
          `Failed to checkout ${version}: ${checkoutResult.stderr.toString()}`,
        )
      }

      // Deploy from the checked out version
      console.log('Deploying from the previous version...')
      const deployResult = spawnSync('pnpm', [
        'vercel',
        'deploy',
        '--prod',
        '--yes',
      ])

      if (deployResult.status !== 0) {
        throw new Error(`Deployment failed: ${deployResult.stderr.toString()}`)
      }
    } else {
      // Vercel URL-based rollback
      console.log('Performing Vercel-based rollback...')
      const rollback = spawnSync('pnpm', [
        'vercel',
        'rollback',
        '--environment',
        options.environment,
        '--yes',
      ])

      if (rollback.status !== 0) {
        throw new Error(`Rollback failed: ${rollback.stderr.toString()}`)
      }
    }

    console.log('✓ Rollback completed successfully')

    // Run verification to ensure rollback is healthy
    console.log('\nVerifying rollback health...')
    const verify = spawnSync('pnpm', [
      'tsx',
      'src/scripts/verify-deployment.ts',
    ])

    if (verify.status !== 0) {
      console.warn('Rollback verification warning: Verification checks failed')
      console.warn(verify.stderr.toString())

      if (options.notify) {
        await sendNotification(
          'Rollback completed but verification checks failed. Manual intervention may be required.',
          options.environment,
        )
      }
    } else {
      console.log('✓ Rollback verification successful')

      if (options.notify) {
        await sendNotification(
          `Deployment rollback completed successfully to version ${version}.`,
          options.environment,
        )
      }
    }

    return true
  } catch (error) {
    console.error('\n❌ Rollback failed:', error)

    if (options.notify) {
      await sendNotification(
        `CRITICAL: Automatic rollback failed. Manual intervention required. Error: ${error}`,
        options.environment,
      )
    }

    return false
  }
}

async function main() {
  try {
    // Parse command line arguments
    const { values } = parseArgs({
      options: {
        environment: { type: 'string', short: 'e', default: 'production' },
        notify: { type: 'boolean', short: 'n', default: false },
        version: { type: 'string', short: 'v' },
        fallbackBranch: { type: 'string', short: 'f', default: 'main' },
      },
    })

    const options: RollbackOptions = {
      environment: values.environment as string,
      notify: values.notify as boolean,
      version: values.version as string | undefined,
      fallbackBranch: values.fallbackBranch as string | undefined,
    }

    const success = await performRollback(options)
    process.exit(success ? 0 : 1)
  } catch (error) {
    console.error('Unhandled error:', error)
    process.exit(1)
  }
}

// Execute main function
main().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})

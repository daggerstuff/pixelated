#!/usr/bin/env tsx

/**
 * Environment setup script
 * Configures the environment for optimal compatibility
 */

import fs from 'fs/promises'
import path from 'path'
import { execSync } from 'child_process'
import chalk from 'chalk'

// Utilities
const log = {
  info: (msg: string) => console.log(chalk.blue(`ℹ️ ${msg}`)),
  success: (msg: string) => console.log(chalk.green(`✅ ${msg}`)),
  warning: (msg: string) => console.log(chalk.yellow(`⚠️ ${msg}`)),
  error: (msg: string) => console.log(chalk.red(`❌ ${msg}`)),
  step: (msg: string) => console.log(chalk.cyan(`➡️ ${msg}`)),
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

async function setupEnvironment() {
  log.info('Setting up build environment...')

  // Check Node.js version
  const nodeMajorVersion = parseInt(process.versions.node.split('.')[0], 10)
  const requiredNodeVersion = 22

  log.step(`Checking Node.js version (required: ${requiredNodeVersion}.x)`)
  if (nodeMajorVersion !== requiredNodeVersion) {
    log.warning(
      `Node.js version mismatch! Using ${nodeMajorVersion} instead of ${requiredNodeVersion}`,
    )
    log.step('Creating .nvmrc file')

    // Create .nvmrc file if it doesn't exist
    if (!(await fileExists('.nvmrc'))) {
      await fs.writeFile('.nvmrc', `${requiredNodeVersion}`)
      log.success('Created .nvmrc file')
    }

    // Try to switch Node.js version if nvm is available
    try {
      log.step(
        `Attempting to switch to Node.js ${requiredNodeVersion} using nvm...`,
      )
      execSync(`nvm use ${requiredNodeVersion}`, { stdio: 'inherit' })
    } catch (error) {
      if (error instanceof Error) {
        log.error(`Failed to switch Node.js version: ${error.message}`)
      }
      log.warning(`Couldn't switch Node.js version automatically.`)
      log.info(`Please run 'nvm use ${requiredNodeVersion}' manually.`)
    }
  } else {
    log.success(`Node.js version is correct (${process.versions.node})`)
  }

  // Check and fix package.json
  log.step('Checking package.json configuration')
  const packageJsonPath = path.join(process.cwd(), 'package.json')

  if (await fileExists(packageJsonPath)) {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'))

    // Ensure engines field is correct
    if (
      !packageJson.engines ||
      packageJson.engines.node !== `${requiredNodeVersion}.x`
    ) {
      log.step('Updating engines field in package.json')
      packageJson.engines = {
        ...packageJson.engines,
        node: `${requiredNodeVersion}.x`,
      }
      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2))
      log.success('Updated engines field in package.json')
    } else {
      log.success('Engines field in package.json is correctly configured')
    }

    // Check flexsearch version
    if (packageJson.dependencies?.flexsearch) {
      const flexsearchVersion = packageJson.dependencies.flexsearch

      if (flexsearchVersion !== '^0.7.31') {
        log.warning(
          `flexsearch version (${flexsearchVersion}) may cause compatibility issues`,
        )
        log.info('Recommended version is ^0.7.31')
      } else {
        log.success('flexsearch is at the correct version (^0.7.31)')
      }
    }
  }

  // Check Astro config
  log.step('Checking Astro configuration')
  const astroConfigPath = path.join(process.cwd(), 'astro.config.mjs')

  if (await fileExists(astroConfigPath)) {
    let astroConfig = await fs.readFile(astroConfigPath, 'utf8')
    let updated = false

    // Check Node.js runtime
    if (
      !astroConfig.includes(`runtime: 'nodejs22.x'`) &&
      astroConfig.includes('@astrojs/vercel')
    ) {
      log.step('Updating Node.js runtime in Astro config')
      // Simple string replacement for demonstration - a more robust solution would use AST parsing
      astroConfig = astroConfig.replace(
        /runtime: ['"]nodejs\d+\.x['"]/g,
        `runtime: 'nodejs22.x'`,
      )
      updated = true
    }

    if (updated) {
      await fs.writeFile(astroConfigPath, astroConfig)
      log.success('Updated Astro configuration')
    } else {
      log.success('Astro configuration is correctly set up')
    }
  }

  log.success('Environment setup completed!')
  log.info('You can now run your build command.')
}

setupEnvironment().catch((error) => {
  log.error(`Failed to set up environment: ${error.message}`)
  process.exit(1)
})

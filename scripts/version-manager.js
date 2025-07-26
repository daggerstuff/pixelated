#!/usr/bin/env node

/**
 * Version Manager - Semantic versioning and release management
 * Integrates with tag-manager.js for release tagging
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import { execSync } from 'child_process'
import { createProductionTag, pushTags } from './tag-manager.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const packagePath = path.join(projectRoot, 'package.json')

// Helper functions
function readPackageJson() {
  if (!fs.existsSync(packagePath)) {
    throw new Error('package.json not found')
  }
  return JSON.parse(fs.readFileSync(packagePath, 'utf8'))
}

function writePackageJson(packageData) {
  fs.writeFileSync(packagePath, JSON.stringify(packageData, null, 2) + '\n')
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/)
  if (!match) {
    throw new Error(`Invalid version format: ${version}`)
  }

  return {
    major: parseInt(match[1]),
    minor: parseInt(match[2]),
    patch: parseInt(match[3]),
    prerelease: match[4] || null,
    original: version,
  }
}

function formatVersion(versionObj) {
  const version = `${versionObj.major}.${versionObj.minor}.${versionObj.patch}`
  return versionObj.prerelease ? `${version}-${versionObj.prerelease}` : version
}

function incrementVersion(currentVersion, type, prerelease = null) {
  const version = parseVersion(currentVersion)

  switch (type) {
    case 'major':
      version.major++
      version.minor = 0
      version.patch = 0
      version.prerelease = null
      break
    case 'minor':
      version.minor++
      version.patch = 0
      version.prerelease = null
      break
    case 'patch':
      version.patch++
      version.prerelease = null
      break
    case 'prerelease':
      if (version.prerelease) {
        // Increment existing prerelease
        const match = version.prerelease.match(/^(.+)\.(\d+)$/)
        version.prerelease = match
          ? `${match[1]}.${parseInt(match[2]) + 1}`
          : `${version.prerelease}.1`
      } else {
        // Create new prerelease
        version.patch++
        version.prerelease = prerelease || 'rc.0'
      }
      break
    default:
      throw new Error(`Invalid version type: ${type}`)
  }

  return formatVersion(version)
}

// Git operations
function runGitCommand(command) {
  return execSync(command, {
    cwd: projectRoot,
    encoding: 'utf8',
  }).trim()
}

function createGitTag(version, message) {
  const tag = `v${version}`
  try {
    runGitCommand(`git tag -a ${tag} -m "${message}"`)
    console.log(chalk.green(`✅ Created git tag: ${tag}`))
    return tag
  } catch (error) {
    console.log(chalk.yellow(`⚠️ Git tag ${tag} already exists`))
    return tag
  }
}

function pushGitTag(tag) {
  try {
    runGitCommand(`git push origin ${tag}`)
    console.log(chalk.green(`✅ Pushed git tag: ${tag}`))
  } catch (error) {
    console.error(chalk.red(`❌ Failed to push tag ${tag}: ${error.message}`))
    throw error
  }
}

// Changelog generation
function generateChangelog(fromVersion, toVersion) {
  try {
    const fromTag = fromVersion ? `v${fromVersion}` : ''
    const range = fromTag ? `${fromTag}..HEAD` : 'HEAD'

    const commits = runGitCommand(
      `git log ${range} --pretty=format:"%h %s" --no-merges`,
    )

    if (!commits) {
      return 'No changes recorded.'
    }

    const lines = commits.split('\n')
    const categorized = {
      features: [],
      fixes: [],
      other: [],
    }

    lines.forEach((line) => {
      const commit = line.trim()
      commit.includes('feat:') || commit.includes('feature:')
        ? categorized.features.push(commit)
        : commit.includes('fix:') || commit.includes('bug:')
          ? categorized.fixes.push(commit)
          : categorized.other.push(commit)
    })

    let changelog = `## Version ${toVersion}\n\n`

    changelog +=
      categorized.features.length > 0
        ? '### 🚀 Features\n' +
          categorized.features.map((commit) => `- ${commit}`).join('\n') +
          '\n\n'
        : ''

    changelog +=
      categorized.fixes.length > 0
        ? '### 🐛 Bug Fixes\n' +
          categorized.fixes.map((commit) => `- ${commit}`).join('\n') +
          '\n\n'
        : ''

    changelog +=
      categorized.other.length > 0
        ? '### 📝 Other Changes\n' +
          categorized.other.map((commit) => `- ${commit}`).join('\n') +
          '\n\n'
        : ''

    return changelog
  } catch (error) {
    console.warn(chalk.yellow('⚠️ Could not generate changelog'))
    return 'Changelog generation failed.'
  }
}

function updateChangelogFile(changelog) {
  const changelogPath = path.join(projectRoot, 'CHANGELOG.md')

  const existingChangelog = fs.existsSync(changelogPath)
    ? fs.readFileSync(changelogPath, 'utf8')
    : '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n'

  // Insert new changelog at the top
  const lines = existingChangelog.split('\n')
  const headerEndIndex =
    lines.findIndex((line) => line.startsWith('## ')) || lines.length

  const newChangelog = [
    ...lines.slice(0, headerEndIndex),
    changelog,
    ...lines.slice(headerEndIndex),
  ].join('\n')

  fs.writeFileSync(changelogPath, newChangelog)
  console.log(chalk.green('✅ Updated CHANGELOG.md'))
}

// Main version management functions
async function bumpVersion(type, options = {}) {
  console.log(chalk.cyan(`\n📋 Bumping version (${type})...`))

  const packageData = readPackageJson()
  const currentVersion = packageData.version
  const newVersion = incrementVersion(currentVersion, type, options.prerelease)

  console.log(chalk.cyan(`Current version: ${currentVersion}`))
  console.log(chalk.cyan(`New version: ${newVersion}`))

  // Update package.json
  packageData.version = newVersion
  writePackageJson(packageData)
  console.log(chalk.green('✅ Updated package.json'))

  // Generate changelog
  if (!options.skipChangelog) {
    const changelog = generateChangelog(currentVersion, newVersion)
    updateChangelogFile(changelog)
  }

  // Create git tag
  const tagMessage = options.message || `Release version ${newVersion}`
  const gitTag = createGitTag(newVersion, tagMessage)

  // Create deployment tags if this is a production release
  if (type !== 'prerelease' && !options.skipDeploymentTags) {
    console.log(chalk.cyan('\n📋 Creating deployment tags...'))
    await createProductionTag({
      message: `Production release ${newVersion}`,
    })
  }

  return {
    previousVersion: currentVersion,
    newVersion,
    gitTag,
  }
}

async function release(type, options = {}) {
  console.log(chalk.cyan.bold(`🚀 Creating ${type} release...`))

  // Check for uncommitted changes
  try {
    const status = runGitCommand('git status --porcelain')
    if (status && !options.force) {
      throw new Error('Uncommitted changes detected. Use --force to override.')
    }
  } catch (error) {
    if (!options.force) {
      throw new Error('Git repository check failed. Use --force to override.')
    }
  }

  const result = await bumpVersion(type, options)

  // Commit changes
  if (!options.skipCommit) {
    try {
      runGitCommand('git add package.json CHANGELOG.md')
      runGitCommand(`git commit -m "Release version ${result.newVersion}"`)
      console.log(chalk.green('✅ Committed version changes'))
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Could not commit changes automatically'))
    }
  }

  // Push tags
  if (!options.skipPush) {
    console.log(chalk.cyan('\n📋 Pushing tags...'))
    await pushTags()

    if (result.gitTag) {
      pushGitTag(result.gitTag)
    }
  }

  console.log(
    chalk.green.bold(
      `\n✅ ${type} release ${result.newVersion} created successfully!`,
    ),
  )

  // Display summary
  console.log(chalk.cyan('\n📋 Release Summary:'))
  console.log(`  Previous Version: ${result.previousVersion}`)
  console.log(`  New Version: ${result.newVersion}`)
  console.log(`  Git Tag: ${result.gitTag}`)

  return result
}

// CLI interface
async function main() {
  const args = process.argv.slice(2)
  const command = args[0]
  const type = args[1]

  const options = {}

  // Parse options
  for (let i = 2; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--message=')) {
      options.message = arg.split('=')[1]
    } else if (arg.startsWith('--prerelease=')) {
      options.prerelease = arg.split('=')[1]
    } else {
      options.force = arg === '--force' ? true : options.force
      options.skipChangelog =
        arg === '--skip-changelog' ? true : options.skipChangelog
      options.skipCommit = arg === '--skip-commit' ? true : options.skipCommit
      options.skipPush = arg === '--skip-push' ? true : options.skipPush
      options.skipDeploymentTags =
        arg === '--skip-deployment-tags' ? true : options.skipDeploymentTags
    }
  }

  try {
    switch (command) {
      case 'bump':
        if (!['major', 'minor', 'patch', 'prerelease'].includes(type)) {
          throw new Error(
            'Invalid version type. Use: major, minor, patch, prerelease',
          )
        }
        await bumpVersion(type, options)
        break

      case 'release':
        if (!['major', 'minor', 'patch', 'prerelease'].includes(type)) {
          throw new Error(
            'Invalid release type. Use: major, minor, patch, prerelease',
          )
        }
        await release(type, options)
        break

      case 'current':
        const packageData = readPackageJson()
        console.log(packageData.version)
        break

      case 'info':
        const pkg = readPackageJson()
        const version = parseVersion(pkg.version)
        console.log(chalk.cyan('\n📋 Version Information:'))
        console.log(`  Current Version: ${pkg.version}`)
        console.log(`  Major: ${version.major}`)
        console.log(`  Minor: ${version.minor}`)
        console.log(`  Patch: ${version.patch}`)
        console.log(`  Prerelease: ${version.prerelease || 'none'}`)
        break

      default:
        console.log(
          chalk.cyan(`
📋 Version Manager Usage:

  Version Management:
    node version-manager.js bump <type> [options]
    node version-manager.js release <type> [options]
    node version-manager.js current
    node version-manager.js info

  Version Types:
    major       1.0.0 -> 2.0.0
    minor       1.0.0 -> 1.1.0
    patch       1.0.0 -> 1.0.1
    prerelease  1.0.0 -> 1.0.1-rc.0

  Options:
    --message="Custom release message"
    --prerelease="rc"  (for prerelease type)
    --force            Force despite warnings
    --skip-changelog   Don't update CHANGELOG.md
    --skip-commit      Don't commit changes
    --skip-push        Don't push tags
    --skip-deployment-tags  Don't create deployment tags

  Examples:
    node version-manager.js release minor --message="New features"
    node version-manager.js bump patch
    node version-manager.js release prerelease --prerelease="beta"
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
  bumpVersion,
  release,
  parseVersion,
  incrementVersion,
  generateChangelog,
}

// Run CLI if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

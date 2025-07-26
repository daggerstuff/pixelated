#!/usr/bin/env node

/**
 * Simple Blog Management Script
 * No frills, just works
 */

const { execSync } = require('child_process')

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}

function log(message) {
  console.log(message)
}

function success(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`)
}

function error(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`)
}

function runBlogCommand(command) {
  try {
    const result = execSync(`pnpm run blog-publisher -- ${command}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { success: true, output: result }
  } catch (err) {
    return {
      success: false,
      error: err.message,
      output: err.stdout || '',
    }
  }
}

// Get command line arguments
const args = process.argv.slice(2)
const command = args.join(' ')

// Show help if no command
if (!command || command === 'help') {
  log('')
  log(`${colors.cyan}Blog Management Commands:${colors.reset}`)
  log('')
  log(
    `  ${colors.yellow}status${colors.reset}              Show overall blog post status`,
  )
  log(
    `  ${colors.yellow}series${colors.reset}              List all blog series and their posts`,
  )
  log(
    `  ${colors.yellow}upcoming${colors.reset}            Show upcoming scheduled publications`,
  )
  log(`  ${colors.yellow}overdue${colors.reset}             Show overdue posts`)
  log(
    `  ${colors.yellow}generate <series> <title>${colors.reset}   Create a new blog post`,
  )
  log(
    `  ${colors.yellow}publish <file-path>${colors.reset}   Publish a draft post`,
  )
  log(
    `  ${colors.yellow}report${colors.reset}              Generate a comprehensive report`,
  )
  log('')
  log(`  Example: ${colors.blue}pnpm run blog status${colors.reset}`)
  log(
    `  Example: ${colors.blue}pnpm run blog generate "My Series" "My New Post"${colors.reset}`,
  )
  log('')
  process.exit(0)
}

// Run the command
const result = runBlogCommand(command)

if (result.success) {
  log(result.output)
  success('Command completed successfully')
} else {
  error(`Command failed: ${result.error}`)
  if (result.output) {
    log(result.output)
  }
  process.exit(1)
}

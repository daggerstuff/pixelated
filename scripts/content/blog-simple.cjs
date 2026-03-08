#!/usr/bin/env node

/**
 * Simple Blog Management Script
 * No frills, just works
 */

const { spawnSync } = require('child_process')

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

// at top of file, ensure string-argv is installed (npm install string-argv)
const toArgv = require('string-argv')

function parseArgs(command) {
  return toArgv(command ?? '')
}

function isSafeToken(token) {
  if (typeof token !== 'string' || token.length === 0) {
    return false
  }
  // Disallow only control/newline/null; shell is disabled.
  for (let i = 0; i < token.length; i += 1) {
    const code = token.charCodeAt(i)
    if (code === 0 || code === 10 || code === 13) {
      return false
    }
  }
  return true
}

function runBlogCommand(command) {
  try {
    const tokens = Array.isArray(command) ? command : parseArgs(command || '')
    if (tokens.length === 0) {
      return { success: false, error: 'Empty command' }
    }

    const top = tokens[0]
    if (!ALLOWED_TOP_LEVEL.has(top)) {
      return { success: false, error: `Disallowed command: ${top}` }
    }

    for (const t of tokens) {
      if (!isSafeToken(t)) {
        return { success: false, error: 'Invalid characters in arguments' }
      }
    }

    const args = ['run', 'blog-publisher', '--', ...tokens]
    const proc = spawnSync('pnpm', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: false })
    if (proc.error) {
      return { success: false, error: proc.error.message }
    }

    if (proc.status === 0) {
      return { success: true, output: proc.stdout }
    }

    return { success: false, error: proc.stderr || 'Unknown error', output: proc.stdout || '' }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// Get command line arguments
const args = process.argv.slice(2)

// Show help if no command
if (args.length === 0 || args[0] === 'help') {
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
const result = runBlogCommand(args)

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

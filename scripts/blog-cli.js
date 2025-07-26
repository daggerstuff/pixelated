#!/usr/bin/env node

/**
 * 🌟 Pixelated Blog Helper CLI 🌟
 * A lightweight command-line interface for the blog publishing system
 */

// Import dependencies
import { createInterface } from 'readline'
import { execSync } from 'child_process'

// ANSI colors for pretty output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  purple: '\x1b[35m',
  cyan: '\x1b[36m',
}

// Create readline interface
const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
})

// Helper functions
function clear() {
  console.clear()
}

function showHeader() {
  clear()
  console.log(
    `${colors.blue}===============================================${colors.reset}`,
  )
  console.log(
    `${colors.cyan}${colors.bright}          📝  BLOG HELPER CLI  📝          ${colors.reset}`,
  )
  console.log(
    `${colors.blue}===============================================${colors.reset}`,
  )
  console.log('')
}

function success(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`)
}

function info(message) {
  console.log(`${colors.blue}ℹ ${message}${colors.reset}`)
}

function warning(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`)
}

function error(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`)
}

// Run blog publisher command safely
function runCommand(command) {
  try {
    const output = execSync(`pnpm run blog-publisher -- ${command}`, {
      encoding: 'utf8',
      stdio: 'pipe',
    })
    return { success: true, output: output.trim() }
  } catch (err) {
    return {
      success: false,
      error: err.message,
      output: err.stdout?.trim() || '',
    }
  }
}

// Show available commands
function showCommands() {
  console.log(`${colors.cyan}Available commands:${colors.reset}`)
  console.log(
    `  ${colors.yellow}status${colors.reset}    - Show overall blog post status`,
  )
  console.log(
    `  ${colors.yellow}series${colors.reset}    - List all blog series and their posts`,
  )
  console.log(
    `  ${colors.yellow}upcoming${colors.reset}  - Show upcoming scheduled publications`,
  )
  console.log(`  ${colors.yellow}overdue${colors.reset}   - Show overdue posts`)
  console.log(
    `  ${colors.yellow}generate${colors.reset}  - Create a new blog post`,
  )
  console.log(
    `  ${colors.yellow}publish${colors.reset}   - Publish a draft post`,
  )
  console.log(
    `  ${colors.yellow}report${colors.reset}    - Generate a comprehensive report`,
  )
  console.log(
    `  ${colors.yellow}help${colors.reset}      - Show this help message`,
  )
  console.log(`  ${colors.yellow}exit${colors.reset}      - Exit the CLI`)
  console.log('')
}

// Main menu
function mainPrompt() {
  rl.question(
    `${colors.bright}${colors.purple}blog>${colors.reset} `,
    (input) => {
      const args = input.trim().split(' ')
      const command = args[0].toLowerCase()
      const restArgs = args.slice(1).join(' ')

      switch (command) {
        case 'help':
          showCommands()
          mainPrompt()
          break

        case 'exit':
        case 'quit':
          console.log(`${colors.blue}Goodbye! 👋${colors.reset}`)
          rl.close()
          break

        case 'clear':
          showHeader()
          mainPrompt()
          break

        case 'status':
        case 'series':
        case 'upcoming':
        case 'overdue':
        case 'report':
          const result = runCommand(command)
          if (result.success) {
            console.log(result.output)
          } else {
            error(`Command failed: ${result.error}`)
            if (result.output) {
              console.log(result.output)
            }
          }
          mainPrompt()
          break

        case 'generate':
          if (!restArgs) {
            // Interactive generate
            rl.question(
              `${colors.yellow}Enter post title:${colors.reset} `,
              (title) => {
                if (!title.trim()) {
                  error('Post title is required')
                  mainPrompt()
                  return
                }

                rl.question(
                  `${colors.yellow}Series name (or leave blank for none):${colors.reset} `,
                  (series) => {
                    const seriesArg = series.trim()
                      ? `"${series.trim()}"`
                      : '""'
                    const result = runCommand(
                      `generate ${seriesArg} "${title.trim()}"`,
                    )

                    if (result.success) {
                      console.log(result.output)
                      success('Post created successfully')
                    } else {
                      error(`Failed to create post: ${result.error}`)
                      if (result.output) {
                        console.log(result.output)
                      }
                    }

                    mainPrompt()
                  },
                )
              },
            )
          } else {
            // Direct generate with args
            const result = runCommand(`generate ${restArgs}`)
            if (result.success) {
              console.log(result.output)
              success('Post created successfully')
            } else {
              error(`Failed to create post: ${result.error}`)
              if (result.output) {
                console.log(result.output)
              }
            }
            mainPrompt()
          }
          break

        case 'publish':
          if (!restArgs) {
            error('Please specify a file path to publish')
            info('Usage: publish <file-path>')
          } else {
            const result = runCommand(`publish ${restArgs}`)
            if (result.success) {
              console.log(result.output)
              success('Post published successfully')
            } else {
              error(`Failed to publish post: ${result.error}`)
              if (result.output) {
                console.log(result.output)
              }
            }
          }
          mainPrompt()
          break

        case '':
          mainPrompt()
          break

        default:
          error(`Unknown command: ${command}`)
          info('Type "help" to see available commands')
          mainPrompt()
          break
      }
    },
  )
}

// Start the CLI
async function start() {
  showHeader()
  console.log(`${colors.cyan}Welcome to the Blog CLI!${colors.reset}`)
  console.log(
    `${colors.dim}Type 'help' to see available commands or 'exit' to quit${colors.reset}`,
  )
  console.log('')

  // Check if the blog publisher is available
  const testResult = runCommand('status')
  if (!testResult.success) {
    error('Failed to access the blog publisher')
    warning('The publishing system may not be properly installed')
    info('You can still try using commands, but they may not work correctly')
    console.log('')
  }

  mainPrompt()
}

// Handle clean exit
rl.on('close', () => {
  process.exit(0)
})

// Start the CLI
start()

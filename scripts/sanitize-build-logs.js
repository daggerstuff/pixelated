#!/usr/bin/env node

/**
 * Script to sanitize build logs
 * Removes sensitive information like API keys and credentials from build logs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

// Patterns to find sensitive information (regex patterns)
const SENSITIVE_PATTERNS = [
  // API keys and tokens
  /(API_KEY|TOKEN|SECRET|PASSWORD|KEY)=\s*["']?([^"'\s]+)["']?/gi,
  /(SUPABASE_DB_PASSWORD|POSTGRES_PASSWORD)=\s*["']?([^"'\s]+)["']?/gi,
  /(FLY_API_TOKEN|PUBLIC_SUPABASE_ANON_KEY)=\s*["']?([^"'\s]+)["']?/gi,
  /(DROPBOX_TOKEN|VITE_LITLYX_API_KEY|TOGETHER_API_KEY)=\s*["']?([^"'\s]+)["']?/gi,
  /(NEBIUS_API_KEY|SUPABASE_SERVICE_ROLE_KEY)=\s*["']?([^"'\s]+)["']?/gi,
  /(UPSTASH_REDIS_REST_TOKEN|RESEND_API_KEY)=\s*["']?([^"'\s]+)["']?/gi,
  /(SENTRY_AUTH_TOKEN)=\s*["']?([^"'\s]+)["']?/gi,

  // URLs with credentials
  /(https?:\/\/)([^:@\s]+):([^:@\s]+)@([^\s]+)/gi,

  // Database connection strings
  /(postgres:\/\/[^:]+):([^@]+)@([^\s]+)/gi,
  /(redis:\/\/[^:]+):([^@]+)@([^\s]+)/gi,

  // JWT tokens
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,

  // Base64 patterns that might be keys
  /[A-Za-z0-9+/]{40,}={0,2}/g,
]

// Files to sanitize
const FILES_TO_SANITIZE = ['build-errors.md', 'logs/build-output.log']

// Helper function to safely read a file
function safeReadFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8')
    }
    console.log(`File does not exist: ${filePath}`)
    return null
  } catch (error) {
    console.error(`Error reading file ${filePath}: ${error.message}`)
    return null
  }
}

// Helper function to safely write a file
function safeWriteFile(filePath, content) {
  try {
    // Ensure the directory exists
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, content)
    return true
  } catch (error) {
    console.error(`Error writing file ${filePath}: ${error.message}`)
    return false
  }
}

// Main function
async function sanitizeLogs() {
  console.log('🔒 Starting log sanitization process...')
  let totalSuccess = 0
  let totalFailures = 0

  for (const relativeFilePath of FILES_TO_SANITIZE) {
    const filePath = path.join(projectRoot, relativeFilePath)

    if (!fs.existsSync(filePath)) {
      console.log(`⚠️ File not found: ${relativeFilePath}`)
      continue
    }

    try {
      console.log(`🔍 Processing: ${relativeFilePath}`)

      // Read file content
      const content = safeReadFile(filePath)

      if (content === null) {
        console.error(`❌ Could not read file: ${relativeFilePath}`)
        totalFailures++
        continue
      }

      let sanitizedContent = content
      let originalSize = content.length
      let replacements = 0

      // Apply each pattern
      for (const pattern of SENSITIVE_PATTERNS) {
        try {
          // For patterns with capture groups, replace only the sensitive part
          if (pattern.toString().includes('(')) {
            sanitizedContent = sanitizedContent.replace(
              pattern,
              (match, ...groups) => {
                // The first capturing group is typically the key name
                // For most patterns, the second group is the sensitive value
                // Get all non-index match groups (excludes the full match and positions)
                const matchGroups = groups.slice(0, groups.length - 2)

                // Replace sensitive parts with [hidden]
                if (matchGroups.length > 1) {
                  // Replace the second and subsequent groups with [hidden]
                  let result = matchGroups[0] // Keep the first group (usually key name)

                  for (let i = 1; i < matchGroups.length; i++) {
                    if (matchGroups[i]) {
                      result += '=[hidden]'
                      replacements++
                    }
                  }

                  return result
                }

                // Fallback if pattern doesn't match expectation
                replacements++
                return '[hidden-credential]'
              },
            )
          } else {
            // For simple patterns without capture groups, replace the entire match
            sanitizedContent = sanitizedContent.replace(pattern, (match) => {
              replacements++
              return '[hidden-data]'
            })
          }
        } catch (regexError) {
          console.error(
            `⚠️ Error applying regex pattern: ${regexError.message}`,
          )
          // Continue with next pattern
          continue
        }
      }

      // Write sanitized content back if changes were made
      if (replacements > 0) {
        const writeSuccess = safeWriteFile(filePath, sanitizedContent)

        if (writeSuccess) {
          console.log(
            `✅ Sanitized ${relativeFilePath}: ${replacements} replacements made`,
          )
          console.log(
            `   Original size: ${originalSize}, New size: ${sanitizedContent.length}`,
          )
          totalSuccess++
        } else {
          console.error(
            `❌ Failed to write sanitized content to ${relativeFilePath}`,
          )
          totalFailures++
        }
      } else {
        console.log(`ℹ️ No sensitive data found in ${relativeFilePath}`)
        totalSuccess++
      }
    } catch (error) {
      console.error(`❌ Error sanitizing ${relativeFilePath}: ${error.message}`)
      totalFailures++
    }
  }

  console.log(
    `✅ Log sanitization complete! Success: ${totalSuccess}, Failures: ${totalFailures}`,
  )

  // Exit with code 0 even if there were failures, to prevent build failures
  process.exit(0)
}

// Run the main function
sanitizeLogs().catch((error) => {
  console.error('❌ Sanitization failed:', error)
  // Exit with code 0 to prevent build failures
  process.exit(0)
})

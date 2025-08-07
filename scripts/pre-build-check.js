#!/usr/bin/env node

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { dirname } from 'path'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')

const requiredEnvVars = [
  'PUBLIC_SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'PUBLIC_SUPABASE_ANON_KEY',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_SERVICE_ROLE_KEY',
]

// Group variables by their base name
const varGroups = {
  SUPABASE_URL: ['SUPABASE_URL', 'PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL'],
  SUPABASE_ANON_KEY: [
    'SUPABASE_ANON_KEY',
    'PUBLIC_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_ANON_KEY',
  ],
  SUPABASE_SERVICE_ROLE_KEY: [
    'SUPABASE_SERVICE_ROLE_KEY',
    'PUBLIC_SUPABASE_SERVICE_ROLE_KEY',
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
  ],
  SENTRY_AUTH_TOKEN: ['SENTRY_AUTH_TOKEN'],
}

// Load environment variables from multiple possible locations
const envFiles = ['.env', '.env.local', '.env.production']
const loadedValues = {}

// Load all environment files
envFiles.forEach((file) => {
  const envPath = path.resolve(projectRoot, file)
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath })
    if (result.parsed) {
      console.log(`✅ Loaded env from ${file}`)

      // Store values for variables found in this file
      Object.entries(result.parsed).forEach(([key, value]) => {
        if (requiredEnvVars.includes(key)) {
          loadedValues[key] = value
        }
      })
    }
  } else {
    console.log(`⚠️ File not found: ${file}`)
  }
})

// Check for missing variables and set up defaults if in development
const missingVars = []
const isProd = process.env.NODE_ENV === 'production'
const isDev = !isProd

// Create or update .env file if needed
const envPath = path.resolve(projectRoot, '.env')
let envContent = ''
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8')
}

// Helper to propagate values across variants of the same variable
function propagateValues(baseVar, variants) {
  const existingValue = variants.find((v) => loadedValues[v] || process.env[v])
  if (existingValue) {
    const value = loadedValues[existingValue] || process.env[existingValue]
    variants.forEach((v) => {
      if (!loadedValues[v] && !process.env[v]) {
        process.env[v] = value
        if (isDev) {
          console.log(`✅ Propagated ${existingValue} value to ${v}`)
        }
      }
    })
    return true
  }
  return false
}

// Check each group of related variables
Object.entries(varGroups).forEach(([baseVar, variants]) => {
  // Try to propagate values between variants
  const hasValue = propagateValues(baseVar, variants)

  if (!hasValue) {
    // None of the variants have a value
    missingVars.push(baseVar)

    // In development, set up mock values
    if (isDev) {
      let mockValue

      switch (baseVar) {
        case 'MONGODB_URI':
          mockValue = 'mongodb://localhost:27017/pixelated_dev'
          break
        case 'MONGODB_DATABASE':
          mockValue = 'pixelated_dev'
          break
        // Removed Supabase environment variables - using MongoDB now
        case 'REDIS_URL':
          mockValue = 'redis://localhost:6379'
          break
      }

      if (mockValue) {
        // Set all variants of this variable
        variants.forEach((varName) => {
          process.env[varName] = mockValue

          // Update .env file if the variable isn't already there
          if (!envContent.includes(`${varName}=`)) {
            envContent += `\n# Mock ${varName} for development\n${varName}=${mockValue}\n`
          }
        })

        console.log(`✅ Created mock value for ${baseVar} in development mode`)
      }
    }
  }
})

// In production, we should fail if variables are missing
if (isProd && missingVars.length > 0) {
  console.error('❌ Missing required environment variables in production:')
  missingVars.forEach((v) => console.error(`   - ${v}`))
  process.exit(1)
} else if (isDev && missingVars.length > 0) {
  console.warn(
    `⚠️ Using mock values for ${missingVars.length} environment variables in development.`,
  )
  console.warn('   These should be replaced with real values for production.')
} else {
  console.log('✅ All environment variables are present.')
}

// Write updated .env file
try {
  fs.writeFileSync(envPath, envContent)
} catch (error) {
  console.error('❌ Error updating .env file:', error.message)
}

// Export environment variables for build process
console.log('✅ Exporting environment variables for build process')
// No need to manually set process.env as we've already done that above

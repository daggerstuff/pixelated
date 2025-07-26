#!/usr/bin/env node

// This file is the entrypoint for our Docker container
console.log('📡 Container startup script running...')

// Check for environment variables
const requiredEnvVars = ['NODE_ENV']

const missingEnvVars = requiredEnvVars.filter((envVar) => !process.env[envVar])

if (missingEnvVars.length > 0) {
  console.error(
    `❌ Missing required environment variables: ${missingEnvVars.join(', ')}`,
  )
  process.exit(1)
}

// Additional startup tasks can be added here
console.log('✅ Environment validated. Starting Astro application...')

// Hand off to the main application
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully')
  process.exit(0)
})

// The application will continue to the CMD specified in the Dockerfile

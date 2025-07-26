#!/usr/bin/env node

/**
 * Health Check Script for Docker Container
 *
 * This script performs a basic health check for the Astro application
 * running in the Docker container. It's used as a fallback when curl
 * is not available in the container.
 */

import http from 'http'

const HEALTH_CHECK_PORT = process.env.PORT || process.env.WEBSITES_PORT || 3000
const HEALTH_CHECK_PATH = '/api/health/simple'
const TIMEOUT = 5000

function healthCheck() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: HEALTH_CHECK_PORT,
      path: HEALTH_CHECK_PATH,
      method: 'GET',
      timeout: TIMEOUT,
    }

    const req = http.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Health check passed')
          resolve({ status: 'healthy', statusCode: res.statusCode, body: data })
        } else {
          console.error(`❌ Health check failed with status ${res.statusCode}`)
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    })

    req.on('error', (error) => {
      console.error(`❌ Health check failed: ${error.message}`)
      reject(error)
    })

    req.on('timeout', () => {
      console.error(`❌ Health check timed out after ${TIMEOUT}ms`)
      req.destroy()
      reject(new Error('Health check timeout'))
    })

    req.end()
  })
}

// Run health check
async function main() {
  try {
    console.log(
      `🔍 Checking health at http://localhost:${HEALTH_CHECK_PORT}${HEALTH_CHECK_PATH}`,
    )
    await healthCheck()
    process.exit(0)
  } catch (error) {
    console.error(`Health check failed: ${error.message}`)
    process.exit(1)
  }
}

main()

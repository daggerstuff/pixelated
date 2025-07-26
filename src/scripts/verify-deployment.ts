#!/usr/bin/env node

/**
 * Deployment Verification Scrip
 *
 * This script verifies the health and functionality of a deployment.
 * It performs various checks to ensure the deployment is working correctly.
 */

import { spawnSync } from 'node:child_process'
import fetch from 'node-fetch'

interface HealthCheckResponse {
  status: string
  version: string
  environment: string
  services: {
    [key: string]: {
      status: string
      latency: number
    }
  }
  metrics: {
    [key: string]: number
  }
}

async function main() {
  try {
    console.log('=== Deployment Verification Tool ===')

    // 1. Check environment variables
    console.log('\n[1/5] Checking environment variables...')
    const requiredEnvVars = [
      'NODE_ENV',
      'DATABASE_URL',
      'REDIS_URL',
      'STORAGE_URL',
    ]

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`)
      }
    }
    console.log('✓ Environment variables verified')

    // 2. Check application health
    console.log('\n[2/5] Checking application health...')
    const healthResponse = await fetch(
      'https://api.pixelatedempathy.com/health',
    )
    if (!healthResponse.ok) {
      throw new Error(`Health check failed: ${healthResponse.statusText}`)
    }
    const healthData = (await healthResponse.json()) as HealthCheckResponse

    if (healthData.status !== 'ok') {
      throw new Error(
        `Health check returned non-ok status: ${healthData.status}`,
      )
    }
    console.log('✓ Application health verified')
    console.log(`  - Version: ${healthData.version}`)
    console.log(`  - Environment: ${healthData.environment}`)
    console.log(`  - Services: ${JSON.stringify(healthData.services, null, 2)}`)

    // Helper function to safely get metric values
    const getMetricValue = (
      metrics: Record<string, number>,
      name: string,
    ): number => {
      return metrics[name] || 0
    }

    console.log('Health check response:', healthData)
    console.log(
      'Response time:',
      getMetricValue(healthData.metrics, 'responseTime'),
      'ms',
    )
    console.log(
      'Success rate:',
      getMetricValue(healthData.metrics, 'successRate'),
      '%',
    )
    console.log(
      'Error rate:',
      getMetricValue(healthData.metrics, 'errorRate'),
      '%',
    )

    // 3. Check database connectivity
    console.log('\n[3/5] Checking database connectivity...')
    const dbCheck = spawnSync('pnpm', [
      'prisma',
      'db',
      'execute',
      '--schema=./prisma/schema.prisma',
      'SELECT 1',
    ])
    if (dbCheck.status !== 0) {
      throw new Error(`Database check failed: ${dbCheck.stderr.toString()}`)
    }
    console.log('✓ Database connectivity verified')

    // 4. Check Redis connectivity
    console.log('\n[4/5] Checking Redis connectivity...')
    const redisCheck = spawnSync('redis-cli', ['ping'])
    if (redisCheck.status !== 0) {
      throw new Error(`Redis check failed: ${redisCheck.stderr.toString()}`)
    }
    console.log('✓ Redis connectivity verified')

    // 5. Check critical endpoints
    console.log('\n[5/5] Checking critical endpoints...')
    const endpoints = [
      '/api/auth/session',
      '/api/ai/status',
      '/api/health/metrics',
    ]

    for (const endpoint of endpoints) {
      const response = await fetch(
        `https://api.pixelatedempathy.com${endpoint}`,
      )
      if (!response.ok) {
        throw new Error(
          `Endpoint check failed for ${endpoint}: ${response.statusText}`,
        )
      }
      console.log(`✓ Endpoint ${endpoint} verified`)
    }

    // Final verification
    console.log('\n=== Verification Summary ===')
    console.log('✓ All checks passed successfully')

    process.exit(0)
  } catch (error) {
    console.error('\n❌ Verification failed:', error)
    process.exit(1)
  }
}

// Execute main function
main().catch((error) => {
  console.error('Unhandled error:', error)
  process.exit(1)
})

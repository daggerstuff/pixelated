#!/usr/bin/env ts-node

/**
 * AI Authentication and Authorization Bypass Tester
 *
 * This script tests AI components for authentication and authorization bypass vulnerabilities.
 * It attempts various techniques to bypass security controls including:
 * - Missing authentication checks
 * - JWT token manipulation
 * - Cookie manipulation
 * - Header manipulation
 * - Parameter pollution
 * - Role-based access control bypass
 */

import fs from 'fs'

import axios from 'axios'
import { performance } from 'perf_hooks'
import { safeJoin, ALLOWED_DIRECTORIES, sanitizeFilename } from '../../src/utils/path-security'

// Configuration
interface Config {
  baseUrl: string
  outputDir: string
  requestDelay: number
  testTimeout: number
  verbose: boolean
  validUserToken: string
  validAdminToken: string
}

interface Endpoint {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  description: string
  requiredRole: 'none' | 'user' | 'admin'
}

interface TestResult {
  endpoint: string
  method: string
  testName: string
  bypassSuccessful: boolean
  statusCode: number
  responseTime: number
  details: string
  evidence?: string
  timestamp: string
}

// Default configuration
const config: Config = {
  baseUrl: 'http://localhost:3000',
  outputDir: safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, 'security-reports'),
  requestDelay: 500,
  testTimeout: 10000,
  verbose: true,
  validUserToken: 'user-token',
  validAdminToken: 'admin-token',
}

// Define endpoints to test
const endpoints: Endpoint[] = [
  {
    path: '/api/ai/completion',
    method: 'POST',
    description: 'AI completion endpoint',
    requiredRole: 'user',
  },
  {
    path: '/api/ai/usage',
    method: 'GET',
    description: 'AI usage statistics endpoint',
    requiredRole: 'user',
  },
  {
    path: '/api/ai/admin/dashboard',
    method: 'GET',
    description: 'AI admin dashboard',
    requiredRole: 'admin',
  },
  {
    path: '/api/ai/admin/users',
    method: 'GET',
    description: 'AI admin users endpoint',
    requiredRole: 'admin',
  },
  {
    path: '/api/ai/admin/settings',
    method: 'POST',
    description: 'AI admin settings endpoint',
    requiredRole: 'admin',
  },
]

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true })
}

// Create report file
const reportFilename = sanitizeFilename(
  `ai-auth-bypass-${new Date().toISOString().split('T')[0]}.json`,
)
const reportFile = safeJoin(config.outputDir, reportFilename)
const reportStream = fs.createWriteStream(reportFile)

/**
 * Write to report file
 */
function writeReport(results: TestResult[]) {
  reportStream.write(JSON.stringify(results, null, 2))
  reportStream.end()

  console.log(`\nScan complete. Report saved to: ${reportFile}`)

  // Print summary
  const total = results.length
  const successful = results.filter((r) => r.bypassSuccessful).length
  const failed = total - successful

  console.log(`\nSummary:`)
  console.log(`- Total tests: ${total}`)
  console.log(`- Successful bypasses: ${successful}`)
  console.log(`- Failed bypasses: ${failed}`)

  if (successful > 0) {
    console.log(`\nSuccessful bypasses:`)
    results
      .filter((r) => r.bypassSuccessful)
      .forEach((result) => {
        console.log(
          `- ${result.endpoint} (${result.method}) - ${result.testName}: ${result.details}`,
        )
      })
  }
}

/**
 * Log message if verbose mode is enabled
 */
function log(message: string) {
  if (config.verbose) {
    console.log(message)
  }
}

/**
 * Create a test result object
 */
function createTestResult(
  endpoint: Endpoint,
  testName: string,
  bypassSuccessful: boolean,
  statusCode: number,
  responseTime: number,
  details: string,
  evidence?: string,
): TestResult {
  return {
    endpoint: endpoint.path,
    method: endpoint.method,
    testName,
    bypassSuccessful,
    statusCode,
    responseTime,
    details,
    evidence,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Test for missing authentication
 */
async function testMissingAuthentication(
  endpoint: Endpoint,
): Promise<TestResult> {
  log(
    `Testing missing authentication for ${endpoint.path} (${endpoint.method})`,
  )

  const startTime = performance.now()
  let statusCode = 0
  let bypassSuccessful = false
  let details = 'Authentication check is properly implemented'
  let evidence = ''

  try {
    // Make request without authentication
    const response = await axios({
      method: endpoint.method,
      url: `${config.baseUrl}${endpoint.path}`,
      headers: {
        'Content-Type': 'application/json',
      },
      data:
        endpoint.method === 'POST'
          ? {
              messages: [{ role: 'user', content: 'Test message' }],
              model: 'together-ai-model',
            }
          : undefined,
      timeout: config.testTimeout,
      validateStatus: () => true,
    })

    statusCode = response.status

    // If the endpoint requires authentication but returns a successful response,
    // it might be vulnerable to authentication bypass
    if (
      endpoint.requiredRole !== 'none' &&
      (statusCode === 200 || statusCode === 201 || statusCode === 204)
    ) {
      bypassSuccessful = true
      details = 'Endpoint accessible without authentication'
      evidence = JSON.stringify(response.data)
    }
  } catch (error: unknown) {
    details = `Error testing missing authentication: ${error instanceof Error ? String(error) : 'Unknown error'}`
  }

  const endTime = performance.now()
  const responseTime = endTime - startTime

  return createTestResult(
    endpoint,
    'Missing Authentication',
    bypassSuccessful,
    statusCode,
    responseTime,
    details,
    evidence,
  )
}

/**
 * Test for JWT token manipulation
 */
async function testJWTManipulation(endpoint: Endpoint): Promise<TestResult> {
  log(`Testing JWT manipulation for ${endpoint.path} (${endpoint.method})`)

  const startTime = performance.now()
  let statusCode = 0
  let bypassSuccessful = false
  let details = 'JWT validation is properly implemented'
  let evidence = ''

  try {
    // Generate an invalid token that follows JWT format but cannot be validated
    const fakeToken =
      Buffer.from(
        JSON.stringify({
          alg: 'HS256',
          typ: 'JWT',
        }),
      ).toString('base64url') +
      '.' +
      Buffer.from(
        JSON.stringify({
          sub: '123456789',
          name: 'Test User',
          role: 'admin',
          iat: Math.floor(Date.now() / 1000),
        }),
      ).toString('base64url') +
      '.' +
      'invalid_signature'

    const response = await axios({
      method: endpoint.method,
      url: `${config.baseUrl}${endpoint.path}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${fakeToken}`,
      },
      data:
        endpoint.method === 'POST'
          ? {
              messages: [{ role: 'user', content: 'Test message' }],
              model: 'together-ai-model',
            }
          : undefined,
      timeout: config.testTimeout,
      validateStatus: () => true,
    })

    statusCode = response.status

    // If the endpoint requires authentication but returns a successful response with a fake token,
    // it might be vulnerable to JWT manipulation
    if (
      endpoint.requiredRole !== 'none' &&
      (statusCode === 200 || statusCode === 201 || statusCode === 204)
    ) {
      bypassSuccessful = true
      details = 'Endpoint accessible with manipulated JWT token'
      evidence = JSON.stringify(response.data)
    }
  } catch (error: unknown) {
    details = `Error testing JWT manipulation: ${error instanceof Error ? String(error) : 'Unknown error'}`
  }

  const endTime = performance.now()
  const responseTime = endTime - startTime

  return createTestResult(
    endpoint,
    'JWT Token Manipulation',
    bypassSuccessful,
    statusCode,
    responseTime,
    details,
    evidence,
  )
}

/**
 * Test for cookie manipulation
 */
async function testCookieManipulation(endpoint: Endpoint): Promise<TestResult> {
  log(`Testing cookie manipulation for ${endpoint.path} (${endpoint.method})`)

  const startTime = performance.now()
  let statusCode = 0
  let bypassSuccessful = false
  let details = 'Cookie validation is properly implemented'
  let evidence = ''

  try {
    // Create a manipulated session cookie
    const fakeCookie =
      'session=' +
      Buffer.from(
        JSON.stringify({
          alg: 'none', // Using 'none' algorithm for testing
          typ: 'JWT',
        }),
      ).toString('base64url') +
      '.' +
      Buffer.from(
        JSON.stringify({
          sub: 'test-user',
          name: 'Test User',
          role: 'admin',
          iat: Math.floor(Date.now() / 1000),
        }),
      ).toString('base64url') +
      '.' +
      'invalid-signature' // Invalid signature for testing

    const response = await axios({
      method: endpoint.method,
      url: `${config.baseUrl}${endpoint.path}`,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': fakeCookie,
      },
      data:
        endpoint.method === 'POST'
          ? {
              messages: [{ role: 'user', content: 'Test message' }],
              model: 'together-ai-model',
            }
          : undefined,
      timeout: config.testTimeout,
      validateStatus: () => true,
    })

    statusCode = response.status

    // If the endpoint requires authentication but returns a successful response with a fake cookie,
    // it might be vulnerable to cookie manipulation
    if (
      endpoint.requiredRole !== 'none' &&
      (statusCode === 200 || statusCode === 201 || statusCode === 204)
    ) {
      bypassSuccessful = true
      details = 'Endpoint accessible with manipulated cookie'
      evidence = JSON.stringify(response.data)
    }
  } catch (error: unknown) {
    details = `Error testing cookie manipulation: ${error instanceof Error ? String(error) : 'Unknown error'}`
  }

  const endTime = performance.now()
  const responseTime = endTime - startTime

  return createTestResult(
    endpoint,
    'Cookie Manipulation',
    bypassSuccessful,
    statusCode,
    responseTime,
    details,
    evidence,
  )
}

/**
 * Test for header manipulation
 */
async function testHeaderManipulation(
  endpoint: Endpoint,
): Promise<TestResult[]> {
  log(`Testing header manipulation for ${endpoint.path} (${endpoint.method})`)

  const results: TestResult[] = []

  // Test various header manipulation techniques
  const headerTests = [
    {
      name: 'X-Original-URL Header',
      headers: {
        'X-Original-URL': endpoint.path,
        'Content-Type': 'application/json',
      },
    },
    {
      name: 'X-Rewrite-URL Header',
      headers: {
        'X-Rewrite-URL': endpoint.path,
        'Content-Type': 'application/json',
      },
    },
    {
      name: 'X-Forwarded-For Header',
      headers: {
        'X-Forwarded-For': '127.0.0.1',
        'Content-Type': 'application/json',
      },
    },
    {
      name: 'X-Forwarded-Host Header',
      headers: {
        'X-Forwarded-Host': 'localhost',
        'Content-Type': 'application/json',
      },
    },
    {
      name: 'X-Remote-IP Header',
      headers: {
        'X-Remote-IP': '127.0.0.1',
        'Content-Type': 'application/json',
      },
    },
    {
      name: 'X-Client-IP Header',
      headers: {
        'X-Client-IP': '127.0.0.1',
        'Content-Type': 'application/json',
      },
    },
  ]

  for (const test of headerTests) {
    const startTime = performance.now()
    let statusCode = 0
    let bypassSuccessful = false
    let details = `${test.name} validation is properly implemented`
    let evidence = ''

    try {
      const response = await axios({
        method: endpoint.method,
        url: `${config.baseUrl}${endpoint.path}`,
        headers: test.headers,
        data:
          endpoint.method === 'POST'
            ? {
                messages: [{ role: 'user', content: 'Test message' }],
                model: 'together-ai-model',
              }
            : undefined,
        timeout: config.testTimeout,
        validateStatus: () => true,
      })

      statusCode = response.status

      // If the endpoint requires authentication but returns a successful response with manipulated headers,
      // it might be vulnerable to header manipulation
      if (
        endpoint.requiredRole !== 'none' &&
        (statusCode === 200 || statusCode === 201 || statusCode === 204)
      ) {
        bypassSuccessful = true
        details = `Endpoint accessible with manipulated ${test.name}`
        evidence = JSON.stringify(response.data)
      }
    } catch (error: unknown) {
      details = `Error testing ${test.name}: ${error instanceof Error ? String(error) : 'Unknown error'}`
    }

    const endTime = performance.now()
    const responseTime = endTime - startTime

    results.push(
      createTestResult(
        endpoint,
        `Header Manipulation (${test.name})`,
        bypassSuccessful,
        statusCode,
        responseTime,
        details,
        evidence,
      ),
    )

    // Add delay between tests
    await new Promise((resolve) => setTimeout(resolve, config.requestDelay))
  }

  return results
}

/**
 * Test for parameter pollution
 */
async function testParameterPollution(endpoint: Endpoint): Promise<TestResult> {
  log(`Testing parameter pollution for ${endpoint.path} (${endpoint.method})`)

  const startTime = performance.now()
  let statusCode = 0
  let bypassSuccessful = false
  let details = 'Parameter validation is properly implemented'
  let evidence = ''

  try {
    // Create a URL with duplicate parameters
    let url = `${config.baseUrl}${endpoint.path}`

    if (endpoint.method === 'GET') {
      url += '?role=user&role=admin'
    }

    const response = await axios({
      method: endpoint.method,
      url,
      headers: {
        'Content-Type': 'application/json',
      },
      data:
        endpoint.method === 'POST'
          ? {
              messages: [{ role: 'user', content: 'Test message' }],
              model: 'together-ai-model',
              role: ['user', 'admin'], // Parameter pollution in JSON body
            }
          : undefined,
      timeout: config.testTimeout,
      validateStatus: () => true,
    })

    statusCode = response.status

    // If the endpoint requires authentication but returns a successful response with parameter pollution,
    // it might be vulnerable
    if (
      endpoint.requiredRole !== 'none' &&
      (statusCode === 200 || statusCode === 201 || statusCode === 204)
    ) {
      bypassSuccessful = true
      details = 'Endpoint accessible with parameter pollution'
      evidence = JSON.stringify(response.data)
    }
  } catch (error: unknown) {
    details = `Error testing parameter pollution: ${error instanceof Error ? String(error) : 'Unknown error'}`
  }

  const endTime = performance.now()
  const responseTime = endTime - startTime

  return createTestResult(
    endpoint,
    'Parameter Pollution',
    bypassSuccessful,
    statusCode,
    responseTime,
    details,
    evidence,
  )
}

/**
 * Test for role-based access control bypass
 */
async function testRBACBypass(endpoint: Endpoint): Promise<TestResult> {
  log(`Testing RBAC bypass for ${endpoint.path} (${endpoint.method})`)

  const startTime = performance.now()
  let statusCode = 0
  let bypassSuccessful = false
  let details = 'Role-based access control is properly implemented'
  let evidence = ''

  // Only test admin endpoints with user token
  if (endpoint.requiredRole !== 'admin') {
    return createTestResult(
      endpoint,
      'RBAC Bypass',
      false,
      0,
      0,
      'Skipped - endpoint does not require admin role',
      '',
    )
  }

  try {
    // Try to access admin endpoint with user token
    const response = await axios({
      method: endpoint.method,
      url: `${config.baseUrl}${endpoint.path}`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.validUserToken}`,
      },
      data:
        endpoint.method === 'POST'
          ? {
              setting: 'test',
              value: 'test',
            }
          : undefined,
      timeout: config.testTimeout,
      validateStatus: () => true,
    })

    statusCode = response.status

    // If the endpoint requires admin role but returns a successful response with user token,
    // it might be vulnerable to RBAC bypass
    if (statusCode === 200 || statusCode === 201 || statusCode === 204) {
      bypassSuccessful = true
      details = 'Admin endpoint accessible with user token'
      evidence = JSON.stringify(response.data)
    }
  } catch (error: unknown) {
    details = `Error testing RBAC bypass: ${error instanceof Error ? String(error) : 'Unknown error'}`
  }

  const endTime = performance.now()
  const responseTime = endTime - startTime

  return createTestResult(
    endpoint,
    'RBAC Bypass',
    bypassSuccessful,
    statusCode,
    responseTime,
    details,
    evidence,
  )
}

/**
 * Run all tests for an endpoint
 */
async function testEndpoint(endpoint: Endpoint): Promise<TestResult[]> {
  log(`\nTesting endpoint: ${endpoint.path} (${endpoint.method})`)
  log(`Required role: ${endpoint.requiredRole}`)

  const results: TestResult[] = []

  // Test missing authentication
  results.push(await testMissingAuthentication(endpoint))
  await new Promise((resolve) => setTimeout(resolve, config.requestDelay))

  // Test JWT manipulation
  results.push(await testJWTManipulation(endpoint))
  await new Promise((resolve) => setTimeout(resolve, config.requestDelay))

  // Test cookie manipulation
  results.push(await testCookieManipulation(endpoint))
  await new Promise((resolve) => setTimeout(resolve, config.requestDelay))

  // Test header manipulation
  results.push(...(await testHeaderManipulation(endpoint)))

  // Test parameter pollution
  results.push(await testParameterPollution(endpoint))
  await new Promise((resolve) => setTimeout(resolve, config.requestDelay))

  // Test RBAC bypass
  results.push(await testRBACBypass(endpoint))

  return results
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting AI authentication and authorization bypass tests...')

  const allResults: TestResult[] = []

  for (const endpoint of endpoints) {
    const results = await testEndpoint(endpoint)
    allResults.push(...results)

    // Print results for this endpoint
    const successfulBypasses = results.filter((r) => r.bypassSuccessful).length
    console.log(`\nResults for ${endpoint.path} (${endpoint.method}):`)
    console.log(`- Tests run: ${results.length}`)
    console.log(`- Successful bypasses: ${successfulBypasses}`)

    if (successfulBypasses > 0) {
      console.log('- Successful bypass techniques:')
      results
        .filter((r) => r.bypassSuccessful)
        .forEach((result) => {
          console.log(`  - ${result.testName}: ${result.details}`)
        })
    }
  }

  writeReport(allResults)
}

// Run tests
runTests().catch((error) => {
  console.error('Error running authentication bypass tests:', error)
  process.exit(1)
})

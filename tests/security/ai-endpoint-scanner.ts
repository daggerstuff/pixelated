#!/usr/bin/env ts-node

/**
 * AI Endpoint Security Scanner
 *
 * This script performs basic security checks on AI endpoints to identify potential vulnerabilities.
 * It tests for authentication, authorization, rate limiting, input validation, and error handling.
 */

import fs from 'fs'

import axios from 'axios'
import { performance } from 'perf_hooks'
import { safeJoin, ALLOWED_DIRECTORIES, sanitizeFilename } from '../../src/utils/path-security'

// Configuration
interface Config {
  baseUrl: string
  endpoints: Endpoint[]
  testUsers: TestUser[]
  outputDir: string
  requestDelay: number
  maxConcurrent: number
}

interface Endpoint {
  path: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  description: string
  requiresAuth: boolean
  requiredRole?: string
  testCases: TestCase[]
}

interface TestCase {
  name: string
  payload?: Record<string, unknown>
  headers?: Record<string, string>
  expectedStatus: number
  description: string
}

interface TestUser {
  name: string
  token?: string
  role: string
}

interface TestResult {
  endpoint: string
  method: string
  testCase: string
  user: string
  status: number
  expectedStatus: number
  responseTime: number
  passed: boolean
  message: string
  timestamp: string
}

// Default configuration
const config: Config = {
  baseUrl: 'http://localhost:3000',
  endpoints: [
    {
      path: '/api/ai/completion',
      method: 'POST',
      description: 'AI completion endpoint',
      requiresAuth: true,
      requiredRole: 'user',
      testCases: [
        {
          name: 'Valid request',
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
            model: 'together-ai-model',
          },
          expectedStatus: 200,
          description: 'Valid request with proper authentication',
        },
        {
          name: 'Missing authentication',
          payload: {
            messages: [{ role: 'user', content: 'Hello' }],
            model: 'together-ai-model',
          },
          headers: { Authorization: '' },
          expectedStatus: 401,
          description: 'Request without authentication token',
        },
        {
          name: 'SQL injection attempt',
          payload: {
            messages: [{ role: 'user', content: "' OR 1=1; --" }],
            model: 'together-ai-model',
          },
          expectedStatus: 400,
          description: 'SQL injection attempt in message content',
        },
        {
          name: 'XSS attempt',
          payload: {
            messages: [{ role: 'user', content: '<script>alert(1)</script>' }],
            model: 'together-ai-model',
          },
          expectedStatus: 400,
          description: 'XSS attempt in message content',
        },
        {
          name: 'Large payload',
          payload: {
            messages: [{ role: 'user', content: 'A'.repeat(100000) }],
            model: 'together-ai-model',
          },
          expectedStatus: 413,
          description: 'Request with very large payload',
        },
      ],
    },
    {
      path: '/api/ai/usage',
      method: 'GET',
      description: 'AI usage statistics endpoint',
      requiresAuth: true,
      requiredRole: 'admin',
      testCases: [
        {
          name: 'Valid request',
          expectedStatus: 200,
          description: 'Valid request with admin authentication',
        },
        {
          name: 'Missing authentication',
          headers: { Authorization: '' },
          expectedStatus: 401,
          description: 'Request without authentication token',
        },
        {
          name: 'Insufficient permissions',
          expectedStatus: 403,
          description: 'Request with non-admin authentication',
        },
      ],
    },
  ],
  testUsers: [
    {
      name: 'Anonymous',
      role: 'anonymous',
    },
    {
      name: 'Regular User',
      token: 'user-token',
      role: 'user',
    },
    {
      name: 'Admin User',
      token: 'admin-token',
      role: 'admin',
    },
  ],
  outputDir: safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, 'security-reports'),
  requestDelay: 500,
  maxConcurrent: 5,
}

// Ensure output directory exists
if (!fs.existsSync(config.outputDir)) {
  fs.mkdirSync(config.outputDir, { recursive: true })
}

// Create report file
const reportFilename = sanitizeFilename(
  `ai-endpoint-scan-${new Date().toISOString().split('T')[0]}.json`,
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
  const passed = results.filter((r) => r.passed).length
  const failed = total - passed

  console.log(`\nSummary:`)
  console.log(`- Total tests: ${total}`)
  console.log(`- Passed: ${passed}`)
  console.log(`- Failed: ${failed}`)

  if (failed > 0) {
    console.log(`\nFailed tests:`)
    results
      .filter((r) => !r.passed)
      .forEach((result) => {
        console.log(
          `- ${result.endpoint} (${result.method}) - ${result.testCase}: ${result.message}`,
        )
      })
  }
}

/**
 * Run a test case
 */
async function runTest(
  endpoint: Endpoint,
  testCase: TestCase,
  user: TestUser,
): Promise<TestResult> {
  const url = `${config.baseUrl}${endpoint.path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(user.token ? { Authorization: `Bearer ${user.token}` } : {}),
    ...testCase.headers,
  }

  const startTime = performance.now()
  let status = 0
  let message = ''

  try {
    const response = await axios({
      method: endpoint.method,
      url,
      data: testCase.payload,
      headers,
      validateStatus: () => true,
    })

    status = response.status
    message = response.statusText
  } catch (error: unknown) {
    message = String(error)
  }

  const endTime = performance.now()
  const responseTime = endTime - startTime

  const passed = status === testCase.expectedStatus

  return {
    endpoint: endpoint.path,
    method: endpoint.method,
    testCase: testCase.name,
    user: user.name,
    status,
    expectedStatus: testCase.expectedStatus,
    responseTime,
    passed,
    message,
    timestamp: new Date().toISOString(),
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting AI endpoint security scan...')

  const results: TestResult[] = []

  for (const endpoint of config.endpoints) {
    console.log(`\nTesting endpoint: ${endpoint.path} (${endpoint.method})`)

    for (const testCase of endpoint.testCases) {
      console.log(`- Test case: ${testCase.name}`)

      // Determine which users should run this test
      let { testUsers } = config

      if (testCase.name === 'Missing authentication') {
        // Only use anonymous user for missing auth tests
        testUsers = [config.testUsers.find((u) => u.role === 'anonymous')!]
      } else if (
        testCase.name === 'Insufficient permissions' &&
        endpoint.requiredRole
      ) {
        // Only use users with insufficient permissions
        testUsers = config.testUsers.filter(
          (u) => u.role !== 'anonymous' && u.role !== endpoint.requiredRole,
        )
      } else if (endpoint.requiresAuth) {
        // Only use authenticated users for auth-required endpoints
        testUsers = config.testUsers.filter((u) => u.role !== 'anonymous')

        if (endpoint.requiredRole && testCase.name === 'Valid request') {
          testUsers = config.testUsers.filter(
            (u) => u.role === endpoint.requiredRole || u.role === 'admin',
          )
        }
      }

      for (const user of testUsers) {
        console.log(`  - User: ${user.name}`)

        const result = await runTest(endpoint, testCase, user)
        results.push(result)

        console.log(
          `    Status: ${result.status}, Expected: ${result.expectedStatus}, Passed: ${result.passed ? 'Yes' : 'No'}`,
        )

        // Add delay between requests
        await new Promise((resolve) => setTimeout(resolve, config.requestDelay))
      }
    }
  }

  writeReport(results)
}

// Run tests
runTests().catch((error) => {
  console.error('Error running security scan:', error)
  process.exit(1)
})

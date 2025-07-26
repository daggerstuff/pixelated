// This file is a k6 load testing script executed by the k6 runtime, not Node.js

import { check, sleep } from 'k6'
import { randomString } from 'k6/data'
import http from 'k6/http'
import { Counter, Rate, Trend } from 'k6/metrics'
import type { RefinedResponse } from 'k6/http'

// Define response types for better type safety
interface NotificationResponse {
  totalNotifications: number
  deliveredNotifications: number
  [key: string]: unknown
}

// Since k6 doesn't support Node.js modules, we simulate PHI audit logging
// by sending an HTTP request to a logging endpoint
function simulatePHIAuditLog() {
  http.post(
    '/api/logging/phi-audit',
    JSON.stringify({
      message: 'Breach notification load test module accessed',
      dataType: 'security-load-testing',
      action: 'module-access',
      component: 'load-tests/breach-notification.load.ts',
      containsPHI: true,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Audit-Source': 'k6-load-test',
      },
    },
  )
}

// Log PHI access at the start of the test
simulatePHIAuditLog()

// Custom metrics
const breachCreationErrors = new Rate('breach_creation_errors')
const notificationsSent = new Counter('notifications_sent')
const breachProcessingTime = new Trend('breach_processing_time')

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 }, // Ramp up to 10 users
    { duration: '3m', target: 10 }, // Stay at 10 users
    { duration: '1m', target: 50 }, // Ramp up to 50 users
    { duration: '3m', target: 50 }, // Stay at 50 users
    { duration: '1m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '1m', target: 0 }, // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'], // Less than 1% of requests should fail
    breach_creation_errors: ['rate<0.02'], // Less than 2% breach creation errors
    breach_processing_time: ['p(95)<2000'], // 95% of breaches processed under 2s
  },
}

// Simulated breach severities and their probabilities
const SEVERITIES = {
  low: 0.4, // 40% probability
  medium: 0.3, // 30% probability
  high: 0.2, // 20% probability
  critical: 0.1, // 10% probability
} as const

type Severity = keyof typeof SEVERITIES

// Simulated breach types
const BREACH_TYPES = [
  'unauthorized_access',
  'data_leak',
  'system_compromise',
  'other',
]

// Simulated affected data types
const AFFECTED_DATA_TYPES = [
  'personal_info',
  'contact_details',
  'medical_records',
  'financial_data',
  'login_history',
  'phi',
]

// Helper function to generate random breach details
function generateBreachDetails() {
  // Determine severity based on probability
  const rand = Math.random() // Use simple random number between 0 and 1
  let severity: Severity = 'low' // Default value
  let sum = 0
  for (const [sev, prob] of Object.entries(SEVERITIES)) {
    sum += prob
    if (rand <= sum) {
      severity = sev as Severity
      break
    }
  }

  // Generate random number of affected users based on severity
  const userCounts = {
    low: () => Math.floor(Math.random() * 10) + 1,
    medium: () => Math.floor(Math.random() * 50) + 10,
    high: () => Math.floor(Math.random() * 200) + 50,
    critical: () => Math.floor(Math.random() * 1000) + 200,
  }

  const affectedUserCount = userCounts[severity]()
  const affectedUsers = Array.from({ length: affectedUserCount })
    .fill('')
    .map(() => `user_${randomString(8)}`)

  // Generate random affected data types (1-3 types)
  const dataTypeCount = Math.floor(Math.random() * 3) + 1
  const affectedData = Array.from({ length: dataTypeCount })
    .fill('')
    .map(
      () =>
        AFFECTED_DATA_TYPES[
          Math.floor(Math.random() * AFFECTED_DATA_TYPES.length)
        ],
    )
    .filter((value, index, self) => self.indexOf(value) === index)

  return {
    type: BREACH_TYPES[Math.floor(Math.random() * BREACH_TYPES.length)],
    severity,
    description: `Load test breach - ${randomString(16)}`,
    affectedUsers,
    affectedData,
    detectionMethod: 'load_testing',
    remediation: 'Automated response actions initiated',
  }
}

// Helper function to check breach status
function checkBreachStatus(breachId: string) {
  const response = http.get(`/api/security/breaches/${breachId}`)
  return response.json()
}

// Main test scenario
export default function () {
  // Generate and report a new breach
  const breachDetails = generateBreachDetails()
  const startTime = new Date().getTime() // Get timestamp instead of Date object

  const createResponse = http.post(
    '/api/security/breaches',
    JSON.stringify(breachDetails),
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Test-Mode': 'true', // Special header to indicate load testing
      },
    },
  )

  // Check if breach creation was successful
  const success = check(createResponse, {
    'breach created successfully': (r: RefinedResponse<unknown>) =>
      r.status === 200,
    'has breach ID': (r: RefinedResponse<unknown>) =>
      r.json('id') !== undefined,
  })

  if (!success) {
    breachCreationErrors.add(1)
    console.error(
      `Failed to create breach: ${createResponse.status} ${createResponse.body}`,
    )
    return
  }

  const breachId = createResponse.json('id')

  // Poll for breach status until completed or timeout
  let attempts = 0
  const maxAttempts = 10
  let completed = false

  while (attempts < maxAttempts && !completed) {
    const statusResponse = checkBreachStatus(breachId)

    if (statusResponse.notificationStatus === 'completed') {
      completed = true
      const processingTime = new Date().getTime() - startTime // Use timestamp for subtraction
      breachProcessingTime.add(processingTime)
      notificationsSent.add(breachDetails.affectedUsers.length)
    } else {
      attempts++
      sleep(1)
    }
  }

  // Verify notification deliveries
  if (completed) {
    const notificationResponse = http.get(
      `/api/security/breaches/${breachId}/notifications`,
    )

    check(notificationResponse, {
      'notifications sent successfully': (r: RefinedResponse<unknown>) =>
        r.status === 200,
      'all notifications delivered': (r: RefinedResponse<unknown>) => {
        const data = r.json() as NotificationResponse
        return (
          data.totalNotifications === breachDetails.affectedUsers.length &&
          data.deliveredNotifications === breachDetails.affectedUsers.length
        )
      },
    })
  }

  // Random sleep between 1-5 seconds before next iteration
  sleep(Math.random() * 4 + 1)
}

// Lifecycle hooks
export function setup() {
  // Setup test environment
  const response = http.post(
    '/api/security/test/setup',
    JSON.stringify({
      mode: 'load_test',
      userCount: 1000, // Pre-create test users
      stakeholderCount: 5, // Pre-create test stakeholders
    }),
  )

  check(response, {
    'test environment setup successfully': (r: RefinedResponse<unknown>) =>
      r.status === 200,
  })

  return response.json()
}

export function teardown(data: { testRunId: string }) {
  // Cleanup test environment
  const response = http.post(
    '/api/security/test/teardown',
    JSON.stringify({
      mode: 'load_test',
      testRunId: data.testRunId,
    }),
  )

  check(response, {
    'test environment cleaned up successfully': (r: RefinedResponse<unknown>) =>
      r.status === 200,
  })
}

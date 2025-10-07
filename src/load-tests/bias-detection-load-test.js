import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// Custom metrics
export const errorRate = new Rate('errors')
export const responseTimeTrend = new Trend('response_time')

// Test configuration
export const options = {
  stages: [
    // Ramp up
    { duration: '2m', target: 10 }, // Ramp up to 10 users over 2 minutes
    { duration: '5m', target: 10 }, // Stay at 10 users for 5 minutes
    { duration: '2m', target: 20 }, // Ramp up to 20 users over 2 minutes
    { duration: '5m', target: 20 }, // Stay at 20 users for 5 minutes
    { duration: '2m', target: 50 }, // Ramp up to 50 users over 2 minutes
    { duration: '5m', target: 50 }, // Stay at 50 users for 5 minutes
    // Ramp down
    { duration: '2m', target: 0 }, // Ramp down to 0 users over 2 minutes
  ],
  thresholds: {
    // Performance requirements
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    http_req_failed: ['rate<0.01'], // Error rate should be less than 1%
    errors: ['rate<0.01'], // Custom error rate should be less than 1%
    response_time: ['p(95)<2000'], // 95% of custom response times should be below 2s
  },
}

// Base URL - can be overridden with environment variable
const BASE_URL = globalThis.__ENV?.BASE_URL || 'http://localhost:3000'

// Test authentication token (should be provided via environment)
const AUTH_TOKEN = globalThis.__ENV?.AUTH_TOKEN || 'test-jwt-token'

// Headers for authenticated requests
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
}

// Sample test data for bias detection
const sampleSessionData = {
  sessionId: 'test-session-123',
  messages: [
    {
      role: 'user',
      content:
        'I feel like everyone at work treats me differently because of my background.',
      timestamp: new Date().toISOString(),
    },
    {
      role: 'assistant',
      content:
        "I understand that feeling different can be challenging. Can you tell me more about specific situations where you've noticed this?",
      timestamp: new Date().toISOString(),
    },
    {
      role: 'user',
      content:
        'During meetings, my ideas are often dismissed or ignored, but when others say similar things, they get positive responses.',
      timestamp: new Date().toISOString(),
    },
  ],
  metadata: {
    userId: 'user-456',
    sessionDuration: 1800000, // 30 minutes
    platform: 'web',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  },
}

// Function to generate random session data
function generateRandomSessionData() {
  const messages = [
    "I'm struggling with anxiety about my performance at work.",
    "Sometimes I feel like I don't belong in certain social situations.",
    'I worry that people judge me based on my appearance.',
    'I often feel excluded from group conversations.',
    'I notice people react differently to me compared to others.',
  ]

  return {
    ...sampleSessionData,
    sessionId: `test-session-${Math.random().toString(36).substr(2, 9)}`,
    messages: [
      {
        role: 'user',
        content: messages[Math.floor(Math.random() * messages.length)],
        timestamp: new Date().toISOString(),
      },
      {
        role: 'assistant',
        content:
          'Thank you for sharing that with me. Can you tell me more about how this makes you feel?',
        timestamp: new Date().toISOString(),
      },
    ],
    metadata: {
      ...sampleSessionData.metadata,
      userId: `user-${Math.random().toString(36).substr(2, 9)}`,
    },
  }
}

// Test health endpoint
export function testHealthEndpoint() {
  const response = http.get(`${BASE_URL}/api/bias-detection/health`)

  const success = check(response, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
    'health check has correct content-type': (r) =>
      r.headers['Content-Type'].includes('application/json'),
  })

  errorRate.add(!success)
  responseTimeTrend.add(response.timings.duration)

  return response
}

// Test session analysis endpoint
export function testAnalysisEndpoint() {
  const payload = generateRandomSessionData()

  const response = http.post(
    `${BASE_URL}/api/bias-detection/analyze`,
    JSON.stringify(payload),
    { headers },
  )

  const success = check(response, {
    'analysis status is 200': (r) => r.status === 200,
    'analysis response time < 3000ms': (r) => r.timings.duration < 3000,
    'analysis has bias score': (r) => {
      try {
        const data = JSON.parse(r.body)
        return (
          data.biasScore !== undefined && typeof data.biasScore === 'number'
        )
      } catch {
        return false
      }
    },
    'analysis has recommendations': (r) => {
      try {
        const data = JSON.parse(r.body)
        return Array.isArray(data.recommendations)
      } catch {
        return false
      }
    },
  })

  errorRate.add(!success)
  responseTimeTrend.add(response.timings.duration)

  return response
}

// Test dashboard data endpoint
export function testDashboardEndpoint() {
  const params = {
    timeRange: '24h',
    limit: '50',
  }

  const url = `${BASE_URL}/api/bias-detection/dashboard?${Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&')}`

  const response = http.get(url, { headers })

  const success = check(response, {
    'dashboard status is 200': (r) => r.status === 200,
    'dashboard response time < 2000ms': (r) => r.timings.duration < 2000,
    'dashboard has sessions data': (r) => {
      try {
        const data = JSON.parse(r.body)
        return Array.isArray(data.sessions)
      } catch {
        return false
      }
    },
    'dashboard has statistics': (r) => {
      try {
        const data = JSON.parse(r.body)
        return data.statistics && typeof data.statistics === 'object'
      } catch {
        return false
      }
    },
  })

  errorRate.add(!success)
  responseTimeTrend.add(response.timings.duration)

  return response
}

// Test data export endpoint
export function testExportEndpoint() {
  const params = {
    format: 'json',
    timeRange: '7d',
    includeMetadata: 'true',
  }

  const url = `${BASE_URL}/api/bias-detection/export?${Object.entries(params)
    .map(([key, value]) => `${key}=${value}`)
    .join('&')}`

  const response = http.get(url, { headers })

  const success = check(response, {
    'export status is 200': (r) => r.status === 200,
    'export response time < 5000ms': (r) => r.timings.duration < 5000,
    'export has data': (r) => r.body.length > 0,
  })

  errorRate.add(!success)
  responseTimeTrend.add(response.timings.duration)

  return response
}

// Test error handling
export function testErrorHandling() {
  // Test with invalid session data
  const invalidPayload = {
    sessionId: '', // Invalid: empty session ID
    messages: [], // Invalid: empty messages
  }

  const response = http.post(
    `${BASE_URL}/api/bias-detection/analyze`,
    JSON.stringify(invalidPayload),
    { headers },
  )

  // Don't count expected errors in error rate
  responseTimeTrend.add(response.timings.duration)

  return response
}

// Test rate limiting
export function testRateLimiting() {
  const responses = []

  // Make multiple rapid requests to trigger rate limiting
  for (let i = 0; i < 15; i++) {
    const response = http.get(`${BASE_URL}/api/bias-detection/health`, {
      headers,
    })
    responses.push(response)
  }

  // Check if at least one request was rate limited
  const rateLimited = responses.some((r) => r.status === 429)

  check(null, {
    'rate limiting is working': () => rateLimited,
  })

  return responses
}

// Main test function
export default function () {
  // Distribute load across different endpoints
  const endpointChoice = Math.random()

  if (endpointChoice < 0.3) {
    // 30% - Health checks (lightweight)
    testHealthEndpoint()
  } else if (endpointChoice < 0.6) {
    // 30% - Session analysis (compute-intensive)
    testAnalysisEndpoint()
  } else if (endpointChoice < 0.8) {
    // 20% - Dashboard data (database-intensive)
    testDashboardEndpoint()
  } else if (endpointChoice < 0.95) {
    // 15% - Data export (I/O intensive)
    testExportEndpoint()
  } else {
    // 5% - Error handling and edge cases
    testErrorHandling()
  }

  // Occasionally test rate limiting
  if (Math.random() < 0.01) {
    // 1% chance
    testRateLimiting()
  }

  // Random sleep between 1-3 seconds to simulate real user behavior
  sleep(Math.random() * 2 + 1)
}

// Setup function (runs once at the beginning)
export function setup() {
  console.log('Starting bias detection engine load test...')
  console.log(`Base URL: ${BASE_URL}`)
  console.log(`Auth Token: ${AUTH_TOKEN ? 'Provided' : 'Not provided'}`)

  // Verify the service is running
  const healthResponse = http.get(`${BASE_URL}/api/bias-detection/health`)
  if (healthResponse.status !== 200) {
    throw new Error(`Service health check failed: ${healthResponse.status}`)
  }

  console.log('Service is healthy, starting load test...')
  return { serviceHealthy: true }
}

// Teardown function (runs once at the end)
export function teardown(data) {
  console.log('Load test completed')
  console.log(`Service was healthy during setup: ${data.serviceHealthy}`)
}

// Handle summary statistics
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'load-test-results.json': JSON.stringify(data, null, 2),
  }
}

// Helper function for text summary (fallback implementation)
function textSummary(data, options = {}) {
  const indent = options.indent || ''

  let summary = `${indent}Bias Detection Engine Load Test Results:\n`
  summary += `${indent}  Total Requests: ${data.metrics.http_reqs.count}\n`
  summary += `${indent}  Failed Requests: ${data.metrics.http_req_failed.count}\n`
  summary += `${indent}  Average Response Time: ${data.metrics.http_req_duration.avg.toFixed(2)}ms\n`
  summary += `${indent}  95th Percentile Response Time: ${data.metrics.http_req_duration['p(95)'].toFixed(2)}ms\n`

  if (data.metrics.errors) {
    summary += `${indent}  Custom Error Rate: ${(data.metrics.errors.rate * 100).toFixed(2)}%\n`
  }

  // Check if thresholds were met
  const thresholdsMet = Object.entries(data.thresholds || {}).every(
    ([, result]) => !result.fails,
  )
  summary += `${indent}  All Thresholds Met: ${thresholdsMet ? '✅ Yes' : '❌ No'}\n`

  return summary
}

import { vi } from 'vitest'

// Type definitions for better TypeScript support (currently unused - defined for future testing features)
// interface TestResult {
//   success: boolean
//   responseTime: number
//   error?: any
// }

// interface PerformanceResults {
//   totalTime: number
//   averageResponseTime: number
//   requestsPerSecond: number
//   successRate: number
//   errors: number
// }

// interface SecurityTestResults {
//   vulnerable: boolean
//   vulnerabilities: string[]
//   recommendations: string[]
// }

// Test Database Configuration
export const testDbConfig = {
  host: process.env['TEST_DB_HOST'] || 'localhost',
  port: parseInt(process.env['TEST_DB_PORT'] || '5433'),
  database: process.env['TEST_DB_NAME'] || 'pixelated_test',
  user: process.env['TEST_DB_USER'] || 'test_user',
  password: process.env['TEST_DB_PASSWORD'] || 'test_password',
}

// Test Redis Configuration
export const testRedisConfig = {
  host: process.env['TEST_REDIS_HOST'] || 'localhost',
  port: parseInt(process.env['TEST_REDIS_PORT'] || '6380'),
  password: process.env['TEST_REDIS_PASSWORD'] || 'test_redis_password',
}

// Mock Data Generators
export class MockDataGenerator {
  static generateUser(overrides: Partial<any> = {}) {
    return {
      id: `user_${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      passwordHash: 'hashed_password',
      firstName: 'Test',
      lastName: 'User',
      role: 'therapist',
      institution: 'Test Clinic',
      licenseNumber: 'TEST123',
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      ...overrides,
    }
  }

  static generateSession(overrides: Partial<any> = {}) {
    return {
      id: `session_${Date.now()}`,
      therapistId: `therapist_${Date.now()}`,
      clientId: `client_${Date.now()}`,
      sessionType: 'individual',
      context: { notes: 'Test session' },
      startedAt: new Date(),
      endedAt: null,
      summary: null,
      state: 'active',
      ...overrides,
    }
  }

  static generateBiasAnalysis(overrides: Partial<any> = {}) {
    return {
      id: `analysis_${Date.now()}`,
      sessionId: `session_${Date.now()}`,
      therapistId: `therapist_${Date.now()}`,
      overallBiasScore: 0.23,
      alertLevel: 'low',
      confidence: 0.89,
      layerResults: {
        preprocessing: { bias_score: 0.15, layer: 'text_preprocessing' },
        fairness: { bias_score: 0.28, layer: 'fairness_analysis' },
        toxicity: { bias_score: 0.18, layer: 'toxicity_detection' },
      },
      recommendations: [
        'Consider more neutral language patterns',
        'Review communication style for potential bias',
      ],
      demographics: {
        gender: 'female',
        ethnicity: 'hispanic',
        age: '35-44',
      },
      contentHash: `hash_${Date.now()}`,
      processingTimeMs: 1250,
      createdAt: new Date(),
      ...overrides,
    }
  }

  static generateAnalyticsData(days: number = 30): Array<{
    date: string
    biasScore: number
    sessionCount: number
    alertCount: number
    minBias: number
    maxBias: number
  }> {
    const data: Array<{
      date: string
      biasScore: number
      sessionCount: number
      alertCount: number
      minBias: number
      maxBias: number
    }> = []
    const now = new Date()

    for (let i = 0; i < days; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)

      data.push({
        date: date.toISOString().split('T')[0],
        biasScore: Math.random() * 0.5 + 0.1, // 0.1 to 0.6 range
        sessionCount: Math.floor(Math.random() * 50) + 10,
        alertCount: Math.floor(Math.random() * 5),
        minBias: Math.random() * 0.2,
        maxBias: Math.random() * 0.4 + 0.3,
      })
    }

    return data
  }

  static generateDemographicData() {
    return [
      {
        gender: 'female',
        ethnicity: 'hispanic',
        ageGroup: '35-44',
        count: 25,
        avgBias: 0.23,
      },
      {
        gender: 'male',
        ethnicity: 'caucasian',
        ageGroup: '25-34',
        count: 18,
        avgBias: 0.31,
      },
      {
        gender: 'female',
        ethnicity: 'asian',
        ageGroup: '45-54',
        count: 12,
        avgBias: 0.18,
      },
      {
        gender: 'male',
        ethnicity: 'african',
        ageGroup: '18-24',
        count: 8,
        avgBias: 0.42,
      },
      {
        gender: 'non-binary',
        ethnicity: 'mixed',
        ageGroup: '55+',
        count: 5,
        avgBias: 0.27,
      },
    ]
  }

  static generateBiasPatterns() {
    return [
      { layer: 'text_preprocessing', avgScore: 0.34, occurrences: 15 },
      { layer: 'fairness_analysis', avgScore: 0.28, occurrences: 22 },
      { layer: 'toxicity_detection', avgScore: 0.19, occurrences: 8 },
      { layer: 'sentiment_analysis', avgScore: 0.41, occurrences: 12 },
      { layer: 'context_awareness', avgScore: 0.25, occurrences: 18 },
    ]
  }
}

// Test Utilities
export class TestUtils {
  static async setupTestDatabase() {
    // This would typically set up a test database
    // For now, we'll use in-memory mocks
    console.log('Setting up test database...')
  }

  static async teardownTestDatabase() {
    // Clean up test database
    console.log('Tearing down test database...')
  }

  static async clearTestData() {
    // Clear all test data
    console.log('Clearing test data...')
  }

  static createMockRequest(body: any = {}, query: any = {}, params: any = {}) {
    return {
      body,
      query,
      params,
      headers: { 'content-type': 'application/json' },
      method: 'POST',
      url: '/api/test',
    }
  }

  static createMockResponse() {
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      end: vi.fn().mockReturnThis(),
    }
    return res
  }

  static async waitForCondition(
    condition: () => boolean,
    timeout: number = 5000,
  ): Promise<void> {
    const startTime = Date.now()

    while (!condition()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Condition not met within timeout')
      }
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }

  static generateRandomString(length: number = 10): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  static generateRandomEmail(): string {
    const username = this.generateRandomString(8)
    const domain = this.generateRandomString(5)
    return `${username}@${domain}.com`
  }

  static generateRandomId(): string {
    return `${this.generateRandomString(8)}-${this.generateRandomString(4)}-${this.generateRandomString(4)}-${this.generateRandomString(4)}-${this.generateRandomString(12)}`
  }
}

// Performance Testing Utilities
export class PerformanceTestUtils {
  static async measureExecutionTime<T>(
    fn: () => Promise<T>,
  ): Promise<{ result: T; executionTime: number }> {
    const startTime = performance.now()
    const result = await fn()
    const executionTime = performance.now() - startTime

    return { result, executionTime }
  }

  static async runLoadTest(
    testFn: () => Promise<any>,
    concurrentUsers: number = 10,
    totalRequests: number = 100,
  ): Promise<{
    totalTime: number
    averageResponseTime: number
    requestsPerSecond: number
    successRate: number
    errors: number
  }> {
    const results: Array<{
      success: boolean
      responseTime: number
      error?: any
    }> = []

    const startTime = Date.now()

    // Run concurrent requests
    const promises = []
    for (let i = 0; i < totalRequests; i++) {
      promises.push(
        this.measureExecutionTime(async () => {
          try {
            await testFn()
            return { success: true }
          } catch (error) {
            return { success: false, error }
          }
        }),
      )
    }

    // Execute in batches to simulate concurrent users
    const batchSize = concurrentUsers
    for (let i = 0; i < promises.length; i += batchSize) {
      const batch = promises.slice(i, i + batchSize)
      const batchResults = await Promise.all(batch)

      batchResults.forEach(({ result, executionTime }) => {
        results.push({
          success: result.success,
          responseTime: executionTime,
          error: result.error,
        })
      })
    }

    const totalTime = Date.now() - startTime
    const successfulRequests = results.filter((r) => r.success).length
    const totalResponseTime = results.reduce(
      (sum, r) => sum + r.responseTime,
      0,
    )

    return {
      totalTime,
      averageResponseTime: totalResponseTime / results.length,
      requestsPerSecond: (results.length / totalTime) * 1000,
      successRate: (successfulRequests / results.length) * 100,
      errors: results.length - successfulRequests,
    }
  }

  static generatePerformanceReport(results: any): string {
    return `
Performance Test Results:
========================
Total Time: ${results.totalTime}ms
Average Response Time: ${results.averageResponseTime.toFixed(2)}ms
Requests/Second: ${results.requestsPerSecond.toFixed(2)}
Success Rate: ${results.successRate.toFixed(2)}%
Errors: ${results.errors}
    `.trim()
  }
}

// Security Testing Utilities
export class SecurityTestUtils {
  static generateXSSPayloads(): string[] {
    return [
      '<script>alert("XSS")</script>',
      '<img src=x onerror=alert("XSS")>',
      '<svg onload=alert("XSS")>',
      'javascript:alert("XSS")',
      '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(\'XSS\')">',
    ]
  }

  static generateSQLInjectionPayloads(): string[] {
    return [
      "' OR '1'='1",
      "'; DROP TABLE users; --",
      "' UNION SELECT * FROM users --",
      "admin' --",
      "1' OR '1' = '1",
      "' OR 1=1 --",
    ]
  }

  static generatePathTraversalPayloads(): string[] {
    return [
      '../../../etc/passwd',
      '..\\..\\..\\windows\\system32\\config\\sam',
      '/etc/passwd',
      'C:\\Windows\\System32\\config\\sam',
      '../../../../etc/shadow',
      '/proc/self/environ',
    ]
  }

  static async testEndpointSecurity(
    endpoint: string,
    method: string = 'GET',
    payloads: string[] = [],
  ): Promise<{
    vulnerable: boolean
    vulnerabilities: string[]
    recommendations: string[]
  }> {
    const vulnerabilities: string[] = []
    const recommendations: string[] = []

    // Test each payload
    for (const payload of payloads) {
      try {
        const response = await fetch(endpoint, {
          method,
          body:
            method !== 'GET' ? JSON.stringify({ input: payload }) : undefined,
          headers: {
            'Content-Type': 'application/json',
          },
        })

        // Check for suspicious responses
        if (response.status === 200) {
          const text = await response.text()
          if (text.includes(payload) || text.includes('alert')) {
            vulnerabilities.push(
              `Potential XSS vulnerability with payload: ${payload}`,
            )
          }
        }
      } catch (error) {
        // Connection errors are expected for some payloads
      }
    }

    if (vulnerabilities.length > 0) {
      recommendations.push('Implement input sanitization')
      recommendations.push('Use Content Security Policy (CSP)')
      recommendations.push('Implement rate limiting')
      recommendations.push('Add input validation and escaping')
    }

    return {
      vulnerable: vulnerabilities.length > 0,
      vulnerabilities,
      recommendations,
    }
  }
}

// Integration Test Helpers
export class IntegrationTestUtils {
  static async startTestServices() {
    // Start test database, Redis, etc.
    console.log('Starting test services...')
  }

  static async stopTestServices() {
    // Stop test services
    console.log('Stopping test services...')
  }

  static async resetTestServices() {
    // Reset test services to clean state
    console.log('Resetting test services...')
  }

  static async waitForService(
    serviceName: string,
    url: string,
    timeout: number = 30000,
  ): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      try {
        const response = await fetch(url)
        if (response.ok) {
          console.log(`${serviceName} is ready`)
          return
        }
      } catch (error) {
        // Service not ready yet
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    throw new Error(`${serviceName} failed to start within ${timeout}ms`)
  }
}

// Export all utilities
export {
  testDbConfig as databaseConfig,
  testRedisConfig as redisConfig,
  MockDataGenerator as mockData,
  TestUtils as testUtils,
  PerformanceTestUtils as performanceTests,
  SecurityTestUtils as securityTests,
  IntegrationTestUtils as integrationTests,
}

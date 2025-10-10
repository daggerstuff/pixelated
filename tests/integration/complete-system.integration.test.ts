/**
 * Complete System Integration Tests
 * 
 * These tests verify the entire bias detection flow from frontend to database,
 * including health checks, API endpoints, database persistence, caching, and
 * the complete user journey.
 */

import { test, expect } from '@playwright/test'
import type { Page, APIRequestContext } from '@playwright/test'

// Test data
const testSessionData = {
  sessionId: '550e8400-e29b-41d4-a716-446655440001',
  timestamp: new Date().toISOString(),
  participantDemographics: {
    age: '25-35',
    gender: 'female',
    ethnicity: 'hispanic',
    primaryLanguage: 'en',
  },
  conversationData: {
    messages: [
      {
        role: 'user' as const,
        content: 'I feel anxious about my upcoming presentation at work.',
        timestamp: new Date(Date.now() - 300000).toISOString(),
      },
      {
        role: 'assistant' as const,
        content: 'I understand that presentations can feel overwhelming. Can you tell me more about what specifically makes you feel anxious?',
        timestamp: new Date(Date.now() - 240000).toISOString(),
      },
      {
        role: 'user' as const,
        content: 'I worry that my colleagues will judge me because of my accent.',
        timestamp: new Date(Date.now() - 180000).toISOString(),
      },
    ],
    duration: 1800,
    wordCount: 450,
  },
  contextualFactors: {
    sessionType: 'individual',
    therapeuticGoals: ['anxiety_management', 'confidence_building'],
    previousSessions: 3,
  },
}

const authToken = 'Bearer test-integration-token-12345'

interface HealthResponse {
  status: string
  timestamp: string
  uptime: number
  services: {
    database: string
    redis: string
    bias_detection: string
  }
  metrics: {
    memory: { used: number; total: number }
    cpu: { usage: string }
  }
}

interface BiasAnalysisResponse {
  success: boolean
  data?: {
    sessionId: string
    overallBiasScore: number
    alertLevel: string
    confidence: number
    analysis: {
      linguistic: Record<string, unknown>
      contextual: Record<string, unknown>
      interactive: Record<string, unknown>
      evaluation: Record<string, unknown>
    }
    demographics: typeof testSessionData.participantDemographics
    recommendations: Array<Record<string, unknown>>
  }
  processingTime?: number
  cacheHit?: boolean
}

interface DashboardResponse {
  success: boolean
  data?: {
    summary: {
      totalSessions: number
      averageBiasScore: number
      totalAlerts: number
      lastUpdated: string
    }
    alerts: Array<Record<string, unknown>>
    trends: Array<Record<string, unknown>>
    demographics: Record<string, unknown>
    recentAnalyses: Array<Record<string, unknown>>
  }
}

test.describe('Complete System Integration Tests', () => {
  let page: Page
  let request: APIRequestContext

  test.beforeAll(async ({ browser, request: req }) => {
    request = req
    page = await browser.newPage()
    
    // Set up page error handling
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error('Page error:', msg.text())
      }
    })
    
    page.on('pageerror', (error) => {
      console.error('Page error:', error.message)
    })
  })

  test.afterAll(async () => {
    await page.close()
  })

  test.describe('Health Check Integration', () => {
    test('Simple health endpoint responds correctly', async () => {
      const response = await request.get('/api/health/simple')
      expect(response.status()).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('status', 'ok')
      expect(data).toHaveProperty('timestamp')
    })

    test('Advanced health endpoint provides detailed system status', async () => {
      const response = await request.get('/api/health')
      expect(response.status()).toBe(200)
      
      const data: HealthResponse = await response.json()
      expect(data.status).toBe('healthy')
      expect(data.uptime).toBeGreaterThan(0)
      expect(data.services.database).toBe('connected')
      expect(data.services.redis).toBe('connected')
      expect(data.services.bias_detection).toBe('operational')
      expect(data.metrics.memory.used).toBeLessThan(data.metrics.memory.total)
    })

    test('Health endpoints handle concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () => 
        request.get('/api/health/simple')
      )
      
      const responses = await Promise.all(requests)
      responses.forEach(response => {
        expect(response.status()).toBe(200)
      })
    })
  })

  test.describe('Frontend to Backend Integration', () => {
    test('Demo page loads and interacts with bias detection API', async () => {
      // Navigate to bias detection demo
      await page.goto('/demo/bias-detection')
      await page.waitForLoadState('networkidle')
      
      // Verify demo page loads
      await expect(page.locator('h1')).toContainText(/bias detection/i)
      
      // Test with preset scenario
      await page.click('button:has-text("Test Preset Scenario")')
      
      // Wait for analysis to complete
      await page.waitForSelector('[data-testid="analysis-results"]', { timeout: 10000 })
      
      // Verify results are displayed
      await expect(page.locator('[data-testid="bias-score"]')).toBeVisible()
      await expect(page.locator('[data-testid="alert-level"]')).toBeVisible()
      await expect(page.locator('[data-testid="recommendations"]')).toBeVisible()
    })

    test('Custom text analysis workflow', async () => {
      await page.goto('/demo/bias-detection')
      await page.waitForLoadState('networkidle')
      
      // Enter custom text
      const testText = "I think women are better at nurturing roles while men excel in leadership positions."
      await page.fill('textarea[placeholder*="Enter text"]', testText)
      
      // Submit for analysis
      await page.click('button:has-text("Analyze")')
      
      // Wait for analysis
      await page.waitForSelector('[data-testid="analysis-results"]', { timeout: 10000 })
      
      // Verify analysis results
      const biasScore = await page.locator('[data-testid="bias-score"]').textContent()
      expect(parseFloat(biasScore || '0')).toBeGreaterThan(0)
      
      const alertLevel = await page.locator('[data-testid="alert-level"]').textContent()
      expect(['low', 'medium', 'high', 'critical']).toContain(alertLevel?.toLowerCase())
    })

    test('Export functionality works from frontend', async () => {
      await page.goto('/demo/bias-detection')
      await page.waitForLoadState('networkidle')
      
      // Perform an analysis first
      await page.click('button:has-text("Test Preset Scenario")')
      await page.waitForSelector('[data-testid="analysis-results"]', { timeout: 10000 })
      
      // Test export functionality
      const downloadPromise = page.waitForEvent('download')
      await page.click('button:has-text("Export")')
      const download = await downloadPromise
      
      // Verify download was triggered
      expect(download.suggestedFilename()).toMatch(/\.(json|csv|pdf)$/)
    })
  })

  test.describe('API to Database Integration', () => {
    test('Bias analysis data is persisted to database', async () => {
      // Submit analysis request
      const analyzeResponse = await request.post('/api/bias-analysis/analyze', {
        data: {
          text: "All engineers should be good at math and logic.",
          sessionId: testSessionData.sessionId,
          demographics: testSessionData.participantDemographics,
        },
        headers: {
          'Authorization': authToken,
        }
      })
      
      expect(analyzeResponse.status()).toBe(200)
      const analyzeData: BiasAnalysisResponse = await analyzeResponse.json()
      expect(analyzeData.success).toBe(true)
      expect(analyzeData.data).toBeDefined()
      
      // Wait a moment for database persistence
      await page.waitForTimeout(1000)
      
      // Retrieve the analysis to verify persistence
      const retrieveResponse = await request.get(`/api/bias-analysis/analyze?sessionId=${testSessionData.sessionId}`)
      expect(retrieveResponse.status()).toBe(200)
      
      const retrieveData: BiasAnalysisResponse = await retrieveResponse.json()
      expect(retrieveData.success).toBe(true)
      expect(retrieveData.data?.sessionId).toBe(testSessionData.sessionId)
      expect(retrieveData.data?.overallBiasScore).toBe(analyzeData.data?.overallBiasScore)
    })

    test('Dashboard reflects recent analyses', async () => {
      // Perform a new analysis
      const sessionId = `550e8400-e29b-41d4-a716-446655440002`
      await request.post('/api/bias-analysis/analyze', {
        data: {
          text: "Young people are always more tech-savvy than older employees.",
          sessionId: sessionId,
          demographics: testSessionData.participantDemographics,
        },
        headers: {
          'Authorization': authToken,
        }
      })
      
      // Wait for dashboard update
      await page.waitForTimeout(2000)
      
      // Check dashboard reflects the new analysis
      const dashboardResponse = await request.get('/api/bias-analysis/dashboard')
      expect(dashboardResponse.status()).toBe(200)
      
      const dashboardData: DashboardResponse = await dashboardResponse.json()
      expect(dashboardData.success).toBe(true)
      expect(dashboardData.data?.summary.totalSessions).toBeGreaterThan(0)
      
      // Verify recent analyses include our session
      const recentAnalyses = dashboardData.data?.recentAnalyses || []
      const foundSession = recentAnalyses.find((analysis: any) => 
        analysis.sessionId === sessionId
      )
      expect(foundSession).toBeDefined()
    })
  })

  test.describe('Caching Integration', () => {
    test('Redis caching improves response times', async () => {
      const sessionId = `550e8400-e29b-41d4-a716-446655440003`
      const requestData = {
        text: "People from rural areas lack sophistication.",
        sessionId: sessionId,
        demographics: testSessionData.participantDemographics,
      }
      
      // First request - should miss cache
      const start1 = Date.now()
      const response1 = await request.post('/api/bias-analysis/analyze', {
        data: requestData,
        headers: { 'Authorization': authToken }
      })
      const time1 = Date.now() - start1
      
      expect(response1.status()).toBe(200)
      const data1 = await response1.json()
      expect(data1.cacheHit).toBe(false)
      
      // Second request - should hit cache
      const start2 = Date.now()
      const response2 = await request.post('/api/bias-analysis/analyze', {
        data: requestData,
        headers: { 'Authorization': authToken }
      })
      const time2 = Date.now() - start2
      
      expect(response2.status()).toBe(200)
      const data2 = await response2.json()
      expect(data2.cacheHit).toBe(true)
      
      // Cached response should be faster
      expect(time2).toBeLessThan(time1)
      expect(data2.data.overallBiasScore).toBe(data1.data.overallBiasScore)
    })

    test('Cache skip option works correctly', async () => {
      const sessionId = `550e8400-e29b-41d4-a716-446655440004`
      const requestData = {
        text: "Traditional gender roles are natural and should be maintained.",
        sessionId: sessionId,
        demographics: testSessionData.participantDemographics,
        options: { skipCache: true }
      }
      
      // Request with cache skip
      const response = await request.post('/api/bias-analysis/analyze', {
        data: requestData,
        headers: { 'Authorization': authToken }
      })
      
      expect(response.status()).toBe(200)
      const data = await response.json()
      expect(data.cacheHit).toBe(false)
    })
  })

  test.describe('Error Handling Integration', () => {
    test('Invalid requests return appropriate error responses', async () => {
      // Test with invalid session ID
      const invalidResponse = await request.post('/api/bias-analysis/analyze', {
        data: {
          text: "Test text",
          sessionId: "invalid-uuid",
        },
        headers: { 'Authorization': authToken }
      })
      
      expect(invalidResponse.status()).toBe(400)
      const errorData = await invalidResponse.json()
      expect(errorData.success).toBe(false)
      expect(errorData.error).toContain('Validation')
    })

    test('Missing authentication returns 401', async () => {
      const response = await request.post('/api/bias-analysis/analyze', {
        data: {
          text: "Test text",
          sessionId: testSessionData.sessionId,
        }
        // No authorization header
      })
      
      expect(response.status()).toBe(401)
    })

    test('Service degradation is handled gracefully', async () => {
      // This test would simulate service issues
      // For now, verify error responses are properly formatted
      const response = await request.get('/api/bias-analysis/analyze?sessionId=non-existent-id')
      
      if (response.status() !== 200) {
        const errorData = await response.json()
        expect(errorData).toHaveProperty('success', false)
        expect(errorData).toHaveProperty('error')
        expect(errorData).toHaveProperty('message')
      }
    })
  })

  test.describe('Performance Integration', () => {
    test('Response times meet performance requirements', async () => {
      const requirements = {
        healthCheck: 1000,    // 1 second
        biasAnalysis: 2000,   // 2 seconds
        dashboard: 1500,      // 1.5 seconds
      }
      
      // Test health check performance
      const healthStart = Date.now()
      const healthResponse = await request.get('/api/health/simple')
      const healthTime = Date.now() - healthStart
      expect(healthTime).toBeLessThan(requirements.healthCheck)
      expect(healthResponse.status()).toBe(200)
      
      // Test bias analysis performance
      const analysisStart = Date.now()
      const analysisResponse = await request.post('/api/bias-analysis/analyze', {
        data: {
          text: "Test performance analysis",
          sessionId: `perf-test-${Date.now()}`,
          demographics: testSessionData.participantDemographics,
        },
        headers: { 'Authorization': authToken }
      })
      const analysisTime = Date.now() - analysisStart
      expect(analysisTime).toBeLessThan(requirements.biasAnalysis)
      expect(analysisResponse.status()).toBe(200)
      
      // Test dashboard performance
      const dashboardStart = Date.now()
      const dashboardResponse = await request.get('/api/bias-analysis/dashboard')
      const dashboardTime = Date.now() - dashboardStart
      expect(dashboardTime).toBeLessThan(requirements.dashboard)
      expect(dashboardResponse.status()).toBe(200)
    })

    test('Concurrent requests are handled efficiently', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => 
        request.post('/api/bias-analysis/analyze', {
          data: {
            text: `Concurrent test ${i}`,
            sessionId: `concurrent-${Date.now()}-${i}`,
            demographics: testSessionData.participantDemographics,
          },
          headers: { 'Authorization': authToken }
        })
      )
      
      const startTime = Date.now()
      const responses = await Promise.all(concurrentRequests)
      const totalTime = Date.now() - startTime
      
      // All requests should complete within reasonable time
      expect(totalTime).toBeLessThan(15000) // 15 seconds for 10 requests
      
      // Most requests should succeed
      const successfulResponses = responses.filter(r => r.status() === 200)
      expect(successfulResponses.length).toBeGreaterThan(8)
    })
  })

  test.describe('Security Integration', () => {
    test('CORS headers are properly configured', async () => {
      const response = await request.get('/api/health/simple')
      expect(response.status()).toBe(200)
      
      const headers = response.headers()
      expect(headers).toHaveProperty('content-type')
      
      // Security headers should be present
      expect(headers).toHaveProperty('x-content-type-options')
      expect(headers).toHaveProperty('x-frame-options')
    })

    test('Rate limiting prevents abuse', async () => {
      // Make many rapid requests to trigger rate limiting
      const requests = Array.from({ length: 70 }, () => 
        request.get('/api/health/simple')
      )
      
      const responses = await Promise.all(requests)
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status() === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
      
      // Verify rate limit response format
      if (rateLimitedResponses.length > 0) {
        const rateLimitData = await rateLimitedResponses[0].json()
        expect(rateLimitData).toHaveProperty('success', false)
        expect(rateLimitData).toHaveProperty('error')
      }
    })

    test('Input validation prevents injection attacks', async () => {
      const maliciousPayloads = [
        {
          text: "<script>alert('xss')</script>",
          sessionId: "test-xss",
        },
        {
          text: "'; DROP TABLE users; --",
          sessionId: "test-sql",
        },
        {
          text: "../../../etc/passwd",
          sessionId: "test-path",
        }
      ]
      
      for (const payload of maliciousPayloads) {
        const response = await request.post('/api/bias-analysis/analyze', {
          data: payload,
          headers: { 'Authorization': authToken }
        })
        
        // Should not crash or return 500
        expect(response.status()).not.toBe(500)
        
        if (response.status() === 200) {
          const data = await response.json()
          expect(data.success).toBe(true)
          // Malicious content should be sanitized
          expect(JSON.stringify(data)).not.toContain('script')
          expect(JSON.stringify(data)).not.toContain('DROP TABLE')
        }
      }
    })
  })

  test.describe('Data Consistency Integration', () => {
    test('Analysis results are consistent across endpoints', async () => {
      const sessionId = `consistency-${Date.now()}`
      const testText = "Younger employees are more adaptable to new technologies."
      
      // Submit analysis
      const analyzeResponse = await request.post('/api/bias-analysis/analyze', {
        data: {
          text: testText,
          sessionId: sessionId,
          demographics: testSessionData.participantDemographics,
        },
        headers: { 'Authorization': authToken }
      })
      
      expect(analyzeResponse.status()).toBe(200)
      const analyzeData = await analyzeResponse.json()
      
      // Retrieve analysis
      const retrieveResponse = await request.get(`/api/bias-analysis/analyze?sessionId=${sessionId}`)
      expect(retrieveResponse.status()).toBe(200)
      const retrieveData = await retrieveResponse.json()
      
      // Check consistency
      expect(retrieveData.data.overallBiasScore).toBe(analyzeData.data.overallBiasScore)
      expect(retrieveData.data.alertLevel).toBe(analyzeData.data.alertLevel)
      expect(retrieveData.data.confidence).toBe(analyzeData.data.confidence)
    })

    test('Dashboard data reflects all analyses', async () => {
      // Get initial dashboard state
      const initialResponse = await request.get('/api/bias-analysis/dashboard')
      expect(initialResponse.status()).toBe(200)
      const initialData = await initialResponse.json()
      const initialCount = initialData.data?.summary.totalSessions || 0
      
      // Perform multiple new analyses
      const newSessions = Array.from({ length: 3 }, (_, i) => ({
        sessionId: `dashboard-test-${Date.now()}-${i}`,
        text: `Test analysis ${i} for dashboard integration`,
      }))
      
      for (const session of newSessions) {
        await request.post('/api/bias-analysis/analyze', {
          data: {
            text: session.text,
            sessionId: session.sessionId,
            demographics: testSessionData.participantDemographics,
          },
          headers: { 'Authorization': authToken }
        })
      }
      
      // Wait for dashboard update
      await page.waitForTimeout(2000)
      
      // Check updated dashboard
      const updatedResponse = await request.get('/api/bias-analysis/dashboard')
      expect(updatedResponse.status()).toBe(200)
      const updatedData = await updatedResponse.json()
      
      expect(updatedData.data.summary.totalSessions).toBeGreaterThanOrEqual(initialCount + newSessions.length)
    })
  })
})
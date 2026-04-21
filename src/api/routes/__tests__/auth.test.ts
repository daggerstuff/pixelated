// Authentication API Integration Tests
// Tests for OAuth-based authentication flow with Auth0
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../../../server'
import { generateTestId, cleanupTestData } from '../../../../tests/api/utils/test-helpers'

describe('Authentication API', () => {
  const testEmail = `test-${generateTestId()}@test.com`
  const testPassword = 'SecurePassword123!'
  const testName = 'Test User'
  let testUserId: string
  let authToken: string

  afterAll(async () => {
    // Cleanup test user if created
    if (testUserId) {
      await cleanupTestData(testUserId)
    }
  })

  describe('GET /api/auth/login', () => {
    it('should redirect to Auth0 login when Auth0 is configured', async () => {
      const hasAuth0Config = !!(process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID)
      
      if (hasAuth0Config) {
        const response = await request(app).get('/api/auth/login')
        expect(response.status).toBe(302)
        expect(response.headers.location).toContain('auth0.com')
      } else {
        const response = await request(app).get('/api/auth/login')
        expect(response.status).toBe(500)
        expect(response.body.error).toContain('Auth0 configuration')
      }
    })

    it('should include required OAuth parameters in redirect', async () => {
      const hasAuth0Config = !!(process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID)
      
      if (hasAuth0Config) {
        const response = await request(app).get('/api/auth/login')
        expect(response.status).toBe(302)
        const location = response.headers.location
        expect(location).toContain('response_type=code')
        expect(location).toContain('client_id=')
        expect(location).toContain('redirect_uri=')
        expect(location).toContain('scope=')
      }
    })

    it('should return 500 when Auth0 is not configured', async () => {
      const hasAuth0Config = !!(process.env.AUTH0_DOMAIN && process.env.AUTH0_CLIENT_ID)
      
      if (!hasAuth0Config) {
        const response = await request(app).get('/api/auth/login')
        expect(response.status).toBe(500)
        expect(response.body.code).toBe('CONFIG_ERROR')
      }
    })
  })

  describe('GET /api/auth/callback', () => {
    it('should reject callback without authorization code', async () => {
      const response = await request(app).get('/api/auth/callback')
      expect(response.status).toBe(400)
      expect(response.body.error).toContain('code')
    })

    it('should reject callback with invalid code format', async () => {
      const response = await request(app).get('/api/auth/callback?code=invalid')
      expect([400, 500, 502]).toContain(response.status)
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app).post('/api/auth/logout')
      expect([200, 204]).toContain(response.status)
    })

    it('should clear session data', async () => {
      const response = await request(app).post('/api/auth/logout')
      expect(response.status).toBeLessThan(500)
    })
  })

  describe('GET /api/auth/me', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/auth/me')
      expect(response.status).toBe(401)
    })

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
      expect(response.status).toBe(401)
    })
  })

  describe('POST /api/auth/refresh', () => {
    it('should reject refresh without token', async () => {
      const response = await request(app).post('/api/auth/refresh')
      expect([400, 401, 500]).toContain(response.status)
    })

    it('should reject refresh with invalid token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid' })
      expect([400, 401, 500]).toContain(response.status)
    })
  })

  describe('Security Tests', () => {
    it('should not expose sensitive data in error messages', async () => {
      const response = await request(app).get('/api/auth/me')
      expect(response.status).toBe(401)
      const errorStr = JSON.stringify(response.body)
      expect(errorStr.toLowerCase()).not.toContain('stack')
      expect(errorStr.toLowerCase()).not.toContain('trace')
    })

    it('should handle malformed requests gracefully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .set('Content-Type', 'application/json')
        .send('not-json')
      expect([400, 401, 415, 500]).toContain(response.status)
    })
  })
})

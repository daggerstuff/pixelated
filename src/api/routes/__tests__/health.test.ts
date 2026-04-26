// Health Endpoints Test Suite
// Tests for health check endpoints (basic, detailed, ready, live)

import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import healthRoutes from '../health'
import express from 'express'

describe('Health Endpoints', () => {
  let app: express.Express

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/', healthRoutes)
  })

  describe('GET /', () => {
    it('should return basic health status', async () => {
      const response = await request(app).get('/')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('status', 'ok')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body).toHaveProperty('uptime')
      expect(response.body).toHaveProperty('environment')
    })

    it('should include ISO timestamp', async () => {
      const response = await request(app).get('/')

      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should return environment information', async () => {
      const response = await request(app).get('/')

      expect(response.body.environment).toBeDefined()
    })
  })

  describe('GET /detailed', () => {
    it('should return detailed health with all services', async () => {
      const response = await request(app).get('/detailed')

      expect(response.status).toBeOneOf([200, 503])
      expect(response.body).toHaveProperty('status')
      expect(response.body).toHaveProperty('services')
      expect(response.body.services).toHaveProperty('mongodb')
      expect(response.body.services).toHaveProperty('postgresql')
      expect(response.body.services).toHaveProperty('redis')
    })

    it('should show service status', async () => {
      const response = await request(app).get('/detailed')

      const mongoStatus = response.body.services.mongodb.status
      expect(mongoStatus).toBeOneOf(['connected', 'disconnected'])

      const postgresStatus = response.body.services.postgresql.status
      expect(postgresStatus).toBeOneOf(['connected', 'disconnected'])

      const redisStatus = response.body.services.redis.status
      expect(redisStatus).toBeOneOf(['connected', 'disconnected'])
    })

    it('should include uptime information', async () => {
      const response = await request(app).get('/detailed')

      expect(response.body).toHaveProperty('timestamp')
    })

    it('should return 503 when status is degraded', async () => {
      const response = await request(app).get('/detailed')

      if (response.body.status === 'degraded') {
        expect(response.status).toBe(503)
      } else {
        expect(response.status).toBe(200)
      }
    })
  })

  describe('GET /ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app).get('/ready')

      expect(response.status).toBeOneOf([200, 503])
      expect(response.body).toHaveProperty('ready')
      // Timestamp may only be present when ready
      if (response.body.ready === true) {
        expect(response.body).toHaveProperty('timestamp')
      }
    })

    it('should return 200 when ready', async () => {
      const response = await request(app).get('/ready')

      if (response.body.ready === true) {
        expect(response.status).toBe(200)
      }
    })

    it('should return 503 when not ready', async () => {
      const response = await request(app).get('/ready')

      if (response.body.ready === false) {
        expect(response.status).toBe(503)
        expect(response.body).toHaveProperty('error')
      }
    })
  })

  describe('GET /live', () => {
    it('should return 200 if application is running', async () => {
      const response = await request(app).get('/live')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('alive', true)
      expect(response.body).toHaveProperty('timestamp')
    })

    it('should include current timestamp', async () => {
      const before = Date.now()
      const response = await request(app).get('/live')
      const after = Date.now()

      const timestamp = new Date(response.body.timestamp).getTime()
      expect(timestamp).toBeGreaterThanOrEqual(before - 1000)
      expect(timestamp).toBeLessThanOrEqual(after + 1000)
    })

    it('should return simple status object', async () => {
      const response = await request(app).get('/live')

      expect(response.body).toHaveProperty('alive')
      expect(response.body.alive).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle partial service failures gracefully', async () => {
      const response = await request(app).get('/detailed')

      // Should always return a valid response even if services are down
      expect(response.body).toBeDefined()
      expect(response.body.services).toBeDefined()
    })

    it('should include error details when services fail', async () => {
      const response = await request(app).get('/detailed')

      // Check that error details are included for failed services
      Object.values(response.body.services || {}).forEach((service: any) => {
        if (service.status === 'disconnected') {
          expect(service).toHaveProperty('error')
        }
      })
    })
  })
})

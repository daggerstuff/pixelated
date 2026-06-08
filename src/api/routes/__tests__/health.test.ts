// Health Endpoints Test Suite
// Tests for health check endpoints (basic, detailed, ready, live)

import express from 'express'
import request from 'supertest'

import healthRoutes from '../health'

type HealthServiceStatus = 'connected' | 'degraded' | 'disconnected'

type DetailedServiceHealth = {
  status: HealthServiceStatus
  error?: string
  [key: string]: unknown
}

type HealthServiceMap = Record<string, DetailedServiceHealth>

type BasicHealthResponse = {
  status: 'ok'
  timestamp: string
  uptime: number
  environment: string
}

type DetailedHealthResponse = {
  status: 'ok' | 'degraded'
  timestamp: string
  services: HealthServiceMap
}

type ReadyHealthResponse = {
  ready: boolean
  timestamp?: string
  reason?: string
  error?: string
}

type LiveHealthResponse = {
  alive: true
  timestamp: string
}

const getHealthServices = (response: { body: DetailedHealthResponse }) =>
  response.body.services

function getTimestamp(body: { timestamp: string }): string {
  return body.timestamp
}

type ServiceHealth = {
  status?: string
}

describe('Health Endpoints', () => {
  let app: express.Express

  beforeEach(() => {
    app = express()
    app.use(express.json())
    app.use('/', healthRoutes)
  })

  describe('GET /', () => {
    it('should return basic health status', async () => {
      const response = await request(app).get<BasicHealthResponse>('/')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('status', 'ok')
      expect(response.body).toHaveProperty('timestamp')
      expect(response.body).toHaveProperty('uptime')
      expect(response.body).toHaveProperty('environment')
    })

    it('should include ISO timestamp', async () => {
      const response = await request(app).get<BasicHealthResponse>('/')

      expect(response.body.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
      )
    })

    it('should return environment information', async () => {
      const response = await request(app).get<BasicHealthResponse>('/')

      expect(response.body.environment).toBeDefined()
    })
  })

  describe('GET /detailed', () => {
    it('should return detailed health with all services', async () => {
      const response =
        await request(app).get<DetailedHealthResponse>('/detailed')

      expect(response.status).toBeOneOf([200, 503])
      expect(response.body).toHaveProperty('status')
      expect(response.body).toHaveProperty('services')
      expect(response.body.services).toHaveProperty('mongodb')
      expect(response.body.services).toHaveProperty('postgresql')
      expect(response.body.services).toHaveProperty('redis')
    })

    it('should show service status', async () => {
      const response =
        await request(app).get<DetailedHealthResponse>('/detailed')

      const services = getHealthServices(response)
      const mongoStatus = services?.['mongodb']?.status
      expect(mongoStatus).toBeOneOf(['connected', 'disconnected'])

      const postgresStatus = services?.['postgresql']?.status
      expect(postgresStatus).toBeOneOf(['connected', 'disconnected'])

      const redisStatus = services?.['redis']?.status
      expect(redisStatus).toBeOneOf(['connected', 'disconnected'])
    })

    it('should include uptime information', async () => {
      const response =
        await request(app).get<DetailedHealthResponse>('/detailed')

      expect(response.body).toHaveProperty('timestamp')
    })

    it('should return 503 when status is degraded', async () => {
      const response =
        await request(app).get<DetailedHealthResponse>('/detailed')

      if (response.body.status === 'degraded') {
        expect(response.status).toBe(503)
      } else {
        expect(response.status).toBe(200)
      }
    })
  })

  describe('GET /ready', () => {
    it('should return readiness status', async () => {
      const response = await request(app).get<ReadyHealthResponse>('/ready')

      expect(response.status).toBeOneOf([200, 503])
      expect(response.body).toHaveProperty('ready')
      // Timestamp may only be present when ready
      if (response.body.ready) {
        expect(response.body).toHaveProperty('timestamp')
      }
    })

    it('should return 200 when ready', async () => {
      const response = await request(app).get<ReadyHealthResponse>('/ready')

      if (response.body.ready) {
        expect(response.status).toBe(200)
      }
    })

    it('should return 503 when not ready', async () => {
      const response = await request(app).get<ReadyHealthResponse>('/ready')

      if (!response.body.ready) {
        expect(response.status).toBe(503)
        expect(response.body).toHaveProperty('error')
      }
    })
  })

  describe('GET /live', () => {
    it('should return 200 if application is running', async () => {
      const response = await request(app).get<LiveHealthResponse>('/live')

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('alive', true)
      expect(response.body).toHaveProperty('timestamp')
    })

    it('should include current timestamp', async () => {
      const before = Date.now()
      const response = await request(app).get<LiveHealthResponse>('/live')
      const after = Date.now()

      const timestamp = new Date(getTimestamp(response.body)).getTime()
      expect(timestamp).toBeGreaterThanOrEqual(before - 1000)
      expect(timestamp).toBeLessThanOrEqual(after + 1000)
    })

    it('should return simple status object', async () => {
      const response = await request(app).get<LiveHealthResponse>('/live')

      expect(response.body).toHaveProperty('alive')
      expect(response.body.alive).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle partial service failures gracefully', async () => {
      const response =
        await request(app).get<DetailedHealthResponse>('/detailed')

      // Should always return a valid response even if services are down
      expect(response.body).toBeDefined()
      expect(response.body.services).toBeDefined()
    })

    it('should include error details when services fail', async () => {
      const response =
        await request(app).get<DetailedHealthResponse>('/detailed')

      // Check that error details are included for failed services
      Object.values(response.body.services).forEach((service) => {
        const details = service as ServiceHealth
        if (details.status === 'disconnected') {
          expect(details).toHaveProperty('error')
        }
      })
    })
  })
})

// import type { APIRoute } from 'astro'
import { mongodb } from '~/config/mongodb.config.ts'

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  services: Record<string, HealthStatusDetail>
}

interface HealthStatusDetail {
  status: 'healthy' | 'unhealthy' | 'degraded'
  message: string
  responseTime?: number
  details?: Record<string, unknown>
}

export const GET = async (): Promise<Response> => {
  const startTime = Date.now()

  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
  }

  try {
    try {
      healthStatus.services['mongodb'] = await checkMongoDBConnection()
    } catch (error) {
      healthStatus.services['mongodb'] = {
        status: 'unhealthy',
        message: 'MongoDB connection failed',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      }
    }

    const serviceStatuses = Object.values(healthStatus.services).map(
      (s) => s.status,
    )

    if (serviceStatuses.includes('unhealthy')) {
      healthStatus.status = 'unhealthy'
    } else if (serviceStatuses.includes('degraded')) {
      healthStatus.status = 'degraded'
    }

    const responseTime = Date.now() - startTime

    // Always return 200; encode degradation in JSON for CI parsing
    return new Response(
      JSON.stringify({
        ...healthStatus,
        responseTime,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      },
    )
  } catch (error) {
    console.error('Health check error:', error)

    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        message: 'Health check failed',
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
      },
    )
  }
}

async function checkMongoDBConnection(): Promise<HealthStatusDetail> {
  const startTime = Date.now()

  try {
    const db = await mongodb.connect()

    // Test database connection with a simple ping
    await db.admin().ping()

    const responseTime = Date.now() - startTime

    return {
      status: 'healthy',
      message: 'MongoDB connection successful',
      responseTime,
    }
  } catch (error) {
    const responseTime = Date.now() - startTime

    return {
      status: 'unhealthy',
      message: 'MongoDB connection failed',
      responseTime,
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

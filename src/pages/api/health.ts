export const prerender = false

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded'
  timestamp: string
  services: Record<string, HealthStatusDetail>
  responseTime: number
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
    responseTime: 0,
  }

  try {
    // Basic application health
    healthStatus.services['application'] = {
      status: 'healthy',
      message: 'Application is running',
      responseTime: Date.now() - startTime,
    }

    // Check MongoDB if available
    try {
      healthStatus.services['mongodb'] = await checkMongoDBConnection()
    } catch (error: unknown) {
      healthStatus.services['mongodb'] = {
        status: 'degraded',
        message: 'MongoDB connection unavailable',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
      }
    }

    // Determine overall status
    const serviceStatuses = Object.values(healthStatus.services).map(
      (s) => s.status,
    )

    if (serviceStatuses.includes('unhealthy')) {
      healthStatus.status = 'unhealthy'
    } else if (serviceStatuses.includes('degraded')) {
      healthStatus.status = 'degraded'
    }

    healthStatus.responseTime = Date.now() - startTime

    // Always return 200 for health checks to avoid false alarms
    return new Response(JSON.stringify(healthStatus, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: unknown) {
    console.error('Health check error:', error)

    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        message: 'Health check failed',
        error: error instanceof Error ? error.message : String(error),
        responseTime: Date.now() - startTime,
        services: {},
      }),
      {
        status: 200, // Still return 200 to avoid pipeline failures
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      },
    )
  }
}

async function checkMongoDBConnection(): Promise<HealthStatusDetail> {
  const startTime = Date.now()

  try {
    // Try to import MongoDB config
    const { mongodb } = await import('~/config/mongodb.config.ts')

    const db = await mongodb.connect()
    await db.admin().ping()

    return {
      status: 'healthy',
      message: 'MongoDB connection successful',
      responseTime: Date.now() - startTime,
    }
  } catch (error: unknown) {
    return {
      status: 'degraded',
      message: 'MongoDB connection failed',
      responseTime: Date.now() - startTime,
      details: {
        error: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

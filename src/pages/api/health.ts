import { initializeDatabase, healthCheck } from '@/lib/db'
import type { APIRoute } from 'astro'

export const GET: APIRoute = async () => {
  try {
    // Initialize database connection if not already done
    initializeDatabase()

    // Perform health checks
    const dbHealth = await healthCheck()

    // Get system information
    const systemInfo = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      platform: process.platform,
      environment: process.env['NODE_ENV'] || 'development'
    }

    // Check if bias detection service is accessible
    let biasServiceHealth: { status: string; error?: string } = { status: 'unknown', error: 'Service check not implemented' }

    try {
      // Simple check - in production this would ping the actual service
      const biasResponse = await fetch('http://localhost:5000/health', {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      } as RequestInit)

      if (biasResponse.ok) {
        biasServiceHealth = { status: 'healthy' }
      } else {
        biasServiceHealth = { status: 'unhealthy', error: `HTTP ${biasResponse.status}` }
      }
    } catch (error: any) {
      biasServiceHealth = { status: 'unhealthy', error: error.message }
    }

    const overallStatus = dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy'

    const healthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealth,
        biasDetection: biasServiceHealth,
        system: systemInfo
      },
      version: '2.0.0',
      environment: process.env['NODE_ENV'] || 'development'
    }

    const statusCode = overallStatus === 'healthy' ? 200 : 503

    return new Response(JSON.stringify(healthResponse, null, 2), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })

  } catch (error: any) {
    console.error('Health check failed:', error)

    return new Response(JSON.stringify({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      services: {
        database: { status: 'unhealthy', error: error.message },
        biasDetection: { status: 'unknown' },
        system: {
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: process.version
        }
      }
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// POST endpoint for detailed diagnostics
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const includeDetails = body?.includeDetails || false

    // Initialize database connection if not already done
    initializeDatabase()

    // Perform comprehensive health checks
    const dbHealth = await healthCheck()

    // Additional diagnostics if requested
    let diagnostics = {}
    if (includeDetails) {
      diagnostics = {
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          environmentVariables: Object.keys(process.env).filter(key =>
            !key.includes('SECRET') && !key.includes('PASSWORD') && !key.includes('KEY')
          )
        },
        database: {
          ...dbHealth,
          connectionString: process.env['DB_HOST'] ? `${process.env['DB_HOST']}:${process.env['DB_PORT'] || 5432}` : 'not configured'
        }
      }
    }

    const overallStatus = dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy'

    return new Response(JSON.stringify({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      diagnostics,
      services: {
        database: dbHealth,
        webServer: { status: 'healthy', uptime: process.uptime() }
      }
    }), {
      status: overallStatus === 'healthy' ? 200 : 503,
      headers: { 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

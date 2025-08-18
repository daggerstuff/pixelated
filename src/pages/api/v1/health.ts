// import type { APIRoute } from 'astro'
import { healthMonitor } from '../../../lib/services/health-monitor'

export const GET = async () => {
  try {
    const health = await healthMonitor.getHealth()
    
    // Return appropriate HTTP status based on health
    const httpStatus = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503
    
    return new Response(JSON.stringify(health, null, 2), {
      status: httpStatus,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    })
  } catch (error: unknown) {
    const errorResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? String(error) : 'Health check failed',
      uptime: process.uptime(),
      responseTime: 0,
      checks: [],
      system: {
        memory: { total: 0, free: 0, used: 0, usagePercent: 0 },
        cpu: { cores: 0, loadAverage: [0, 0, 0], model: 'Unknown' },
        platform: 'unknown',
        nodeVersion: process.version
      }
    }
    
    return new Response(JSON.stringify(errorResponse, null, 2), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  }
}

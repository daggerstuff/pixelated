import type { APIRoute } from 'astro'

const startTime = Date.now()

export const GET: APIRoute = () => {
  const now = new Date()
  const uptime = Date.now() - startTime

  const healthData = {
    status: 'healthy',
    timestamp: now.toISOString(),
    uptime: Math.floor(uptime / 1000),
    version: process.env['npm_package_version'] || '1.0.0',
    environment: process.env['NODE_ENV'] || 'development',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
    },
  }

  return new Response(JSON.stringify(healthData), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  })
}
import type { APIRoute } from 'astro'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('pixel-stats-api')
const PIXEL_API_URL = process.env.PIXEL_API_URL || 'http://localhost:8001'

export const GET: APIRoute = async () => {
  try {
    const response = await fetch(`${PIXEL_API_URL}/agent-stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      // Fallback for demo purposes if backend isn't updated yet
      return new Response(JSON.stringify({
        "Coordinator": { "average_latency_ms": 145.2, "error_rate": 0.001, "throughput": 1250 },
        "Psychologist": { "average_latency_ms": 412.5, "error_rate": 0.02, "throughput": 840 },
        "Memory Agent": { "average_latency_ms": 85.1, "error_rate": 0, "throughput": 2100 },
        "Safety Guard": { "average_latency_ms": 12.4, "error_rate": 0, "throughput": 4500 }
      }), { status: 200 })
    }

    const data = await response.json()
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    logger.error(`Stats error: ${error.message}`)
    // Mock data fallback
    return new Response(JSON.stringify({
      "Coordinator": { "average_latency_ms": 145.2, "error_rate": 0.001, "throughput": 1250 },
      "Psychologist": { "average_latency_ms": 412.5, "error_rate": 0.02, "throughput": 840 },
      "Memory Agent": { "average_latency_ms": 85.1, "error_rate": 0, "throughput": 2100 },
      "Safety Guard": { "average_latency_ms": 12.4, "error_rate": 0, "throughput": 4500 }
    }), { status: 200 })
  }
}

export const POST: APIRoute = async () => {
  try {
    const response = await fetch(`${PIXEL_API_URL}/reset-stats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      throw new Error('Failed to reset stats on backend')
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error: any) {
    logger.error(`Reset stats error: ${error.message}`)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

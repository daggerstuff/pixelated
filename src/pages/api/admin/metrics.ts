export const prerender = false

import type { APIRoute } from 'astro'

/**
 * API endpoint for fetching system metrics (admin only)
 * GET /api/admin/metrics
 */
export const GET: APIRoute = async () => {
  try {
    // Mock metrics data for demonstration
    const mockMetrics = {
      activeUsers: 142,
      activeSessions: 89,
      avgResponseTime: 245,
      systemLoad: 0.65,
      storageUsed: '2.3 GB',
      messagesSent: 1247,
      activeSecurityLevel: 'HIPAA Compliant',
      totalTherapists: 23,
      totalClients: 156,
      sessionsToday: 34,
    }

    return new Response(JSON.stringify(mockMetrics), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}

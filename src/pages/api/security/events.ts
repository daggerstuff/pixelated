import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('default')

// Mock data for demonstration
const mockEvents = [
  {
    id: '1',
    timestamp: Date.now() - 3600000,
    type: 'login',
    severity: 'medium' as const,
    metadata: { details: 'Failed login attempt' },
  },
  {
    id: '2',
    timestamp: Date.now() - 7200000,
    type: 'access',
    severity: 'high' as const,
    metadata: { details: 'Unauthorized access attempt' },
  },
  {
    id: '3',
    timestamp: Date.now() - 10800000,
    type: 'system',
    severity: 'low' as const,
    metadata: { details: 'System maintenance completed' },
  },
]

const mockStats = {
  total: 42,
  last24h: 8,
  last7d: 23,
  bySeverity: {
    critical: 2,
    high: 5,
    medium: 12,
    low: 23,
  },
}

export const GET = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const type = url.searchParams.get('type')
    const severity = url.searchParams.get('severity') as
      | 'critical'
      | 'high'
      | 'medium'
      | 'low'
      | null
    const limit = url.searchParams.get('limit')

    // Filter mock events based on query parameters
    let filteredEvents = [...mockEvents]

    if (type) {
      filteredEvents = filteredEvents.filter((event) => event.type === type)
    }

    if (severity) {
      filteredEvents = filteredEvents.filter(
        (event) => event.severity === severity,
      )
    }

    if (limit) {
      const limitNum = parseInt(limit)
      filteredEvents = filteredEvents.slice(0, limitNum)
    }

    return new Response(
      JSON.stringify({ events: filteredEvents, stats: mockStats }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  } catch (error: unknown) {
    logger.error(
      'Error fetching security events:',
      error as Record<string, unknown>,
    )
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }
}

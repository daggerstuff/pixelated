import type { APIRoute } from 'astro'
import type {
  DemoAnalyticsEvent,
  EnrichedAnalyticsEvent,
  DemoAnalyticsSuccessResponse,
  DemoAnalyticsGetResponse,
  AnalyticsSummary,
  AnalyticsError,
  GA4Event,
  MixpanelEvent,
} from './types'

// In-memory storage for demo (replace with database in production)
const analyticsData: EnrichedAnalyticsEvent[] = []

export const POST: APIRoute = async ({ request }) => {
  try {
    const eventData = (await request.json()) as DemoAnalyticsEvent

    // Validate required fields
    const validationErrors: AnalyticsError['details'] = []
    if (!eventData.event) {
      validationErrors.push({
        field: 'event',
        message: 'Event name is required',
      })
    }
    if (!eventData.session_id) {
      validationErrors.push({
        field: 'session_id',
        message: 'Session ID is required',
      })
    }
    if (!eventData.ab_variant) {
      validationErrors.push({
        field: 'ab_variant',
        message: 'A/B variant is required',
      })
    }

    if (validationErrors.length > 0) {
      const error: AnalyticsError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid analytics event data',
        details: validationErrors,
      }
      return new Response(JSON.stringify(error), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Add server-side timestamp and IP
    const enrichedEvent: EnrichedAnalyticsEvent = {
      ...eventData,
      server_timestamp: Date.now(),
      ip_address:
        request.headers.get('x-forwarded-for') ||
        request.headers.get('x-real-ip') ||
        'unknown',
      user_agent: request.headers.get('user-agent') || eventData.user_agent,
    }

    // Store the event (in production, save to database)
    analyticsData.push(enrichedEvent)

    // Log for debugging
    console.log('Demo Analytics Event:', {
      event: enrichedEvent.event,
      session_id: enrichedEvent.session_id,
      ab_variant: enrichedEvent.ab_variant,
      timestamp: new Date(enrichedEvent.timestamp).toISOString(),
    })

    // Send to external analytics services
    await Promise.allSettled([
      sendToGoogleAnalytics(enrichedEvent),
      sendToMixpanel(enrichedEvent),
      sendToCustomAnalytics(enrichedEvent),
    ])

    const response: DemoAnalyticsSuccessResponse = {
      success: true,
      event_id: enrichedEvent.session_id + '_' + enrichedEvent.timestamp,
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Demo analytics error:', error)

    const apiError: AnalyticsError = {
      code: 'PROCESSING_ERROR',
      message: 'Failed to process analytics event',
      details: {
        source: 'demo-tracking',
        message: error instanceof Error ? error.message : String(error),
      },
    }

    return new Response(JSON.stringify(apiError), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const GET: APIRoute = async ({ url }) => {
  try {
    const { searchParams } = new URL(url)
    const sessionId = searchParams.get('session_id')
    const abVariant = searchParams.get('ab_variant')
    const event = searchParams.get('event')

    // Filter analytics data based on query parameters
    let filteredData = analyticsData

    if (sessionId) {
      filteredData = filteredData.filter(
        (item) => item.session_id === sessionId,
      )
    }

    if (abVariant) {
      filteredData = filteredData.filter(
        (item) => item.ab_variant === abVariant,
      )
    }

    if (event) {
      filteredData = filteredData.filter((item) => item.event === event)
    }

    // Generate analytics summary
    const summary = generateAnalyticsSummary(filteredData)

    const response: DemoAnalyticsGetResponse = {
      total_events: filteredData.length,
      events: filteredData.slice(-100), // Return last 100 events
      summary,
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Demo analytics query error:', error)

    const apiError: AnalyticsError = {
      code: 'PROCESSING_ERROR',
      message: 'Failed to retrieve analytics data',
      details: {
        source: 'demo-tracking',
        message: error instanceof Error ? error.message : String(error),
      },
    }

    return new Response(JSON.stringify(apiError), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function sendToGoogleAnalytics(
  event: EnrichedAnalyticsEvent,
): Promise<void> {
  // Google Analytics 4 Measurement Protocol
  const GA_MEASUREMENT_ID = import.meta.env.PUBLIC_GA_MEASUREMENT_ID
  const { GA_API_SECRET } = import.meta.env

  if (!GA_MEASUREMENT_ID || !GA_API_SECRET) {
    console.warn('Google Analytics credentials not configured')
    return
  }

  try {
    const gaEvent: GA4Event = {
      name: event.event,
      parameters: {
        ab_variant: event.ab_variant,
        page_title: 'ClinicalVault Trainer Demo',
        page_location: event.url,
        custom_parameter_1: event.session_id,
        custom_parameter_2: event.ab_variant,
        ...Object.fromEntries(
          Object.entries(event).filter(
            ([key]) =>
              ![
                'event',
                'timestamp',
                'session_id',
                'ab_variant',
                'url',
              ].includes(key),
          ),
        ),
      },
    }

    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=${GA_API_SECRET}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: event.session_id,
          events: [gaEvent],
        }),
      },
    )

    if (!response.ok) {
      throw new Error(`GA4 API error: ${response.status}`)
    }
  } catch (error) {
    console.error('Failed to send to Google Analytics:', error)
  }
}

async function sendToMixpanel(event: EnrichedAnalyticsEvent): Promise<void> {
  const { MIXPANEL_TOKEN } = import.meta.env

  if (!MIXPANEL_TOKEN) {
    console.warn('Mixpanel token not configured')
    return
  }

  try {
    const mixpanelEvent: MixpanelEvent = {
      event: event.event,
      properties: {
        token: MIXPANEL_TOKEN,
        distinct_id: event.session_id,
        ab_variant: event.ab_variant,
        page: event.page,
        time: Math.floor(event.timestamp / 1000),
        ...event,
      },
    }

    const response = await fetch('https://api.mixpanel.com/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([mixpanelEvent]),
    })

    if (!response.ok) {
      throw new Error(`Mixpanel API error: ${response.status}`)
    }
  } catch (error) {
    console.error('Failed to send to Mixpanel:', error)
  }
}

async function sendToCustomAnalytics(
  event: EnrichedAnalyticsEvent,
): Promise<void> {
  // Send to your custom analytics service
  const { CUSTOM_ANALYTICS_ENDPOINT, CUSTOM_ANALYTICS_TOKEN } = import.meta.env

  if (!CUSTOM_ANALYTICS_ENDPOINT || !CUSTOM_ANALYTICS_TOKEN) {
    return
  }

  try {
    const response = await fetch(CUSTOM_ANALYTICS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CUSTOM_ANALYTICS_TOKEN}`,
      },
      body: JSON.stringify(event),
    })

    if (!response.ok) {
      throw new Error(`Custom analytics API error: ${response.status}`)
    }
  } catch (error) {
    console.error('Failed to send to custom analytics:', error)
  }
}

function generateAnalyticsSummary(
  events: EnrichedAnalyticsEvent[],
): AnalyticsSummary {
  const summary: AnalyticsSummary = {
    total_events: events.length,
    unique_sessions: new Set(events.map((e) => e.session_id)).size,
    ab_variants: {},
    event_types: {},
    conversion_funnel: {
      page_views: 0,
      demo_interactions: 0,
      cta_clicks: 0,
      conversion_rate: 0,
    },
    avg_time_to_cta: 0,
    scroll_depth_avg: 0,
  }

  // Count A/B variants
  events.forEach((event) => {
    summary.ab_variants[event.ab_variant] =
      (summary.ab_variants[event.ab_variant] || 0) + 1
    summary.event_types[event.event] =
      (summary.event_types[event.event] || 0) + 1
  })

  // Calculate conversion funnel
  summary.conversion_funnel.page_views = events.filter(
    (e) => e.event === 'demo_page_view',
  ).length
  summary.conversion_funnel.demo_interactions = events.filter(
    (e) => e.event === 'demo_interaction',
  ).length
  summary.conversion_funnel.cta_clicks = events.filter(
    (e) => e.event === 'demo_cta_click',
  ).length

  if (summary.conversion_funnel.page_views > 0) {
    summary.conversion_funnel.conversion_rate =
      (summary.conversion_funnel.cta_clicks /
        summary.conversion_funnel.page_views) *
      100
  }

  // Calculate average time to CTA
  const ctaEvents = events.filter(
    (e) => e.event === 'demo_cta_click' && e.time_to_click,
  )
  if (ctaEvents.length > 0) {
    summary.avg_time_to_cta =
      ctaEvents.reduce((sum, e) => sum + (e.time_to_click || 0), 0) /
      ctaEvents.length
  }

  // Calculate average scroll depth
  const scrollEvents = events.filter(
    (e) => e.event === 'demo_scroll_depth' && e.depth_percent,
  )
  if (scrollEvents.length > 0) {
    summary.scroll_depth_avg =
      scrollEvents.reduce((sum, e) => sum + (e.depth_percent || 0), 0) /
      scrollEvents.length
  }

  return summary
}

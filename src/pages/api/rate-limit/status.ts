/**
 * Rate limiting status API endpoint
 * Provides real-time metrics and system health information
 */

import type { APIRoute } from 'astro'
import { rateLimitAnalytics, getRateLimitStatus, checkRateLimitHealth } from '@/lib/rate-limiting'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('rate-limit-status')

interface RateLimitStatus {
  system: unknown
  health: unknown
  analytics?: unknown
  alerts?: unknown
}

interface ApiResponse {
  status: 'success' | 'error'
  data: RateLimitStatus
  timestamp: string
  message?: string
  error?: string
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url)
    const includeAnalytics = url.searchParams.get('analytics') === 'true'
    const includeAlerts = url.searchParams.get('alerts') === 'true'
    const days = parseInt(url.searchParams.get('days') || '7')

    const [status, health] = await Promise.all([
      getRateLimitStatus(),
      checkRateLimitHealth()
    ])

    const response: ApiResponse = {
      status: 'success',
      data: {
        system: status,
        health
      },
      timestamp: new Date().toISOString()
    }

    // Include analytics if requested
    if (includeAnalytics) {
      const analytics = await rateLimitAnalytics.getAnalyticsSummary(days)
      response.data.analytics = analytics
    }

    // Include recent alerts if requested
    if (includeAlerts) {
      const alerts = await rateLimitAnalytics.getRecentAlerts(20)
      response.data.alerts = alerts
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    logger.error('Rate limit status API error:', { error })

    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Failed to retrieve rate limiting status',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }
}

/**
 * POST endpoint to add custom monitors or alerts
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    const { action, data } = body

    switch (action) {
      case 'add_monitor': {
        // Add a custom monitor
        const { name, checkIntervalMs, thresholds, handlers } = data

        if (!name || !checkIntervalMs || !thresholds || !handlers) {
          return new Response(
            JSON.stringify({
              status: 'error',
              message: 'Missing required monitor parameters'
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }

        // Define type for handler function
        type AlertHandler = (alert: unknown) => void

        // Define a registry of safe, predefined handler functions
        const safeHandlerRegistry: Record<string, AlertHandler> = {
          // Log alert to system with structured format
          'log-alert': (alert) => {
            logger.warn('Rate limit alert triggered', {
              alert,
              timestamp: new Date().toISOString()
            })
          },

          // Send alert to Sentry for error tracking
          'send-sentry-alert': (alert) => {
            // Import Sentry client if available
            try {
              // Use ES6 import syntax instead of CommonJS require
              // This assumes Sentry is properly configured in the application
              // We're using a safe approach that won't break if Sentry isn't available
              import('@sentry/node').then(({ captureMessage }) => {
                captureMessage(`Rate limit alert triggered: ${JSON.stringify(alert)}`, 'warning')
              }).catch(error => {
                logger.error('Failed to load Sentry module', { error })
              })
            } catch (error) {
              logger.error('Failed to send alert to Sentry', { error })
            }
          },

          // Trigger webhook to external monitoring system
          'trigger-webhook': (alert) => {
            // Use fetch to send alert to configured webhook endpoint
            // This assumes webhook URL is configured in environment variables
            const webhookUrl = process.env.RATE_LIMIT_WEBHOOK_URL
            if (!webhookUrl) {
              logger.warn('RATE_LIMIT_WEBHOOK_URL not configured, skipping webhook')
              return
            }

            fetch(webhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Pixelated-Rate-Limiter'
              },
              body: JSON.stringify({
                type: 'rate_limit_alert',
                alert,
                timestamp: new Date().toISOString()
              })
            })
            .then(response => {
              if (!response.ok) {
                logger.error('Webhook request failed', {
                  status: response.status,
                  url: webhookUrl
                })
              }
            })
            .catch(error => {
              logger.error('Webhook request failed', { error, url: webhookUrl })
            })
          },

          // Send email notification to administrators
          'send-email': (alert) => {
            // Use email service configured in environment
            const emailServiceUrl = process.env.EMAIL_SERVICE_URL
            const adminEmail = process.env.ADMIN_EMAIL

            if (!emailServiceUrl || !adminEmail) {
              logger.warn('Email service not configured, skipping email notification')
              return
            }

            fetch(emailServiceUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.EMAIL_SERVICE_TOKEN}`
              },
              body: JSON.stringify({
                to: adminEmail,
                subject: 'Rate Limit Alert: Potential Attack Detected',
                body: `A rate limit alert has been triggered:\n\n${JSON.stringify(alert, null, 2)}\n\nTimestamp: ${new Date().toISOString()}`
              })
            })
            .then(response => {
              if (!response.ok) {
                logger.error('Email notification failed', {
                  status: response.status,
                  url: emailServiceUrl
                })
              }
            })
            .catch(error => {
              logger.error('Email notification failed', { error, url: emailServiceUrl })
            })
          }
        }

        const monitor = {
          name,
          checkIntervalMs,
          thresholds,
          handlers: handlers.map((handler: string) => {
            // Validate handler type against registry
            const safeHandler = safeHandlerRegistry[handler]
            if (!safeHandler) {
              throw new Error(`Invalid handler type: ${handler}`)
            }
            return safeHandler
          })
        }

        rateLimitAnalytics.addMonitor(monitor)

        return new Response(
          JSON.stringify({
            status: 'success',
            message: 'Monitor added successfully',
            data: { monitor: name }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      case 'remove_monitor': {
        // Remove a monitor
        const { name } = data

        if (!name) {
          return new Response(
            JSON.stringify({
              status: 'error',
              message: 'Monitor name is required'
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }

        rateLimitAnalytics.removeMonitor(name)

        return new Response(
          JSON.stringify({
            status: 'success',
            message: 'Monitor removed successfully',
            data: { monitor: name }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      case 'cleanup_analytics': {
        // Cleanup old analytics data
        const { olderThanDays = 30 } = data

        await rateLimitAnalytics.cleanup(olderThanDays)

        return new Response(
          JSON.stringify({
            status: 'success',
            message: 'Analytics cleanup completed',
            data: { olderThanDays }
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({
            status: 'error',
            message: `Unknown action: ${action}`
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    logger.error('Rate limit POST API error:', { error })

    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Failed to process monitor addition',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }
}

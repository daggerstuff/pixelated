/**
 * DLP Service Integration Points
 *
 * This file provides utilities and middleware for integrating the DLP service
 * at various data exit points throughout the application.
 */

import type { NextApiRequest, NextApiResponse } from 'next'
import type { AstroGlobal } from 'astro'
import { dlpService, type DLPResult } from './dlp'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('dlp-integration')

/**
 * Key integration points for DLP in the application
 *
 * This serves as documentation for where DLP controls should be applied
 */
export const DLP_INTEGRATION_POINTS = {
  // API Endpoints with PHI/PII data
  API_ENDPOINTS: [
    '/api/auth/user',
    '/api/sessions',
    '/api/emotions',
    '/api/chat',
    '/api/export',
    '/api/security',
    '/api/fhe',
    '/api/ai',
    '/api/admin/ai',
  ],

  // File Export Endpoints
  EXPORT_ENDPOINTS: [
    '/api/export/sessions',
    '/api/export/data',
    '/api/export/analytics',
  ],

  // Browser Functions
  CLIENT_FUNCTIONS: [
    'downloadData',
    'copyToClipboard',
    'shareSession',
    'exportAnalytics',
  ],

  // Admin Functions
  ADMIN_FUNCTIONS: ['exportUserData', 'exportSystemData', 'bulkExport'],
}

/**
 * Next.js API middleware for applying DLP to request/response data
 *
 * @param checkRequestBody Whether to scan request body (POST/PUT requests)
 * @param checkResponseBody Whether to scan response body (defaults to true)
 * @returns Next.js middleware function
 */
export function withDLPProtection(
  options: {
    checkRequestBody?: boolean
    checkResponseBody?: boolean
  } = {},
) {
  const { checkRequestBody = false, checkResponseBody = true } = options

  return async (
    req: NextApiRequest,
    res: NextApiResponse,
    next: () => Promise<void>,
  ) => {
    try {
      const userId =
        (req as NextApiRequest & { user?: { id?: string } }).user?.id ||
        'unknown'

      // Check request body if enabled
      if (
        checkRequestBody &&
        req.body &&
        (req.method === 'POST' || req.method === 'PUT')
      ) {
        const contentString =
          typeof req.body === 'string' ? req.body : JSON.stringify(req.body)

        const dlpResult = dlpService.scanContent(contentString, {
          userId,
          action: `${req.method} ${req.url}`,
          destination: 'api-request',
        })

        if (!dlpResult.allowed) {
          return res.status(403).json({
            error: 'Blocked by DLP policy',
            reason: dlpResult.reason || 'Policy Violation',
            code: 'DLP_POLICY_VIOLATION',
          })
        }

        // If content was redacted, update request body
        if (dlpResult.redactedContent) {
          try {
            req.body =
              typeof req.body === 'string'
                ? dlpResult.redactedContent
                : JSON.parse(dlpResult.redactedContent) as any
          } catch (e) {
            logger.error('Failed to parse redacted content', { error: e })
          }
        }
      }

      // Store original res.json to intercept responses
      const originalJson = res.json

      if (checkResponseBody) {
        // Override res.json to scan outgoing data
        res.json = function (body: unknown) {
          try {
            const contentString = JSON.stringify(body)

            const dlpResult = dlpService.scanContent(contentString, {
              userId,
              action: `response ${req.url}`,
              destination: 'api-response',
            })

            if (!dlpResult.allowed) {
              return res.status(403).json({
                error: 'Blocked by DLP policy',
                reason: dlpResult.reason || 'Policy Violation',
                code: 'DLP_POLICY_VIOLATION',
              })
            }

            // If redacted, update response body
            if (dlpResult.redactedContent) {
              try {
                body = JSON.parse(dlpResult.redactedContent) as any
              } catch (e) {
                logger.error('Failed to parse redacted response content', {
                  error: e,
                })
              }
            }
          } catch (e) {
            logger.error('Error in DLP response scanning', { error: e })
          }

          // Call original json method
          return originalJson.call(res, body)
        }
      }

      // Continue to the next middleware or route handler
      return next()
    } catch (error: unknown) {
      logger.error('Error in DLP middleware', { error })
      return next()
    }
  }
}

/**
 * Astro middleware for applying DLP to request/response data in SSR mode
 */
export function astroWithDLPProtection() {
  return async (ctx: AstroGlobal, next: () => Promise<void>) => {
    try {
      const userId = ctx.locals?.user?.id || 'unknown'

      // For endpoints that handle file exports
      if (
        ctx.request.url.includes('/export/') ||
        ctx.request.headers.get('content-disposition')?.includes('attachment')
      ) {
        // Original response
        const response: Response = (await next()) as unknown as Response
        if (!response) {
          // If next() doesn't return a response for some reason, pass through.
          return next()
        }

        // For text-based responses like JSON or HTML
        const contentType = response.headers.get('content-type') || ''
        if (
          contentType.includes('application/json') ||
          contentType.includes('text/')
        ) {
          try {
            const text = await response.text()

            const dlpResult = dlpService.scanContent(text, {
              userId,
              action: `download ${ctx.request.url}`,
              destination: 'file-export',
              metadata: {
                contentType,
                dataSize: text.length,
              },
            })

            if (!dlpResult.allowed) {
              return new Response(
                JSON.stringify({
                  error: 'Export blocked by DLP policy',
                  reason: dlpResult.reason || 'Policy Violation',
                }),
                {
                  status: 403,
                  headers: {
                    'Content-Type': 'application/json',
                  },
                },
              )
            }

            // Return redacted content or original content
            return new Response(dlpResult.redactedContent || text, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            })
          } catch (e) {
            logger.error('Error processing export through DLP', { error: e })
          }
        }

        return response
      }

      return next()
    } catch (error: unknown) {
      logger.error('Error in Astro DLP middleware', { error })
      return next()
    }
  }
}

/**
 * Client-side DLP integration for browser functions
 */
export function clientSideDLP() {
  if (typeof window === 'undefined') {
    return {
      scanContent: () => ({
        allowed: true,
        triggeredRules: [],
      }),
      safeClipboardCopy: async (_text: string) => true,
      safeFileDownload: (_fileName: string, _content: string) => true,
    } as {
      scanContent: (
        content: string,
        context: { action: string; metadata?: Record<string, unknown> },
      ) => DLPResult
      safeClipboardCopy: (text: string) => Promise<boolean>
      safeFileDownload: (fileName: string, content: string) => boolean
    }
  }

  // Utility for client-side DLP checks
  return {
    /**
     * Client-side DLP scan - automatically redacts or blocks PHI
     * Use for copy-to-clipboard, downloads, etc.
     */
    scanContent: (
      content: string,
      context: { action: string; metadata?: Record<string, unknown> },
    ): DLPResult => {
      try {
        const userId = localStorage.getItem('userId') || 'unknown'

        // Call DLP service
        return dlpService.scanContent(content, {
          userId,
          action: context.action,
          destination: 'client-side',
          metadata: context.metadata,
        })
      } catch (e) {
        console.error('Error in client-side DLP', e)
        // Return a DLPResult compatible object in case of an error
        return {
          allowed: true,
          triggeredRules: [],
          reason: 'Client-side DLP scan failed',
        }
      }
    },

    /**
     * Apply DLP to clipboard operations
     */
    safeClipboardCopy: async (text: string): Promise<boolean> => {
      try {
        const result = clientSideDLP().scanContent(text, {
          action: 'clipboard-copy',
        })

        if (!result.allowed) {
          console.warn(
            'Clipboard copy blocked by DLP policy:',
            result.reason || 'Policy Violation',
          )
          return false
        }

        const contentToCopy = result.redactedContent || text
        await navigator.clipboard.writeText(contentToCopy)
        return true
      } catch (e) {
        console.error('Error in clipboard DLP', e)
        return false
      }
    },

    /**
     * Apply DLP to file downloads
     */
    safeFileDownload: (fileName: string, content: string): boolean => {
      try {
        const result = clientSideDLP().scanContent(content, {
          action: 'file-download',
          metadata: { fileName },
        })

        if (!result.allowed) {
          console.warn(
            'File download blocked by DLP policy:',
            result.reason || 'Policy Violation',
          )
          return false
        }

        const contentToDownload = result.redactedContent || content

        // Create download
        const element = document.createElement('a')
        element.setAttribute(
          'href',
          'data:text/plain;charset=utf-8,' +
            encodeURIComponent(contentToDownload),
        )
        element.setAttribute('download', fileName)
        element.style.display = 'none'
        document.body.appendChild(element)
        element.click()
        document.body.removeChild(element)

        return true
      } catch (e) {
        console.error('Error in download DLP', e)
        return false
      }
    },
  }
}

/**
 * API route registration helper
 * Identifies which routes should use DLP protection
 */
export function shouldApplyDLPToRoute(route: string): boolean {
  // Check if route matches any of the integration points
  return (
    DLP_INTEGRATION_POINTS.API_ENDPOINTS.some((endpoint) =>
      route.startsWith(endpoint),
    ) ||
    DLP_INTEGRATION_POINTS.EXPORT_ENDPOINTS.some((endpoint) =>
      route.startsWith(endpoint),
    )
  )
}

/**
 * Setup guide for DLP integration
 */
export function printDLPIntegrationGuide() {
  console.log(`
DLP Integration Guide
====================

1. API Routes: Apply the withDLPProtection middleware to these endpoints:
   ${DLP_INTEGRATION_POINTS.API_ENDPOINTS.join('\n   ')}

2. Export Endpoints: Apply strict DLP monitoring to these data export points:
   ${DLP_INTEGRATION_POINTS.EXPORT_ENDPOINTS.join('\n   ')}

3. Client-Side Functions: Use clientSideDLP() for these browser operations:
   ${DLP_INTEGRATION_POINTS.CLIENT_FUNCTIONS.join('\n   ')}

4. Admin Functions: Apply extra DLP scrutiny to these operations:
   ${DLP_INTEGRATION_POINTS.ADMIN_FUNCTIONS.join('\n   ')}

5. Custom Rules: Extend the dlpService with domain-specific rules
`)
}

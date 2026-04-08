import { createBuildSafeLogger } from '../../../lib/logging/build-safe-logger'
import { OptimizedBiasDetectionService } from '../../../lib/services/bias-detection-optimized'

const logger = createBuildSafeLogger('bias-detection-api')
const biasDetectionService = OptimizedBiasDetectionService.getInstance()

const buildHeadersMap = (headers?: HeadersInit): Map<string, string> => {
  const headerMap = new Map<string, string>()

  if (!headers) return headerMap

  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      headerMap.set(key.toLowerCase(), value)
    })
    return headerMap
  }

  if (Array.isArray(headers)) {
    headers.forEach(([key, value]) => {
      headerMap.set(key.toLowerCase(), value)
    })
    return headerMap
  }

  Object.entries(headers).forEach(([key, value]) => {
    headerMap.set(key.toLowerCase(), String(value))
  })

  return headerMap
}

const createMockCompatibleResponse = (
  body: BodyInit | null,
  init?: ResponseInit,
): Response => {
  const headersMap = buildHeadersMap(init?.headers)
  const status = init?.status ?? 200

  return {
    status,
    ok: status >= 200 && status < 300,
    statusText: '',
    headers: {
      get: (key: string) => headersMap.get(key.toLowerCase()) ?? null,
    },
    json: async () => {
      if (typeof body === 'string') {
        try {
          return JSON.parse(body)
        } catch {
          return body
        }
      }
      return body as unknown
    },
    text: async () => {
      if (typeof body === 'string') return body
      return JSON.stringify(body ?? '')
    },
  } as unknown as Response
}

const createResponse = (
  body: BodyInit | null,
  init?: ResponseInit,
): Response => {
  if (typeof Response === 'function') {
    const responsePrototype = (Response as unknown as { prototype?: unknown })
      .prototype
    const canConstructResponse = Boolean(
      responsePrototype && responsePrototype.constructor === Response,
    )

    if (canConstructResponse) {
      try {
        return new Response(body, init)
      } catch {
        // Fall back to calling Response as a function if construction fails
      }
    }

    try {
      return (
        Response as unknown as (
          body: BodyInit | null,
          init?: ResponseInit,
        ) => Response
      )(body, init)
    } catch {
      return createMockCompatibleResponse(body, init)
    }
  }

  return createMockCompatibleResponse(body, init)
}

export const POST = async ({
  request,
}: {
  request: Request
}): Promise<Response> => {
  const startTime = Date.now()

  try {
    // Parse request body
    const body = await request.json()

    // Validation
    if (!body || (!body.content && !body.text)) {
      const processingTime = Math.max(Date.now() - startTime, 1)

      return createResponse(
        JSON.stringify({
          success: false,
          error: 'Bad Request',
          message: 'Content is required',
          processingTime,
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'X-Processing-Time': processingTime.toString(),
            'X-Cache': 'MISS',
          },
        },
      )
    }

    const text = body.content || body.text
    const therapistId = body.therapistId || 'default-therapist'
    const sessionId = body.sessionId || 'default-session'

    // Perform real analysis — forward sessionId so a caller's existing
    // session is honoured rather than silently replaced with a new UUID.
    const result = await biasDetectionService.analyzeBias({
      text,
      therapistId,
      sessionId: sessionId !== 'default-session' ? sessionId : undefined,
    })

    const processingTime = Math.max(Date.now() - startTime, 1)

    return createResponse(
      JSON.stringify({
        success: true,
        data: {
          sessionId: result.sessionId,
          overallScore: result.overallBiasScore,
          riskLevel: result.alertLevel,
          demographicAnalysis: {},
          layerAnalysis: result.layerResults,
          recommendations: result.recommendations,
        },
        cacheHit: result.cached,
        processingTime,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Processing-Time': processingTime.toString(),
          'X-Cache': result.cached ? 'HIT' : 'MISS',
        },
      },
    )
  } catch (error: unknown) {
    logger.error('Analysis failed', { error })

    const processingTime = Math.max(Date.now() - startTime, 1)

    return createResponse(
      JSON.stringify({
        success: false,
        error: 'Analysis Failed',
        message: error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Unknown error',
        processingTime,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Processing-Time': processingTime.toString(),
          'X-Cache': 'MISS',
        },
      },
    )
  }
}

export const GET = async ({
  request,
}: {
  request: Request
}): Promise<Response> => {
  const startTime = Date.now()

  try {
    const url = new URL(request.url)
    const therapistId = url.searchParams.get('therapistId')

    if (!therapistId) {
      return createResponse(
        JSON.stringify({
          success: false,
          error: 'Bad Request',
          message: 'therapistId is required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    const days = parseInt(url.searchParams.get('days') || '30', 10)

    // Get real summary
    const summary = await biasDetectionService.getBiasSummary(
      therapistId,
      days,
    )

    const processingTime = Math.max(Date.now() - startTime, 1)

    return createResponse(
      JSON.stringify({
        success: true,
        data: summary,
        cacheHit: true,
        processingTime,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Processing-Time': processingTime.toString(),
          'X-Cache': 'HIT',
        },
      },
    )
  } catch (error: unknown) {
    logger.error('Get analysis failed', { error })

    const processingTime = Math.max(Date.now() - startTime, 1)

    return createResponse(
      JSON.stringify({
        success: false,
        error: 'Get Analysis Failed',
        message: error instanceof Error ? (error instanceof Error ? error.message : "Unknown error") : 'Unknown error',
        processingTime,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'X-Processing-Time': processingTime.toString(),
          'X-Cache': 'MISS',
        },
      },
    )
  }
}


/**
 * Auth0-based 3D Emotion Visualization API Endpoint
 * Handles 3D emotion visualization with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { getUserById } from '@/services/auth0.service'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { AIRepository } from '@/lib/db/ai/repository'
import { MultidimensionalEmotionMapper } from '@/lib/ai/emotions/MultidimensionalEmotionMapper'
import { createAuditLog } from '@/lib/audit'

export const prerender = false

const logger = createBuildSafeLogger('auth0-3d-emotion-visualization-api')

interface EmotionPoint3D {
  id: string
  valence: number // -1 to 1 (negative to positive)
  arousal: number // -1 to 1 (calm to excited)
  dominance: number // -1 to 1 (submissive to dominant)
  emotion: string
  timestamp: string
  intensity: number // 0 to 1
  sessionId?: string
  confidence?: number
}

interface Emotion3DVisualizationResponse {
  emotionPoints: EmotionPoint3D[]
  metadata: {
    totalPoints: number
    timeRange: string
    sessionCount: number
    dominantEmotions: Array<{
      emotion: string
      frequency: number
      averageIntensity: number
    }>
    trajectoryAnalysis: {
      valenceGradient: number
      arousalGradient: number
      dominanceGradient: number
      emotionalStability: number
    }
  }
}

/**
 * 3D Emotion Visualization API
 * GET /api/auth/auth0-3d-emotion-visualization
 *
 * Provides multidimensional emotion data for the MultidimensionalEmotionChart component
 * Maps emotions to Valence-Arousal-Dominance (VAD) space for 3D visualization
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user from Auth0
    const user = await getUserById(validation.userId!)

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse query parameters
    const url = new URL(request.url)
    const clientId = url.searchParams.get('clientId')
    const sessionId = url.searchParams.get('sessionId')
    const timeRange = parseInt(url.searchParams.get('timeRange') || '7', 10) // days
    const maxPoints = parseInt(url.searchParams.get('maxPoints') || '100', 10)
    const includeTrajectory =
      url.searchParams.get('includeTrajectory') === 'true'

    if (!clientId && !sessionId) {
      return new Response(
        JSON.stringify({ error: 'Either clientId or sessionId is required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const repository = new AIRepository()
    const emotionMapper = new MultidimensionalEmotionMapper()

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - timeRange)

    // Fetch emotion data
    let emotionData = []
    let sessions = []

    if (sessionId) {
      // Fetch specific session emotions
      emotionData = await repository.getEmotionsForSession(sessionId)
      sessions = [{ sessionId }]
    } else if (clientId) {
      // Fetch client sessions and emotions
      sessions = await repository.getSessions({
        clientId,
        startDate,
        endDate,
      })

      for (const session of sessions) {
        if (session.sessionId) {
          const sessionEmotions = await repository.getEmotionsForSession(
            session.sessionId,
          )
          emotionData.push(
            ...sessionEmotions.map((e) => ({
              ...e,
              sessionId: session.sessionId,
            })),
          )
        }
      }
    }

    // Limit data points if necessary
    if (emotionData.length > maxPoints) {
      const interval = Math.floor(emotionData.length / maxPoints)
      emotionData = emotionData
        .filter((_, index) => index % interval === 0)
        .slice(0, maxPoints)
    }

    // Map emotions to 3D coordinates
    const emotionPoints: EmotionPoint3D[] = emotionData.map(
      (emotion, index) => {
        const dimensions = emotionMapper.mapEmotionsToDimensions(emotion)

        return {
          id: `emotion-${emotion.id || index}`,
          valence: normalizeToRange(dimensions.valence || 0, -1, 1),
          arousal: normalizeToRange(dimensions.arousal || 0, -1, 1),
          dominance: normalizeToRange(dimensions.dominance || 0, -1, 1),
          emotion: emotion.primaryEmotion || emotion.emotion || 'neutral',
          timestamp: emotion.timestamp || new Date().toISOString(),
          intensity: normalizeToRange(
            emotion.confidence || emotion.intensity || 0.5,
            0,
            1,
          ),
          sessionId: emotion.sessionId,
          confidence: emotion.confidence || 0.7,
        }
      },
    )

    // Sort by timestamp
    emotionPoints.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )

    // Calculate dominant emotions
    const emotionCounts = new Map<
      string,
      { count: number; totalIntensity: number }
    >()
    emotionPoints.forEach((point) => {
      const current = emotionCounts.get(point.emotion) || {
        count: 0,
        totalIntensity: 0,
      }
      emotionCounts.set(point.emotion, {
        count: current.count + 1,
        totalIntensity: current.totalIntensity + point.intensity,
      })
    })

    const dominantEmotions = Array.from(emotionCounts.entries())
      .map(([emotion, stats]) => ({
        emotion,
        frequency: stats.count,
        averageIntensity: stats.totalIntensity / stats.count,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)

    // Calculate trajectory analysis
    let trajectoryAnalysis = {
      valenceGradient: 0,
      arousalGradient: 0,
      dominanceGradient: 0,
      emotionalStability: 0,
    }

    if (includeTrajectory && emotionPoints.length > 1) {
      trajectoryAnalysis = calculateEmotionalTrajectory(emotionPoints)
    }

    const response: Emotion3DVisualizationResponse = {
      emotionPoints,
      metadata: {
        totalPoints: emotionPoints.length,
        timeRange: `${timeRange} days`,
        sessionCount: new Set(
          emotionPoints.map((p) => p.sessionId).filter(Boolean),
        ).size,
        dominantEmotions,
        trajectoryAnalysis,
      },
    }

    // Create audit log
    await createAuditLog(
      '3d_emotion_visualization_access',
      'auth.components.emotions.3d.visualization.access',
      user.id,
      'auth-components-emotions',
      {
        action: 'get_3d_emotion_visualization',
        pointCount: emotionPoints.length,
        sessionCount: response.metadata.sessionCount,
        dominantEmotion: dominantEmotions[0]?.emotion || 'none'
      }
    )

    logger.info('Generated 3D emotion visualization data', {
      pointCount: emotionPoints.length,
      sessionCount: response.metadata.sessionCount,
      dominantEmotion: dominantEmotions[0]?.emotion || 'none',
      userId: user.id,
    })

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=180', // 3-minute cache
      },
    })
  } catch (error: unknown) {
    logger.error('Error generating 3D emotion visualization data', { error })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.components.emotions.3d.visualization.error',
      'anonymous',
      'auth-components-emotions',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

/**
 * POST endpoint for real-time emotion updates
 * Allows adding new emotion points to the visualization
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Extract token from request
    const token = extractTokenFromRequest(request as unknown as Request)

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Validate token
    const validation = await validateToken(token, 'access')

    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Get user from Auth0
    const user = await getUserById(validation.userId!)

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const body = await request.json()
    const { emotion, valence, arousal, dominance, intensity, sessionId } = body

    // Validate input
    if (
      !emotion ||
      typeof valence !== 'number' ||
      typeof arousal !== 'number' ||
      typeof dominance !== 'number'
    ) {
      return new Response(
        JSON.stringify({ error: 'Invalid emotion data format' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    // Create new emotion point
    const newEmotionPoint: EmotionPoint3D = {
      id: `emotion-${Date.now()}`,
      valence: Math.max(-1, Math.min(1, valence)),
      arousal: Math.max(-1, Math.min(1, arousal)),
      dominance: Math.max(-1, Math.min(1, dominance)),
      emotion,
      timestamp: new Date().toISOString(),
      intensity: Math.max(0, Math.min(1, intensity || 0.5)),
      sessionId,
      confidence: 0.8, // Default confidence for manually added points
    }

    // Create audit log
    await createAuditLog(
      'emotion_point_added',
      'auth.components.emotions.3d.visualization.add',
      user.id,
      'auth-components-emotions',
      {
        action: 'add_emotion_point',
        emotion: newEmotionPoint.emotion,
        coordinates: [
          newEmotionPoint.valence,
          newEmotionPoint.arousal,
          newEmotionPoint.dominance,
        ],
        sessionId: newEmotionPoint.sessionId
      }
    )

    // TODO: Save to database
    // const repository = new AIRepository()
    // await repository.saveEmotionPoint(newEmotionPoint)

    logger.info('Added new emotion point', {
      emotion: newEmotionPoint.emotion,
      coordinates: [
        newEmotionPoint.valence,
        newEmotionPoint.arousal,
        newEmotionPoint.dominance,
      ],
      sessionId: newEmotionPoint.sessionId,
      userId: user.id,
    })

    return new Response(
      JSON.stringify({
        success: true,
        emotionPoint: newEmotionPoint,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    logger.error('Error adding emotion point', { error })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.components.emotions.3d.visualization.error',
      'anonymous',
      'auth-components-emotions',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

// Helper functions
function normalizeToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function calculateEmotionalTrajectory(emotionPoints: EmotionPoint3D[]) {
  if (emotionPoints.length < 2) {
    return {
      valenceGradient: 0,
      arousalGradient: 0,
      dominanceGradient: 0,
      emotionalStability: 0,
    }
  }

  const first = emotionPoints[0]
  const last = emotionPoints[emotionPoints.length - 1]
  const timeSpan =
    new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()

  // Calculate gradients (change over time)
  const valenceGradient =
    (last.valence - first.valence) / (timeSpan / (1000 * 60 * 60)) // per hour
  const arousalGradient =
    (last.arousal - first.arousal) / (timeSpan / (1000 * 60 * 60))
  const dominanceGradient =
    (last.dominance - first.dominance) / (timeSpan / (1000 * 60 * 60))

  // Calculate emotional stability (inverse of variance)
  const valenceVariance = calculateVariance(emotionPoints.map((p) => p.valence))
  const arousalVariance = calculateVariance(emotionPoints.map((p) => p.arousal))
  const dominanceVariance = calculateVariance(
    emotionPoints.map((p) => p.dominance),
  )

  const totalVariance = valenceVariance + arousalVariance + dominanceVariance
  const emotionalStability = Math.max(0, 1 - totalVariance / 3) // Normalize to 0-1

  return {
    valenceGradient: Number(valenceGradient.toFixed(4)),
    arousalGradient: Number(arousalGradient.toFixed(4)),
    dominanceGradient: Number(dominanceGradient.toFixed(4)),
    emotionalStability: Number(emotionalStability.toFixed(3)),
  }
}

function calculateVariance(values: number[]): number {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
  return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length
}
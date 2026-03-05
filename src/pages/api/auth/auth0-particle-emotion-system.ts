/**
 * Auth0-based Particle Emotion System API Endpoint
 * Handles particle emotion system with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { getUserById } from '@/services/auth0.service'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { AIRepository } from '@/lib/db/ai/repository'
import { createAuditLog } from '@/lib/audit'

export const prerender = false

const logger = createBuildSafeLogger('auth0-particle-emotion-system-api')

interface ParticleConfig {
  id: string
  position: [number, number, number]
  velocity: [number, number, number]
  color: string
  size: number
  emotion:
    | 'joy'
    | 'sadness'
    | 'anger'
    | 'fear'
    | 'surprise'
    | 'disgust'
    | 'neutral'
  intensity: number
  lifetime?: number
  behavior?: {
    movementPattern: 'flow' | 'orbit' | 'chaos' | 'pulse' | 'spiral'
    interactionRadius: number
    attraction: number
    repulsion: number
  }
}

interface ParticleSystemConfig {
  particleCount: number
  emotion: string
  intensity: number
  sessionId?: string
  environmentFactors: {
    gravity: number
    friction: number
    turbulence: number
    magnetism: number
  }
  visualSettings: {
    showTrails: boolean
    showConnections: boolean
    colorMode: 'emotion' | 'intensity' | 'velocity' | 'random'
    particleStyle: 'sphere' | 'point' | 'star' | 'glow'
  }
}

interface ParticleSystemResponse {
  particles: ParticleConfig[]
  systemConfig: ParticleSystemConfig
  metadata: {
    generationTimestamp: string
    emotionProfile: {
      dominantEmotion: string
      emotionMix: Record<string, number>
      averageIntensity: number
      volatility: number
    }
    performanceHints: {
      recommendedFrameRate: number
      complexity: 'low' | 'medium' | 'high'
      gpuOptimized: boolean
    }
  }
}

/**
 * Particle Emotion System API
 * GET /api/auth/auth0-particle-emotion-system
 *
 * Generates particle configurations for the Particle component based on emotional states
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
    const emotion = url.searchParams.get('emotion') || 'neutral'
    const particleCount = Math.min(
      parseInt(url.searchParams.get('particleCount') || '50', 10),
      200,
    )
    const intensity = Math.max(
      0,
      Math.min(1, parseFloat(url.searchParams.get('intensity') || '0.5')),
    )
    const sessionId = url.searchParams.get('sessionId')
    const useSessionData = url.searchParams.get('useSessionData') === 'true'
    const complexity = url.searchParams.get('complexity') || 'medium'

    let emotionProfile = {
      dominantEmotion: emotion,
      emotionMix: { [emotion]: 1.0 },
      averageIntensity: intensity,
      volatility: 0.3,
    }

    // If session data is requested, fetch real emotion data
    if (useSessionData && sessionId) {
      try {
        const repository = new AIRepository()
        const sessionEmotions =
          await repository.getEmotionsForSession(sessionId)

        if (sessionEmotions.length > 0) {
          emotionProfile = calculateEmotionProfile(sessionEmotions)
        }
      } catch (error) {
        logger.warn('Failed to fetch session emotion data, using default', {
          sessionId,
          error,
        })
      }
    }

    // Generate particle system configuration
    const systemConfig: ParticleSystemConfig = {
      particleCount,
      emotion: emotionProfile.dominantEmotion,
      intensity: emotionProfile.averageIntensity,
      sessionId,
      environmentFactors: getEnvironmentFactors(
        emotionProfile.dominantEmotion,
        emotionProfile.volatility,
      ),
      visualSettings: getVisualSettings(
        complexity as 'low' | 'medium' | 'high',
      ),
    }

    // Generate particles based on emotion profile
    const particles = generateEmotionParticles(systemConfig, emotionProfile)

    const response: ParticleSystemResponse = {
      particles,
      systemConfig,
      metadata: {
        generationTimestamp: new Date().toISOString(),
        emotionProfile,
        performanceHints: {
          recommendedFrameRate:
            complexity === 'high' ? 30 : complexity === 'medium' ? 45 : 60,
          complexity: complexity as 'low' | 'medium' | 'high',
          gpuOptimized: particleCount > 100,
        },
      },
    }

    // Create audit log
    await createAuditLog(
      'particle_system_access',
      'auth.components.particles.emotion.system.access',
      user.id,
      'auth-components-particles',
      {
        action: 'get_particle_system',
        particleCount: particles.length,
        dominantEmotion: emotionProfile.dominantEmotion,
        intensity: emotionProfile.averageIntensity,
        sessionId
      }
    )

    logger.info('Generated particle emotion system', {
      particleCount: particles.length,
      dominantEmotion: emotionProfile.dominantEmotion,
      intensity: emotionProfile.averageIntensity,
      sessionId,
      userId: user.id,
    })

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, max-age=120', // 2-minute cache
      },
    })
  } catch (error: unknown) {
    logger.error('Error generating particle emotion system', { error })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.components.particles.emotion.system.error',
      'anonymous',
      'auth-components-particles',
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
 * POST endpoint for real-time particle updates
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
    const { emotion, intensity, sessionId, particleUpdates } = body

    // Validate input
    if (!emotion || typeof intensity !== 'number') {
      return new Response(
        JSON.stringify({ error: 'emotion and intensity are required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Process real-time updates
    const updateResponse = {
      success: true,
      timestamp: new Date().toISOString(),
      appliedUpdates: {
        emotion,
        intensity: Math.max(0, Math.min(1, intensity)),
        sessionId,
        particleCount: particleUpdates?.length || 0,
      },
      recommendations: generateEmotionRecommendations(emotion, intensity),
    }

    // Create audit log
    await createAuditLog(
      'particle_system_update',
      'auth.components.particles.emotion.system.update',
      user.id,
      'auth-components-particles',
      {
        action: 'update_particle_system',
        emotion,
        intensity: Math.max(0, Math.min(1, intensity)),
        sessionId,
        particleCount: particleUpdates?.length || 0
      }
    )

    // TODO: Save particle interaction data for analytics
    // const repository = new AIRepository()
    // await repository.saveParticleInteraction(user.id, sessionId, updateResponse)

    logger.info('Processed particle system update', {
      emotion,
      intensity,
      sessionId,
      userId: user.id,
    })

    return new Response(JSON.stringify(updateResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    logger.error('Error processing particle system update', { error })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.components.particles.emotion.system.error',
      'anonymous',
      'auth-components-particles',
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
function calculateEmotionProfile(sessionEmotions: any[]) {
  const emotionCounts = new Map<
    string,
    { count: number; totalIntensity: number }
  >()
  let totalIntensity = 0
  let intensityValues: number[] = []

  sessionEmotions.forEach((emotion) => {
    const emotionName = emotion.primaryEmotion || emotion.emotion || 'neutral'
    const intensity = emotion.confidence || emotion.intensity || 0.5

    const current = emotionCounts.get(emotionName) || {
      count: 0,
      totalIntensity: 0,
    }
    emotionCounts.set(emotionName, {
      count: current.count + 1,
      totalIntensity: current.totalIntensity + intensity,
    })

    totalIntensity += intensity
    intensityValues.push(intensity)
  })

  // Find dominant emotion
  let dominantEmotion = 'neutral'
  let maxCount = 0

  const emotionMix: Record<string, number> = {}
  emotionCounts.forEach((stats, emotion) => {
    const percentage = stats.count / sessionEmotions.length
    emotionMix[emotion] = percentage

    if (stats.count > maxCount) {
      maxCount = stats.count
      dominantEmotion = emotion
    }
  })

  // Calculate volatility (standard deviation of intensities)
  const averageIntensity = totalIntensity / sessionEmotions.length
  const variance =
    intensityValues.reduce(
      (sum, val) => sum + Math.pow(val - averageIntensity, 2),
      0,
    ) / intensityValues.length
  const volatility = Math.sqrt(variance)

  return {
    dominantEmotion,
    emotionMix,
    averageIntensity,
    volatility,
  }
}

function getEnvironmentFactors(emotion: string, volatility: number) {
  const baseFactors = {
    gravity: 0.1,
    friction: 0.02,
    turbulence: 0.1,
    magnetism: 0.05,
  }

  switch (emotion) {
    case 'joy':
      return {
        gravity: 0.05, // Lighter, more floating
        friction: 0.01,
        turbulence: 0.15 + volatility * 0.1,
        magnetism: 0.08,
      }
    case 'sadness':
      return {
        gravity: 0.2, // Heavier, sinking
        friction: 0.05,
        turbulence: 0.05,
        magnetism: 0.02,
      }
    case 'anger':
      return {
        gravity: 0.1,
        friction: 0.01,
        turbulence: 0.3 + volatility * 0.2, // More chaotic
        magnetism: 0.1,
      }
    case 'fear':
      return {
        gravity: 0.15,
        friction: 0.03,
        turbulence: 0.25 + volatility * 0.15, // Jittery
        magnetism: 0.03,
      }
    case 'surprise':
      return {
        gravity: 0.05,
        friction: 0.01,
        turbulence: 0.4, // Very dynamic
        magnetism: 0.12,
      }
    default:
      return baseFactors
  }
}

function getVisualSettings(complexity: 'low' | 'medium' | 'high') {
  switch (complexity) {
    case 'low':
      return {
        showTrails: false,
        showConnections: false,
        colorMode: 'emotion' as const,
        particleStyle: 'point' as const,
      }
    case 'medium':
      return {
        showTrails: true,
        showConnections: false,
        colorMode: 'emotion' as const,
        particleStyle: 'sphere' as const,
      }
    case 'high':
      return {
        showTrails: true,
        showConnections: true,
        colorMode: 'intensity' as const,
        particleStyle: 'glow' as const,
      }
  }
}

function generateEmotionParticles(
  config: ParticleSystemConfig,
  emotionProfile: any,
): ParticleConfig[] {
  const particles: ParticleConfig[] = []
  const { particleCount, emotion } = config

  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2
    const radius = 2 + Math.random() * 3
    const height = (Math.random() - 0.5) * 4

    // Select emotion for this particle based on emotion mix
    let particleEmotion = emotion as ParticleConfig['emotion']
    const rand = Math.random()
    let cumulative = 0

    for (const [emo, percentage] of Object.entries(emotionProfile.emotionMix)) {
      cumulative += percentage
      if (rand <= cumulative) {
        particleEmotion = emo as ParticleConfig['emotion']
        break
      }
    }

    const particle: ParticleConfig = {
      id: `particle-${i}`,
      position: [
        Math.cos(angle) * radius + (Math.random() - 0.5) * 1,
        height,
        Math.sin(angle) * radius + (Math.random() - 0.5) * 1,
      ],
      velocity: [
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
      ],
      color: getEmotionColor(particleEmotion),
      size: 0.08 + Math.random() * 0.12,
      emotion: particleEmotion,
      intensity: 0.3 + Math.random() * 0.7,
      lifetime: 30 + Math.random() * 60, // seconds
      behavior: {
        movementPattern: getMovementPattern(particleEmotion),
        interactionRadius: 0.5 + Math.random() * 0.5,
        attraction: Math.random() * 0.1,
        repulsion: Math.random() * 0.05,
      },
    }

    particles.push(particle)
  }

  return particles
}

function getEmotionColor(emotion: string): string {
  const colors = {
    joy: '#FFD700', // Gold
    sadness: '#4682B4', // Steel Blue
    anger: '#DC143C', // Crimson
    fear: '#9932CC', // Dark Orchid
    surprise: '#FF69B4', // Hot Pink
    disgust: '#228B22', // Forest Green
    neutral: '#708090', // Slate Gray
  }

  return colors[emotion as keyof typeof colors] || colors.neutral
}

function getMovementPattern(
  emotion: string,
): 'flow' | 'orbit' | 'chaos' | 'pulse' | 'spiral' {
  switch (emotion) {
    case 'joy':
      return 'flow'
    case 'sadness':
      return 'pulse'
    case 'anger':
      return 'chaos'
    case 'fear':
      return 'chaos'
    case 'surprise':
      return 'spiral'
    default:
      return 'orbit'
  }
}

function generateEmotionRecommendations(emotion: string, intensity: number) {
  const recommendations = {
    visualAdjustments: [] as string[],
    therapeuticInsights: [] as string[],
    interactionSuggestions: [] as string[],
  }

  if (intensity > 0.8) {
    recommendations.visualAdjustments.push(
      'Increase particle density for high emotional intensity',
    )
    recommendations.therapeuticInsights.push(
      'High emotional intensity detected - consider grounding techniques',
    )
  }

  if (emotion === 'anger' && intensity > 0.6) {
    recommendations.visualAdjustments.push('Enable chaos movement pattern')
    recommendations.therapeuticInsights.push(
      'Anger pattern suggests need for calming interventions',
    )
    recommendations.interactionSuggestions.push(
      'Try slow, circular mouse movements to reduce particle agitation',
    )
  }

  if (emotion === 'sadness') {
    recommendations.visualAdjustments.push('Reduce particle buoyancy')
    recommendations.therapeuticInsights.push(
      'Sadness pattern - consider uplift strategies',
    )
  }

  return recommendations
}
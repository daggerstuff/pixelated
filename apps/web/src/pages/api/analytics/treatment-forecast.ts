// import type { APIContext } from 'astro'
import { z } from 'zod'

import { collectContext } from '@/lib/ai/services/ContextualAwarenessService'
import {
  TherapySessionSchema,
  ChatSessionSchema,
  EmotionStateSchema,
  MentalHealthAnalysisSchema,
} from '@/lib/ai/services/outcome-recommendation-types'
import { recommend } from '@/lib/ai/services/OutcomeRecommendationEngine'

// Input schema for validation
const ForecastRequestSchema = z.object({
  session: TherapySessionSchema,
  chatSession: ChatSessionSchema,
  recentEmotionState: EmotionStateSchema.nullable(),
  recentInterventions: z.array(z.string()),
  userPreferences: z.record(z.string(), z.unknown()).optional(),
  mentalHealthAnalysis: MentalHealthAnalysisSchema.optional(),
  clientId: z.string().optional(),
  desiredOutcomes: z.array(z.string()).min(1),
  maxResults: z.number().min(1).max(10).optional(),
})

export const post = async ({ request }: { request: Request }) => {
  try {
    const body = await request.json()
    const parsed = ForecastRequestSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid input',
          details: z.flattenError(parsed.error),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const {
      session,
      chatSession,
      recentEmotionState,
      recentInterventions,
      userPreferences,
      mentalHealthAnalysis,
      desiredOutcomes,
      maxResults,
    } = parsed.data

    // Construct context factors securely
    const context = collectContext({
      session: { ...session, sessionId: session.id },
      chatSession,
      recentEmotionState: recentEmotionState as Record<string, unknown>,
      recentInterventions,
      ...(userPreferences !== undefined ? { userPreferences } : {}),
      mentalHealthAnalysis,
    })

    // Generate recommendations (forecasts)
    const forecasts = recommend({
      context,
      desiredOutcomes,
      maxResults: maxResults ?? 5,
    })

    // Structure response
    return new Response(
      JSON.stringify({ success: true, data: { forecasts } }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (err: unknown) {
    // Log securely (avoid leaking sensitive data)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

// import type { APIContext } from 'astro'
import { z } from 'zod'
import { recommend } from '@/lib/ai/services/OutcomeRecommendationEngine'
import { collectContext } from '@/lib/ai/services/ContextualAwarenessService'
import {
  TherapySessionSchema,
  ChatSessionSchema,
  EmotionStateSchema,
  MentalHealthAnalysisSchema
} from '@/lib/ai/services/outcome-recommendation-types';


// Input schema for validation
const ForecastRequestSchema = z.object({
  session: TherapySessionSchema,
  chatSession: ChatSessionSchema,
  recentEmotionState: EmotionStateSchema.nullable(),
  recentInterventions: z.array(z.string()),
  userPreferences: z.record(z.string(), z.unknown()).optional(),
  mentalHealthAnalysis: MentalHealthAnalysisSchema.optional(),
  desiredOutcomes: z.array(z.string()).min(1),
  maxResults: z.number().min(1).max(10).optional(),
})

export const post = async ({ request }) => {
  try {
    const body = await request.json()
    const parsed = ForecastRequestSchema.safeParse(body)
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid input',
          details: parsed.error.flatten(),
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
      session,
      chatSession,
      recentEmotionState,
      recentInterventions,
      ...(userPreferences !== undefined ? { userPreferences } : {}),
      mentalHealthAnalysis,
    })

    // Generate recommendations (forecasts)
    const forecasts = recommend({
      context,
      desiredOutcomes,
      maxResults: maxResults || 5,
    })

    // Structure response
    return new Response(
      JSON.stringify({ success: true, data: { forecasts } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err: unknown) {
    // Log securely (avoid leaking sensitive data)
    console.error('Treatment forecast API error:', err)
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

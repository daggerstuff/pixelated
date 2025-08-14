import type { APIRoute, APIContext } from 'astro'
import { protectRoute } from '@/lib/auth/serverAuth'
import {
  getOrCreateUserSettings,
  updateUserSettings,
} from '@/lib/db/user-settings'
import { createBuildSafeLogger } from '../../../../../../lib/logging/build-safe-logger'

// Replace Supabase Json type with MongoDB-compatible type
type JsonValue = string | number | boolean | null | JsonObject | JsonValue[]
interface JsonObject {
  [key: string]: JsonValue
}

const logger = createBuildSafeLogger('preferences-api')

interface AIPreferences {
  defaultModel: string
  preferredModels: string[]
  responseLength: string
  responseStyle: string
  enableSentimentAnalysis: boolean
  enableCrisisDetection: boolean
  crisisDetectionSensitivity: string
  saveAnalysisResults: boolean
  aiSuggestions: boolean
}

const DEFAULT_AI_PREFERENCES: AIPreferences = {
  defaultModel: 'gemini-2-flash',
  preferredModels: ['gemini-2-flash', 'claude-3-sonnet'],
  responseLength: 'medium',
  responseStyle: 'balanced',
  enableSentimentAnalysis: true,
  enableCrisisDetection: true,
  crisisDetectionSensitivity: 'medium',
  saveAnalysisResults: true,
  aiSuggestions: true,
}

function validateAIPreferences(input: unknown): asserts input is AIPreferences {
  if (typeof input !== 'object' || input == null) {
    throw new Error('Invalid preferences object')
  }

  const preferences = input as Record<string, unknown>

  if (
    ![
      'gemini-2-flash',
      'gemini-2-flash-lite',
      'claude-3-opus',
      'claude-3-sonnet',
      'claude-3-haiku',
    ].includes(preferences['defaultModel'] as string)
  ) {
    throw new Error('Invalid defaultModel')
  }
  if (!Array.isArray(preferences['preferredModels'])) {
    throw new Error('preferredModels must be an array')
  }
  if (
    !['concise', 'medium', 'detailed'].includes(
      preferences['responseLength'] as string,
    )
  ) {
    throw new Error('Invalid responseLength')
  }
  if (
    !['supportive', 'balanced', 'direct'].includes(
      preferences['responseStyle'] as string,
    )
  ) {
    throw new Error('Invalid responseStyle')
  }
  if (typeof preferences['enableSentimentAnalysis'] !== 'boolean') {
    throw new Error('Invalid enableSentimentAnalysis')
  }
  if (typeof preferences['enableCrisisDetection'] !== 'boolean') {
    throw new Error('Invalid enableCrisisDetection')
  }
  if (
    !['low', 'medium', 'high'].includes(
      preferences['crisisDetectionSensitivity'] as string,
    )
  ) {
    throw new Error('Invalid crisisDetectionSensitivity')
  }
  if (typeof preferences['saveAnalysisResults'] !== 'boolean') {
    throw new Error('Invalid saveAnalysisResults')
  }
  if (typeof preferences['aiSuggestions'] !== 'boolean') {
    throw new Error('Invalid aiSuggestions')
  }
}

export const GET: APIRoute = protectRoute()(async ({ locals }) => {
  try {
    const { user } = locals
    const settings = await getOrCreateUserSettings(user.id)

    // Extract AI preferences with type safety
    const preferences = (settings.preferences as Record<string, unknown>) || {}
    const aiPrefs =
      (preferences['ai'] as AIPreferences) ?? DEFAULT_AI_PREFERENCES

    return new Response(JSON.stringify({ preferences: aiPrefs }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    logger.error('Error fetching AI preferences', { error })
    return new Response(
      JSON.stringify({ error: 'Failed to fetch preferences' }),
      { status: 500 },
    )
  }
})

export const PUT: APIRoute = protectRoute()(async ({ request, locals }) => {
  try {
    const { user } = locals
    const body = await request.json()
    if (!body || typeof body.preferences !== 'object') {
      return new Response(JSON.stringify({ error: 'Missing preferences' }), {
        status: 400,
      })
    }
    validateAIPreferences(body.preferences)
    const settings = await getOrCreateUserSettings(user.id, request)

    // Safely update preferences with proper type handling
    const currentPreferences =
      (settings.preferences as Record<string, unknown>) || {}
    const newPrefs = {
      ...currentPreferences,
      ai: body.preferences,
    }

    await updateUserSettings(
      user.id,
      { preferences: newPrefs as unknown as JsonValue },
      request,
    )
    logger.info('AI preferences updated', { userId: user.id })
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    logger.error('Error updating AI preferences', { error })
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update preferences',
      }),
      { status: 400 },
    )
  }
})

export const DELETE: APIRoute = protectRoute()(async ({ locals, request }) => {
  try {
    const { user } = locals
    const settings = await getOrCreateUserSettings(user.id, request)

    // Safely reset preferences with proper type handling
    const currentPreferences =
      (settings.preferences as Record<string, unknown>) || {}
    const newPrefs = {
      ...currentPreferences,
      ai: DEFAULT_AI_PREFERENCES,
    }

    await updateUserSettings(
      user.id,
      { preferences: newPrefs as unknown as JsonValue },
      request,
    )
    logger.info('AI preferences reset to defaults', { userId: user.id })
    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (error) {
    logger.error('Error resetting AI preferences', { error })
    return new Response(
      JSON.stringify({ error: 'Failed to reset preferences' }),
      { status: 500 },
    )
  }
})

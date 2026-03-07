/**
 * Auth0-based Preferences API Endpoint
 * Handles user preferences operations with Auth0 integration
 */

import type { APIRoute } from 'astro'
import { getUserById, updateUser } from '@/services/auth0.service'
import { validateToken } from '@/lib/auth/auth0-jwt-service'
import { extractTokenFromRequest } from '@/lib/auth/auth0-middleware'
import { createAuditLog } from '@/lib/audit'

// Replace Supabase Json type with MongoDB-compatible type
type JsonValue = string | number | boolean | null | JsonObject | JsonValue[]
interface JsonObject {
  [key: string]: JsonValue
}

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

/**
 * GET /api/auth/auth0-preferences - Get user AI preferences
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
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Extract AI preferences with type safety
    const preferences = (user.preferences as Record<string, unknown>) || {}
    const aiPrefs =
      (preferences['ai'] as AIPreferences) ?? DEFAULT_AI_PREFERENCES

    // Create audit log
    await createAuditLog(
      'preferences_access',
      'auth.preferences.access',
      user.id,
      'auth-preferences',
      { action: 'get_preferences' }
    )

    return new Response(JSON.stringify({ preferences: aiPrefs }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error fetching AI preferences', { error })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.preferences.error',
      'anonymous',
      'auth-preferences',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return new Response(
      JSON.stringify({ error: 'Failed to fetch preferences' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

/**
 * PUT /api/auth/auth0-preferences - Update user AI preferences
 */
export const PUT: APIRoute = async ({ request }) => {
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

    const body = await request.json()
    if (!body || typeof body.preferences !== 'object') {
      return new Response(JSON.stringify({ error: 'Missing preferences' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    validateAIPreferences(body.preferences)

    // Get current user
    const user = await getUserById(validation.userId!)

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Safely update preferences with proper type handling
    const currentPreferences =
      (user.preferences as Record<string, unknown>) || {}
    const newPrefs = {
      ...currentPreferences,
      ai: body.preferences,
    }

    // Update user in Auth0
    await updateUser(validation.userId!, { preferences: newPrefs })

    // Create audit log
    await createAuditLog(
      'preferences_update',
      'auth.preferences.update',
      user.id,
      'auth-preferences',
      { action: 'update_preferences' }
    )

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error updating AI preferences', { error })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.preferences.error',
      'anonymous',
      'auth-preferences',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? String(error)
            : 'Failed to update preferences',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

/**
 * DELETE /api/auth/auth0-preferences - Reset user AI preferences to defaults
 */
export const DELETE: APIRoute = async ({ request }) => {
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

    // Get current user
    const user = await getUserById(validation.userId!)

    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Safely reset preferences with proper type handling
    const currentPreferences =
      (user.preferences as Record<string, unknown>) || {}
    const newPrefs = {
      ...currentPreferences,
      ai: DEFAULT_AI_PREFERENCES,
    }

    // Update user in Auth0
    await updateUser(validation.userId!, { preferences: newPrefs })

    // Create audit log
    await createAuditLog(
      'preferences_reset',
      'auth.preferences.reset',
      user.id,
      'auth-preferences',
      { action: 'reset_preferences' }
    )

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error resetting AI preferences', { error })

    // Create audit log for the error
    await createAuditLog(
      'system_error',
      'auth.preferences.error',
      'anonymous',
      'auth-preferences',
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      }
    )

    return new Response(
      JSON.stringify({ error: 'Failed to reset preferences' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
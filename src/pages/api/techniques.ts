import { getCollection } from 'astro:content'
import { techniqueSchema, type TechniqueSchema } from '@/content/schema'
import { recommend } from '@/lib/ai/services/OutcomeRecommendationEngine'

import type { CollectionEntry } from 'astro:content'
// Removed: import type { APIContext } from 'astro/types'

// Define a type for API endpoints context
interface APIEndpointContext {
  request: Request
  params: Record<string, string>
  url: URL
}

const ALLOWED_CATEGORIES = ['CBT', 'Mindfulness', 'DBT', 'ACT', 'EMDR', 'Other']
const ALLOWED_EVIDENCE = ['Strong', 'Moderate', 'Preliminary', 'Anecdotal']

export async function GET({ request }: APIEndpointContext) {
  try {
    const url = new URL(request.url)
    const category = url.searchParams.get('category')
    const evidenceLevel = url.searchParams.get('evidenceLevel')

    // Validate query params
    let categoryFilter: string | undefined = undefined
    if (category) {
      if (!ALLOWED_CATEGORIES.includes(category)) {
        return new Response(
          JSON.stringify({ error: 'Invalid category parameter.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
      categoryFilter = category
    }
    let evidenceFilter: string | undefined = undefined
    if (evidenceLevel) {
      if (!ALLOWED_EVIDENCE.includes(evidenceLevel)) {
        return new Response(
          JSON.stringify({ error: 'Invalid evidenceLevel parameter.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        )
      }
      evidenceFilter = evidenceLevel
    }

    // Fetch all techniques
    const allTechniques = await getCollection('techniques')
    // Validate and filter
    const validTechniques = allTechniques
      .map((entry: CollectionEntry<'techniques'>) => {
        const parsed = techniqueSchema.safeParse(entry.data)
        return parsed.success ? parsed.data : null
      })
      .filter(Boolean)

    let filtered = validTechniques
    if (categoryFilter) {
      filtered = filtered.filter(
        (t: TechniqueSchema) => t.category === categoryFilter,
      )
    }
    if (evidenceFilter) {
      filtered = filtered.filter(
        (t: TechniqueSchema) => t.evidenceLevel === evidenceFilter,
      )
    }

    return new Response(JSON.stringify(filtered), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=600',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'same-origin',
        'Strict-Transport-Security':
          'max-age=63072000; includeSubDomains; preload',
      },
    })
  } catch (error) {
    console.error('GET /api/techniques error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function POST({ request }: APIEndpointContext) {
  try {
    if (request.headers.get('content-type') !== 'application/json') {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json' }),
        { status: 415, headers: { 'Content-Type': 'application/json' } },
      )
    }
    const body = await request.json()
    const { context, desiredOutcomes, maxResults } = body || {}

    // Basic input validation
    if (
      !context ||
      !Array.isArray(desiredOutcomes) ||
      desiredOutcomes.length === 0
    ) {
      return new Response(
        JSON.stringify({
          error: 'context and desiredOutcomes[] are required.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
    // Optionally, validate context structure (minimal check)
    if (!context.session || !context.chatSession) {
      return new Response(
        JSON.stringify({
          error: 'context.session and context.chatSession are required.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      )
    }
    // Defensive: limit maxResults
    const safeMaxResults =
      typeof maxResults === 'number' && maxResults > 0 && maxResults <= 10
        ? maxResults
        : 5

    // Generate recommendations
    let recommendations
    try {
      recommendations = recommend({
        context,
        desiredOutcomes,
        maxResults: safeMaxResults,
      })
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: 'Recommendation engine error',
          details: (err as Error).message,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      )
    }

    return new Response(JSON.stringify(recommendations), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'same-origin',
        'Strict-Transport-Security':
          'max-age=63072000; includeSubDomains; preload',
      },
    })
  } catch (error) {
    console.error('POST /api/techniques error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

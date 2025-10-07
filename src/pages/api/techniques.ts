import { getCollection } from 'astro:content'
import { recommend } from '../../lib/ai/services/OutcomeRecommendationEngine'

const ALLOWED_CATEGORIES = ['CBT', 'Mindfulness', 'DBT', 'ACT', 'EMDR', 'Other']
const ALLOWED_EVIDENCE = ['Strong', 'Moderate', 'Preliminary', 'Anecdotal']

export const GET = async ({ request }: { request: Request }) => {
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

    // Get techniques from content collection
    const techniques = await getCollection('techniques')
    
    // Filter techniques based on query parameters
    let filteredTechniques = techniques
    
    if (categoryFilter) {
      filteredTechniques = filteredTechniques.filter(
        technique => technique.data.category === categoryFilter
      )
    }
    
    if (evidenceFilter) {
      filteredTechniques = filteredTechniques.filter(
        technique => technique.data.evidenceLevel === evidenceFilter
      )
    }

    // Transform for API response
    const responseData = filteredTechniques.map(technique => ({
      id: technique.id,
      slug: technique.slug,
      title: technique.data.title,
      description: technique.data.description,
      category: technique.data.category,
      evidenceLevel: technique.data.evidenceLevel,
      duration: technique.data.duration,
      difficulty: technique.data.difficulty,
      tags: technique.data.tags || []
    }))

    return new Response(
      JSON.stringify({
        success: true,
        techniques: responseData,
        total: responseData.length,
        filters: {
          category: categoryFilter,
          evidenceLevel: evidenceFilter
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to fetch techniques',
        message: error instanceof Error ? String(error) : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

export const POST = async ({ request, cookies }) => {
  try {
    // Authentication check
    const sessionCookie = cookies.get('session')
    if (!sessionCookie) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const body = await request.json()
    const { patientData, preferences } = body

    if (!patientData) {
      return new Response(
        JSON.stringify({ error: 'Patient data is required for recommendations' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get AI recommendations
    const recommendationRequest = { ...patientData, ...preferences }
    const recommendations = await recommend(recommendationRequest)

    return new Response(
      JSON.stringify({
        success: true,
        recommendations,
        timestamp: Date.now()
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error: unknown) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to generate recommendations',
        message: error instanceof Error ? String(error) : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

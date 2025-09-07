// import type { APIRoute, APIContext } from 'astro'
import type { AIMessage } from '../../../lib/ai/models/ai-types.js'
// Import the type expected by InterventionAnalysisService
import { InterventionAnalysisService } from '../../../lib/ai/services/intervention-analysis'
import { createTogetherAIService } from '../../../lib/ai/services/together'
import { createAuditLog, AuditEventType } from '../../../lib/audit'
import { getSession } from '../../../lib/auth/session.js'
import { aiRepository } from '@/lib/db/ai'
import { AIService } from '@/lib/ai/models/ai-types'

/**
 * @typedef {import('astro').APIContext} APIContext
 */

/**
 * API route for intervention effectiveness analysis
 */
export const POST = async ({ request }) => {
  let session: Awaited<ReturnType<typeof getSession>> | null = null

  try {
    // Verify session
    session = await getSession(request)
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Parse request body
    const body = await request.json()
    const { conversation, interventionMessage, userResponse, batch, model } =
      body

    // Validate required fields
    if (!(conversation && interventionMessage && userResponse) && !batch) {
      return new Response(
        JSON.stringify({
          error:
            'Either conversation, interventionMessage, and userResponse or batch is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Create AI service
    const envVars = import.meta.env as Record<string, string | undefined>
    const {
      TOGETHER_API_KEY: togetherApiKey = '',
      TOGETHER_BASE_URL: togetherBaseUrl,
    } = envVars

    const aiService = createTogetherAIService(
      togetherBaseUrl
        ? { togetherApiKey, togetherBaseUrl, apiKey: '' }
        : { togetherApiKey, apiKey: '' },
    )

    // Use the model from the request or the default model
    const modelId = model || 'mistralai/Mixtral-8x7B-Instruct-v0.2'

    // Create intervention analysis service
    const interventionService = new InterventionAnalysisService({
      aiService: aiService as unknown as AIService, // Force the type to match what InterventionAnalysisService expects
      model: modelId,
    })

    // Log the request
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.intervention.request',
      session?.user?.id || 'anonymous',
      'intervention-analysis',
      {
        model: modelId,
        batchSize: batch ? batch.length : 0,
      },
    )

    // Start timer for latency measuremen
    const startTime = Date.now()

    // Process the request
    let result: unknown
    if (batch) {
      result = await interventionService.analyzeBatch(batch)

      // Store each result in the database
      for (const [i, analysis] of (
        result as import('../../../lib/ai/services/intervention-analysis').InterventionAnalysisResult[]
      ).entries()) {
        const latencyMs = Date.now() - startTime
        const batchItem = batch[i]

        await aiRepository.storeInterventionAnalysis({
          userId: session?.user?.id,
          modelId,
          modelProvider: 'together',
          requestTokens: 0, // No usage information available
          responseTokens: 0, // No usage information available
          totalTokens: 0, // No usage information available
          latencyMs,
          success: true,
          error: null,
          conversation: JSON.stringify(batchItem.conversation),
          intervention: batchItem.interventionMessage,
          userResponse: batchItem.userResponse,
          effectiveness: analysis.effectiveness_score,
          insights: JSON.stringify({
            key_insights: analysis.key_insights ?? [],
          }),
          recommendedFollowUp: analysis.improvement_suggestions
            ? analysis.improvement_suggestions.join('\n')
            : '',
          metadata: {
            batchIndex: i,
            batchSize: batch.length,
          },
        })
      }
    } else {
      // Convert conversation to AIMessage[] if it's not already
      const conversationMessages = Array.isArray(conversation)
        ? conversation
        : ([{ role: 'user', content: conversation, name: '' }] as AIMessage[])

      result = await interventionService.analyzeIntervention(
        conversationMessages,
        interventionMessage,
        userResponse,
      )

      const latencyMs = Date.now() - startTime

      // Store the result in the database
      await aiRepository.storeInterventionAnalysis({
        userId: session?.user?.id || 'anonymous',
        modelId,
        modelProvider: 'together',
        requestTokens: 0, // No usage information available
        responseTokens: 0, // No usage information available
        totalTokens: 0, // No usage information available
        latencyMs,
        success: true,
        error: null,
        conversation: JSON.stringify(conversationMessages),
        intervention: interventionMessage,
        userResponse,
        effectiveness: (
          result as import('../../../lib/ai/services/intervention-analysis').InterventionAnalysisResult
        ).effectiveness_score,
        insights: JSON.stringify({
          key_insights:
            (
              result as import('../../../lib/ai/services/intervention-analysis').InterventionAnalysisResult
            ).key_insights ?? [],
        }),
        recommendedFollowUp: (
          result as import('../../../lib/ai/services/intervention-analysis').InterventionAnalysisResult
        ).improvement_suggestions
          ? (
              result as import('../../../lib/ai/services/intervention-analysis').InterventionAnalysisResult
            ).improvement_suggestions.join('\n')
          : '',
        metadata: {},
      })
    }

    // Log the response
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.intervention.response',
      session?.user?.id || 'anonymous',
      'intervention-analysis',
      {
        model: modelId,
        resultCount: Array.isArray(result) ? result.length : 1,
        latencyMs: Date.now() - startTime,
      },
    )

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    console.error('Error in intervention analysis API:', error)

    // Create audit log for the error
    await createAuditLog(
      AuditEventType.AI_OPERATION,
      'ai.intervention.error',
      session?.user?.id || 'anonymous',
      'intervention-analysis',
      {
        error: error instanceof Error ? String(error) : String(error),
        stack: error instanceof Error ? (error as Error)?.stack : undefined,
        status: 'error',
      },
    )

    return new Response(
      JSON.stringify({
        error: 'An error occurred during intervention analysis',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
  }
}

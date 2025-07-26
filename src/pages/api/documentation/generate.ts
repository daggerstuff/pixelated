import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { getCurrentUser } from '@/lib/auth'
import { DocumentationService } from '../../../lib/documentation'
import { AIRepository } from '../../../lib/db/ai/repository'
import { AIMessage, AIServiceOptions, createTogetherAIService } from '../../../lib/ai/AIService'

const logger = createBuildSafeLogger('documentation-api')

// Instantiate dependencies for DocumentationService
const repository = new AIRepository()
const togetherConfig = {
  togetherApiKey: process.env['TOGETHER_API_KEY'] || 'dummy-key',
  apiKey: process.env['TOGETHER_API_KEY'] || 'dummy-key'
};
// Create the base service
const baseAiService = createTogetherAIService(togetherConfig);
// Add a stub getModelInfo to satisfy the AIService interface
const aiService = {
  ...baseAiService,
  getModelInfo: () => ({
    id: 'dummy-model',
    name: 'Dummy Model',
    provider: 'together',
    capabilities: ['chat'],
    contextWindow: 2048,
    maxTokens: 1024,
  }),
  generateCompletion: async (messages: AIMessage[], options: AIServiceOptions | undefined) => {
    const result = await baseAiService.generateCompletion(messages, options);
    if ('id' in result) {
      return result;
    }
    // Convert plain result to minimal AICompletion
    return {
      id: 'dummy-completion',
      created: Date.now(),
      model: 'dummy-model',
      choices: [
        {
          message: {
            role: 'assistant' as const,
            content: result.content,
          },
          finishReason: 'stop' as const,
        },
      ],
      usage: result.usage || {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
      provider: 'together',
      content: result.content,
    } as import('../../../lib/ai/models/ai-types').AICompletion;
  }
};
const documentationService = new DocumentationService(repository, aiService)

export const POST = async ({ request }: { request: Request }) => {
  try {
    // Authenticate request
    // To get cookies in Astro API route, use the request.headers
    // We'll create a minimal cookies API compatible with getCurrentUser
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = {
      get: (name: string) => {
        const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`));
        return match ? { value: match[1] } : undefined;
      },
    };

    const user = await getCurrentUser(cookies);
    if (!user) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: 'You must be authenticated to access this endpoint',
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // Check admin permission
    if (user.role !== 'admin') {
      return new Response(
        JSON.stringify({
          error: 'Forbidden',
          message: 'You do not have permission to generate documentation',
        }),
        {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // Parse request body
    const body = await request.json()
    const { section, options } = body

    if (!section) {
      return new Response(
        JSON.stringify({
          error: 'Bad Request',
          message: 'section parameter is required',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
    }

    // Generate documentation
    const result = await documentationService.generateDocumentation(section, options)

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  } catch (error) {
    logger.error('Error generating documentation:', error)

    return new Response(
      JSON.stringify({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
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

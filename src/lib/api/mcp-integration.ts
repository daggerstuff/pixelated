/**
 * MCP (Model Context Protocol) Integration API
 * Provides unified interface for AI model communication and context management
 */

import type { APIContext } from 'astro'
import { getLogger } from '@/lib/utils/logger'

const logger = getLogger('mcp-integration')

export interface MCPRequest {
  method: string
  params?: Record<string, unknown>
  context?: Record<string, unknown>
}

export interface MCPResponse {
  success: boolean
  data?: unknown
  error?: string
  context?: Record<string, unknown>
}

export interface MCPModelConfig {
  modelId: string
  endpoint: string
  apiKey?: string
  maxTokens?: number
  temperature?: number
}

export class MCPIntegration {
  private config: MCPModelConfig
  private isInitialized: boolean = false

  constructor(config: MCPModelConfig) {
    this.config = config
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing MCP integration', {
        modelId: this.config.modelId,
      })

      // Validate configuration
      if (!this.config.endpoint) {
        throw new Error('MCP endpoint is required')
      }

      // Test connection
      await this.healthCheck()

      this.isInitialized = true
      logger.info('MCP integration initialized successfully')
    } catch (error) {
      logger.error('Failed to initialize MCP integration', { error })
      throw error
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.endpoint}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && {
            Authorization: `Bearer ${this.config.apiKey}`,
          }),
        },
      })

      return response.ok
    } catch (error) {
      logger.error('MCP health check failed', { error })
      return false
    }
  }

  async sendRequest(request: MCPRequest): Promise<MCPResponse> {
    if (!this.isInitialized) {
      throw new Error('MCP integration not initialized')
    }

    try {
      logger.debug('Sending MCP request', { method: request.method })

      const response = await fetch(`${this.config.endpoint}/api/mcp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && {
            Authorization: `Bearer ${this.config.apiKey}`,
          }),
        },
        body: JSON.stringify(request),
      })

      if (!response.ok) {
        throw new Error(
          `MCP request failed: ${response.status} ${response.statusText}`,
        )
      }

      const data = await response.json()
      return data as MCPResponse
    } catch (error) {
      logger.error('MCP request failed', { error, method: request.method })
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  async processConversation(
    messages: Array<{ role: string; content: string }>,
  ): Promise<MCPResponse> {
    return this.sendRequest({
      method: 'process_conversation',
      params: {
        messages,
        model_config: {
          max_tokens: this.config.maxTokens || 1000,
          temperature: this.config.temperature || 0.7,
        },
      },
    })
  }

  async analyzeContext(
    content: string,
    contextType: string = 'therapeutic',
  ): Promise<MCPResponse> {
    return this.sendRequest({
      method: 'analyze_context',
      params: {
        content,
        context_type: contextType,
      },
    })
  }

  async validateSafety(content: string): Promise<MCPResponse> {
    return this.sendRequest({
      method: 'validate_safety',
      params: {
        content,
      },
    })
  }
}

// Singleton instance
let mcpInstance: MCPIntegration | null = null

export function getMCPIntegration(): MCPIntegration {
  if (!mcpInstance) {
    const config: MCPModelConfig = {
      modelId: process.env.MCP_MODEL_ID || 'default',
      endpoint: process.env.MCP_ENDPOINT || 'http://localhost:8000',
      apiKey: process.env.MCP_API_KEY,
      maxTokens: parseInt(process.env.MCP_MAX_TOKENS || '1000'),
      temperature: parseFloat(process.env.MCP_TEMPERATURE || '0.7'),
    }

    mcpInstance = new MCPIntegration(config)
  }

  return mcpInstance
}

// API Route handlers
export async function POST(context: APIContext) {
  try {
    const mcp = getMCPIntegration()

    if (!mcp) {
      return new Response(
        JSON.stringify({ error: 'MCP integration not available' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    const request = (await context.request.json()) as MCPRequest
    const response = await mcp.sendRequest(request)

    return new Response(JSON.stringify(response), {
      status: response.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    logger.error('MCP API request failed', { error })

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

export async function GET(_context: APIContext) {
  try {
    const mcp = getMCPIntegration()
    const isHealthy = await mcp.healthCheck()

    return new Response(
      JSON.stringify({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
      }),
      {
        status: isHealthy ? 200 : 503,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

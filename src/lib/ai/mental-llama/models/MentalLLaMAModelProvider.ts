import config from '../../../../config/env.config.ts'
import type {
  IModelProvider,
  LLMInvocationOptions,
  LLMResponse,
} from '../types/mentalLLaMATypes.ts'

const MODEL_INFO: Record<string, { name: string; version: string; capabilities: string[] }> = {
  '7B': {
    name: 'MentalLLaMA-7B',
    version: '7B',
    capabilities: ['chat', 'text-generation', 'mental-health-analysis'],
  },
  '13B': {
    name: 'MentalLLaMA-13B',
    version: '13B',
    capabilities: ['chat', 'text-generation', 'mental-health-analysis', 'advanced-reasoning'],
  },
}

export class MentalLLaMAModelProvider implements IModelProvider {
  private readonly modelTier: string
  private readonly endpointUrl: string | undefined
  private readonly apiKey: string | undefined

  constructor(modelTier: string = '7B') {
    this.modelTier = modelTier
    this.endpointUrl =
      modelTier === '13B'
        ? config.mentalLLaMA.endpointUrl13B()
        : config.mentalLLaMA.endpointUrl7B()
    this.apiKey = config.mentalLLaMA.apiKey()
  }

  async invoke(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: LLMInvocationOptions,
  ): Promise<LLMResponse> {
    if (!this.endpointUrl) {
      throw new Error(`MentalLLaMA endpoint URL not configured for model tier: ${this.modelTier}`)
    }

    const body: Record<string, unknown> = {
      messages,
      model: options?.model ?? this.modelTier,
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      ...(options?.max_tokens !== undefined && { max_tokens: options.max_tokens }),
      ...(options?.top_p !== undefined && { top_p: options.top_p }),
      ...(options?.stop !== undefined && { stop: options.stop }),
      ...(options?.stream !== undefined && { stream: options.stream }),
    }

    const response = await fetch(this.endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`MentalLLaMA request failed: ${response.status} ${response.statusText}`)
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string }; finish_reason?: string }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
      model?: string
    }

    const content = data.choices?.[0]?.message?.content ?? ''
    const finishReason = data.choices?.[0]?.finish_reason as LLMResponse['finishReason']

    return {
      content,
      finishReason: finishReason ?? 'stop',
      usage: data.usage,
      model: data.model ?? this.modelTier,
    }
  }

  getModelInfo() {
    return MODEL_INFO[this.modelTier] ?? MODEL_INFO['7B']
  }

  async isAvailable(): Promise<boolean> {
    return !!this.endpointUrl
  }
}

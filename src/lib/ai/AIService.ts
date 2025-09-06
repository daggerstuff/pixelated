export interface AIMessage {
  role: 'user' | 'assistant' | 'system' | 'function' | 'data' | 'tool';
  content: string;
  name?: string;
  id?: string;
  createdAt?: Date;
  metadata?: Record<string, any>;
}

export interface AIStreamChunk {
  content?: string;
  finishReason?: 'stop' | 'length' | 'function_call' | 'content_filter' | 'tool_calls';
  done?: boolean;
  id?: string;
  model?: string;
  created?: number;
  choices?: Array<{
    delta: {
      content?: string;
    };
    finish_reason: string;
    index: number;
  }>;
}

export interface AIServiceOptions {
  apiKey: string;
  baseUrl?: string;
}

export class AIService {
  private apiKey: string;
  private baseUrl: string;

  constructor(options: AIServiceOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl || 'https://api.openai.com/v1';
  }

  async createCompletion(
    messages: AIMessage[],
    model: string = 'gpt-3.5-turbo',
    stream: boolean = false
  ): Promise<any> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error.message);
    }

    if (stream) {
      return response.body;
    }

    return response.json();
  }
}

// Minimal placeholder for AIService
export function runAIService() {
  // Return dummy result for now
  return { result: 'ok' };
}

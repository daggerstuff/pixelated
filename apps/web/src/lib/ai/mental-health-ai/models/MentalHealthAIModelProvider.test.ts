import { getEnv } from '../../../../config/env.config.js'
import { MentalHealthAIModelProvider } from './MentalHealthAIModelProvider.ts'

// Mock getEnv
vi.mock('../../../../config/env.config.js', () => ({
  getEnv: vi.fn(),
}))

// Mock logger
vi.mock('src/lib/utils/logger.ts', () => ({
  getLogger: vi.fn().mockReturnValue({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

describe('MentalHealthAIModelProvider', () => {
  const mockApiKey = 'test-api-key'
  const mockAccountId = 'test-account-id'
  const mockEndpoint = `https://api.cloudflare.com/client/v4/accounts/${mockAccountId}/ai/v1/chat/completions`
  const MODEL_ID = '@cf/mistralai/mistral-small-3.1-24b-instruct'

  beforeEach(() => {
    vi.mocked(getEnv).mockReturnValue({
      CLOUDFLARE_AI_API_KEY: mockApiKey,
      CLOUDFLARE_ACCOUNT_ID: mockAccountId,
    } as unknown as ReturnType<typeof getEnv>)

    // Stub global fetch
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with 7B model configuration by default', () => {
    const provider = new MentalHealthAIModelProvider()
    expect(provider.getModelTier()).toBe('7B')
    expect(provider.getModelConfig()).toEqual({
      modelId: MODEL_ID,
      endpointUrl: mockEndpoint,
      apiKey: mockApiKey,
      providerType: 'custom_api',
    })
  })

  it('should initialize with 13B model configuration', () => {
    const provider = new MentalHealthAIModelProvider('13B')
    expect(provider.getModelTier()).toBe('13B')
    expect(provider.getModelConfig()).toEqual({
      modelId: MODEL_ID,
      endpointUrl: mockEndpoint,
      apiKey: mockApiKey,
      providerType: 'custom_api',
    })
  })

  it('should create mock configuration if API key is missing', () => {
    vi.mocked(getEnv).mockReturnValue({
      CLOUDFLARE_ACCOUNT_ID: mockAccountId,
    } as unknown as ReturnType<typeof getEnv>)
    const provider = new MentalHealthAIModelProvider()
    expect(provider.getModelConfig()).toEqual({
      modelId: 'mock-mental-health-ai-7B',
      providerType: 'custom_api',
    })
  })

  it('should create mock configuration if account ID is missing', () => {
    vi.mocked(getEnv).mockReturnValue({
      CLOUDFLARE_AI_API_KEY: mockApiKey,
    } as unknown as ReturnType<typeof getEnv>)
    const provider = new MentalHealthAIModelProvider('7B')
    expect(provider.getModelConfig()).toEqual({
      modelId: 'mock-mental-health-ai-7B',
      providerType: 'custom_api',
    })
  })

  it('should create mock configuration if account ID is missing for 13B tier', () => {
    vi.mocked(getEnv).mockReturnValue({
      CLOUDFLARE_AI_API_KEY: mockApiKey,
    } as unknown as ReturnType<typeof getEnv>)
    const provider = new MentalHealthAIModelProvider('13B')
    expect(provider.getModelConfig()).toEqual({
      modelId: 'mock-mental-health-ai-13B',
      providerType: 'custom_api',
    })
  })

  describe('chat method', () => {
    const messages: Array<{
      role: 'system' | 'user' | 'assistant'
      content: string
    }> = [{ role: 'user', content: 'Hello' }]
    const options = { temperature: 0.5 }

    it('should make a successful API call and return content', async () => {
      const provider = new MentalHealthAIModelProvider()
      const mockResponse = {
        choices: [{ message: { content: 'Hi there!' } }],
      }
      ;void (fetch as unknown as { mockResolvedValue: (v: unknown) => Promise<unknown> }).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await provider.chat(messages, options)

      expect(fetch).toHaveBeenCalledWith(mockEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${mockApiKey}`,
        },
        body: JSON.stringify({
          model: MODEL_ID,
          messages,
          ...options,
        }),
      })
      expect(result).toBe('Hi there!')
    })

    it('should throw an error if API request fails (response not ok)', async () => {
      const provider = new MentalHealthAIModelProvider()
      ;void (fetch as unknown as { mockResolvedValue: (v: unknown) => Promise<unknown> }).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })

      await expect(provider.chat(messages, options)).rejects.toThrow(
        `API request to ${MODEL_ID} failed with status 500: Internal Server Error`,
      )
    })

    it('should throw an error if API response has invalid structure', async () => {
      const provider = new MentalHealthAIModelProvider()
      ;void (fetch as unknown as { mockResolvedValue: (v: unknown) => Promise<unknown> }).mockResolvedValue({
        ok: true,
        json: async () => ({}), // Invalid structure
      })

      await expect(provider.chat(messages, options)).rejects.toThrow(
        'Invalid response structure from MentalHealthAI API.',
      )
    })

    it('should throw an error if fetch itself fails (network error)', async () => {
      const provider = new MentalHealthAIModelProvider()
      ;void (fetch as unknown as { mockRejectedValue: (v: Error) => Promise<unknown> }).mockRejectedValue(
        new Error('Network connection failed'),
      )

      await expect(provider.chat(messages, options)).rejects.toThrow(
        'Network connection failed',
      )
    })

    it('should throw error when chat method is called with mock configuration', async () => {
    vi.mocked(getEnv).mockReturnValue({
        CLOUDFLARE_ACCOUNT_ID: mockAccountId,
    } as unknown as ReturnType<typeof getEnv>)
      const provider = new MentalHealthAIModelProvider()
      await expect(provider.chat(messages, options)).rejects.toThrow(
        'MentalHealthAI model mock-mental-health-ai-7B is not properly configured for actual API calls',
      )
    })

    it('should create a provider with mock configuration when constructor is called with missing API key', () => {
    vi.mocked(getEnv).mockReturnValue({
        CLOUDFLARE_ACCOUNT_ID: mockAccountId,
    } as unknown as ReturnType<typeof getEnv>)
      const provider = new MentalHealthAIModelProvider()
      expect(provider.getModelConfig().modelId).toBe('mock-mental-health-ai-7B')
      expect(provider.getModelConfig().providerType).toBe('custom_api')
    })
  })
})

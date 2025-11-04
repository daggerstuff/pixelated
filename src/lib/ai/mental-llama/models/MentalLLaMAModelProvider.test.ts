import { MentalLLaMAModelProvider } from './MentalLLaMAModelProvider.ts'
import { getEnv } from '../../../../config/env.config.js'

// Mock getEnv
vi.mock('src/config/env.config.ts', () => ({
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

describe('MentalLLaMAModelProvider', () => {
  const mockApiKey = 'test-api-key'
  const mockEndpoint7B = 'http://localhost/v1/chat/completions-7b'
  const mockEndpoint13B = 'http://localhost/v1/chat/completions-13b'

  beforeEach(() => {
    vi.mocked(getEnv).mockReturnValue({
      MENTALLAMA_API_KEY: mockApiKey,
      MENTALLAMA_ENDPOINT_URL_7B: mockEndpoint7B,
      MENTALLAMA_ENDPOINT_URL_13B: mockEndpoint13B,
      // other env vars if needed by logger or other parts
    } as unknown)

    // Stub global fetch
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize with 7B model configuration by default', () => {
    const provider = new MentalLLaMAModelProvider()
    expect(provider.getModelTier()).toBe('7B')
    expect(provider.getModelConfig()).toEqual({
      modelId: 'mentalllama-chat-7B',
      endpointUrl: mockEndpoint7B,
      apiKey: mockApiKey,
      providerType: 'custom_api',
    })
  })

  it('should initialize with 13B model configuration', () => {
    const provider = new MentalLLaMAModelProvider('13B')
    expect(provider.getModelTier()).toBe('13B')
    expect(provider.getModelConfig()).toEqual({
      modelId: 'mentalllama-chat-13B',
      endpointUrl: mockEndpoint13B,
      apiKey: mockApiKey,
      providerType: 'custom_api',
    })
  })

  it('should create mock configuration if API key is missing', () => {
    vi.mocked(getEnv).mockReturnValue({
      MENTALLAMA_ENDPOINT_URL_7B: mockEndpoint7B,
    } as unknown)
    const provider = new MentalLLaMAModelProvider()
    expect(provider.getModelConfig()).toEqual({
      modelId: 'mock-mentalllama-7B',
      providerType: 'custom_api',
    })
  })

  it('should create mock configuration if endpoint URL is missing for 7B model', () => {
    vi.mocked(getEnv).mockReturnValue({
      MENTALLAMA_API_KEY: mockApiKey,
    } as unknown)
    const provider = new MentalLLaMAModelProvider('7B')
    expect(provider.getModelConfig()).toEqual({
      modelId: 'mock-mentalllama-7B',
      providerType: 'custom_api',
    })
  })

  it('should create mock configuration if endpoint URL is missing for 13B model', () => {
    vi.mocked(getEnv).mockReturnValue({
      MENTALLAMA_API_KEY: mockApiKey,
      MENTALLAMA_ENDPOINT_URL_7B: mockEndpoint7B, // Provide 7B but test 13B
    } as unknown)
    const provider = new MentalLLaMAModelProvider('13B')
    expect(provider.getModelConfig()).toEqual({
      modelId: 'mock-mentalllama-13B',
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
      const provider = new MentalLLaMAModelProvider()
      const mockResponse = {
        choices: [{ message: { content: 'Hi there!' } }],
      }
      ;(fetch as unknown).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await provider.chat(messages, options)

      expect(fetch).toHaveBeenCalledWith(mockEndpoint7B, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockApiKey}`,
        },
        body: JSON.stringify({
          model: 'mentalllama-chat-7B',
          messages,
          ...options,
        }),
      })
      expect(result).toBe('Hi there!')
    })

    it('should throw an error if API request fails (response not ok)', async () => {
      const provider = new MentalLLaMAModelProvider()
      ;(fetch as unknown).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      })

      await expect(provider.chat(messages, options)).rejects.toThrow(
        'API request to mentalllama-chat-7B failed with status 500: Internal Server Error',
      )
    })

    it('should throw an error if API response has invalid structure', async () => {
      const provider = new MentalLLaMAModelProvider()
      ;(fetch as unknown).mockResolvedValue({
        ok: true,
        json: async () => ({}), // Invalid structure
      })

      await expect(provider.chat(messages, options)).rejects.toThrow(
        'Invalid response structure from MentalLLaMA API.',
      )
    })

    it('should throw an error if fetch itself fails (network error)', async () => {
      const provider = new MentalLLaMAModelProvider()
      ;(fetch as unknown).mockRejectedValue(
        new Error('Network connection failed'),
      )

      await expect(provider.chat(messages, options)).rejects.toThrow(
        'Network connection failed',
      )
    })

    it('should throw error when chat method is called with mock configuration', async () => {
      vi.mocked(getEnv).mockReturnValue({
        MENTALLAMA_ENDPOINT_URL_7B: mockEndpoint7B,
      } as unknown)
      const provider = new MentalLLaMAModelProvider()
      await expect(provider.chat(messages, options)).rejects.toThrow(
        'MentalLLaMA model mock-mentalllama-7B is not properly configured for actual API calls',
      )
    })

    it('should create a provider with mock configuration when constructor is called with missing API key', () => {
      vi.mocked(getEnv).mockReturnValue({
        MENTALLAMA_ENDPOINT_URL_7B: mockEndpoint7B,
      } as unknown)
      const provider = new MentalLLaMAModelProvider()
      expect(provider.getModelConfig().modelId).toBe('mock-mentalllama-7B')
      expect(provider.getModelConfig().providerType).toBe('custom_api')
    })
  })
})

import { CernerProvider } from '../providers/cerner.provider'

describe('cerner Provider', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }

  const providerConfig = {
    id: 'test-cerner',
    name: 'Test Cerner Provider',
    baseUrl:
      'https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d',
    clientId: testId || 'example-client-id',
    clientSecret: process.env.CLIENT_SECRET || 'example-client-secret',
    scopes: ['system/Patient.read', 'system/Observation.read'],
  }

  let cernerProvider: CernerProvider

  beforeEach(() => {
    cernerProvider = new CernerProvider(
      providerConfig.id,
      providerConfig.name,
      providerConfig.baseUrl,
      providerConfig.clientId,
      providerConfig.clientSecret,
      providerConfig.scopes,
      mockLogger as unknown as Console,
    )
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initialization', () => {
    it('should successfully initialize provider', async () => {
      // Mock the validateEndpoint method to return true
      vi.spyOn(cernerProvider as unknown, 'validateEndpoint').mockResolvedValue(
        true,
      )

      // Mock verifyCernerEndpoints to succeed
      vi.spyOn(
        cernerProvider as unknown,
        'verifyCernerEndpoints',
      ).mockResolvedValue(undefined)

      // Mock the FHIR client's searchResources method
      const mockSearchResources = vi
        .fn()
        .mockResolvedValue([{ resourceType: 'CapabilityStatement' }])
      vi.spyOn(cernerProvider as unknown, 'getClient').mockReturnValue({
        searchResources: mockSearchResources,
      })

      await expect(cernerProvider.initialize()).resolves.not.toThrow()
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Initializing provider ${providerConfig.id}`,
      )
      expect(mockSearchResources).toHaveBeenCalledWith('CapabilityStatement', {
        mode: 'server',
      })
    })

    it('should throw error when endpoint validation fails', async () => {
      // Mock the validateEndpoint method to return false
      vi.spyOn(cernerProvider as unknown, 'validateEndpoint').mockResolvedValue(
        false,
      )

      await expect(cernerProvider.initialize()).rejects.toThrow()
    })

    it('should throw error when CapabilityStatement is not found', async () => {
      // Mock the validateEndpoint method to return true
      vi.spyOn(cernerProvider as unknown, 'validateEndpoint').mockResolvedValue(
        true,
      )

      // Mock the FHIR client's searchResources method to return empty array
      const mockSearchResources = vi.fn().mockResolvedValue([])
      vi.spyOn(cernerProvider as unknown, 'getClient').mockReturnValue({
        searchResources: mockSearchResources,
      })

      await expect(cernerProvider.initialize()).rejects.toThrow(
        'No CapabilityStatement found',
      )
    })

    it('should throw error when required endpoints are not available', async () => {
      // Mock the validateEndpoint method to return true
      vi.spyOn(cernerProvider as unknown, 'validateEndpoint').mockResolvedValue(
        true,
      )

      // Mock the FHIR client's searchResources method to succeed for CapabilityStatement
      // but fail for endpoint verification
      const mockSearchResources = vi
        .fn()
        .mockImplementation((resourceType: string) => {
          if (resourceType === 'CapabilityStatement') {
            return Promise.resolve([{ resourceType: 'CapabilityStatement' }])
          }
          return Promise.reject(new Error('Endpoint not available'))
        })

      vi.spyOn(cernerProvider as unknown, 'getClient').mockReturnValue({
        searchResources: mockSearchResources,
      })

      await expect(cernerProvider.initialize()).rejects.toThrow(
        'Required Cerner endpoint',
      )
    })
  })

  describe('cleanup', () => {
    it('should successfully cleanup provider', async () => {
      await expect(cernerProvider.cleanup()).resolves.not.toThrow()
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Cleaned up provider ${providerConfig.id}`,
      )
    })

    it('should handle cleanup errors gracefully', async () => {
      // Mock super.cleanup to throw an error
      vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(cernerProvider)),
        'cleanup',
      ).mockRejectedValue(new Error('Cleanup failed'))

      await expect(cernerProvider.cleanup()).rejects.toThrow('Cleanup failed')
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('default scopes', () => {
    it('should provide default scopes when not specified', () => {
      const providerWithDefaultScopes = new CernerProvider(
        providerConfig.id,
        providerConfig.name,
        providerConfig.baseUrl,
        providerConfig.clientId,
        providerConfig.clientSecret,
        undefined,
        mockLogger as unknown as Console,
      )

      expect(providerWithDefaultScopes.scopes).toContain('system/Patient.read')
      expect(providerWithDefaultScopes.scopes).toContain(
        'system/Observation.read',
      )
      expect(providerWithDefaultScopes.scopes).toContain('online_access')
    })
  })
})

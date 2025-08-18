import { AthenahealthProvider } from '../providers/athenahealth.provider'

describe('athenahealth Provider', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }

  const providerConfig = {
    id: 'test-athenahealth',
    name: 'Test Athenahealth Provider',
    baseUrl: 'https://api.athenahealth.com/fhir/r4',
    clientId: testId || 'example-client-id',
    clientSecret: process.env.CLIENT_SECRET || 'example-client-secret',
    scopes: [
      'user/Patient.read',
      'user/Observation.read',
      'user/Encounter.read',
      'user/Condition.read',
      'user/Procedure.read',
    ],
  }

  let athenahealthProvider: AthenahealthProvider

  beforeEach(() => {
    athenahealthProvider = new AthenahealthProvider(
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
      vi.spyOn(
        athenahealthProvider as unknown,
        'validateEndpoint',
      ).mockResolvedValue(true)

      // Mock verifyAthenahealthEndpoints to succeed
      vi.spyOn(
        athenahealthProvider as unknown,
        'verifyAthenahealthEndpoints',
      ).mockResolvedValue(undefined)

      // Mock the FHIR client's searchResources method
      const mockCapabilityStatement = {
        rest: [
          {
            security: {
              service: ['OAuth2'],
              extension: [
                {
                  url: 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris',
                  extension: [
                    {
                      url: 'authorize',
                      valueUri: 'https://auth.example.com/authorize',
                    },
                    {
                      url: 'token',
                      valueUri: 'https://auth.example.com/token',
                    },
                  ],
                },
              ],
            },
          },
        ],
        security: {},
      }

      const mockSearchResources = vi
        .fn()
        .mockResolvedValue([mockCapabilityStatement])
      vi.spyOn(athenahealthProvider as unknown, 'getClient').mockReturnValue({
        searchResources: mockSearchResources,
      })

      await expect(athenahealthProvider.initialize()).resolves.not.toThrow()
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Initializing provider ${providerConfig.id}`,
      )
      expect(mockSearchResources).toHaveBeenCalledWith('CapabilityStatement', {
        mode: 'server',
      })
    })

    it('should throw error when endpoint validation fails', async () => {
      // Mock the validateEndpoint method to return false
      vi.spyOn(
        athenahealthProvider as unknown,
        'validateEndpoint',
      ).mockResolvedValue(false)

      await expect(athenahealthProvider.initialize()).rejects.toThrow(
        'Invalid Athenahealth endpoint',
      )
    })

    it('should throw error when CapabilityStatement is not found', async () => {
      // Mock the validateEndpoint method to return true
      vi.spyOn(
        athenahealthProvider as unknown,
        'validateEndpoint',
      ).mockResolvedValue(true)

      // Mock the FHIR client's searchResources method to return empty array
      const mockSearchResources = vi.fn().mockResolvedValue([])
      vi.spyOn(athenahealthProvider as unknown, 'getClient').mockReturnValue({
        searchResources: mockSearchResources,
      })

      await expect(athenahealthProvider.initialize()).rejects.toThrow(
        'No CapabilityStatement found',
      )
    })

    it('should throw error when required endpoints are not available', async () => {
      // Mock the validateEndpoint method to return true
      vi.spyOn(
        athenahealthProvider as unknown,
        'validateEndpoint',
      ).mockResolvedValue(true)

      // Mock the FHIR client's searchResources method to succeed for CapabilityStatement
      // but fail for endpoint verification
      const mockSearchResources = vi
        .fn()
        .mockImplementation((resourceType: string) => {
          if (resourceType === 'CapabilityStatement') {
            return Promise.resolve([
              {
                rest: [
                  {
                    security: {
                      service: ['OAuth2'],
                      extension: [
                        {
                          url: 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris',
                          extension: [
                            {
                              url: 'authorize',
                              valueUri: 'https://auth.example.com/authorize',
                            },
                            {
                              url: 'token',
                              valueUri: 'https://auth.example.com/token',
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
                security: {},
              },
            ])
          }
          return Promise.reject(new Error('Endpoint not available'))
        })

      vi.spyOn(athenahealthProvider as unknown, 'getClient').mockReturnValue({
        searchResources: mockSearchResources,
      })

      await expect(athenahealthProvider.initialize()).rejects.toThrow(
        'Required Athenahealth endpoint',
      )
    })

    it('should throw error when OAuth2 configuration is missing', async () => {
      // Mock the validateEndpoint method to return true
      vi.spyOn(
        athenahealthProvider as unknown,
        'validateEndpoint',
      ).mockResolvedValue(true)

      // Mock verifyAthenahealthEndpoints to succeed
      vi.spyOn(
        athenahealthProvider as unknown,
        'verifyAthenahealthEndpoints',
      ).mockResolvedValue(undefined)

      // Mock the FHIR client's searchResources method with invalid capability statement
      const mockSearchResources = vi.fn().mockResolvedValue([
        {
          rest: [
            {
              security: {
                service: ['Basic'], // Missing OAuth2
              },
            },
          ],
          security: {},
        },
      ])

      vi.spyOn(athenahealthProvider as unknown, 'getClient').mockReturnValue({
        searchResources: mockSearchResources,
      })

      await expect(athenahealthProvider.initialize()).rejects.toThrow(
        'OAuth2 security service is not configured',
      )
    })

    it('should throw error when SMART on FHIR endpoints are missing', async () => {
      // Mock the validateEndpoint method to return true
      vi.spyOn(
        athenahealthProvider as unknown,
        'validateEndpoint',
      ).mockResolvedValue(true)

      // Mock verifyAthenahealthEndpoints to succeed
      vi.spyOn(
        athenahealthProvider as unknown,
        'verifyAthenahealthEndpoints',
      ).mockResolvedValue(undefined)

      // Mock the FHIR client's searchResources method with missing SMART endpoints
      const mockSearchResources = vi.fn().mockResolvedValue([
        {
          rest: [
            {
              security: {
                service: ['OAuth2'],
                // Missing SMART extension
              },
            },
          ],
          security: {},
        },
      ])

      vi.spyOn(athenahealthProvider as unknown, 'getClient').mockReturnValue({
        searchResources: mockSearchResources,
      })

      await expect(athenahealthProvider.initialize()).rejects.toThrow(
        'SMART on FHIR OAuth2 endpoints are not configured',
      )
    })
  })

  describe('cleanup', () => {
    it('should successfully cleanup provider', async () => {
      await expect(athenahealthProvider.cleanup()).resolves.not.toThrow()
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Cleaned up provider ${providerConfig.id}`,
      )
    })

    it('should handle cleanup errors gracefully', async () => {
      // Mock super.cleanup to throw an error
      vi.spyOn(
        Object.getPrototypeOf(Object.getPrototypeOf(athenahealthProvider)),
        'cleanup',
      ).mockRejectedValue(new Error('Cleanup failed'))

      await expect(athenahealthProvider.cleanup()).rejects.toThrow(
        'Cleanup failed',
      )
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe('default scopes', () => {
    it('should provide default scopes when not specified', () => {
      const providerWithDefaultScopes = new AthenahealthProvider(
        providerConfig.id,
        providerConfig.name,
        providerConfig.baseUrl,
        providerConfig.clientId,
        providerConfig.clientSecret,
        undefined,
        mockLogger as unknown as Console,
      )

      expect(providerWithDefaultScopes.scopes).toContain('user/Patient.read')
      expect(providerWithDefaultScopes.scopes).toContain(
        'user/Observation.read',
      )
      expect(providerWithDefaultScopes.scopes).toContain('user/Encounter.read')
      expect(providerWithDefaultScopes.scopes).toContain('user/Condition.read')
      expect(providerWithDefaultScopes.scopes).toContain('user/Procedure.read')
      expect(providerWithDefaultScopes.scopes).toContain('openid')
      expect(providerWithDefaultScopes.scopes).toContain('fhirUser')
    })
  })
})

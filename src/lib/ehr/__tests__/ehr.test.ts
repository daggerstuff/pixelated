import { EpicProvider } from '../providers/epic.provider'
import { CernerProvider } from '../providers/cerner.provider'
import { AllscriptsProvider } from '../providers/allscripts.provider'
import { AthenahealthProvider } from '../providers/athenahealth.provider'
import { EHRServiceImpl } from '../services/ehr.service'
import { EHRError } from '../types'

describe('eHR Service', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }

  const testId = 'test-id'
  const mockProvider = {
    id: 'test-epic',
    name: 'Test Epic Provider',
    vendor: 'epic' as const,
    baseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth',
    clientId: testId || 'example-client-id',
    clientSecret: process.env.CLIENT_SECRET || 'example-client-secret',
    scopes: ['launch/patient', 'patient/*.read'],
    initialize: vi.fn(),
    cleanup: vi.fn(),
  }

  let ehrService: EHRServiceImpl

  beforeEach(() => {
    ehrService = new EHRServiceImpl(mockLogger as unknown as Console)
    vi.spyOn(EpicProvider.prototype, 'initialize').mockResolvedValue(undefined)
    vi.spyOn(CernerProvider.prototype, 'initialize').mockResolvedValue(undefined)
    vi.spyOn(AllscriptsProvider.prototype, 'initialize').mockResolvedValue(undefined)
    vi.spyOn(AthenahealthProvider.prototype, 'initialize').mockResolvedValue(undefined)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('configureProvider', () => {
    it('should successfully configure a provider', async () => {
      await expect(
        ehrService.configureProvider(mockProvider),
      ).resolves.not.toThrow()
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Configured EHR provider: ${mockProvider.id}`,
      )
    })

    it('should throw error for invalid provider configuration', async () => {
      const invalidProvider = { ...mockProvider, vendor: 'invalid' }
      await expect(
        ehrService.configureProvider(invalidProvider as any),
      ).rejects.toThrow(EHRError)
    })
  })

  describe('connect', () => {
    it('should successfully connect to a configured provider', async () => {
      await ehrService.configureProvider(mockProvider)
      await expect(ehrService.connect(mockProvider.id)).resolves.not.toThrow()
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Connected to EHR provider: ${mockProvider.id}`,
      )
    })

    it('should throw error when connecting to non-existent provider', async () => {
      await expect(ehrService.connect('non-existent')).rejects.toThrow(EHRError)
    })
  })

  describe('disconnect', () => {
    it('should successfully disconnect from a connected provider', async () => {
      await ehrService.configureProvider(mockProvider)
      await ehrService.connect(mockProvider.id)
      await expect(
        ehrService.disconnect(mockProvider.id),
      ).resolves.not.toThrow()
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Disconnected from EHR provider: ${mockProvider.id}`,
      )
    })

    it('should throw error when disconnecting from non-connected provider', async () => {
      await ehrService.configureProvider(mockProvider)
      await expect(ehrService.disconnect(mockProvider.id)).rejects.toThrow(
        EHRError,
      )
    })
  })

  describe('getFHIRClient', () => {
    it('should return FHIR client for connected provider', async () => {
      await ehrService.configureProvider(mockProvider)
      await ehrService.connect(mockProvider.id)
      expect(ehrService.getFHIRClient(mockProvider.id)).toBeDefined()
    })

    it('should throw error when getting client for non-connected provider', () => {
      expect(() => ehrService.getFHIRClient('non-existent')).toThrow(EHRError)
    })
  })
})

describe('epic Provider', () => {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }

  const testId = 'test-id'
  const providerConfig = {
    id: 'test-epic',
    name: 'Test Epic Provider',
    baseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth',
    clientId: testId || 'example-client-id',
    clientSecret: process.env.CLIENT_SECRET || 'example-client-secret',
    scopes: ['launch/patient', 'patient/*.read'],
  }

  let epicProvider: EpicProvider

  beforeEach(() => {
    epicProvider = new EpicProvider(
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
      // Mock the base provider's validateEndpoint method
      vi.spyOn(epicProvider as any, 'validateEndpoint').mockResolvedValue(
        true,
      )

      // Mock the getClient method to return a mock FHIR client
      const mockFhirClient = {
        // Mock the searchResources method needed by BaseEHRProvider.initialize
        searchResources: vi
          .fn()
          .mockImplementation(async (resourceType: string) => {
            if (resourceType === 'CapabilityStatement') {
              // Return a minimal valid CapabilityStatement for initialization
              return Promise.resolve([
                {
                  resourceType: 'CapabilityStatement',
                  status: 'active',
                  fhirVersion: '4.0.1',
                  kind: 'instance',
                  rest: [
                    {
                      mode: 'server',
                      security: {
                        service: [
                          {
                            coding: [
                              {
                                system:
                                  'http://terminology.hl7.org/CodeSystem/restful-security-service',
                                code: 'SMART-on-FHIR',
                              },
                            ],
                          },
                        ],
                        extension: [
                          {
                            url: 'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris',
                            extension: [
                              {
                                url: 'authorize',
                                valueUri:
                                  'https://fhir.epic.com/oauth2/authorize',
                              },
                              {
                                url: 'token',
                                valueUri: 'https://fhir.epic.com/oauth2/token',
                              },
                            ],
                          },
                        ],
                      },
                    },
                  ],
                },
              ])
            }
            // Return empty for other potential searches during init if needed
            return Promise.resolve([])
          }),
        // Add other client methods if epicProvider.initialize calls them
        read: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      }
      vi.spyOn(epicProvider as any, 'getClient').mockReturnValue(
        mockFhirClient,
      )

      // Now initialization should work without network calls
      await expect(epicProvider.initialize()).resolves.not.toThrow()
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Initializing provider ${providerConfig.id}`,
      )
      // Verify CapabilityStatement was fetched
      expect(mockFhirClient.searchResources).toHaveBeenCalledWith(
        'CapabilityStatement',
        expect.anything(),
      )
    })

    it('should throw error when endpoint validation fails', async () => {
      // Mock the validateEndpoint method to return false
      vi.spyOn(epicProvider as any, 'validateEndpoint').mockResolvedValue(
        false,
      )

      await expect(epicProvider.initialize()).rejects.toThrow()
    })
  })

  describe('cleanup', () => {
    it('should successfully cleanup provider', async () => {
      await expect(epicProvider.cleanup()).resolves.not.toThrow()
      expect(mockLogger.info).toHaveBeenCalledWith(
        `Cleaned up provider ${providerConfig.id}`,
      )
    })
  })
})

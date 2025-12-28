import { EHRError } from '../types'
import { BaseEHRProvider } from './base.provider'
import type { FHIRResource } from '../types'

interface CapabilityStatement extends FHIRResource {
  rest?: Array<{
    security?: {
      service?: string[]
      extension?: Array<{
        url: string
        extension?: Array<{
          url: string
          valueUri?: string
        }>
      }>
    }
  }>
}

export class AthenahealthProvider extends BaseEHRProvider {
  readonly id: string
  readonly name: string
  readonly vendor = 'athenahealth' as const
  readonly baseUrl: string
  readonly clientId: string
  readonly clientSecret: string
  readonly scopes: string[]

  private static readonly DEFAULT_SCOPES = [
    'user/Patient.read',
    'user/Observation.read',
    'user/Encounter.read',
    'user/Condition.read',
    'user/Procedure.read',
    'openid',
    'fhirUser',
  ]

  constructor(
    id: string,
    name: string,
    baseUrl: string,
    clientId: string,
    clientSecret: string,
    scopes?: string[],
    logger: Console = console,
  ) {
    super(logger)
    this.id = id
    this.name = name
    this.baseUrl = baseUrl
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.scopes = scopes || AthenahealthProvider.DEFAULT_SCOPES
  }

  async initialize(): Promise<void> {
    this.logger.info(`Initializing provider ${this.id}`)

    try {
      // Validate the base endpoint
      const isValid = await this.validateEndpoint()
      if (!isValid) {
        throw new EHRError(
          'Invalid Athenahealth endpoint',
          'INVALID_ENDPOINT',
          this.id,
        )
      }

      // Initialize Athenahealth-specific features
      await this.initializeAthenahealthFeatures()

      // Verify required endpoints are available
      await this.verifyAthenahealthEndpoints()

      this.logger.info(`Provider ${this.id} initialized successfully`)
    } catch (error: unknown) {
      this.logger.error(`Failed to initialize provider ${this.id}:`, error)
      throw error
    }
  }

  private async initializeAthenahealthFeatures(): Promise<void> {
    try {
      // Get the FHIR client
      const client = this.getClient()

      // Search for CapabilityStatement to verify SMART on FHIR support
      const [capabilityStatement] =
        await client.searchResources<CapabilityStatement>(
          'CapabilityStatement',
          {
            mode: 'server',
          },
        )

      if (!capabilityStatement) {
        throw new EHRError(
          'No CapabilityStatement found',
          'MISSING_CAPABILITY',
          this.id,
        )
      }

      // Verify OAuth2 security service is configured
      const rest = capabilityStatement.rest?.[0]
      const security = rest?.security

      if (!security?.service?.includes('OAuth2')) {
        throw new EHRError(
          'OAuth2 security service is not configured',
          'OAUTH_CONFIG_ERROR',
          this.id,
        )
      }

      // Verify SMART on FHIR OAuth2 endpoints
      const smartExtension = security.extension?.find(
        (ext: { url: string }) =>
          ext.url ===
          'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris',
      )

      if (!smartExtension?.extension?.length) {
        throw new EHRError(
          'SMART on FHIR OAuth2 endpoints are not configured',
          'MISSING_OAUTH_ENDPOINTS',
          this.id,
        )
      }

      // Verify required OAuth2 endpoints are present
      const hasAuthorize = smartExtension.extension.some(
        (ext: { url: string }) => ext.url === 'authorize',
      )
      const hasToken = smartExtension.extension.some(
        (ext: { url: string }) => ext.url === 'token',
      )

      if (!hasAuthorize || !hasToken) {
        throw new EHRError(
          'Required OAuth2 endpoints are missing',
          'MISSING_OAUTH_ENDPOINTS',
          this.id,
        )
      }
    } catch (error: unknown) {
      this.logger.error('Failed to initialize Athenahealth features:', error)
      throw error
    }
  }

  private async verifyAthenahealthEndpoints(): Promise<void> {
    try {
      const client = this.getClient()

      // Verify access to required FHIR resources
      const requiredEndpoints = [
        'Patient',
        'Observation',
        'Encounter',
        'Condition',
        'Procedure',
      ]

      for (const endpoint of requiredEndpoints) {
        try {
          await client.searchResources(endpoint, { _count: '1' })
          this.logger.info(`Verified Athenahealth endpoint: ${endpoint}`)
        } catch (error: unknown) {
          this.logger.error(`Failed to access ${endpoint} endpoint:`, error)
          throw new EHRError(
            `Required Athenahealth endpoint ${endpoint} is not available`,
            'ENDPOINT_UNAVAILABLE',
            this.id,
          )
        }
      }
    } catch (error: unknown) {
      this.logger.error('Failed to verify Athenahealth endpoints:', error)
      throw error
    }
  }

  async cleanup(): Promise<void> {
    try {
      this.logger.info(`Cleaning up provider ${this.id}`)
      await super.cleanup()
      // Add any Athenahealth-specific cleanup here if needed
      this.logger.info(`Cleaned up provider ${this.id}`)
    } catch (error: unknown) {
      this.logger.error(`Failed to cleanup provider ${this.id}:`, error)
      throw error
    }
  }
}

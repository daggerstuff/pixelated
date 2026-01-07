import { BaseEHRProvider } from './base.provider'

export class AllscriptsProvider extends BaseEHRProvider {
  readonly vendor = 'allscripts' as const

  constructor(
    readonly id: string,
    readonly name: string,
    readonly baseUrl: string,
    readonly clientId: string,
    readonly clientSecret: string,
    readonly scopes: string[] = [
      'user/Patient.read',
      'user/Observation.read',
      'user/Condition.read',
      'user/Procedure.read',
      'user/Medication.read',
      'user/MedicationRequest.read',
      'user/Immunization.read',
      'user/AllergyIntolerance.read',
      'user/DocumentReference.read',
      'launch/patient',
      'openid',
      'fhirUser',
    ],
    logger: Console = console,
  ) {
    super(logger)
  }

  override async initialize(): Promise<void> {
    await super.initialize()

    // Allscripts-specific initialization
    const isValid = await this.validateEndpoint()
    if (!isValid) {
      throw new Error(
        `Failed to validate Allscripts endpoint for provider ${this.id}`,
      )
    }

    // Initialize Allscripts-specific features
    await this.initializeAllscriptsFeatures()
  }

  private async initializeAllscriptsFeatures(): Promise<void> {
    try {
      this.logger.info(
        `Initializing Allscripts features for provider ${this.id}`,
      )

      // Validate Allscripts-specific capabilities
      const client = this.getClient()

      // Check CapabilityStatement for Allscripts-specific features
      const capabilityStatement = await client.searchResources(
        'CapabilityStatement',
        {
          mode: 'server',
        },
      )

      if (capabilityStatement.length === 0) {
        throw new Error('No CapabilityStatement found')
      }

      // Verify Allscripts-specific endpoints and features
      await this.verifyAllscriptsEndpoints()
      await this.verifyAllscriptsFeatures(capabilityStatement[0])

      this.logger.info(
        `Successfully initialized Allscripts features for provider ${this.id}`,
      )
    } catch (error: unknown) {
      this.logger.error(
        `Failed to initialize Allscripts features for provider ${this.id}:`,
        error,
      )
      throw error
    }
  }

  private async verifyAllscriptsEndpoints(): Promise<void> {
    const client = this.getClient()

    // Verify key resource endpoints that Allscripts requires
    const requiredEndpoints = [
      'Patient',
      'Observation',
      'Condition',
      'Procedure',
      'Medication',
      'MedicationRequest',
      'Immunization',
      'AllergyIntolerance',
      'DocumentReference',
    ]

    for (const endpoint of requiredEndpoints) {
      try {
        await client.searchResources(endpoint, { _summary: 'count' })
        this.logger.info(`Verified Allscripts endpoint: ${endpoint}`)
      } catch (error: unknown) {
        this.logger.error(
          `Failed to verify Allscripts endpoint ${endpoint}:`,
          error,
        )
        throw new Error(
          `Required Allscripts endpoint ${endpoint} is not available`,
          { cause: error },
        )
      }
    }
  }

  private async verifyAllscriptsFeatures(
    capabilityStatement: any,
  ): Promise<void> {
    // Verify Allscripts-specific features in the capability statement
    const requiredFeatures = ['rest', 'security']

    for (const feature of requiredFeatures) {
      if (!capabilityStatement[feature]) {
        throw new Error(
          `Required Allscripts feature ${feature} is not available`,
        )
      }
    }

    // Verify OAuth2 security configuration
    const security = capabilityStatement.rest[0]?.security
    if (!security || !security.service?.includes('OAuth2')) {
      throw new Error('OAuth2 security service is not configured')
    }

    // Verify SMART on FHIR capabilities
    const smartExtension = security.extension?.find(
      (ext: unknown) =>
        (ext as { url?: string }).url ===
        'http://fhir-registry.smarthealthit.org/StructureDefinition/oauth-uris',
    )

    if (!smartExtension) {
      throw new Error('SMART on FHIR OAuth2 endpoints are not configured')
    }

    // Verify required OAuth2 endpoints
    const requiredEndpoints = ['authorize', 'token']
    for (const endpoint of requiredEndpoints) {
      const endpointUrl = smartExtension.extension?.find(
        (ext: unknown) => (ext as { url?: string }).url === endpoint,
      )?.valueUri
      if (!endpointUrl) {
        throw new Error(
          `Required OAuth2 endpoint ${endpoint} is not configured`,
        )
      }
    }
  }

  override async cleanup(): Promise<void> {
    try {
      // Allscripts-specific cleanup
      this.logger.info(`Cleaning up Allscripts provider ${this.id}`)

      // Perform any Allscripts-specific cleanup tasks
      // For example: revoke tokens, clear session data, etc.

      await super.cleanup()
    } catch (error: unknown) {
      this.logger.error(
        `Failed to cleanup Allscripts provider ${this.id}:`,
        error,
      )
      throw error
    }
  }
}

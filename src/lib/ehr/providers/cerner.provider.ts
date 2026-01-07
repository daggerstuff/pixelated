import { BaseEHRProvider } from './base.provider'

export class CernerProvider extends BaseEHRProvider {
  readonly vendor = 'cerner' as const

  constructor(
    readonly id: string,
    readonly name: string,
    readonly baseUrl: string,
    readonly clientId: string,
    readonly clientSecret: string,
    readonly scopes: string[] = [
      'system/Patient.read',
      'system/Observation.read',
      'system/Condition.read',
      'system/Procedure.read',
      'system/Medication.read',
      'system/MedicationRequest.read',
      'system/Immunization.read',
      'system/AllergyIntolerance.read',
      'system/DocumentReference.read',
      'online_access',
    ],
    logger: Console = console,
  ) {
    super(logger)
  }

  override async initialize(): Promise<void> {
    await super.initialize()

    // Cerner-specific initialization
    const isValid = await this.validateEndpoint()
    if (!isValid) {
      throw new Error(
        `Failed to validate Cerner endpoint for provider ${this.id}`,
      )
    }

    // Initialize Cerner-specific features
    await this.initializeCernerFeatures()
  }

  private async initializeCernerFeatures(): Promise<void> {
    try {
      this.logger.info(`Initializing Cerner features for provider ${this.id}`)

      // Validate Cerner-specific capabilities
      const client = this.getClient()

      // Check CapabilityStatement for Cerner-specific features
      const capabilityStatement = await client.searchResources(
        'CapabilityStatement',
        {
          mode: 'server',
        },
      )

      if (capabilityStatement.length === 0) {
        throw new Error('No CapabilityStatement found')
      }

      // Verify Cerner-specific endpoints
      await this.verifyCernerEndpoints()

      this.logger.info(
        `Successfully initialized Cerner features for provider ${this.id}`,
      )
    } catch (error: unknown) {
      this.logger.error(
        `Failed to initialize Cerner features for provider ${this.id}:`,
        error,
      )
      throw error
    }
  }

  private async verifyCernerEndpoints(): Promise<void> {
    const client = this.getClient()

    // Verify key resource endpoints that Cerner requires
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
        this.logger.info(`Verified Cerner endpoint: ${endpoint}`)
      } catch (error: unknown) {
        this.logger.error(
          `Failed to verify Cerner endpoint ${endpoint}:`,
          error,
        )
        throw new Error(
          `Required Cerner endpoint ${endpoint} is not available`,
          { cause: error },
        )
      }
    }
  }

  override async cleanup(): Promise<void> {
    try {
      // Cerner-specific cleanup
      this.logger.info(`Cleaning up Cerner provider ${this.id}`)

      // Perform any Cerner-specific cleanup tasks
      // For example: close any open sessions, clear caches, etc.

      await super.cleanup()
    } catch (error: unknown) {
      this.logger.error(`Failed to cleanup Cerner provider ${this.id}:`, error)
      throw error
    }
  }
}

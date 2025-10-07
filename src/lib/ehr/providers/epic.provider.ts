import { BaseEHRProvider } from './base.provider'

export class EpicProvider extends BaseEHRProvider {
  readonly vendor = 'epic' as const

  constructor(
    readonly id: string,
    readonly name: string,
    readonly baseUrl: string,
    readonly clientId: string,
    readonly clientSecret: string,
    readonly scopes: string[] = [
      'launch/patient',
      'patient/*.read',
      'user/*.read',
      'openid',
      'fhirUser',
    ],
    logger: Console = console,
  ) {
    super(logger)
  }

  async initialize(): Promise<void> {
    await super.initialize()

    // Epic-specific initialization
    const isValid = await this.validateEndpoint()
    if (!isValid) {
      throw new Error(
        `Failed to validate Epic endpoint for provider ${this.id}`,
      )
    }

    // Initialize Epic-specific features
    await this.initializeEpicFeatures()
  }

  private async initializeEpicFeatures(): Promise<void> {
    try {
      // Initialize Epic-specific features like CDS Hooks, SMART on FHIR, etc.
      this.logger.info(`Initializing Epic features for provider ${this.id}`)

      // Example: Validate SMART on FHIR capability statement
      const client = this.getClient()
      const capabilityStatement = await client.searchResources(
        'CapabilityStatement',
        {
          mode: 'server',
        },
      )

      if (capabilityStatement.length === 0) {
        throw new Error('No CapabilityStatement found')
      }

      this.logger.info(
        `Successfully initialized Epic features for provider ${this.id}`,
      )
    } catch (error: unknown) {
      this.logger.error(
        `Failed to initialize Epic features for provider ${this.id}:`,
        error,
      )
      throw error
    }
  }

  async cleanup(): Promise<void> {
    try {
      // Epic-specific cleanup
      this.logger.info(`Cleaning up Epic provider ${this.id}`)

      // Perform any Epic-specific cleanup tasks here

      await super.cleanup()
    } catch (error: unknown) {
      this.logger.error(`Failed to cleanup Epic provider ${this.id}:`, error)
      throw error
    }
  }
}

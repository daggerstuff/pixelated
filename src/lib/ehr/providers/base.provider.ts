import type { EHRProvider, FHIRClient } from '../types'
import { createFHIRClient } from '../services/fhir.client'

export abstract class BaseEHRProvider implements EHRProvider {
  abstract id: string
  abstract name: string
  abstract vendor: 'epic' | 'cerner' | 'allscripts' | 'athenahealth'
  abstract baseUrl: string
  abstract clientId: string
  abstract clientSecret: string
  abstract scopes: string[]

  protected client: FHIRClient | null = null
  protected logger: Console

  constructor(logger: Console = console) {
    this.logger = logger
  }

  protected getClient(): FHIRClient {
    if (!this.client) {
      this.client = createFHIRClient(this)
      this.logger.info(`Created FHIR client for provider ${this.id}`)
    }
    return this.client
  }

  async initialize(): Promise<void> {
    // Can be overridden by specific providers for additional initialization
    this.logger.info(`Initializing provider ${this.id}`)
  }

  async cleanup(): Promise<void> {
    // Can be overridden by specific providers for cleanup
    this.client = null
    this.logger.info(`Cleaned up provider ${this.id}`)
  }

  toJSON(): Record<string, unknown> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clientSecret, client, logger, ...safeProperties } = this as any
    return safeProperties
  }

  // Common provider-specific operations can be added here
  protected async validateEndpoint(): Promise<boolean> {
    try {
      const client = this.getClient()
      await client.searchResources('Patient', { _summary: 'count' })
      return true
    } catch (error: unknown) {
      this.logger.error(
        `Failed to validate endpoint for provider ${this.id}:`,
        error,
      )
      return false
    }
  }
}

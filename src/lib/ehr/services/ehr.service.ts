import type { EHRProvider, EHRService, FHIRClient } from '../types'
import { z } from 'zod'
import { AllscriptsProvider } from '../providers/allscripts.provider'
import { AthenahealthProvider } from '../providers/athenahealth.provider'
import { CernerProvider } from '../providers/cerner.provider'
import { EpicProvider } from '../providers/epic.provider'
import { EHRError, ehrProviderSchema } from '../types'
import { createFHIRClient } from './fhir.client'

export class EHRServiceImpl implements EHRService {
  private providers: Map<string, EHRProvider> = new Map()
  private clients: Map<string, FHIRClient> = new Map()
  private logger: Console

  constructor(logger: Console = console) {
    this.logger = logger
  }

  async configureProvider(config: EHRProvider): Promise<void> {
    try {
      // Validate provider configuration
      const validatedConfig = await ehrProviderSchema.parseAsync(config)

      // Create appropriate provider instance based on vendor
      let provider: EHRProvider
      switch (validatedConfig.vendor.toLowerCase()) {
        case 'epic':
          provider = new EpicProvider(
            validatedConfig.id,
            validatedConfig.name,
            validatedConfig.baseUrl,
            validatedConfig.clientId,
            validatedConfig.clientSecret,
            validatedConfig.scopes,
            this.logger,
          )
          break
        case 'cerner':
          provider = new CernerProvider(
            validatedConfig.id,
            validatedConfig.name,
            validatedConfig.baseUrl,
            validatedConfig.clientId,
            validatedConfig.clientSecret,
            validatedConfig.scopes,
            this.logger,
          )
          break
        case 'allscripts':
          provider = new AllscriptsProvider(
            validatedConfig.id,
            validatedConfig.name,
            validatedConfig.baseUrl,
            validatedConfig.clientId,
            validatedConfig.clientSecret,
            validatedConfig.scopes,
            this.logger,
          )
          break
        case 'athenahealth':
          provider = new AthenahealthProvider(
            validatedConfig.id,
            validatedConfig.name,
            validatedConfig.baseUrl,
            validatedConfig.clientId,
            validatedConfig.clientSecret,
            validatedConfig.scopes,
            this.logger,
          )
          break
        default:
          throw new EHRError(
            `Unsupported vendor: ${validatedConfig.vendor}`,
            'UNSUPPORTED_VENDOR',
            validatedConfig.id,
          )
      }

      // Initialize the provider
      await provider.initialize()

      // Store provider configuration
      this.providers.set(validatedConfig.id, provider)

      this.logger.info(`Configured EHR provider: ${validatedConfig.id}`)
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        throw new EHRError(
          'Invalid provider configuration',
          'INVALID_CONFIG',
          config.id,
          error,
        )
      }
      throw new EHRError(
        'Failed to configure provider',
        'CONFIG_ERROR',
        config.id,
        error instanceof Error ? error : undefined,
      )
    }
  }

  async connect(providerId: string): Promise<void> {
    try {
      const provider = this.validateProvider(providerId)

      // Create FHIR client for the provider
      const client = createFHIRClient(provider)
      this.clients.set(providerId, client)

      this.logger.info(`Connected to EHR provider: ${providerId}`)
    } catch (error: unknown) {
      throw new EHRError(
        'Failed to connect to provider',
        'CONNECTION_ERROR',
        providerId,
        error instanceof Error ? error : undefined,
      )
    }
  }

  async disconnect(providerId: string): Promise<void> {
    try {
      const provider = this.validateProvider(providerId)
      const client = this.clients.get(providerId)

      if (!client) {
        throw new EHRError(
          `No active connection for provider: ${providerId}`,
          'NO_CONNECTION',
          providerId,
        )
      }

      // Cleanup provider
      await provider.cleanup()

      // Remove client
      this.clients.delete(providerId)

      this.logger.info(`Disconnected from EHR provider: ${providerId}`)
    } catch (error: unknown) {
      throw new EHRError(
        'Failed to disconnect from provider',
        'DISCONNECT_ERROR',
        providerId,
        error instanceof Error ? error : undefined,
      )
    }
  }

  getFHIRClient(providerId: string): FHIRClient {
    const client = this.clients.get(providerId)
    if (!client) {
      throw new EHRError(
        `No active connection for provider: ${providerId}`,
        'NO_CONNECTION',
        providerId,
      )
    }
    return client
  }

  // Helper methods
  private validateProvider(providerId: string): EHRProvider {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new EHRError(
        `Provider not found: ${providerId}`,
        'PROVIDER_NOT_FOUND',
        providerId,
      )
    }
    return provider
  }
}

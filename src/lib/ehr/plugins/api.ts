import type { FHIRClient, Logger, PluginAPI } from '../types'
import { EventEmitter } from 'node:events'
import { RedisStorageAPI } from '../services/redis.storage'

export function createPluginAPI(
  fhirClient: FHIRClient,
  logger: Logger,
  redisUrl: string,
): PluginAPI {
  const events = new EventEmitter()
  const storage = new RedisStorageAPI(redisUrl)

  return {
    events: {
      on<T>(event: string, handler: (data: T) => void): void {
        events.on(event, handler as (data: unknown) => void)
      },
      off<T>(event: string, handler: (data: T) => void): void {
        events.off(event, handler as (data: unknown) => void)
      },
      emit<T>(event: string, data: T): void {
        events.emit(event, data)
      },
    },
    storage,
    fhir: fhirClient,
    logger,
  }
}

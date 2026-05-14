import { EventEmitter } from 'node:events'

import { RedisStorageAPI } from '../services/redis.storage'
import type { FHIRClient, Logger, PluginAPI } from '../types'

export function createPluginAPI(
  fhirClient: FHIRClient,
  logger: Logger,
  redisUrl: string,
): PluginAPI {
  const events = new EventEmitter()
  const storage = new RedisStorageAPI(redisUrl)

  return {
    events: {
      on(event: string, handler: (data: unknown) => void): void {
        events.on(event, handler as (data: unknown) => void)
      },
      off(event: string, handler: (data: unknown) => void): void {
        events.off(event, handler as (data: unknown) => void)
      },
      emit(event: string, data: unknown): void {
        events.emit(event, data)
      },
    },
    storage,
    fhir: fhirClient,
    logger,
  }
}

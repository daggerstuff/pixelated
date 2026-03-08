/**
 * Storage Providers Wrapper
 *
 * This module provides a way to dynamically load storage providers based on the environment.
 * It ensures server-only modules are not bundled in client code by using dynamic imports.
 */

import type { StorageProvider, StorageProviderConfig } from './types'
import { isBrowser } from '../../browser/is-browser'
import { createBuildSafeLogger as getLogger } from '../../logging/build-safe-logger'

/**
 * Get storage provider instance based on provider name
 */
export async function getStorageProvider(
  providerName: string,
  config: StorageProviderConfig,
): Promise<StorageProvider> {
  // In browser environments, return dummy provider that throws errors
  // This prevents Node.js modules from being bundled in client code
  if (isBrowser) {
    return createBrowserStubProvider()
  }

  // Server-side implementation - dynamically load based on provider name
  let providerModule: any
  try {
    switch (providerName) {
      case 'google-cloud-storage': {
        providerModule = await import('./storage-providers/google-cloud')
        return new providerModule.GoogleCloudStorageProvider(config)
      }
      case 'aws-s3': {
        providerModule = await import('./storage-providers/aws-s3')
        return new providerModule.S3StorageProvider(config)
      }
      case 'local-fs': {
        providerModule = await import('./storage-providers/local-fs')
        return new providerModule.LocalFileSystemProvider(config)
      }
      case 'memory': {
        providerModule = await import('./storage-providers/memory')
        return new providerModule.InMemoryStorageProvider(config)
      }
      case 'default':
      default: {
        providerModule = await import('./storage-providers/memory')
        return new providerModule.InMemoryStorageProvider(config)
      }
    }
  } catch (error: unknown) {
    console.error(`Error loading storage provider '${providerName}':`, error)

    // Fallback to in-memory provider for safety
    providerModule = await import('./storage-providers/memory')
    return new providerModule.InMemoryStorageProvider(config)
  }
}

/**
 * Create a stub provider for browser environments
 * This prevents server-only code from being bundled with client-side code
 */
function createBrowserStubProvider(): StorageProvider {
  return {
    initialize: async () => {
      console.warn(
        'Storage providers are not available in browser environments',
      )
    },
    listFiles: async () => {
      console.warn(
        'Storage providers are not available in browser environments',
      )
      return []
    },
    storeFile: async () => {
      console.warn(
        'Storage providers are not available in browser environments',
      )
    },
    getFile: async () => {
      console.warn(
        'Storage providers are not available in browser environments',
      )
      return new Uint8Array()
    },
    deleteFile: async () => {
      console.warn(
        'Storage providers are not available in browser environments',
      )
    },
  }
}

/**
 * Creates a mock storage provider for testing that just logs operations
 */
export function createMockStorageProvider(): StorageProvider {
  // Logger prefix
  const prefix = `mock-storage:default`
  const logger = getLogger(prefix)

  logger.info('Creating mock storage provider')

  // Return a provider that just logs operations
  return {
    initialize: async () => {
      logger.info('Initializing mock storage provider')
    },

    listFiles: async (pattern: string) => {
      logger.info(`Listing files with pattern: ${pattern}`)
      return []
    },

    storeFile: async (_key: string, _data: Uint8Array) => {
      logger.info(`Storing file: ${_key} (size: ${_data.byteLength} bytes)`)
    },

    getFile: async (_key: string) => {
      logger.info(`Getting file: ${_key}`)
      // Return mock data
      return new Uint8Array(new TextEncoder().encode('mock data'))
    },

    deleteFile: async (_key: string) => {
      logger.info(`Deleting file: ${_key}`)
    },
  }
}

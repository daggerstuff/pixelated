/**
 * Backup security helpers — crypto, hashing, restore, and storage-provider
 * utilities extracted from backup/index.ts.
 */

import * as NodeCrypto from 'crypto'
import { isBrowser } from '../../browser/is-browser'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type {
  RestoreResult,
  BackupDataPayload,
} from './backup-security.types'
import type { StorageProvider, StorageProviderConfig } from './types'

const logger = createBuildSafeLogger('backup-security')

// Import crypto polyfill statically to avoid issues during build

// Utility function for browser-safe buffer conversions without using Buffer
/**
 * Converts a hex string to a Uint8Array backed by a true ArrayBuffer.
 * This ensures compatibility with Web Crypto API (BufferSource).
 */
export function hexStringToUint8Array(hexString: string): Uint8Array {
  if (!/^[0-9A-Fa-f]+$/.test(hexString) || hexString.length % 2 !== 0) {
    throw new Error('Invalid hex string')
  }

  // Always allocate a new ArrayBuffer to guarantee compatibility
  const buffer = new ArrayBuffer(hexString.length / 2)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16)
  }
  return bytes
}

// Import crypto browser/node implementation

export const getCrypto = async () => {
  if (isBrowser) {
    return {
      encrypt: async (
        data: Uint8Array,
        key: Uint8Array,
        iv: Uint8Array,
      ): Promise<{ encryptedData: Uint8Array; authTag: Uint8Array }> => {
        const { subtle } = window.crypto
        const importedKey = await subtle.importKey(
          'raw',
          key,
          { name: 'AES-GCM' },
          false,
          ['encrypt'],
        )
        const encrypted = await subtle.encrypt(
          { name: 'AES-GCM', iv },
          importedKey,
          data,
        )
        // In Web Crypto API, the auth tag is appended to the ciphertext
        const encryptedArray = new Uint8Array(encrypted)
        const authTag = encryptedArray.slice(-16) // Last 16 bytes are the auth tag
        const encryptedData = encryptedArray.slice(0, -16)
        return { encryptedData, authTag }
      },
      decrypt: async (
        data: Uint8Array,
        key: Uint8Array,
        iv: Uint8Array,
        authTag: Uint8Array,
      ): Promise<Uint8Array> => {
        const { subtle } = window.crypto
        const importedKey = await subtle.importKey(
          'raw',
          key,
          { name: 'AES-GCM' },
          false,
          ['decrypt'],
        )
        // Combine ciphertext and auth tag for Web Crypto API
        const combined = new Uint8Array(data.length + authTag.length)
        combined.set(data)
        combined.set(authTag, data.length)
        // Create a new ArrayBuffer to ensure proper typing
        const combinedBuffer = new ArrayBuffer(combined.byteLength)
        new Uint8Array(combinedBuffer).set(combined)
        const decrypted = await subtle.decrypt(
          { name: 'AES-GCM', iv },
          importedKey,
          combinedBuffer,
        )
        return new Uint8Array(decrypted)
      },
      randomBytes: (length: number): Uint8Array => {
        const array = new Uint8Array(length)
        window.crypto.getRandomValues(array)
        return array
      },
    }
  } else {
    const nodeCrypto = await import('crypto')
    return {
      encrypt: async (
        data: Uint8Array,
        key: Uint8Array,
        iv: Uint8Array,
      ): Promise<{ encryptedData: Uint8Array; authTag: Uint8Array }> => {
        const cipher: import('crypto').CipherGCM = nodeCrypto.createCipheriv(
          'aes-256-gcm',
          key,
          iv,
        )

        // Manual concatenation of Uint8Arrays without Buffer
        const part1 = new Uint8Array(cipher.update(data))
        const part2 = new Uint8Array(cipher.final())

        const encryptedData = new Uint8Array(part1.length + part2.length)
        encryptedData.set(part1)
        encryptedData.set(part2, part1.length)

        // Get authentication tag
        const authTag = new Uint8Array(cipher.getAuthTag())

        return { encryptedData, authTag }
      },
      decrypt: async (
        data: Uint8Array,
        key: Uint8Array,
        iv: Uint8Array,
        authTag: Uint8Array,
      ): Promise<Uint8Array> => {
        const decipher: import('crypto').DecipherGCM =
          nodeCrypto.createDecipheriv('aes-256-gcm', key, iv)
        decipher.setAuthTag(authTag)

        // Manual concatenation of Uint8Arrays without Buffer
        const part1 = new Uint8Array(decipher.update(data))
        const part2 = new Uint8Array(decipher.final())

        const result = new Uint8Array(part1.length + part2.length)
        result.set(part1)
        result.set(part2, part1.length)

        return result
      },
      randomBytes: (length: number): Uint8Array => {
        return new Uint8Array(nodeCrypto.randomBytes(length))
      },
    }
  }
}

export function generateUUID(): string {
  if (isBrowser && window.crypto?.randomUUID) {
    return window.crypto.randomUUID()
  }

  // Simple UUID v4 implementation that works everywhere
  let uuid = ''

  // Use crypto-secure random values for UUID v4 generation
  const randBytes = isBrowser
    ? window.crypto.getRandomValues(new Uint8Array(16))
    : NodeCrypto.randomBytes(16)

  // Per RFC4122 v4: set bits for version and `clock_seq_hi_and_reserved`
  if (randBytes[6] !== undefined) {
    randBytes[6] = (randBytes[6] & 0x0f) | 0x40
  }
  if (randBytes[8] !== undefined) {
    randBytes[8] = (randBytes[8] & 0x3f) | 0x80
  }

  for (let i = 0; i < 16; i++) {
    const byte = randBytes[i]
    const hex = (byte ?? 0).toString(16).padStart(2, '0')
    // Insert dashes at the appropriate positions
    if (i === 4 || i === 6 || i === 8 || i === 10) {
      uuid += '-'
    }
    uuid += hex
  }

  return uuid
}

export async function calculateHash(data: Uint8Array): Promise<string> {
  if (isBrowser) {
    // Web Crypto API for browser
    // Create a new ArrayBuffer to ensure proper typing
    const dataBuffer = new ArrayBuffer(data.byteLength)
    new Uint8Array(dataBuffer).set(data)
    const hashBuffer = await window.crypto.subtle.digest(
      'SHA-256',
      dataBuffer,
    )
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  } else {
    // Node.js crypto for server - without using Buffer
    const nodeCrypto = await import('crypto')
    const hash = nodeCrypto.createHash('sha256')
    // Use Uint8Array directly
    hash.update(data)
    return hash.digest('hex')
  }
}

export async function restoreData(data: Uint8Array): Promise<RestoreResult> {
  try {
    logger.info(`Parsing backup data of size: ${data.byteLength} bytes`)

    const json = JSON.parse(
      new TextDecoder().decode(data),
    ) as BackupDataPayload

    if (!json.data || typeof json.data !== 'object') {
      throw new Error('Invalid backup format: missing "data" field')
    }

    const mongooseModule = 'mongoose'
    const mongoose =
      (await import(/* @vite-ignore */ mongooseModule)).default ??
      (await import(/* @vite-ignore */ mongooseModule))

    const connection = mongoose.connection
    if (connection.readyState !== 1) {
      throw new Error(
        'Mongoose connection is not ready — cannot restore data',
      )
    }

    const result: RestoreResult = {
      modelsProcessed: 0,
      documentsRestored: 0,
      models: {},
    }

    for (const [modelName, documents] of Object.entries(json.data)) {
      if (!Array.isArray(documents)) {
        logger.warn(`Skipping "${modelName}": expected array of documents`)
        continue
      }

      let Model: ReturnType<typeof connection.model>
      try {
        Model = connection.model(modelName)
      } catch {
        logger.warn(
          `Skipping "${modelName}": model not registered in current schema`,
        )
        result.models[modelName] = { restored: 0, errors: 0 }
        result.modelsProcessed++
        continue
      }

      if (documents.length === 0) {
        result.models[modelName] = { restored: 0, errors: 0 }
        result.modelsProcessed++
        continue
      }

      const ops = documents.map((doc: Record<string, unknown>) => ({
        updateOne: {
          filter: { _id: doc['_id'] },
          update: { $set: doc },
          upsert: true,
        },
      }))

      try {
        const bulkResult = await Model.bulkWrite(ops, { ordered: false })
        const restored =
          (bulkResult.upsertedCount ?? 0) + (bulkResult.modifiedCount ?? 0)
        const errors = bulkResult.writeErrors?.length ?? 0

        result.models[modelName] = { restored, errors }
        result.documentsRestored += restored
        result.modelsProcessed++

        logger.info(
          `Restored ${restored} documents for model "${modelName}" (${errors} errors)`,
        )
      } catch (bulkError: unknown) {
        const errors = documents.length
        result.models[modelName] = { restored: 0, errors }
        result.documentsRestored += 0
        result.modelsProcessed++

        logger.error(
          `Bulk restore failed for model "${modelName}": ${bulkError instanceof Error ? bulkError.message : String(bulkError)}`,
        )
      }
    }

    // Integrity verification: re-read one model to confirm data was written
    if (result.modelsProcessed > 0 && result.documentsRestored > 0) {
      const firstModelName = Object.keys(json.data)[0]
      const firstModelDocs = json.data[firstModelName]
      if (firstModelDocs && firstModelDocs.length > 0) {
        try {
          const Model = connection.model(firstModelName)
          const sampleId = (firstModelDocs[0] as Record<string, unknown>)[
            '_id'
          ]
          const verified = await Model.exists({ _id: sampleId })
          if (!verified) {
            throw new Error(
              `Integrity check failed: document ${String(sampleId)} from model "${firstModelName}" not found after restore`,
            )
          }
          logger.info('Integrity verification passed')
        } catch (verifyError: unknown) {
          throw new Error(
            `Post-restore integrity verification failed: ${verifyError instanceof Error ? verifyError.message : String(verifyError)}`,
            { cause: verifyError },
          )
        }
      }
    }

    logger.info(
      `Restore complete: ${result.documentsRestored} documents across ${result.modelsProcessed} models`,
    )

    return result
  } catch (error: unknown) {
    logger.error(
      `Failed to restore data: ${error instanceof Error ? String(error) : String(error)}`,
    )
    throw new Error(
      `Data restoration failed: ${error instanceof Error ? String(error) : String(error)}`,
      { cause: error },
    )
  }
}

// Get the appropriate storage provider implementation using dynamic import
async function getStorageProvider(
  provider: string,
  config: Record<string, unknown> = {},
): Promise<StorageProvider> {
  try {
    // Import the storage provider dynamically
    const { getStorageProvider: importedGetStorageProvider } =
      await import('./storage-providers-wrapper')
    // Convert to unknown first, then ensure it has the required type property
    const providerConfig = {
      type: provider,
      ...config,
    } as StorageProviderConfig

    return importedGetStorageProvider(provider, providerConfig)
  } catch (error: unknown) {
    logger.error(
      `Failed to load storage provider: ${error instanceof Error ? String(error) : String(error)}`,
    )
    throw new Error(
      `Storage provider loading failed: ${error instanceof Error ? String(error) : String(error)}`,
      { cause: error },
    )
  }
}

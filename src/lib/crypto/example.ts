/**
 * Example usage of the crypto system
 * This file demonstrates how to use the encryption, key storage, and rotation features
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'

const logger = createBuildSafeLogger('crypto-example')
import { createCryptoSystem } from './index'
import { ScheduledKeyRotation } from './scheduledRotation'
import { KeyStorage } from './keyStorage'

/**
 * Example: Basic encryption and decryption
 */
async function basicEncryptionExample() {
  // Create a crypto system
  const crypto = createCryptoSystem({
    namespace: 'example',
    keyRotationDays: 90,
  })

  // Encrypt some data
  const sensitiveData = 'This is sensitive patient information'
  const encrypted = await crypto.encrypt(sensitiveData, 'patient-data')

  logger.info('Data encrypted successfully', { encrypted })

  // Decrypt the data
  const decrypted = await crypto.decrypt(encrypted, 'patient-data')

  logger.info('Data decrypted successfully', { decrypted })

  // Verify the decryption worked correctly
  logger.info('Decryption verification', {
    success: decrypted === sensitiveData,
  })
}

/**
 * Example: Manual key rotation
 */
async function manualKeyRotationExample() {
  // Create a key storage instance
  const keyStorage = new KeyStorage({
    namespace: 'example',
    region: 'us-east-1',
    useKms: false,
  })

  // Generate a key
  const { keyId, keyData } = await keyStorage.generateKey('patient-data')

  logger.info('Key generated', { keyId, version: keyData.version })

  // Rotate the key
  const rotatedKey = await keyStorage.rotateKey(keyId)

  if (rotatedKey) {
    logger.info('Key rotated', {
      keyId: rotatedKey.keyId,
      version: rotatedKey.keyData.version,
    })
  }

  // List all keys
  const keys = await keyStorage.listKeys()

  logger.info('Key listing complete', { keys })
}

/**
 * Example: Scheduled key rotation
 */
function scheduledKeyRotationExample() {
  // Create a scheduled rotation service
  const scheduler = new ScheduledKeyRotation({
    namespace: 'example',
    checkIntervalMs: 5 * 60 * 1000, // Check every 5 minutes
    onRotation: (oldKeyId, newKeyId) => {
      logger.info('Key rotation completed', { oldKeyId, newKeyId })
    },
    onError: (error) => {
      logger.error('Key rotation failed', { error })
    },
  })

  // Start the scheduler
  scheduler.start()

  logger.info('Key rotation scheduler started', {
    checkIntervalMs: 5 * 60 * 1000,
  })

  // To stop the scheduler later:
  // scheduler.stop();
}

/**
 * Example: Re-encrypting data after key rotation
 */
async function reencryptionExample() {
  // Create a crypto system
  const crypto = createCryptoSystem({
    namespace: 'example',
    keyRotationDays: 90,
  })

  // Encrypt some data
  const sensitiveData = 'This is sensitive patient information'
  const encrypted = await crypto.encrypt(sensitiveData, 'patient-data')

  logger.info('Original data encrypted', { encrypted })

  // Extract key ID from the encrypted data
  const keyId = encrypted.split(':')[0]

  // Simulate key rotation
  const keyStorage = new KeyStorage({
    namespace: 'example',
    region: 'us-east-1',
    useKms: false,
  })
  const rotatedKey = await keyStorage.rotateKey(keyId)

  if (rotatedKey) {
    logger.info('Key rotated for re-encryption', {
      version: rotatedKey.keyData.version,
    })

    // Re-encrypt the data with the new key
    const decrypted = await crypto.decrypt(encrypted, 'patient-data')
    const reencrypted = await crypto.encrypt(decrypted, 'patient-data')

    logger.info('Data re-encrypted with new key', { reencrypted })

    // Verify the re-encryption worked correctly
    const redecrypted = await crypto.decrypt(reencrypted, 'patient-data')
    logger.info('Re-encryption verification', {
      success: redecrypted === sensitiveData,
    })
  }
}

/**
 * Run all examples
 */
async function runExamples() {
  logger.info('Starting encryption examples')

  logger.info('Running basic encryption example')
  await basicEncryptionExample()

  logger.info('Running manual key rotation example')
  await manualKeyRotationExample()

  logger.info('Running scheduled key rotation example')
  scheduledKeyRotationExample()

  logger.info('Running re-encryption example')
  await reencryptionExample()

  logger.info('All examples completed')
}

// Uncomment to run the examples
// runExamples().catch(console.error);

export {
  basicEncryptionExample,
  manualKeyRotationExample,
  reencryptionExample,
  runExamples,
  scheduledKeyRotationExample,
}

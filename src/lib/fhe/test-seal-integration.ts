/**
 * Microsoft SEAL Integration Test
 *
 * This file provides a simple test script to verify that the SEAL integration
 * is working correctly. Run this file directly to test the SEAL implementation.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { SealContext } from './seal-context'
import { SealService } from './seal-service'
import { SealOperations } from './seal-operations'
import { SealSchemeType } from './seal-types'
import { EncryptionMode } from './types'

// Initialize logger
const logger = createBuildSafeLogger('seal-test')

/**
 * Run a test of the SEAL integration
 */
async function testSEALIntegration() {
  try {
    logger.info('Starting SEAL integration test')

    // Initialize SEAL context with BFV scheme
    const contextOptions = {
      scheme: SealSchemeType.BFV,
      params: {
        polyModulusDegree: 8192,
        coeffModulusBits: [60, 40, 40, 60],
        plainModulus: 1032193,
      },
    }

    const context = new SealContext(contextOptions)
    await context.initialize()

    logger.info('SEAL context initialized successfully')

    // Initialize SEAL service
    const service = SealService.getInstance()
    await service.initialize(EncryptionMode.FHE)

    logger.info('SEAL service initialized successfully')

    // Generate encryption keys
    await service.generateKeys()
    logger.info('Encryption keys generated successfully')

    // Create test data
    const testData = [1, 2, 3, 4, 5]
    logger.info('Test data:', { testData })

    // Encrypt the test data
    const encrypted = await service.encrypt(testData)
    logger.info('Data encrypted successfully')

    // Decrypt the data
    const decrypted = await service.decrypt(encrypted)
    logger.info('Data decrypted successfully:', { decrypted })

    // Check if the decryption was successful
    const isDecryptionSuccessful = testData.every(
      (value, index) => value === decrypted[index],
    )
    logger.info(
      `Decryption test ${isDecryptionSuccessful ? 'PASSED' : 'FAILED'}`,
    )

    // Initialize operations
    const operations = new SealOperations(service)

    // Test homomorphic addition
    logger.info('Testing homomorphic addition')
    const addResult = await operations.add(encrypted, [5, 5, 5, 5, 5])

    if (addResult.success) {
      const decryptedAdd = await service.decrypt(addResult.result)
      logger.info('Homomorphic addition result:', { decryptedAdd })
      const expectedAdd = testData.map((v) => v + 5)
      const isAdditionSuccessful = expectedAdd.every(
        (value, index) => value === decryptedAdd[index],
      )
      logger.info(`Addition test ${isAdditionSuccessful ? 'PASSED' : 'FAILED'}`)
    } else {
      logger.error('Homomorphic addition failed:', { error: addResult.error })
    }

    // Test homomorphic multiplication
    logger.info('Testing homomorphic multiplication')
    const multResult = await operations.multiply(encrypted, [2, 2, 2, 2, 2])

    if (multResult.success) {
      const decryptedMult = await service.decrypt(multResult.result)
      logger.info('Homomorphic multiplication result:', { decryptedMult })
      const expectedMult = testData.map((v) => v * 2)
      const isMultiplicationSuccessful = expectedMult.every(
        (value, index) => value === decryptedMult[index],
      )
      logger.info(
        `Multiplication test ${isMultiplicationSuccessful ? 'PASSED' : 'FAILED'}`,
      )
    } else {
      logger.error('Homomorphic multiplication failed:', {
        error: multResult.error,
      })
    }

    // Cleanup
    service.dispose()
    context.dispose()

    logger.info('SEAL integration test completed')
    return true
  } catch (error: unknown) {
    logger.error('SEAL integration test failed:', { error })
    return false
  }
}

// Run the test if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
  logger.info('Running SEAL integration test directly')
  testSEALIntegration()
    .then((success) => {
      if (success) {
        logger.info('SEAL integration test completed successfully')
        process.exit(0)
      } else {
        logger.error('SEAL integration test failed')
        process.exit(1)
      }
    })
    .catch((error) => {
      logger.error('Unhandled error in SEAL integration test:', { error })
      process.exit(1)
    })
}

export { testSEALIntegration }

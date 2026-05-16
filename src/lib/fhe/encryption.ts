/**
 * FHE Encryption Module
 *
 * This module provides encryption/decryption functionality for FHE operations.
 * It re-exports the relevant functions from the FHE service.
 */

import { realFHEService } from './fhe-service'
import type { FHEService } from './types'

export const encrypt = async (
  value: Parameters<(typeof realFHEService)['encrypt']>[0],
  options?: Parameters<(typeof realFHEService)['encrypt']>[1],
): ReturnType<(typeof realFHEService)['encrypt']> => {
  return realFHEService.encrypt(value, options)
}

export const decrypt = async (
  encryptedData: Parameters<(typeof realFHEService)['decrypt']>[0],
  options?: Parameters<(typeof realFHEService)['decrypt']>[1],
): ReturnType<(typeof realFHEService)['decrypt']> => {
  return realFHEService.decrypt(encryptedData, options)
}

export type { FHEService }
export { RealFHEService, realFHEService as fheService } from './fhe-service'

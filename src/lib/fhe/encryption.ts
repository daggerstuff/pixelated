/**
 * FHE Encryption Module
 * 
 * This module provides encryption/decryption functionality for FHE operations.
 * It re-exports the relevant functions from the FHE service.
 */

export { encrypt, decrypt, EncryptedData } from './fhe-service';
export type { FHEService } from './fhe-service';
export { RealFHEService, realFHEService as fheService } from './fhe-service';
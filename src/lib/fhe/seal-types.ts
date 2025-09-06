/**
 * Microsoft SEAL Type Definitions
 *
 * Contains type definitions for SEAL integration with the generic FHE types.
 * This file contains SEAL-specific implementations of the interfaces defined in './types.ts'.
 */

import { FHEOperation } from './types'
import type {
  FHEConfig,
  FHEKeys,
  FHEOperationResult,
  FHEService,
} from './types'

/**
 * SEAL Encryption Parameters Options
 */
export interface SealEncryptionParamsOptions {
  polyModulusDegree: number
  coeffModulusBits: number[]
  plainModulus?: number // Only used for BFV/BGV
  scale?: number // Only used for CKKS
  securityLevel?: SealSecurityLevel
}

/**
 * SEAL Security Levels
 */
export type SealSecurityLevel = 'tc128' | 'tc192' | 'tc256'

/**
 * SEAL Scheme Type Enumeration
 */
export enum SealSchemeType {
  BFV = 'bfv',
  BGV = 'bgv',
  CKKS = 'ckks',
}

/**
 * SEAL supported operations by scheme type
 */
export const SEAL_SUPPORTED_OPERATIONS: Record<SealSchemeType, FHEOperation[]> =
  {
    [SealSchemeType.BFV]: [
      FHEOperation.Addition,
      FHEOperation.Subtraction,
      FHEOperation.Multiplication,
      FHEOperation.Negation,
      FHEOperation.Square,
      FHEOperation.Rotation,
      FHEOperation.Polynomial,
    ],
    [SealSchemeType.BGV]: [
      FHEOperation.Addition,
      FHEOperation.Subtraction,
      FHEOperation.Multiplication,
      FHEOperation.Negation,
      FHEOperation.Square,
      FHEOperation.Rotation,
      FHEOperation.Polynomial,
    ],
    [SealSchemeType.CKKS]: [
      FHEOperation.Addition,
      FHEOperation.Subtraction,
      FHEOperation.Multiplication,
      FHEOperation.Negation,
      FHEOperation.Square,
      FHEOperation.Rotation,
      FHEOperation.Polynomial,
      FHEOperation.Rescale, // CKKS specific operation
    ],
  }

/**
 * SEAL Service Configuration
 * Extends the generic FHEConfig with SEAL-specific properties
 */
export interface SealServiceConfig extends FHEConfig {
  scheme: SealSchemeType
  useHardwareAcceleration?: boolean
  persistKeys?: boolean
  keyPersistencePath?: string
  defaultScale?: number // For CKKS
}

/**
 * SEAL Operation Result
 * Implements the generic FHEOperationResult interface for SEAL operations
 */
export interface SealOperationResult extends FHEOperationResult {
  result?: unknown
  success: boolean
  error?: string
  operation: FHEOperation
}

/**
 * SEAL Context Options
 */
export interface SealContextOptions {
  scheme: SealSchemeType
  params: SealEncryptionParamsOptions
  defaultScale?: number // Default scale for CKKS encoding/encryption
}

/**
 * SEAL Key Generation Options
 */
export interface SealKeyGenOptions {
  generatePublicKey?: boolean
  generateRelinKeys?: boolean
  generateGaloisKeys?: boolean
  galoisSteps?: number[] // Specific rotation steps for Galois keys (more efficient)
}

/**
 * SEAL Encryption Options
 */
export interface SealEncryptOptions {
  scale?: number // Only used for CKKS
  useSymmetric?: boolean // Whether to use secret key (symmetric) encryption
}

/**
 * SEAL Key Pair
 */
export interface SealKeyPair {
  secretKey: unknown
  publicKey?: unknown
  relinKeys?: unknown
  galoisKeys?: unknown
}

/**
 * Serialized SEAL Keys
 */
export interface SerializedSealKeys {
  secretKey: string // Base64 encoded
  publicKey?: string // Base64 encoded
  relinKeys?: string // Base64 encoded
  galoisKeys?: string // Base64 encoded
}

/**
 * SEAL Key Load Options
 */
export interface SealKeyLoadOptions {
  format?: 'base64' | 'binary'
  validateKeys?: boolean
}

/**
 * SEAL Serialization Options
 */
export interface SealSerializationOptions {
  compression?: boolean
  binary?: boolean
}

/**
 * Maps encryption mode to appropriate SEAL scheme
 */
export function getSchemeForMode(mode: string): SealSchemeType {
  switch (mode) {
    case 'high-precision':
      return SealSchemeType.CKKS
    case 'integer':
      return SealSchemeType.BFV
    default:
      return SealSchemeType.BFV
  }
}

/**
 * Default SEAL parameters by scheme
 */
export const SEAL_PARAMETER_PRESETS: Record<
  string,
  SealEncryptionParamsOptions
> = {
  'bfv-default': {
    polyModulusDegree: 8192,
    coeffModulusBits: [60, 40, 40, 40, 60],
    plainModulus: 1_032_193,
  },
  'bgv-default': {
    polyModulusDegree: 8192,
    coeffModulusBits: [60, 40, 40, 40, 60],
    plainModulus: 1_032_193,
  },
  'ckks-default': {
    polyModulusDegree: 8192,
    coeffModulusBits: [60, 40, 40, 40, 60],
    scale: 2 ** 40,
  },
  'low-security': {
    polyModulusDegree: 4096,
    coeffModulusBits: [40, 20, 20, 40],
    plainModulus: 1_032_193,
  },
  'high-security': {
    polyModulusDegree: 16_384,
    coeffModulusBits: [60, 40, 40, 40, 40, 40, 60],
    plainModulus: 1_032_193,
  },
  'high-performance': {
    polyModulusDegree: 8192,
    coeffModulusBits: [30, 20, 20, 20, 30],
    plainModulus: 65_537,
  },
}

/**
 * SealKeys implements the FHEKeys interface for SEAL-specific key handling
 */
export interface SealKeys extends FHEKeys {
  /** SEAL-specific key data */
  sealKeyPair: SealKeyPair

  /** Serialized form of the keys */
  serializedKeys?: SerializedSealKeys
}

/**
 * Interface for a service implementing the FHE operations using SEAL
 */
export interface SealFHEService extends FHEService {
  /** SEAL-specific encryption parameters */
  getSealParameters(): SealEncryptionParamsOptions

  /** SEAL-specific key operations */
  loadKeys(
    serializedKeys: SerializedSealKeys,
    options?: SealKeyLoadOptions,
  ): Promise<void>

  /** Export keys in serialized format */
  exportKeys(options?: SealSerializationOptions): Promise<SerializedSealKeys>
}

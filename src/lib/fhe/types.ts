/**
 * FHE Service Type Definitions
 *
 * Type definitions for Fully Homomorphic Encryption implementation.
 * This file provides generic interfaces that are implemented by specific FHE libraries
 * like Microsoft SEAL (see ./seal-types.ts for the SEAL-specific implementations).
 */

//---------------------------------------------------------------
// Core Enums
//---------------------------------------------------------------

/**
 * Encryption modes available in the system
 */
export enum EncryptionMode {
  NONE = 'none', // No encryption
  STANDARD = 'standard', // Standard encryption (not FHE)
  FHE = 'fhe', // Full homomorphic encryption
  HIPAA = 'hipaa', // HIPAA-compliant encryption
}

/**
 * Homomorphic operations that can be performed on encrypted data
 * These operations are implemented by specific FHE libraries like SEAL.
 * See SEAL_SUPPORTED_OPERATIONS in seal-types.ts for library-specific support.
 */
export enum FHEOperation {
  // Basic arithmetic operations
  Addition = 'addition',
  Subtraction = 'subtraction',
  Multiplication = 'multiplication',
  Square = 'square',
  Negation = 'negation',
  Rotation = 'rotation',
  Polynomial = 'polynomial',
  Rescale = 'rescale',

  // Text analysis operations
  SENTIMENT = 'sentiment',
  CATEGORIZE = 'categorize',
  SUMMARIZE = 'summarize',
  TOKENIZE = 'tokenize',
  FILTER = 'filter',
  CUSTOM = 'custom',
  WORD_COUNT = 'word_count',
  CHARACTER_COUNT = 'character_count',
  KEYWORD_DENSITY = 'keyword_density',
  READING_LEVEL = 'reading_level',
  ANALYZE = 'ANALYZE',
}

/**
 * FHE error types
 */
export enum FHEErrorType {
  INITIALIZATION_ERROR = 'initialization_error',
  ENCRYPTION_ERROR = 'encryption_error',
  DECRYPTION_ERROR = 'decryption_error',
  OPERATION_ERROR = 'operation_error',
  INVALID_FORMAT = 'invalid_format',
  INVALID_KEY = 'invalid_key',
  PERMISSION_DENIED = 'permission_denied',
  CONFIGURATION_ERROR = 'configuration_error',
  NETWORK_ERROR = 'network_error',
  UNKNOWN_ERROR = 'unknown_error',
}

/**
 * FHE operation type
 */
export enum FHEOperationType {
  ENCRYPT = 'encrypt',
  DECRYPT = 'decrypt',
  PROCESS = 'process',
  KEY_GENERATION = 'key_generation',
  REENCRYPTION = 'reencryption',
}

/**
 * Therapy content category
 */
export enum TherapyCategory {
  ANXIETY = 'anxiety',
  DEPRESSION = 'depression',
  TRAUMA = 'trauma',
  RELATIONSHIP = 'relationship',
  SUBSTANCE_USE = 'substance_use',
  GENERAL = 'general',
  OTHER = 'other',
}

/**
 * Therapy content sentiment
 */
export enum TherapySentiment {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral',
  MIXED = 'mixed',
}

//---------------------------------------------------------------
// Core Types and Interfaces
//---------------------------------------------------------------

/**
 * Explicit key types for TFHE/SEAL
 */
export type ClientKey = unknown
export type ServerKey = unknown
export type PublicKey = unknown

/**
 * Polynomial Representation
 * Represents a polynomial as an array of coefficients [a₀, a₁, a₂, ..., aₙ]
 * where the polynomial is: a₀ + a₁x + a₂x² + ... + aₙxⁿ
 *
 * Used in FHE operations like the polynomial evaluation operation.
 */
export type Polynomial = number[]

/**
 * TFHE Security Level type
 * Different FHE libraries have their own security level implementations.
 * See SealSecurityLevel in seal-types.ts for the SEAL-specific version.
 */
export type TFHESecurityLevel = number

//---------------------------------------------------------------
// Configuration Interfaces
//---------------------------------------------------------------

/**
 * Multi-tenant configuration for FHE services
 */
export interface TenantConfig {
  /** Unique identifier for the tenant */
  tenantId: string

  /** Optional tenant-specific encryption key */
  encryptionKey?: string

  /** Optional metadata for the tenant */
  metadata?: Record<string, unknown>

  /** Isolation level for the tenant */
  isolationLevel?: 'shared' | 'dedicated' | 'custom'

  /** Custom configuration for tenant-specific settings */
  customConfig?: Record<string, unknown>

  /** Resource limits for this tenant */
  resourceLimits?: {
    maxOperationsPerMinute?: number
    maxKeySize?: number
    maxDataSize?: number
    maxConcurrentOperations?: number
  }
}

/**
 * Options for initializing encryption
 * This is a general interface that specific implementations can extend.
 */
export interface EncryptionOptions {
  mode?: EncryptionMode
  keySize?: number
  securityLevel?: string | TFHESecurityLevel
  enableDebug?: boolean
  keyRotationPeriod?: number
  enableBackup?: boolean
}

/**
 * Options for initializing an FHE service
 */
export interface FHEServiceOptions {
  mode: EncryptionMode
  sealScheme?: string
  useMock?: boolean
  keySize?: number
  securityLevel?: string | TFHESecurityLevel
  enableDebug?: boolean
  keyRotationPeriod?: number
  enableBackup?: boolean
  /** Multi-tenant configuration */
  tenantConfig?: TenantConfig
  [key: string]: unknown
}

/**
 * Configuration for FHE operations
 * This generic interface is extended by library-specific config interfaces,
 * like SealServiceConfig in seal-types.ts
 */
export interface FHEConfig {
  /** Mode of encryption */
  mode: EncryptionMode

  /** Key size in bits */
  keySize?: number

  /** Security level */
  securityLevel?: string | TFHESecurityLevel

  /** Enable debug mode */
  enableDebug?: boolean

  /** Polynomial modulus degree */
  polyModulusDegree?: number

  /** Coefficient modulus bits */
  coeffModulusBits?: number[]

  /** Plain modulus (for BFV scheme) */
  plainModulus?: number

  /** Scale (for CKKS scheme) */
  scale?: number

  /** Maximum computation depth */
  maxDepth?: number

  /** Implementation-specific configuration */
  [key: string]: unknown
}

/**
 * Parameters for FHE operations
 */
export interface FHEOperationParams {
  categories?: Record<string, string[]>
  filterTerms?: string[]
  operation?: string
  operationParams?: Record<string, unknown>
}

/**
 * Key management options for FHE secure storage and rotation
 */
export interface KeyManagementOptions {
  rotationPeriodDays?: number
  persistKeys?: boolean
  storagePrefix?: string
}

/**
 * Options for TEE (Trusted Execution Environment) integration
 */
export interface TEEOptions {
  provider:
    | 'aws-nitro'
    | 'azure-confidential-computing'
    | 'gcp-confidential-vm'
    | 'intel-sgx'
  attestationService?: string
  verificationKeys?: string[]
  enableRemoteAttestation?: boolean
}

/**
 * Compliance configuration for different regulatory standards
 */
export interface ComplianceConfig {
  hipaa?: boolean
  gdpr?: boolean
  ccpa?: boolean
  pci?: boolean
  auditLog?: boolean
  auditLogRetentionDays?: number
}

/**
 * FHE initialization options
 */
export interface FHEInitOptions {
  mode: EncryptionMode
  securityLevel: 'low' | 'medium' | 'high'
  keyRotationPeriod?: number
  enableBackup?: boolean
}

//---------------------------------------------------------------
// Data Structure Interfaces
//---------------------------------------------------------------

/**
 * Generic interface for encrypted data
 * Each implementation may extend this with additional properties.
 * See MockEncryptedData in mock-fhe-service.ts for an example implementation.
 */
export interface EncryptedData<T = unknown> {
  /** Unique identifier for the encrypted data */
  id: string

  /** Optional metadata for the encrypted data */
  metadata?: Record<string, unknown>

  /** Implementation-specific data */
  data: T

  /** Data type for type checking */
  dataType: 'number' | 'string' | 'boolean' | 'array' | 'object'
}

/**
 * Type guard for EncryptedData
 */
export function isEncryptedData(obj: unknown): obj is EncryptedData<unknown> {
  if (!obj || typeof obj !== 'object') {
    return false
  }
  const record = obj as Record<string, unknown>

  return (
    typeof record['id'] === 'string' &&
    typeof record['dataType'] === 'string' &&
    'data' in record
  )
}

/**
 * Encrypted message interface
 */
export interface EncryptedMessage {
  id: string
  content: string // Encrypted content
  timestamp: number
  metadata?: EncryptedMessageMetadata
}

/**
 * Metadata for an encrypted message
 */
export interface EncryptedMessageMetadata {
  encryptionMode: EncryptionMode
  keyId?: string
  timestamp: number
  contentType?: string
  verificationToken?: string
}

/**
 * TFHE context for cryptographic operations
 */
export interface TFHEContext {
  initialized: boolean
  config?: unknown
  clientKey: unknown
  publicKey: unknown
  keySize?: number
  securityLevel?: string | TFHESecurityLevel
}

/**
 * TFHE key pair for storage and management
 */
export interface TFHEKeyPair {
  id: string
  publicKey: string
  privateKeyEncrypted: string
  created: number
  expires: number
  version: string
}

/**
 * FHE key pair
 */
export interface FHEKeyPair {
  publicKey: string
  privateKey: string
  keyId: string
  created: number
  expires?: number
  securityLevel: string
}

/**
 * Keys used in FHE operations
 */
export interface FHEKeys {
  /** Key identifier */
  keyId: string

  /** When the key was created */
  createdAt: Date

  /** Optional key expiration */
  expiresAt?: Date

  /** Associated scheme */
  scheme: string

  /** Key status */
  status: 'active' | 'expired' | 'revoked'
}

/**
 * FHE Session
 */
export interface FHESession {
  id: string
  therapistId: string
  patientId?: string
  keyPairId: string
  created: number
  lastActive: number
  encryptionMode: string
  active: boolean
}

//---------------------------------------------------------------
// Service Interfaces
//---------------------------------------------------------------

/**
 * Interface for FHE cryptographic scheme
 */
export interface FHEScheme {
  /** Name of the scheme */
  name: string

  /** Version of the scheme */
  version: string

  /** Get all operations supported by this scheme */
  getOperations(): FHEOperation[]

  /** Check if a specific operation is supported */
  supportsOperation(operation: FHEOperation): boolean
}

/**
 * Interface for FHE service implementation
 */
export interface FHEService {
  /** The cryptographic scheme used by this service */
  scheme: FHEScheme

  /** Initialize the service (load keys, prepare environment) */
  initialize(options?: unknown): Promise<void | boolean>

  /** Generate new encryption keys */
  generateKeys(config?: FHEConfig): Promise<FHEKeys>

  /** Check if the service is initialized and ready */
  isInitialized(): boolean

  /** Check if a specific operation is supported */
  supportsOperation(operation: FHEOperation): boolean

  /**
   * Encrypt a value
   * @param value The value to encrypt
   * @returns The encrypted data
   */
  encrypt<T>(value: T, options?: unknown): Promise<EncryptedData<unknown>>

  /**
   * Decrypt encrypted data
   * @param encryptedData The encrypted data to decrypt
   * @returns The decrypted value
   */
  decrypt<T>(
    encryptedData: EncryptedData<unknown>,
    options?: unknown,
  ): Promise<T>

  /**
   * Add two encrypted values
   * @param a First encrypted value
   * @param b Second encrypted value or scalar
   * @returns Result of addition
   */
  add?(
    a: EncryptedData<unknown>,
    b: EncryptedData<unknown> | number,
  ): Promise<EncryptedData<unknown>>

  /**
   * Subtract one encrypted value from another
   * @param a First encrypted value
   * @param b Second encrypted value or scalar
   * @returns Result of subtraction
   */
  subtract?(
    a: EncryptedData<unknown>,
    b: EncryptedData<unknown> | number,
  ): Promise<EncryptedData<unknown>>

  /**
   * Multiply encrypted value
   * @param a Encrypted value
   * @param b Another encrypted value or scalar
   * @returns Result of multiplication
   */
  multiply?(
    a: EncryptedData<unknown>,
    b: EncryptedData<unknown> | number,
  ): Promise<EncryptedData<unknown>>

  /**
   * Negate an encrypted value
   * @param value Encrypted value to negate
   * @returns Negated encrypted value
   */
  negate?(value: EncryptedData<unknown>): Promise<EncryptedData<unknown>>

  /**
   * Apply a polynomial function to encrypted data
   * @param value Encrypted value
   * @param coefficients Polynomial coefficients from lowest to highest degree
   * @returns Result of polynomial evaluation
   */
  applyPolynomial?(
    value: EncryptedData<unknown>,
    coefficients: Polynomial,
  ): Promise<EncryptedData<unknown>>

  /**
   * Rotate elements in an encrypted vector
   * @param vector Encrypted vector
   * @param steps Number of steps to rotate (positive for right, negative for left)
   * @returns Rotated encrypted vector
   */
  rotate?(
    vector: EncryptedData<unknown>,
    steps: number,
  ): Promise<EncryptedData<unknown>>

  /**
   * Process encrypted data
   */
  processEncrypted?(
    encryptedData: string,
    operation: FHEOperation | string,
    params?: Record<string, unknown>,
  ): Promise<FHEOperationResult<string>>
}

/**
 * Extended service interface with additional methods
 */
export interface FHEServiceInterface extends FHEService {
  dispose(): void
  rotateKeys(): Promise<void>
  getMode(): EncryptionMode
  encryptData(data: unknown): Promise<string>
}

//---------------------------------------------------------------
// Operation Results and Metrics
//---------------------------------------------------------------

/**
 * Result of a homomorphic operation
 */
export interface HomomorphicOperationResult {
  success: boolean
  result?: string // Encrypted result
  operationType: string
  timestamp: number
  error?: string
  metadata?: Record<string, unknown> // Additional operation metadata
}

/**
 * Results of an FHE operation
 */
export interface FHEOperationResult<T = unknown> {
  success: boolean
  result?: T
  error?: string
  operation: FHEOperation
  metadata?: Record<string, unknown>
}

/**
 * Result of a TFHE operation
 */
export interface TFHEOperationResult {
  success: boolean
  data?: unknown
  error?: string
  operationId?: string
  timestamp: number
}

/**
 * Performance metrics for FHE operations
 */
export interface FHEPerformanceMetrics {
  operationId: string
  operation: FHEOperation
  startTime: number
  endTime: number
  duration: number
  inputSize: number
  outputSize: number
  success: boolean
}

/**
 * Security audit log entry for FHE operations
 */
export interface FHESecurityAuditEntry {
  timestamp: number
  operation: string
  keyId?: string
  success: boolean
  errorCode?: string
  ipAddress?: string
  userId?: string
}

/**
 * FHE operation context
 */
export interface FHEOperationContext {
  operationType: string
  contextId: string
  timestamp: number
  parameters?: Record<string, unknown>
  metrics?: FHEPerformanceMetrics
}

//---------------------------------------------------------------
// Therapy-Specific Interfaces
//---------------------------------------------------------------

/**
 * Therapy message encryption request
 */
export interface TherapyEncryptionRequest {
  message: string
  therapistId: string
  patientId?: string
  scenario?: string
  securityLevel: string
  encryptionMode: string
}

/**
 * Therapy message decryption request
 */
export interface TherapyDecryptionRequest {
  encryptedMessage: string
  therapistId: string
  patientId?: string
  requestId: string
}

/**
 * Therapy homomorphic operation request
 */
export interface TherapyHomomorphicRequest {
  encryptedMessage: string
  operation: string
  therapistId: string
  patientId?: string
  parameters?: Record<string, unknown>
}

// Export error type for use in error handling
export class OperationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OperationError'
  }
}

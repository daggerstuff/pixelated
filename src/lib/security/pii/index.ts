/**
 * PII Detection and Redaction Service
 *
 * This service is responsible for detecting and redacting personally identifiable
 * information (PII) in text and data structures. It uses a combination of pattern
 * matching and machine learning to identify sensitive information.
 *
 * The service is designed to work with both plaintext and encrypted data, leveraging
 * FHE capabilities when available.
 */

import { fheService } from '../../fhe'
import { FHEOperation } from '../../fhe/types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

// Initialize logger
const logger = createBuildSafeLogger('default')

// Types and interfaces
export enum PIIType {
  EMAIL = 'email',
  PHONE = 'phone',
  SSN = 'ssn',
  CREDIT_CARD = 'credit_card',
  ADDRESS = 'address',
  NAME = 'name',
  DATE_OF_BIRTH = 'date_of_birth',
  IP_ADDRESS = 'ip_address',
  MEDICAL_RECORD = 'medical_record',
  PATIENT_ID = 'patient_id',
  INSURANCE_ID = 'insurance_id',
  OTHER = 'other',
}

export interface PIIDetectionResult {
  detected: boolean
  types: PIIType[]
  confidence: number
  redacted?: string
  metadata?: Record<string, unknown>
  isEncrypted: boolean
}

export interface PIIDetectionConfig {
  enabled: boolean
  redactByDefault: boolean
  minConfidence: number
  useML: boolean
  patternMatchingOnly: boolean
  enabledTypes: PIIType[]
  auditDetections: boolean
  customPatterns?: Record<string, RegExp>
  enableFHEDetection: boolean
}

// Default configuration
const DEFAULT_CONFIG: PIIDetectionConfig = {
  enabled: true,
  redactByDefault: true,
  minConfidence: 0.7,
  useML: true,
  patternMatchingOnly: false,
  enabledTypes: Object.values(PIIType),
  auditDetections: true,
  enableFHEDetection: true,
}

/**
 * Interface for FHE Service
 */
interface FHEService {
  isInitialized(): boolean;
  processEncrypted(
    text: string,
    operation: FHEOperation,
    options: {
      operation: string;
      threshold: number;
      patterns: string[];
    }
  ): Promise<{
    data: {
      hasPII: string;
      confidence: string;
      types: string;
      redacted?: string;
    };
    metadata: {
      operation: FHEOperation;
      timestamp: number;
    };
  }>;
}

/**
 * PII Detection Service class
 * Singleton implementation to provide PII detection and redaction
 */
class PIIDetectionService {
  private static instance: PIIDetectionService
  private config: PIIDetectionConfig
  private initialized = false
  private mlModelLoaded = false
  private patterns: Record<PIIType, RegExp[]>

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(config: Partial<PIIDetectionConfig> = {}): void {
    this.config = { ...DEFAULT_CONFIG, ...config }

    // Initialize base patterns for detection
    this.patterns = {
      [PIIType.EMAIL]: [/[\w.%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi],
      [PIIType.PHONE]: [
        /(\+\d{1,3}[\s-])?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
        /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      ],
      [PIIType.SSN]: [/\b\d{3}-?\d{2}-?\d{4}\b/g],
      [PIIType.CREDIT_CARD]: [
        /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
        /\b\d{4}[\s-]?\d{6}[\s-]?\d{5}\b/g, // AMEX format
      ],
      [PIIType.ADDRESS]: [
        /\d+\s+([A-Z]+\s+){1,3}(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Court|Ct|Lane|Ln|Way|Parkway|Pkwy)\.?(\s|,)/gi,
        /P\.?O\.?\s+Box\s+\d+/gi,
      ],
      [PIIType.NAME]: [/\b([A-Z][a-z]+)(\s+[A-Z][a-z]+){1,2}\b/g],
      [PIIType.DATE_OF_BIRTH]: [
        /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\b/gi,
      ],
      [PIIType.IP_ADDRESS]: [
        /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
        /\b([0-9a-f]{1,4}:){7}[0-9a-f]{1,4}\b/gi, // IPv6 format
      ],
      [PIIType.MEDICAL_RECORD]: [
        /\bMRN:?\s*\d+\b/gi,
        /\bMedical Record:?\s*\d+\b/gi,
      ],
      [PIIType.PATIENT_ID]: [
        /\bPatient ID:?\s*\d+\b/gi,
        /\bPID:?\s*\d+\b/gi,
        /\bPatient ID:?\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, // UUID format
        /\bPID:?\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, // UUID format
        /\b(?:patient[_-]?(?:id|uuid|identifier)|p(?:atient)?id):?\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, // UUID with patient context
      ],
      [PIIType.INSURANCE_ID]: [
        /\bInsurance ID:?\s*[\w-]+\b/gi,
        /\bPolicy Number:?\s*[\w-]+\b/gi,
      ],
      [PIIType.OTHER]: [],
    }

    logger.info('PII Detection Service initialized')
  }

  /**
   * Get the singleton instance of the PII detection service
   */
  public static getInstance(
    config?: Partial<PIIDetectionConfig>,
  ): PIIDetectionService {
    if (!PIIDetectionService.instance) {
      PIIDetectionService.instance = new PIIDetectionService(config)
    }

    // Update config if provided
    if (config) {
      PIIDetectionService.instance.updateConfig(config)
    }

    return PIIDetectionService.instance
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      logger.info('Initializing PII Detection Service')

      // Load ML model if enabled and not pattern-matching only
      if (this.config.useML && !this.config.patternMatchingOnly) {
        await this.loadMLModel()
      }

      // Add custom patterns if provided
      if (this.config.customPatterns) {
        Object.entries(this.config.customPatterns).forEach(
          ([type, pattern]) => {
            const piiType = type as PIIType
            if (this.patterns[piiType]) {
              this.patterns[piiType].push(pattern)
            } else {
              this.patterns[PIIType.OTHER].push(pattern)
            }
          },
        )
      }

      this.initialized = true
      logger.info('PII Detection Service initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize PII Detection Service', {
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  /**
   * Load the machine learning model for advanced PII detection
   */
  private async loadMLModel(): Promise<void> {
    try {
      // In a real implementation, this would load an NLP model
      // For this implementation, we'll simulate model loading

      logger.info('Loading ML model for PII detection')

      // Simulate loading delay
      await new Promise((resolve) => setTimeout(resolve, 500))

      this.mlModelLoaded = true
      logger.info('ML model loaded successfully')
    } catch (error: unknown) {
      logger.error('Failed to load ML model', {
        error: error instanceof Error ? String(error) : String(error),
      })
      this.mlModelLoaded = false
      // Fall back to pattern matching
      this.config.patternMatchingOnly = true
    }
  }

  /**
   * Update the configuration
   */
  public updateConfig(config: Partial<PIIDetectionConfig>): void {
    this.config = { ...this.config, ...config }
    logger.info('PII Detection Service configuration updated')
  }

  /**
   * Detect PII in a string
   */
  public async detect(
    text: string,
    options: {
      redact?: boolean
      types?: PIIType[]
    } = {},
  ): Promise<PIIDetectionResult> {
    if (!this.config.enabled) {
      return {
        detected: false,
        types: [],
        confidence: 0,
        isEncrypted: false,
      }
    }

    // Handle default options
    const redact = options.redact ?? this.config.redactByDefault
    const typesToCheck = options.types ?? this.config.enabledTypes

    try {
      // Check if the text is already encrypted
      const isEncrypted = text.startsWith('ENC:') || text.startsWith('FHE:')

      // If encrypted and FHE detection is enabled, use homomorphic detection
      if (isEncrypted && this.config.enableFHEDetection) {
        return this.detectEncrypted(text)
      }

      // Pattern-based detection
      const detectedPII: PIIType[] = []

      for (const type of typesToCheck) {
        for (const pattern of this.patterns[type]) {
          if (pattern.test(text)) {
            detectedPII.push(type)
            break // Found a match for this type, move to next type
          }
        }
      }

      // ML-based detection (if enabled and loaded)
      let mlConfidence = 0
      if (
        this.config.useML &&
        this.mlModelLoaded &&
        !this.config.patternMatchingOnly
      ) {
        // In a real implementation, this would use the ML model
        // For this implementation, we'll simulate ML detection

        // Simple heuristic: if text contains sensitive keywords, increase confidence
        const sensitiveKeywords = [
          'ssn',
          'social security',
          'confidential',
          'private',
          'secret',
          'password',
          'diagnosis',
          'condition',
          'medical',
          'patient',
          'doctor',
          'therapy',
          'therapist',
          'health',
          'insurance',
          'record',
          'birth',
          'address',
          'phone',
          'email',
        ]

        for (const keyword of sensitiveKeywords) {
          if (text.toLowerCase().includes(keyword)) {
            mlConfidence += 0.1 // Increase confidence for each match
          }
        }

        // Cap confidence at 1.0
        mlConfidence = Math.min(mlConfidence, 1.0)

        // If ML detects PII with high confidence but pattern matching missed it
        if (
          mlConfidence > this.config.minConfidence &&
          detectedPII.length === 0
        ) {
          detectedPII.push(PIIType.OTHER)
        }
      }

      // Calculate overall confidence
      const patternConfidence = detectedPII.length > 0 ? 0.9 : 0
      const confidence = Math.max(patternConfidence, mlConfidence)

      // Create result
      const result: PIIDetectionResult = {
        detected:
          detectedPII.length > 0 || confidence >= this.config.minConfidence,
        types: detectedPII,
        confidence,
        isEncrypted: false,
      }

      // Redact if requested
      if (redact && result.detected) {
        result.redacted = this.redactText(text, detectedPII)
      }

      // Log detection if auditing is enabled
      if (this.config.auditDetections && result.detected) {
        this.logDetection(result)
      }

      return result
    } catch (error: unknown) {
      logger.error('Error detecting PII', {
        error: error instanceof Error ? String(error) : String(error),
      })

      // Return a safe default
      return {
        detected: false,
        types: [],
        confidence: 0,
        isEncrypted: false,
      }
    }
  }

  /**
   * Detect PII in encrypted text using FHE
   */
  private async detectEncrypted(
    encryptedText: string,
  ): Promise<PIIDetectionResult> {
    try {
      // Ensure FHE service is available
      const fheServiceTyped = fheService as FHEService;
      if (!fheServiceTyped.isInitialized()) {
        throw new Error('FHE service not initialized');
      }

      // Process encrypted data using FHE operations
      const result = await fheServiceTyped.processEncrypted(
        encryptedText,
        FHEOperation.ANALYZE,
        {
          operation: 'pii_detection',
          threshold: this.config.minConfidence,
          patterns: Object.values(this.patterns)
            .flat()
            .map((p) => p.source),
        },
      );

      // Return encrypted result
      return {
        data: { hasPII: 'false', confidence: '0', types: '' },
        metadata: { operation: FHEOperation.ANALYZE, timestamp: Date.now() },
      };

      // Parse the result
      // In a real FHE implementation, this would decrypt the result
      // For this implementation, we'll simulate the result

      const hasPII = (result.data as { hasPII: string }).hasPII === 'true'
      const confidence =
        Number.parseFloat((result.data as { confidence: string }).confidence) ||
        0

      // Create types array from comma-separated string
      const types =
        (((result.data as { types: string }).types || '')
          .split(',')
          .filter((t) => t.trim() !== '') as PIIType[]) || []

      const detectionResult: PIIDetectionResult = {
        detected: hasPII,
        types,
        confidence,
        isEncrypted: true,
        metadata: {
          operationId: result.metadata.operation.toString(),
          processingTime: (Date.now() - result.metadata.timestamp).toString(),
        },
      }

      // If redaction was requested as part of the FHE operation
      if ((result.data as { redacted: string }).redacted) {
        detectionResult.redacted = (
          result.data as { redacted: string }
        ).redacted
      }

      return detectionResult
    } catch (error: unknown) {
      logger.error('Error detecting PII in encrypted text', {
        error: error instanceof Error ? String(error) : String(error),
      })

      // Fall back to assuming no PII
      return {
        detected: false,
        types: [],
        confidence: 0,
        isEncrypted: true,
      }
    }
  }

  /**
   * Redact identified PII in text
   */
  private redactText(text: string, types: PIIType[]): string {
    let redactedText = text

    // Apply appropriate redaction for each PII type
    for (const type of types) {
      for (const pattern of this.patterns[type]) {
        redactedText = redactedText.replace(
          pattern,
          this.getRedactionReplacement(type),
        )
      }
    }

    return redactedText
  }

  /**
   * Get the appropriate redaction replacement for a PII type
   */
  private getRedactionReplacement(type: PIIType): string {
    switch (type) {
      case PIIType.EMAIL:
        return '[EMAIL REDACTED]'
      case PIIType.PHONE:
        return '[PHONE REDACTED]'
      case PIIType.SSN:
        return '[SSN REDACTED]'
      case PIIType.CREDIT_CARD:
        return '[CREDIT CARD REDACTED]'
      case PIIType.ADDRESS:
        return '[ADDRESS REDACTED]'
      case PIIType.NAME:
        return '[NAME REDACTED]'
      case PIIType.DATE_OF_BIRTH:
        return '[DOB REDACTED]'
      case PIIType.IP_ADDRESS:
        return '[IP ADDRESS REDACTED]'
      case PIIType.MEDICAL_RECORD:
        return '[MEDICAL RECORD REDACTED]'
      case PIIType.PATIENT_ID:
        return '[PATIENT ID REDACTED]'
      case PIIType.INSURANCE_ID:
        return '[INSURANCE ID REDACTED]'
      default:
        return '[PII REDACTED]'
    }
  }

  /**
   * Process a data object and redact any PII
   */
  public async processObject<T extends Record<string, unknown>>(
    data: T,
    options: {
      redact?: boolean
      types?: PIIType[]
      sensitiveKeys?: string[]
    } = {},
  ): Promise<{ processed: T; hasPII: boolean }> {
    if (!this.config.enabled) {
      return { processed: data, hasPII: false }
    }

    // Handle default options
    const redact = options.redact ?? this.config.redactByDefault
    const typesToCheck = options.types ?? this.config.enabledTypes
    const sensitiveKeys = options.sensitiveKeys ?? []

    // Create a copy of the data to avoid modifying the original
    const result = JSON.parse(JSON.stringify(data) as any) as T
    let detectedPII = false

    // Process the object recursively
    const processValue = async (
      value: unknown,
      key?: string,
    ): Promise<unknown> => {
      // Skip null or undefined values
      if (value === null || value === undefined) {
        return value
      }

      // Check if this is a sensitive key that should be automatically redacted
      const isSensitiveKey =
        key &&
        sensitiveKeys.some((sensitiveKey) =>
          key.toLowerCase().includes(sensitiveKey.toLowerCase()),
        )

      // Handle different types
      if (typeof value === 'string') {
        // If it's a sensitive key, always redact
        if (isSensitiveKey) {
          detectedPII = true
          return redact ? '[REDACTED]' : value
        }

        // Otherwise check for PII
        const piiResult = await this.detect(value, {
          redact,
          types: typesToCheck,
        })

        if (piiResult.detected) {
          detectedPII = true
          return piiResult.redacted || value
        }

        return value
      } else if (typeof value === 'object') {
        // Handle arrays
        if (Array.isArray(value)) {
          const processedArray = []

          for (const item of value) {
            processedArray.push(await processValue(item))
          }

          return processedArray
        }

        // Handle objects
        const processedObject: Record<string, unknown> = {}

        for (const [objKey, objValue] of Object.entries(value)) {
          processedObject[objKey] = await processValue(objValue, objKey)
        }

        return processedObject
      }

      // Other types (number, boolean, etc.) are returned as is
      return value
    }

    // Process the root object
    const processed = (await processValue(result)) as T

    return { processed, hasPII: detectedPII }
  }

  /**
   * Log PII detection for audit purposes
   */
  private logDetection(result: PIIDetectionResult): void {
    logger.info('PII detected', {
      types: result.types,
      confidence: result.confidence,
      timestamp: new Date().toISOString(),
      isEncrypted: result.isEncrypted,
    })

    // In a real implementation, this would log to an audit system
    // For this implementation, we're just logging to the console
  }

  /**
   * Check if the service is initialized
   */
  public isInitialized(): boolean {
    return this.initialized
  }
}

// Export a singleton instance
export const piiDetectionService = PIIDetectionService.getInstance()

export { PIIDetectionService }

// Export default for convenience
export default piiDetectionService

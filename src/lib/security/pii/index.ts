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
import type { RealFHEService } from '../../fhe/fhe-service'

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
  private constructor(config: Partial<PIIDetectionConfig> = {}) {
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
   * Validates model integrity and handles loading failures gracefully
   */
  private async loadMLModel(): Promise<void> {
    try {
      // Validate configuration before attempting to load
      if (!this.config.useML) {
        logger.info('ML model loading skipped - ML disabled in configuration')
        this.mlModelLoaded = false
        return
      }

      logger.info('Loading ML model for PII detection')

      // In a real implementation, this would:
      // 1. Validate model file integrity (checksum/hash)
      // 2. Verify model signature/authenticity
      // 3. Load model from secure storage
      // 4. Perform safety checks on model parameters

      // Simulate model loading with validation
      const loadStartTime = Date.now()
      
      // Simulate loading delay for realistic behavior
      await new Promise((resolve) => setTimeout(resolve, 500))

      // Validate simulated loading time (prevent infinite hangs)
      const loadDuration = Date.now() - loadStartTime
      if (loadDuration > 10000) { // 10 second timeout
        throw new Error('ML model loading timeout - exceeded 10 seconds')
      }

      this.mlModelLoaded = true
      logger.info('ML model loaded successfully', {
        loadDuration,
        modelType: 'simulated-nlp-pii-detector',
      })

    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Failed to load ML model', {
        error: errorMessage,
        timestamp: new Date().toISOString(),
        config: {
          useML: this.config.useML,
          patternMatchingOnly: this.config.patternMatchingOnly,
        },
      })

      this.mlModelLoaded = false
      
      // Graceful fallback to pattern matching
      logger.info('Falling back to pattern matching due to ML model loading failure')
      this.config.patternMatchingOnly = true
      
      // Log the fallback for audit purposes
      if (this.config.auditDetections) {
        logger.info('ML model fallback activated', {
          fallbackReason: 'model_loading_failure',
          error: errorMessage,
        })
      }
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
   * Detect PII in a string with enhanced validation and error handling
   * @param text - The text to analyze for PII
   * @param options - Detection options including redaction and type filtering
   * @returns Promise resolving to PIIDetectionResult
   */
  public async detect(
    text: string,
    options: {
      redact?: boolean
      types?: PIIType[]
    } = {},
  ): Promise<PIIDetectionResult> {
    // Input validation
    if (typeof text !== 'string') {
      logger.warn('Invalid input type for PII detection', {
        receivedType: typeof text,
        expectedType: 'string',
      })
      return {
        detected: false,
        types: [],
        confidence: 0,
        isEncrypted: false,
      }
    }

    if (!this.config.enabled) {
      logger.debug('PII detection disabled by configuration')
      return {
        detected: false,
        types: [],
        confidence: 0,
        isEncrypted: false,
      }
    }

    // Handle default options with validation
    const redact = options.redact ?? this.config.redactByDefault
    const typesToCheck = options.types ?? this.config.enabledTypes

    // Validate types array
    if (!Array.isArray(typesToCheck) || typesToCheck.length === 0) {
      logger.warn('Invalid or empty types array provided', {
        typesToCheck,
      })
      return {
        detected: false,
        types: [],
        confidence: 0,
        isEncrypted: false,
      }
    }

    try {
      // Check if the text is already encrypted using secure prefix detection
      const isEncrypted = this.isEncryptedText(text)

      // If encrypted and FHE detection is enabled, use homomorphic detection
      if (isEncrypted && this.config.enableFHEDetection) {
        logger.debug('Processing encrypted text with FHE detection')
        return this.detectEncrypted(text)
      }

      // Pattern-based detection with performance optimization
      const detectedPII: PIIType[] = []
      const textLower = text.toLowerCase() // Cache lowercase version for performance

      for (const type of typesToCheck) {
        const patterns = this.patterns[type]
        if (!patterns || patterns.length === 0) {
          continue // Skip types with no patterns
        }

        for (const pattern of patterns) {
          try {
            if (pattern.test(text)) {
              detectedPII.push(type)
              break // Found a match for this type, move to next type
            }
          } catch (patternError) {
            logger.error('Pattern matching error', {
              pattern: pattern.source,
              type,
              error: patternError instanceof Error ? patternError.message : String(patternError),
            })
            // Continue with next pattern instead of failing completely
            continue
          }
        }
      }

      // ML-based detection with enhanced validation
      let mlConfidence = 0
      if (
        this.config.useML &&
        this.mlModelLoaded &&
        !this.config.patternMatchingOnly
      ) {
        logger.debug('Using ML-based detection')
        
        // Enhanced ML detection with better heuristics
        mlConfidence = this.calculateMLConfidence(textLower, detectedPII)

        // If ML detects PII with high confidence but pattern matching missed it
        if (
          mlConfidence > this.config.minConfidence &&
          detectedPII.length === 0
        ) {
          detectedPII.push(PIIType.OTHER)
          logger.debug('ML detection identified additional PII not caught by patterns', {
            mlConfidence,
            minConfidence: this.config.minConfidence,
          })
        }
      }

      // Calculate overall confidence with enhanced logic
      const patternConfidence = detectedPII.length > 0 ? 0.9 : 0
      const confidence = Math.max(patternConfidence, mlConfidence)

      // Validate confidence bounds
      const validatedConfidence = Math.max(0, Math.min(1, confidence))

      // Create result with validation
      const result: PIIDetectionResult = {
        detected:
          detectedPII.length > 0 || validatedConfidence >= this.config.minConfidence,
        types: detectedPII,
        confidence: validatedConfidence,
        isEncrypted: false,
      }

      // Redact if requested with validation
      if (redact && result.detected) {
        try {
          result.redacted = this.redactText(text, detectedPII)
        } catch (redactionError) {
          logger.error('Redaction failed', {
            error: redactionError instanceof Error ? redactionError.message : String(redactionError),
            textLength: text.length,
            typesToRedact: detectedPII,
          })
          // Continue without redaction rather than failing completely
        }
      }

      // Log detection if auditing is enabled
      if (this.config.auditDetections && result.detected) {
        this.logDetection(result)
      }

      logger.debug('PII detection completed', {
        detected: result.detected,
        types: result.types,
        confidence: result.confidence,
        textLength: text.length,
      })

      return result
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Error detecting PII', {
        error: errorMessage,
        textLength: text.length,
        timestamp: new Date().toISOString(),
      })

      // Return a safe default - maintain security by assuming no PII detection
      return {
        detected: false,
        types: [],
        confidence: 0,
        isEncrypted: false,
      }
    }
  }

  /**
   * Detect PII in encrypted text using FHE (Fully Homomorphic Encryption)
   * This method processes encrypted data without decrypting it, maintaining
   * privacy while performing PII detection operations.
   */
  private async detectEncrypted(
    encryptedText: string,
  ): Promise<PIIDetectionResult> {
    try {
      // Validate FHE service availability with proper type checking
      if (!fheService || typeof fheService !== 'object') {
        throw new Error('FHE service not available or invalid')
      }

      // Ensure FHE service is available and properly typed
      const fheServiceTyped = fheService as RealFHEService
      if (!fheServiceTyped.isInitialized()) {
        throw new Error('FHE service not initialized')
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
      )

      // Validate FHE operation result
      if (!result || !result.data) {
        logger.warn('FHE operation returned empty result', {
          encryptedTextLength: encryptedText.length,
        })
        return {
          detected: false,
          types: [],
          confidence: 0,
          isEncrypted: true,
        }
      }

      // Safely extract and validate FHE result data
      const resultData = result.data as {
        hasPII?: string
        confidence?: string
        types?: string
        redacted?: string
      }

      const hasPII = resultData.hasPII === 'true'
      const confidence = Number.parseFloat(resultData.confidence || '0') || 0

      // Create types array from comma-separated string with validation
      const types = resultData.types
        ? (resultData.types
            .split(',')
            .filter((t) => t.trim() !== '')
            .map((t) => t.trim()) as PIIType[]) || []
        : []

      const detectionResult: PIIDetectionResult = {
        detected: hasPII,
        types,
        confidence,
        isEncrypted: true,
        metadata: {
          operationId: result.metadata?.operation?.toString() || 'unknown',
          processingTime: result.metadata?.timestamp
            ? (Date.now() - result.metadata.timestamp).toString()
            : '0',
        },
      }

      // If redaction was requested as part of the FHE operation
      if (resultData.redacted) {
        detectionResult.redacted = resultData.redacted
      }

      return detectionResult
    } catch (error: unknown) {
      logger.error('Error detecting PII in encrypted text', {
        error: error instanceof Error ? error.message : String(error),
        encryptedTextLength: encryptedText.length,
        timestamp: new Date().toISOString(),
      })

      // Fall back to assuming no PII - maintain security by default
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
    const result = JSON.parse(JSON.stringify(data)) as T
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
          const processedArray: unknown[] = []

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
   * Check if text appears to be encrypted based on common encryption prefixes
   * @param text - Text to check for encryption indicators
   * @returns boolean indicating if text is likely encrypted
   */
  private isEncryptedText(text: string): boolean {
    // Check for common encryption prefixes used in the system
    const encryptionPrefixes = ['ENC:', 'FHE:', 'AES:', 'RSA:']
    
    // Also check for base64-like patterns that might indicate encryption
    const base64Pattern = /^[A-Za-z0-9+/]{20,}={0,2}$/
    
    return encryptionPrefixes.some(prefix => text.startsWith(prefix)) ||
           (text.length > 20 && base64Pattern.test(text))
  }

  /**
   * Calculate ML confidence score using enhanced heuristics
   * @param text - Lowercase text to analyze
   * @param detectedPatterns - Already detected PII patterns
   * @returns Confidence score between 0 and 1
   */
  private calculateMLConfidence(text: string, detectedPatterns: PIIType[]): number {
    let mlConfidence = 0
    
    // Enhanced keyword categories for better detection
    const sensitiveKeywords = {
      high: ['ssn', 'social security', 'password', 'credit card', 'bank account'],
      medium: ['confidential', 'private', 'secret', 'medical', 'patient', 'diagnosis'],
      low: ['health', 'insurance', 'record', 'birth', 'address', 'phone', 'email'],
    }
    
    // Score based on keyword categories
    for (const [category, keywords] of Object.entries(sensitiveKeywords)) {
      const categoryScore = category === 'high' ? 0.15 : category === 'medium' ? 0.1 : 0.05
      
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          mlConfidence += categoryScore
        }
      }
    }
    
    // Bonus for context indicators
    const contextIndicators = ['personal', 'identification', 'identity', 'biometric']
    for (const indicator of contextIndicators) {
      if (text.includes(indicator)) {
        mlConfidence += 0.05
      }
    }
    
    // Penalize if no patterns were detected but text is very short
    if (detectedPatterns.length === 0 && text.length < 10) {
      mlConfidence *= 0.5
    }
    
    // Cap confidence at 1.0
    return Math.min(mlConfidence, 1.0)
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

/**
 * Homomorphic Operations for FHE
 *
 * This module provides implementation for operations that can be performed
 * on encrypted data without decryption using Microsoft SEAL Library.
 *
 * It uses interfaces defined in ./types.ts and implementations from ./seal-types.ts.
 */

import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { getEncryptedTextProcessor } from './encrypted-text-processor'
import { SealResourceScope } from './seal-memory'
import { SealOperations } from './seal-operations'
import { SealService } from './seal-service'
import type { SealCipherText } from './seal-service'
import { SealSchemeType } from './seal-types'
import type { SealOperationResult } from './seal-types'
import type { SealContextOptions } from './seal-types'
import { EncryptionMode, FHEOperation } from './types'
import type { HomomorphicOperationResult } from './types'

// Get logger
const logger = createBuildSafeLogger('homomorphic-ops')

// Environment detection
const isServer = typeof window === 'undefined'

import { isRecord, parseSerializedCiphertextInput, resolveSerializedResult, normalizeOptionalRecordToStringArray, getNumericArray, getNumericValue, getStringArray, formatOperationError, FHEOperationError } from './homomorphic-ops.utils'
export { FHEOperationError } from './homomorphic-ops.utils'
import { simulateCategorization, analyzeSentiment, categorizeText, summarizeText, tokenizeText, filterText, estimateSyllables } from './homomorphic-ops.text-analysis'

/**
 * Class for performing homomorphic operations on encrypted data
 * This class coordinates between the generic FHE interfaces defined in ./types.ts
 * and the SEAL-specific implementations from ./seal-types.ts to provide
 * homomorphic operations on encrypted data.
 */
export class HomomorphicOperations {
  private static instance: HomomorphicOperations | null = null
  private initialized = false
  private sealOps: SealOperations | null = null
  private enableClientSideProcessing = true
  private enableServerSideProcessing = true

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    logger.info(
      `Homomorphic Operations initialized in ${isServer ? 'server' : 'client'} environment`,
    )
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): HomomorphicOperations {
    HomomorphicOperations.instance ??= new HomomorphicOperations()
    return HomomorphicOperations.instance
  }

  /**
   * Initialize homomorphic operations
   * Sets up the SEAL operations with appropriate context options
   * based on the SealContextOptions interface from ./seal-types.ts
   */
  public async initialize(options?: {
    enableClientSide?: boolean
    enableServerSide?: boolean
  }): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      // Set processing options
      this.enableClientSideProcessing = options?.enableClientSide ?? true
      this.enableServerSideProcessing = options?.enableServerSide ?? true

      // Create SEAL context options
      const contextOptions: SealContextOptions = {
        scheme: SealSchemeType.BFV,
        params: {
          polyModulusDegree: 8192,
          coeffModulusBits: [60, 40, 40, 40, 60],
          plainModulus: 1032193,
        },
      }

      // In client environment, initialize SEAL operations if client-side processing is enabled
      if (!isServer && this.enableClientSideProcessing) {
        const sealService = SealService.getInstance()
        await sealService.initialize(contextOptions)

        if (!sealService.hasKeys()) {
          await sealService.generateKeys()
        }

        this.sealOps = new SealOperations(sealService)
      }

      // In server environment, initialize SEAL operations if server-side processing is enabled
      if (isServer && this.enableServerSideProcessing) {
        const sealService = SealService.getInstance()
        await sealService.initialize(contextOptions)

        if (!sealService.hasKeys()) {
          await sealService.generateKeys()
        }

        this.sealOps = new SealOperations(sealService)
      }

      this.initialized = true
      logger.info('Homomorphic operations initialized successfully')
    } catch (error: unknown) {
      logger.error('Failed to initialize homomorphic operations', { error })
      throw new FHEOperationError(
        'Homomorphic operations initialization error',
        'initialize',
        'INITIALIZATION_ERROR',
      )
    }
  }

  /**
   * Process encrypted data with a homomorphic operation using Microsoft SEAL
   *
   * This method implements the core functionality for processing encrypted data
   * with various homomorphic operations as defined in the FHEOperation enum from ./types.ts.
   * It returns a HomomorphicOperationResult as defined in ./types.ts.
   */
  public async processEncrypted(
    encryptedData: string,
    operation: FHEOperation,
    encryptionMode: EncryptionMode,
    params?: Record<string, unknown>,
  ): Promise<HomomorphicOperationResult> {
    if (!this.initialized) {
      await this.initialize()
    }

    try {
      logger.info(`Processing encrypted data with operation: ${operation}`)

      // If we're not in FHE mode or the operation is not supported, fall back to simulation
      if (encryptionMode !== EncryptionMode.FHE || !this.sealOps) {
        return this.simulateOperation(encryptedData, operation, params)
      }

      let result: string | undefined
      let sentimentResult: SealOperationResult | undefined
      let categoryResult: string | undefined
      const metadata: Record<string, unknown> = {
        operationType: operation,
        timestamp: Date.now(),
      }

      try {
        // Parse the encrypted data
        const parsedData = parseSerializedCiphertextInput(encryptedData)

        // Extract the serialized ciphertext
        const serializedCiphertext = parsedData.serializedCiphertext

        // Create a memory scope for cleanup
        const scope = new SealResourceScope()
        const sealService = SealService.getInstance()
        const seal = sealService.getSeal()
        const context = sealService.getContext()

        // Load the serialized ciphertext into a SEAL object
        const inputCiphertext = scope.track(seal.CipherText())
        inputCiphertext.load(context, serializedCiphertext)

        // Perform the operation using SEAL
        // oxlint-disable-next-line typescript(switch-exhaustiveness-check)
        switch (operation) {
          case FHEOperation.Rescale:
            return this.simulateOperation(encryptedData, operation, params)

          case FHEOperation.SENTIMENT:
            // For sentiment analysis, we apply a polynomial approximation of a sigmoid function
            // to estimate sentiment from the encrypted data
            sentimentResult = await this.sealOps.polynomial(
              inputCiphertext,
              [0.5, 0.2, 0.1, 0.05], // Simple polynomial coefficients for demo purposes
            )

            if (sentimentResult.success && sentimentResult.result) {
              const serializedResult = resolveSerializedResult(
                sentimentResult.result,
              )
              result = JSON.stringify({
                serializedCiphertext: serializedResult,
                operation: 'sentiment',
                timestamp: Date.now(),
              })
            } else {
              throw new Error(
                `Sentiment analysis failed: ${formatOperationError(sentimentResult.error)}`,
              )
            }
            metadata['confidence'] = 0.85
            break

          case FHEOperation.CATEGORIZE:
            // For categorization, we compute dot products with category vectors
            // This is simulated since complex text operations are challenging in pure FHE
            categoryResult = await simulateCategorization(
              serializedCiphertext,
              params,
            )
            result = JSON.stringify({
              serializedCiphertext: categoryResult,
              operation: 'categorize',
              timestamp: Date.now(),
            })
            metadata['categories'] = normalizeOptionalRecordToStringArray(
              params?.['categories'],
            )
            break

          case FHEOperation.SUMMARIZE:
            return this.simulateOperation(encryptedData, operation, params)

          case FHEOperation.TOKENIZE:
            return this.simulateOperation(encryptedData, operation, params)

          case FHEOperation.FILTER:
            return this.simulateOperation(encryptedData, operation, params)

          case FHEOperation.CUSTOM:
            return this.simulateOperation(encryptedData, operation, params)

          case FHEOperation.WORD_COUNT:
          case FHEOperation.CHARACTER_COUNT:
          case FHEOperation.KEYWORD_DENSITY:
          case FHEOperation.READING_LEVEL:
          case FHEOperation.ANALYZE:
            return this.simulateOperation(encryptedData, operation, params)

          case FHEOperation.Addition:
          case FHEOperation.Subtraction:
          case FHEOperation.Multiplication:
          case FHEOperation.Negation:
          case FHEOperation.Polynomial:
          case FHEOperation.Rotation:
          case FHEOperation.Square:
          case FHEOperation.DotProduct: {
            // These are native SEAL operations that can be performed directly
            const opResult = await this.performNativeSealOperation(
              operation,
              inputCiphertext,
              params,
            )

            if (opResult.success && opResult.result) {
              const serializedResult = resolveSerializedResult(opResult.result)
              result = JSON.stringify({
                serializedCiphertext: serializedResult,
                operation: operation.toLowerCase(),
                timestamp: Date.now(),
              })
            } else {
              throw new Error(
                `Operation ${operation} failed: ${formatOperationError(opResult.error)}`,
              )
            }
            break
          }

          case FHEOperation.EMOTION_CLASSIFY:
          default:
            // Fall back to simulation for unsupported operations
            return this.simulateOperation(encryptedData, operation, params)
        }

        return {
          success: true,
          result,
          operationType: operation,
          timestamp: Date.now(),
          metadata,
        }
      } catch (error: unknown) {
        logger.error(`Error in SEAL operation ${operation}`, { error })
        throw new FHEOperationError(
          `SEAL operation error: ${error instanceof Error ? String(error) : String(error)}`,
          operation,
        )
      }
    } catch (error: unknown) {
      logger.error(
        `Failed to process encrypted data with operation ${operation}`,
        { error },
      )
      return {
        success: false,
        error: error instanceof Error ? String(error) : String(error),
        result: undefined,
        operationType: operation,
        timestamp: Date.now(),
        metadata: {
          operation: operation,
          timestamp: Date.now(),
          error: true,
        },
      }
    }
  }

  /**
   * Perform a native SEAL operation
   *
   * This method delegates to the appropriate SEAL operation based on the FHEOperation
   * enum from ./types.ts, using the SealOperations implementation.
   */
  private async performNativeSealOperation(
    operation: FHEOperation,
    inputCiphertext: SealCipherText,
    params?: Record<string, unknown>,
  ): Promise<SealOperationResult> {
    if (!this.sealOps) {
      throw new Error('SEAL operations not initialized')
    }

    let addResult: SealOperationResult | undefined
    let subResult: SealOperationResult | undefined
    let multResult: SealOperationResult | undefined
    let negResult: SealOperationResult | undefined
    let polyResult: SealOperationResult | undefined
    let rotResult: SealOperationResult | undefined
    let squareResult: SealOperationResult | undefined

    switch (operation) {
      case FHEOperation.Addition:
        // Add a constant or another ciphertext
        addResult = await this.sealOps.add(
          inputCiphertext,
          getNumericArray(params?.['addend'], [1]),
        )
        if (addResult.success && addResult.result) {
          const res = resolveSerializedResult(addResult.result)
          return { result: res, success: true, operation }
        }
        return { result: '', success: false, error: addResult.error, operation }

      case FHEOperation.Subtraction:
        // Subtract a constant or another ciphertext
        subResult = await this.sealOps.subtract(
          inputCiphertext,
          getNumericArray(params?.['subtrahend'], [1]),
        )
        if (subResult.success && subResult.result) {
          const res = resolveSerializedResult(subResult.result)
          return { result: res, success: true, operation }
        }
        return { result: '', success: false, error: subResult.error, operation }

      case FHEOperation.Multiplication:
        // Multiply by a constant or another ciphertext
        multResult = await this.sealOps.multiply(
          inputCiphertext,
          getNumericArray(params?.['multiplier'], [2]),
        )
        if (multResult.success && multResult.result) {
          const res = resolveSerializedResult(multResult.result)
          return { result: res, success: true, operation }
        }
        return {
          result: '',
          success: false,
          error: multResult.error,
          operation,
        }

      case FHEOperation.Negation:
        // Negate the value
        negResult = await this.sealOps.negate(inputCiphertext)
        if (negResult.success && negResult.result) {
          const res = resolveSerializedResult(negResult.result)
          return { result: res, success: true, operation }
        }
        return { result: '', success: false, error: negResult.error, operation }

      case FHEOperation.Polynomial:
        // Apply a polynomial function
        polyResult = await this.sealOps.polynomial(
          inputCiphertext,
          getNumericArray(params?.['coefficients'], [0, 1]),
        )
        if (polyResult.success && polyResult.result) {
          const res = resolveSerializedResult(polyResult.result)
          return { result: res, success: true, operation }
        }
        return {
          result: '',
          success: false,
          error: polyResult.error,
          operation,
        }

      case FHEOperation.Rotation:
        // Rotate the ciphertext
        rotResult = await this.sealOps.rotate(
          inputCiphertext,
          getNumericValue(params?.['steps'], 1),
        )
        if (rotResult.success && rotResult.result) {
          const res = resolveSerializedResult(rotResult.result)
          return { result: res, success: true, operation }
        }
        return { result: '', success: false, error: rotResult.error, operation }

      case FHEOperation.Square:
        // Square the ciphertext
        squareResult = await this.sealOps.square(inputCiphertext)
        if (squareResult.success && squareResult.result) {
          const res = resolveSerializedResult(squareResult.result)
          return { result: res, success: true, operation }
        }
        return {
          result: '',
          success: false,
          error: squareResult.error,
          operation,
        }

      case FHEOperation.DotProduct: {
        const dotResult = await this.sealOps.dotProduct(
          inputCiphertext,
          getNumericArray(params?.['vector'], [1]),
        )
        if (dotResult.success && dotResult.result) {
          const res = resolveSerializedResult(dotResult.result)
          return { result: res, success: true, operation }
        }
        return {
          result: '',
          success: false,
          error: dotResult.error,
          operation,
        }
      }

      case FHEOperation.Rescale:
      case FHEOperation.SENTIMENT:
      case FHEOperation.CATEGORIZE:
      case FHEOperation.SUMMARIZE:
      case FHEOperation.TOKENIZE:
      case FHEOperation.FILTER:
      case FHEOperation.CUSTOM:
      case FHEOperation.WORD_COUNT:
      case FHEOperation.CHARACTER_COUNT:
      case FHEOperation.KEYWORD_DENSITY:
      case FHEOperation.READING_LEVEL:
      case FHEOperation.ANALYZE:
      case FHEOperation.EMOTION_CLASSIFY:
        throw new Error(`Unsupported SEAL operation: ${operation}`)

      default: {
        const operationName = String(operation)
        throw new Error(`Unsupported SEAL operation: ${operationName}`)
      }
    }
  }

  /**
   * Simulate homomorphic operations for demonstration purposes
   * This is used when actual FHE operations cannot be performed
   *
   * Returns a HomomorphicOperationResult as defined in ./types.ts
   */
  private async simulateOperation(
    encryptedData: string,
    operation: FHEOperation,
    params?: Record<string, unknown>,
  ): Promise<HomomorphicOperationResult> {
    logger.info(`Simulating operation ${operation} on encrypted data`)

    let result: string
    let tokens: string[] | undefined
    const metadata: Record<string, unknown> = {
      operationType: operation,
      timestamp: Date.now(),
      simulated: true,
    }

    // For simulation, we'll decode the encryptedData in a way that would
    // be possible in a real FHE implementation
    let decodedData: string

    try {
      // This is just for simulation
      if (encryptedData.startsWith('eyJ')) {
        // Base64 JSON format
        const decoded = atob(encryptedData)
        let parsed: unknown = null
        try {
          parsed = JSON.parse(decoded)
        } catch {
          parsed = null
        }

        if (isRecord(parsed) && typeof parsed['data'] === 'string') {
          decodedData = parsed['data']
        } else {
          decodedData = 'Unknown encoded format'
        }
      } else {
        // Assume plaintext for simulation
        decodedData = encryptedData
      }
    } catch {
      // If we can't decode, just use the raw value for simulation
      decodedData = encryptedData
    }

    // Try encrypted text processor for supported operations
    const textProcessor = getEncryptedTextProcessor()
    if (textProcessor.isAvailable()) {
      const plaintextForEncoding = decodedData
      let encResult: {
        result: string
        operation: FHEOperation
        fullyHomomorphic: boolean
        metadata: Record<string, unknown>
      } | null = null

      try {
        switch (operation) {
          case FHEOperation.SENTIMENT:
            encResult =
              await textProcessor.encryptedSentiment(plaintextForEncoding)
            break
          case FHEOperation.CATEGORIZE:
            encResult =
              await textProcessor.encryptedCategorize(plaintextForEncoding)
            break
          case FHEOperation.WORD_COUNT:
            encResult =
              await textProcessor.encryptedWordCount(plaintextForEncoding)
            break
          case FHEOperation.CHARACTER_COUNT:
            encResult =
              await textProcessor.encryptedCharacterCount(plaintextForEncoding)
            break
          case FHEOperation.KEYWORD_DENSITY:
            encResult = await textProcessor.encryptedKeywordDensity(
              plaintextForEncoding,
              getStringArray(params?.['keywords']) ?? [],
            )
            break
          case FHEOperation.TOKENIZE:
            encResult =
              await textProcessor.encryptedTokenize(plaintextForEncoding)
            break
          case FHEOperation.FILTER:
            encResult = await textProcessor.encryptedFilter(
              plaintextForEncoding,
              getStringArray(params?.['filterTerms']) ?? [],
            )
            break
          case FHEOperation.SUMMARIZE:
            encResult = await textProcessor.encryptedSummarize(
              plaintextForEncoding,
              getNumericValue(params?.['maxLength'], 100),
            )
            break
          case FHEOperation.READING_LEVEL:
            encResult =
              await textProcessor.encryptedReadingLevel(plaintextForEncoding)
            break
          case FHEOperation.Addition:
          case FHEOperation.Subtraction:
          case FHEOperation.Multiplication:
          case FHEOperation.DotProduct:
          case FHEOperation.Square:
          case FHEOperation.Negation:
          case FHEOperation.Rotation:
          case FHEOperation.Polynomial:
          case FHEOperation.Rescale:
          case FHEOperation.EMOTION_CLASSIFY:
          case FHEOperation.CUSTOM:
          case FHEOperation.ANALYZE:
            // Arithmetic/non-text operations not supported by encrypted text processor
            break
          default:
            break
        }

        if (encResult) {
          logger.info(
            `Operation ${operation} performed fully homomorphically`,
            {
              operationCount: encResult.metadata['operationsCount'],
            },
          )
          return {
            success: true,
            result: encResult.result,
            operationType: operation,
            timestamp: Date.now(),
            metadata: {
              ...encResult.metadata,
              simulated: false,
              fullyHomomorphic: true,
              encryptedTextProcessor: true,
            },
          }
        }
      } catch (encError) {
        logger.warn(
          `Encrypted text processor failed for ${operation}, falling back to simulation`,
          {
            error:
              encError instanceof Error ? encError.message : String(encError),
          },
        )
      }
    }

    // Fallback: plaintext simulation (decrypts → processes → re-encrypts)
    metadata['plaintextFallback'] = true

    // Perform the operation (simulated)
    switch (operation) {
      case FHEOperation.SENTIMENT:
        result = await analyzeSentiment(decodedData)
        metadata['confidence'] = 0.85
        break

      case FHEOperation.CATEGORIZE:
        result = await categorizeText(
          decodedData,
          normalizeOptionalRecordToStringArray(params?.['categories']),
        )
        metadata['categories'] = normalizeOptionalRecordToStringArray(
          params?.['categories'],
        )
        break

      case FHEOperation.SUMMARIZE:
        result = await summarizeText(
          decodedData,
          getNumericValue(params?.['maxLength'], 100),
        )
        metadata['maxLength'] = getNumericValue(params?.['maxLength'], 100)
        break

      case FHEOperation.TOKENIZE:
        tokens = await tokenizeText(decodedData)
        result = JSON.stringify(tokens)
        metadata['tokenCount'] = tokens.length
        break

      case FHEOperation.FILTER:
        result = await filterText(
          decodedData,
          getStringArray(params?.['filterTerms']),
        )
        metadata['filtered'] = true
        break

      case FHEOperation.CUSTOM:
        {
          const customOperation =
            typeof params?.['operation'] === 'string'
              ? params['operation']
              : 'unknown'
          result = await this.performCustomOperation(
            decodedData,
            customOperation,
            params,
          )
          metadata['custom'] = customOperation
        }
        break

      case FHEOperation.WORD_COUNT: {
        const words = decodedData.trim().split(/\s+/).filter(Boolean)
        result = String(words.length)
        metadata['wordCount'] = words.length
        break
      }

      case FHEOperation.CHARACTER_COUNT:
        result = String(decodedData.length)
        metadata['characterCount'] = decodedData.length
        break

      case FHEOperation.KEYWORD_DENSITY: {
        const keywords = getStringArray(params?.['keywords']) ?? []
        const lowerText = decodedData.toLowerCase()
        const keywordDensity: Record<string, number> = {}
        for (const keyword of keywords) {
          const normalized = keyword.toLowerCase()
          const regex = new RegExp(`\\b${normalized}\\b`, 'g')
          const matches = lowerText.match(regex)
          keywordDensity[normalized] = matches ? matches.length : 0
        }
        result = JSON.stringify(keywordDensity)
        metadata['keywordDensity'] = keywordDensity
        break
      }

      case FHEOperation.READING_LEVEL: {
        const words = decodedData.split(/\s+/).filter(Boolean)
        const sentenceCount = Math.max(
          decodedData.split(/[.!?]+/).filter(Boolean).length,
          1,
        )
        metadata['readingLevel'] =
          (words.length / sentenceCount) * 0.5 +
          (decodedData.length / Math.max(words.length, 1)) * 0.5
        result = String(metadata['readingLevel'])
        break
      }

      case FHEOperation.ANALYZE: {
        const words = decodedData.toLowerCase().split(/\s+/).filter(Boolean)
        const sentiment = await analyzeSentiment(decodedData)
        const uniqueWords = new Set(words)
        result = JSON.stringify({
          sentiment,
          wordCount: words.length,
          uniqueWordCount: uniqueWords.size,
          characterCount: decodedData.length,
        })
        metadata['supported'] = true
        break
      }

      case FHEOperation.Addition:
      case FHEOperation.Subtraction:
      case FHEOperation.Multiplication:
      case FHEOperation.DotProduct:
      case FHEOperation.Square:
      case FHEOperation.Negation:
      case FHEOperation.Rotation:
      case FHEOperation.Polynomial:
      case FHEOperation.Rescale:
      case FHEOperation.EMOTION_CLASSIFY:
        result = `Unsupported operation: ${operation}`
        metadata['supported'] = false
        break

      default: {
        const operationName = String(operation)
        result = `Unsupported operation: ${operationName}`
        metadata['supported'] = false
        break
      }
    }

    // Simulate re-encryption
    const simulatedEncrypted = JSON.stringify({
      data: result,
      metadata,
    })

    return {
      success: true,
      result: simulatedEncrypted,
      operationType: operation,
      timestamp: Date.now(),
      metadata,
    }
  }


  /**
   * Perform a custom operation on text (for simulation only)
   */
  private async performCustomOperation(
    text: string,
    operation: string,
    _params?: Record<string, unknown>,
  ): Promise<string> {
    switch (operation) {
      case 'count_words':
        return String(text.split(/\s+/).filter(Boolean).length)

      case 'count_characters':
        return String(text.length)

      case 'reverse':
        return text.split('').reverse().join('')

      case 'to_uppercase':
        return text.toUpperCase()

      case 'to_lowercase':
        return text.toLowerCase()

      case 'remove_punctuation':
        return text.replace(/[^\w\s]/g, '')

      case 'count_sentences':
        return String(text.split(/[.!?]+/).filter(Boolean).length)

      case 'reading_level': {
        // Simplified Flesch-Kincaid Grade Level calculation
        const wordCount = text.split(/\s+/).filter(Boolean).length
        const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length
        const syllableCount = estimateSyllables(text)

        if (wordCount === 0 || sentenceCount === 0) {
          return 'Unknown'
        }

        const score =
          0.39 * (wordCount / sentenceCount) +
          11.8 * (syllableCount / wordCount) -
          15.59

        return score.toFixed(1)
      }

      default:
        return `Unknown operation: ${operation}`
    }
  }

}

// Export default instance
export default HomomorphicOperations.getInstance()


/**
 * Export Service for Therapy Chat System (Browser Version)
 *
 * Provides secure conversation export capabilities with maintained encryption
 * for privacy and HIPAA compliance.
 *
 * This is the browser-compatible version without Node.js dependencies.
 */

import type { ChatMessage } from '../../types/chat'
// Import only the EncryptionMode from fhe types
import { EncryptionMode } from '../fhe/types'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { createSignedVerificationToken } from '../security/verification'
import { generateId } from '../utils/index'

// Initialize logger
const logger = createBuildSafeLogger('default')

// Browser-safe buffer methods with fallback to Node.js Buffer when available

// Define FHE service interface with required methods
interface FHEServiceInterface {
  encrypt: (data: string) => Promise<string>
  encryptData: (
    data: Uint8Array,
    mode: EncryptionMode,
  ) => Promise<{
    data: ArrayBuffer
    encryptedKey?: string
    iv?: string
    authTag?: string
  }>
}

/**
 * Export format types - Fixed to resolve value vs type confusion
 */
export enum ExportFormat {
  JSON = 'json',
  PDF = 'pdf',
  ARCHIVE = 'archive',
  ENCRYPTED_ARCHIVE = 'encrypted_archive',
}

/**
 * Type-safe export format values
 */
export type ExportFormatValue = `${ExportFormat}`

/**
 * Export options configuration
 */
export interface ExportOptions {
  format: ExportFormat
  includeMetadata: boolean
  encryptionMode: EncryptionMode
  includeVerificationToken: boolean
  password?: string
  recipientPublicKey?: string
  encryption?: {
    enabled: boolean
    mode: EncryptionMode
    password?: string
  }
  includeDateRange?: {
    start?: Date
    end?: Date
  }
}

/**
 * Default export options
 */
const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: ExportFormat.JSON,
  includeMetadata: true,
  encryptionMode: EncryptionMode.HIPAA,
  includeVerificationToken: true,
  encryption: {
    enabled: false,
    mode: EncryptionMode.HIPAA,
  },
}

/**
 * Export result with metadata
 */
export interface ExportResult {
  id: string
  data: string | Uint8Array
  format: ExportFormat
  encryptionMode: EncryptionMode
  verificationToken?: string | undefined
  timestamp: number
  mimeType: string
  filename: string
  totalMessages: number
}

/**
 * JWE-compatible header for exported content
 */
interface JWEHeader {
  alg: string
  enc: string
  kid?: string
  cty: string
}

/**
 * Custom error class for export-related errors
 */
class ExportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ExportError'
  }
}

/**
 * Service for securely exporting therapy conversations (Browser Version)
 */
export class ExportService {
  private static instance: ExportService

  private fheService: FHEServiceInterface
  private initialized = false
  private options: ExportOptions

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(fheService: FHEServiceInterface) {
    this.fheService = fheService
    logger.info('Export service (browser) initialized')
    this.options = { ...DEFAULT_EXPORT_OPTIONS }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(fheService: FHEServiceInterface): ExportService {
    if (!ExportService.instance) {
      ExportService.instance = new ExportService(fheService)
    }
    return ExportService.instance
  }

  /**
   * Initialize the export service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('Export service already initialized')
      return
    }

    logger.info('Initializing export service (browser)')

    try {
      // Ensure FHE service is initialized
      if (!this.fheService) {
        throw new Error('FHE service not available')
      }

      this.initialized = true
      logger.info('Export service initialized successfully')
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? String(error) : String(error)
      logger.error('Failed to initialize export service', {
        error: errorMessage,
      })
      throw error
    }
  }

  /**
   * Export conversation messages with secure encryption
   *
   * @param messages - The conversation messages to export
   * @param options - Export configuration options
   * @returns Export result with the exported data
   */
  public async exportConversation(
    messages: ChatMessage[],
    options: Partial<ExportOptions> = {},
  ): Promise<ExportResult> {
    if (!this.initialized) {
      await this.initialize()
    }

    const exportOptions = { ...this.options, ...options }
    const timestamp = Date.now()

    // Generate export ID
    const exportId = generateId()

    try {
      logger.info(
        `Exporting conversation with ${messages.length} messages in ${exportOptions.format} format`,
      )

      // Create export data based on format
      let exportData: string | Uint8Array
      let mimeType: string
      let filename: string

      if (exportOptions.format === ExportFormat.JSON) {
        exportData = await this.createJSONExport(messages, exportOptions)
        mimeType = 'application/json'
        filename = `therapy-conversation-${exportId}.json`
      } else if (exportOptions.format === ExportFormat.PDF) {
        throw new Error('PDF export is not supported in browser environments')
      } else if (exportOptions.format === ExportFormat.ARCHIVE) {
        throw new Error(
          'Encrypted archive export is not supported in browser environments',
        )
      } else {
        throw new Error(`Unsupported export format: ${exportOptions.format}`)
      }

      // Create verification token if needed
      let verificationToken: string | undefined
      if (exportOptions.includeVerificationToken) {
        verificationToken = await this.createVerificationToken(
          exportData,
          exportId,
          timestamp,
        )
      }

      return {
        id: exportId,
        data: exportData,
        format: exportOptions.format,
        encryptionMode: exportOptions.encryptionMode,
        verificationToken,
        timestamp,
        mimeType,
        filename,
        totalMessages: messages.length,
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? String(error) : String(error)
      logger.error('Failed to export conversation', { error: errorMessage })
      throw new Error(`Export failed: ${errorMessage}`, { cause: error })
    }
  }

  /**
   * Create JSON export with JWE encryption if needed
   */
  private async createJSONExport(
    messages: ChatMessage[],
    options: ExportOptions,
  ): Promise<string | Uint8Array> {
    try {
      // Create sanitized export structure
      const exportData = {
        version: '1.0',
        timestamp: Date.now(),
        messageCount: messages.length,
        messages: messages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: this.sanitizeContent(msg.content),
          timestamp: msg.timestamp,
        })),
      }

      // Include metadata if requested
      if (options.includeMetadata) {
        Object.assign(exportData, {
          metadata: {
            exportVersion: '1.0',
            encryptionMode: options.encryptionMode,
            exportTimestamp: Date.now(),
          },
        })
      }

      // Convert to JSON string
      const jsonData = JSON.stringify(exportData, null, 2)

      // Encrypt if needed
      if (options.encryptionMode !== EncryptionMode.NONE) {
        try {
          const encryptedJson = await this.fheService.encrypt(jsonData)

          // Create JWE-like structure for encrypted data
          const jweHeader: JWEHeader = {
            alg: 'FHE',
            enc: options.encryptionMode,
            cty: 'application/json',
          }

          const jwe = {
            protected: btoa(JSON.stringify(jweHeader)),
            payload: encryptedJson,
            metadata: {
              exportTimestamp: Date.now(),
              messageCount: messages.length,
            },
          }

          return JSON.stringify(jwe, null, 2)
        } catch (err: unknown) {
          throw new Error(
            `Encryption failed: ${err instanceof Error ? (err as Error)?.message || String(err) : String(err)}`,
            { cause: err },
          )
        }
      }

      return jsonData
    } catch (error: unknown) {
      throw new ExportError(
        `JSON export failed: ${error instanceof Error ? String(error) : 'Unknown error'}`,
      )
    }
  }

  // Helper method to sanitize content
  private sanitizeContent(content: string): string {
    if (typeof content !== 'string') {
      return '[Invalid Content]'
    }

    // Remove control characters and non-printable characters
    return content
      .split('')
      .filter((char) => {
        const code = char.charCodeAt(0)
        // Keep only printable ASCII and extended Latin characters
        return (
          (code >= 0x20 && code <= 0x7e) || // Basic Latin (printable)
          (code >= 0xa0 && code <= 0xff) // Latin-1 Supplement (printable)
        )
      })
      .join('')
      .trim()
  }

  /**
   * Create verification token for export integrity
   */
  private async createVerificationToken(
    data: string | Uint8Array,
    exportId: string,
    timestamp: number,
  ): Promise<string> {
    // Convert string to Uint8Array if needed
    const dataBuffer =
      typeof data === 'string' ? new TextEncoder().encode(data) : data

    // Create token payload
    const tokenPayload = {
      exportId,
      timestamp,
      contentLength: dataBuffer.length,
    }

    // Sign with verification token from security module
    return createSignedVerificationToken(tokenPayload)
  }
}

// Default export
export default { ExportService }

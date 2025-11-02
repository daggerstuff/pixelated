/**
 * Export Service for Therapy Chat System (Node.js Version)
 *
 * Provides secure conversation export capabilities with maintained encryption
 * for privacy and HIPAA compliance.
 *
 * This is the Node.js-specific implementation with full functionality.
 */

import type { ChatMessage } from '../../types/chat'
// Import only the EncryptionMode from fhe types
import { EncryptionMode } from '../fhe/types'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { createSignedVerificationToken } from '../security/verification'
import { generateId } from '../utils/index'
import PDFDocument from 'pdfkit'
import archiver from 'archiver'
import { Buffer } from 'buffer'

// Initialize logger
const logger = createBuildSafeLogger('default')

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
 * Export format types
 */
export enum ExportFormat {
  JSON_FORMAT = 'json',
  PDF = 'pdf',
  ENCRYPTED_ARCHIVE = 'encrypted_archive',
}

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
}

/**
 * Default export options
 */
const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  format: ExportFormat.JSON_FORMAT,
  includeMetadata: true,
  encryptionMode: EncryptionMode.HIPAA,
  includeVerificationToken: true,
}

/**
 * Export result with metadata
 */
export interface ExportResult {
  id: string
  data: string | Uint8Array
  format: ExportFormat
  encryptionMode: EncryptionMode
  verificationToken: string | undefined // Modified definition
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
 * Service for securely exporting therapy conversations
 */
export class ExportService {
  private static instance: ExportService

  private fheService: FHEServiceInterface
  private initialized = false

  /**
   * Private constructor to enforce singleton pattern
   */
  private constructor(fheService: FHEServiceInterface) {
    this.fheService = fheService
    logger.info('Export service initialized')
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

    logger.info('Initializing export service')

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

    const exportOptions = { ...DEFAULT_EXPORT_OPTIONS, ...options }
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

      switch (exportOptions.format) {
        case ExportFormat.PDF: {
          const result = await this.createPDFExport(messages, exportOptions)
          exportData = result.data
          mimeType = 'application/pdf'
          filename = `therapy-conversation-${exportId}.pdf`
          break
        }

        case ExportFormat.ENCRYPTED_ARCHIVE: {
          const archive = await this.createEncryptedArchive(
            messages,
            exportOptions,
          )
          exportData = archive.data
          mimeType = 'application/octet-stream'
          filename = `therapy-conversation-${exportId}.secz`
          break
        }

        case ExportFormat.JSON_FORMAT:
        default: {
          const json = await this.createJSONExport(messages, exportOptions)
          exportData = json.data
          mimeType = 'application/json'
          filename = `therapy-conversation-${exportId}.json`
        }
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
  ): Promise<{ data: string }> {
    // Prepare export content
    const exportContent = {
      id: generateId(),
      timestamp: Date.now(),
      messages: messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || Date.now(),
      })),
      metadata: options.includeMetadata
        ? {
            exportVersion: '1.0',
            encryptionMode: options.encryptionMode,
            totalMessages: messages.length,
          }
        : undefined,
    }

    // Convert to JSON
    const jsonData = JSON.stringify(exportContent, null, 2)

    // Encrypt if needed
    if (options.encryptionMode !== EncryptionMode.NONE) {
      // Create JWE format with headers
      const jweHeader: JWEHeader = {
        alg: 'ECDH-ES+A256KW',
        enc: 'A256GCM',
        cty: 'application/json',
      }

      // Use FHE service to encrypt
      const encryptedData = await this.fheService.encryptData(
        new TextEncoder().encode(jsonData),
        options.encryptionMode,
      )

      // Format as JWE
      const jwe = {
        protected: btoa(JSON.stringify(jweHeader)),
        encrypted_key: encryptedData.encryptedKey,
        iv: encryptedData.iv,
        ciphertext: encryptedData.data,
        tag: encryptedData.authTag,
      }

      return { data: JSON.stringify(jwe) }
    }

    return { data: jsonData }
  }

  /**
   * Create PDF export with embedded encryption
   */
  private async createPDFExport(
    messages: ChatMessage[],
    options: ExportOptions,
  ): Promise<{ data: Uint8Array }> {
    try {
      // Validate input
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error(
          'Invalid or empty messages array provided for PDF export',
        )
      }

      // Validate message format
      messages.forEach((msg, index) => {
        if (!msg.role || !msg.content) {
          throw new Error(
            `Invalid message format at index ${index}: missing role or content`,
          )
        }
      })

      // Create a new PDF document with encryption if password provided
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: 'Therapy Conversation Export',
          Author: 'Pixelated Empathy System',
          Subject: 'Therapy Session Transcript',
          Keywords: 'therapy, conversation, export',
          CreationDate: new Date(),
        },
        // Enable PDF encryption if password provided
        userPassword: options.password,
        ownerPassword: options.password,
        permissions: {
          printing: 'highResolution',
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: false,
          contentAccessibility: true,
          documentAssembly: false,
        },
      })

      // Set up error handling for PDF generation
      doc.on('error', (err: Error) => {
        throw new Error(
          `PDF generation error: ${(err as Error)?.message || String(err)}`,
        )
      })

      // Create a buffer to store the PDF with timeout
      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))

      // Add watermark to each page with error handling
      doc.on('pageAdded', () => {
        try {
          const watermarkText = 'CONFIDENTIAL'
          doc.save()
          doc.rotate(45, { origin: [doc.page.width / 2, doc.page.height / 2] })
          doc
            .fontSize(60)
            .fillColor('grey', 0.3)
            .text(watermarkText, 0, 0, {
              align: 'center',
              width: Math.sqrt(
                Math.pow(doc.page.width, 2) + Math.pow(doc.page.height, 2),
              ),
            })
          doc.restore()
        } catch (err: unknown) {
          const error = err as Error
          console.error('Error adding watermark:', String(error))
          // Continue without watermark rather than failing the export
        }
      })

      // Header
      doc
        .font('Helvetica-Bold')
        .fontSize(24)
        .text('Therapy Conversation Export', { align: 'center' })
        .moveDown()

      // Add security notice
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor('red')
        .text(
          'CONFIDENTIAL: This document contains sensitive information. Unauthorized access, copying, or distribution is prohibited.',
          { align: 'center' },
        )
        .moveDown()
        .fillColor('black')

      // Metadata section
      doc
        .font('Helvetica')
        .fontSize(12)
        .text(`Generated: ${new Date().toLocaleString()}`)
        .text(`Total Messages: ${messages.length}`)
        .text(`Export ID: ${generateId()}`)
        .text(`Security Level: ${options.encryptionMode}`)
        .moveDown()

      // Messages section with content sanitization
      doc
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('Conversation Transcript', { underline: true })
        .moveDown()

      // Add each message with sanitization and error handling
      for (const [index, msg] of messages.entries()) {
        try {
          // Sanitize content
          const sanitizedContent = this.sanitizeContent(msg.content)
          const sanitizedRole = this.sanitizeContent(msg.role)
          const timestamp = msg.timestamp
            ? new Date(msg.timestamp).toLocaleString()
            : new Date().toLocaleString()

          // Role header
          doc
            .font('Helvetica-Bold')
            .fontSize(12)
            .text(sanitizedRole.toUpperCase(), {
              continued: true,
            })
            .font('Helvetica')
            .text(` - ${timestamp}`)

          // Message content with overflow handling
          const contentLines = this.wrapText(
            sanitizedContent,
            doc.page.width - 100,
            11,
          )

          doc
            .font('Helvetica')
            .fontSize(11)
            .text(contentLines.join('\n'), {
              align: 'left',
              width: doc.page.width - 100,
              lineGap: 2,
            })
            .moveDown()

          // Add separator line
          if (index < messages.length - 1) {
            doc
              .moveTo(50, doc.y)
              .lineTo(doc.page.width - 50, doc.y)
              .stroke()
              .moveDown()
          }
        } catch (err: unknown) {
          console.error(`Error processing message ${index}:`, err)
          // Add error notice in the document
          doc
            .font('Helvetica')
            .fontSize(10)
            .fillColor('red')
            .text(`[Error processing message ${index}]`)
            .fillColor('black')
            .moveDown()
        }
      }

      // Footer with page numbers and timestamp
      const totalPages = doc.bufferedPageRange().count
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i)
        doc
          .font('Helvetica')
          .fontSize(10)
          .text(
            `Page ${i + 1} of ${totalPages} | Generated: ${new Date().toLocaleString()} | CONFIDENTIAL`,
            50,
            doc.page.height - 50,
            { align: 'center' },
          )
      }

      // Finalize the PDF with timeout
      doc.end()

      // Wait for the PDF to be fully generated with timeout
      const pdfBuffer = await Promise.race([
        new Promise<Buffer>((resolve) => {
          doc.on('end', () => {
            resolve(Buffer.concat(chunks))
          })
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('PDF generation timeout')),
            30000, // 30 second timeout
          ),
        ),
      ])

      // Encrypt if needed with error handling
      if (options.encryptionMode !== EncryptionMode.NONE) {
        try {
          const encryptedData = await this.fheService.encryptData(
            new Uint8Array(pdfBuffer),
            options.encryptionMode,
          )
          return { data: new Uint8Array(encryptedData.data) }
        } catch (err: unknown) {
          const error = err as Error
          throw new Error(`Encryption failed: ${String(error)}`, { cause: err })
        }
      }

      return { data: new Uint8Array(pdfBuffer) }
    } catch (error: unknown) {
      throw new ExportError(
        `PDF export failed: ${error instanceof Error ? String(error) : 'Unknown error'}`,
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

  // Helper method to wrap text
  private wrapText(text: string, width: number, fontSize: number): string[] {
    // Simple word wrap implementation
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    // Approximate characters per line based on font size and width
    const charsPerLine = Math.floor(width / (fontSize * 0.6))

    for (const word of words) {
      if (currentLine.length + word.length + 1 <= charsPerLine) {
        currentLine += (currentLine ? ' ' : '') + word
      } else {
        if (currentLine) {
          lines.push(currentLine)
        }
        currentLine = word
      }
    }
    if (currentLine) {
      lines.push(currentLine)
    }

    return lines
  }

  /**
   * Create encrypted archive for maximum security
   */
  private async createEncryptedArchive(
    messages: ChatMessage[],
    options: ExportOptions,
  ): Promise<{ data: Uint8Array }> {
    // Create JSON representation first
    const jsonResult = await this.createJSONExport(messages, options)

    // Create a buffer to store the archive
    const chunks: Buffer[] = []

    // Create archive
    const archive = archiver('zip', {
      zlib: { level: 9 }, // Maximum compression
    })

    // Collect archive data
    archive.on('data', (chunk: Buffer) => chunks.push(chunk))

    // Create manifest
    const manifest = {
      format: 'SECZ-1.0',
      encryption: options.encryptionMode,
      timestamp: Date.now(),
      contentType: 'application/json',
      files: ['conversation.json'],
      metadata: {
        totalMessages: messages.length,
        exportVersion: '1.0',
        encryptionMode: options.encryptionMode,
      },
    }

    // Add manifest to archive
    archive.append(JSON.stringify(manifest, null, 2), {
      name: 'manifest.json',
    })

    // Add conversation data
    archive.append(jsonResult.data, { name: 'conversation.json' })

    // Finalize archive
    archive.finalize()

    // Wait for archive to be fully generated
    const archiveBuffer = await new Promise<Buffer>((resolve, reject) => {
      archive.on('end', () => resolve(Buffer.concat(chunks)))
      archive.on('error', reject)
    })

    // Encrypt the archive if needed
    if (options.encryptionMode !== EncryptionMode.NONE) {
      const encryptedData = await this.fheService.encryptData(
        new Uint8Array(archiveBuffer),
        options.encryptionMode,
      )
      return { data: new Uint8Array(encryptedData.data) }
    }

    return { data: new Uint8Array(archiveBuffer) }
  }

  /**
   * Create verification token for export integrity
   */
  private async createVerificationToken(
    data: string | Uint8Array,
    exportId: string,
    timestamp: number,
  ): Promise<string> {
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

import type { APIRoute } from 'astro'
import type { ChatMessage } from '../../../types/chat'
import { getSession } from '../../../lib/auth/session'
import { ExportFormat, ExportService } from '../../../lib/export'
import { fheService } from '../../../lib/fhe'
import { EncryptionMode } from '../../../lib/fhe/types'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'

// Initialize logger
const logger = createBuildSafeLogger('default')

/**
 * GET handler - returns information about the export conversation endpoint
 */
export const GET: APIRoute = async ({ request }) => {
  try {
    // Verify authentication
    const session = await getSession(request)
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Return endpoint information
    return new Response(
      JSON.stringify({
        name: 'Conversation Export API',
        description: 'Endpoint for exporting therapy conversations',
        methods: ['POST'],
        version: '1.0.0',
        status: 'active',
        authentication: 'required',
        supportedFormats: ['json', 'pdf', 'encrypted_archive'],
        encryptionModes: ['none', 'standard', 'hipaa', 'fhe'],
        features: [
          'HIPAA-compliant encryption',
          'Access control validation',
          'Audit trail logging',
          'Metadata inclusion',
          'Verification tokens',
        ],
        requiredParameters: ['sessionId'],
        optionalParameters: ['format', 'encryptionMode'],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    logger.error('Export API info error:', error)
    return new Response(
      JSON.stringify({
        error: 'Failed to get endpoint information',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}

/**
 * API endpoint for exporting therapy conversations
 * POST /api/export/conversation
 */
export const POST: APIRoute = async ({ request }) => {
  try {
    // Verify authentication
    const session = await getSession(request)
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Get export options from request
    const payload = await request.json()
    const { sessionId, format = 'json', encryptionMode = 'hipaa' } = payload

    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Session ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check if user has access to the session
    const hasAccess = await checkSessionAccess(session.user.id, sessionId)
    if (!hasAccess) {
      return new Response(
        JSON.stringify({ error: 'Access denied to this session' }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        },
      )
    }

    // Get messages for the session
    const messages = await getSessionMessages(sessionId)
    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: 'No messages found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Initialize export service
    const exportService = ExportService.getInstance(fheService)
    await exportService.initialize()

    // Map format and encryption mode
    const exportFormat = mapExportFormat(format)
    const exportEncryptionMode = mapEncryptionMode(encryptionMode)

    // Create export
    const exportResult = await exportService.exportConversation(messages, {
      format: exportFormat,
      encryptionMode: exportEncryptionMode,
      includeMetadata: true,
      includeVerificationToken: true,
    })

    // Log the export for auditing
    await recordExportAction(
      session.user.id,
      sessionId,
      exportResult.id,
      exportFormat,
    )

    // Return export information
    return new Response(
      JSON.stringify({
        id: exportResult.id,
        filename: exportResult.filename,
        format: exportResult.format,
        timestamp: exportResult.timestamp,
        totalMessages: exportResult.totalMessages,
        downloadUrl: `/api/export/download/${exportResult.id}`,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    logger.error('Export API error:', error)
    return new Response(JSON.stringify({ error: 'Export failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

/**
 * Check if user has access to the specified session
 */
async function checkSessionAccess(
  userId: string,
  sessionId: string,
): Promise<boolean> {
  // In a real implementation, this would check the database for access permissions
  // For this example, we'll assume the check passes
  console.log(`Checking access for user ${userId} to session ${sessionId}`)
  return true
}

/**
 * Get all messages for a therapy session
 */
async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  // In a real implementation, this would fetch messages from the database
  // For this example, we'll return sample messages
  console.log(`Fetching messages for session ${sessionId}`)
  return [
    {
      id: '1',
      role: 'system',
      content: 'This is a secure therapy session. All messages are encrypted.',
      timestamp: Date.now() - 3600000,
    },
    {
      id: '2',
      role: 'user',
      content: "I've been feeling anxious lately.",
      timestamp: Date.now() - 3500000,
    },
    {
      id: '3',
      role: 'assistant',
      content:
        'I understand. Can you tell me more about what triggers your anxiety?',
      timestamp: Date.now() - 3400000,
    },
    {
      id: '4',
      role: 'user',
      content:
        'It seems to happen most often when I have deadlines approaching.',
      timestamp: Date.now() - 3300000,
    },
  ]
}

/**
 * Record export action for audit trail
 */
async function recordExportAction(
  userId: string,
  sessionId: string,
  exportId: string,
  format: ExportFormat,
): Promise<void> {
  // In a real implementation, this would record the export action in the audit log
  logger.info(
    `User ${userId} exported session ${sessionId} in ${format} format with ID ${exportId}`,
  )
}

/**
 * Map string format to ExportFormat enum
 */
function mapExportFormat(format: string): ExportFormat {
  switch (format.toLowerCase()) {
    case 'pdf':
      return ExportFormat.PDF
    case 'encrypted_archive':
    case 'archive':
      return ExportFormat.ENCRYPTED_ARCHIVE
    case 'json':
    default:
      return ExportFormat.JSON
  }
}

/**
 * Map string encryption mode to EncryptionMode enum
 */
function mapEncryptionMode(mode: string): EncryptionMode {
  switch (mode.toLowerCase()) {
    case 'none':
      return EncryptionMode.NONE
    case 'standard':
      return EncryptionMode.STANDARD
    case 'fhe':
    case 'maximum':
      return EncryptionMode.FHE
    case 'hipaa':
    default:
      return EncryptionMode.HIPAA
  }
}

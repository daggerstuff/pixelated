/**
 * Portal Messaging Service — F1.11 Client Portal Feature #2
 *
 * Secure messaging thread CRUD using FHIR Communication resources.
 * Patients can start threads with their care team, send messages, and view replies.
 *
 * Storage: FHIR Communication stored as DocumentReference with category "communication"
 * in the existing ehr_document_reference table via a lightweight repository wrapper.
 */

import type { RLSContext } from '@/lib/ehr-native/repositories/base-repository'
import { BaseRepository } from '@/lib/ehr-native/repositories/base-repository'
import { documentReferenceSchema, type DocumentReference } from '@/lib/ehr-native/types'

// ── Validation helpers (local, matching pattern in scheduling-service.ts) ──

function validateId(id: string, label: string): string {
  const sanitized = id.trim()
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitized)) {
    throw new Error(`Invalid ${label} format: expected UUID`)
  }
  return sanitized
}

function sanitizeLimit(value: number | undefined, max = 100): number {
  return Math.max(1, Math.min(max, Math.floor(value ?? 20)))
}

function sanitizeOffset(value: number | undefined): number {
  return Math.max(0, Math.floor(value ?? 0))
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface MessageThread {
  id: string
  patientId: string
  subject: string
  participantReferences: Array<{ reference: string; display?: string }>
  messages: ThreadMessage[]
  createdAt: string
  updatedAt: string
}

export interface ThreadMessage {
  id: string
  senderReference: string
  recipientReference: string
  body: string
  sentAt: string
  status: 'sent' | 'delivered' | 'read'
}

export interface CreateThreadInput {
  patientId: string
  subject: string
  practitionerReference: string
  initialMessage: string
}

export interface CreateMessageInput {
  threadId: string
  senderReference: string
  recipientReference: string
  body: string
}

export interface ThreadSearchParams {
  limit?: number
  offset?: number
}

export interface ThreadSummary {
  threadId: string
  subject: string
  messageCount: number
  lastMessageAt: string
  participants: Array<{ reference: string; display?: string }>
}

// ── Repository ──────────────────────────────────────────────────────────────

/**
 * Lightweight repository for communication threads stored as DocumentReference
 * resources with category "communication". Uses the existing ehr_document_reference table.
 */
class CommunicationRepository extends BaseRepository<DocumentReference & { id?: string }> {
  protected readonly tableName = 'ehr_document_reference'
  protected readonly idColumn = 'document_reference_id'
  protected readonly resourceType = 'DocumentReference'

  async createThread(
    patientId: string,
    practitionerRef: string,
    subject: string,
    initialMessage: string,
    senderRef: string,
  ): Promise<DocumentReference> {
    const now = new Date().toISOString()
    const docRef: DocumentReference = {
      resourceType: 'DocumentReference',
      status: 'current',
      type: {
        coding: [{ system: 'http://loinc.org', code: '82373-0', display: 'Clinical note' }],
        text: 'Portal Communication',
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/document-category',
              code: 'communication',
              display: 'Communication',
            },
          ],
          text: 'Secure Message Thread',
        },
      ],
      subject: { reference: `Patient/${patientId}` },
      date: now,
      author: [{ reference: senderRef }],
      description: subject,
      content: [
        {
          attachment: {
            contentType: 'application/json',
            data: Buffer.from(
              JSON.stringify({ body: initialMessage, sender: senderRef, recipient: practitionerRef, sentAt: now }),
            ).toString('base64'),
            title: 'Initial message',
          },
        },
      ],
      context: {
        related: [{ ref: { reference: practitionerRef } }],
      },
    }

    const parsed = documentReferenceSchema.parse(docRef)
    return this.withRLS(async (client) => {
      const result = await client.query(
        `INSERT INTO ${this.tableName}
          (tenant_id, patient_id, status, date, fhir_resource)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING fhir_resource`,
        [
          this.rlsContext.tenantId,
          patientId,
          'current',
          now,
          JSON.stringify(parsed),
        ],
      )
      return (result.rows[0] as { fhir_resource: DocumentReference }).fhir_resource
    })
  }

  async addMessage(
    threadId: string,
    senderRef: string,
    recipientRef: string,
    body: string,
  ): Promise<DocumentReference> {
    const existing = await this.findById(threadId)
    if (!existing) throw new Error(`Communication thread ${threadId} not found`)

    const now = new Date().toISOString()
    const newContent = [
      ...(existing.content || []),
      {
        attachment: {
          contentType: 'application/json',
          data: Buffer.from(
            JSON.stringify({ body, sender: senderRef, recipient: recipientRef, sentAt: now }),
          ).toString('base64'),
          title: `Message from ${senderRef}`,
        },
      },
    ]

    const updated: DocumentReference = {
      ...existing,
      date: now,
      content: newContent,
    }

    const parsed = documentReferenceSchema.parse(updated)
    return this.withRLS(async (client) => {
      const result = await client.query(
        `UPDATE ${this.tableName}
         SET fhir_resource = $2, updated_at = NOW()
         WHERE ${this.idColumn} = $1
         RETURNING fhir_resource`,
        [threadId, JSON.stringify(parsed)],
      )
      return (result.rows[0] as { fhir_resource: DocumentReference }).fhir_resource
    })
  }

  override async findByPatient(
    patientId: string,
    limit: number,
    offset: number,
  ): Promise<DocumentReference[]> {
    return this.withRLS(async (client) => {
      const result = await client.query(
        `SELECT fhir_resource FROM ${this.tableName}
         WHERE patient_id = $1
           AND fhir_resource->'category' @> '[{"coding":[{"code":"communication"}]}]'
         ORDER BY updated_at DESC
         LIMIT $2 OFFSET $3`,
        [patientId, limit, offset],
      )
      return (result.rows as Array<{ fhir_resource: DocumentReference }>).map((r) => r.fhir_resource)
    })
  }

  override async findById(id: string): Promise<DocumentReference | null> {
    return super.findById(id)
  }

  override async delete(id: string): Promise<boolean> {
    return this.withRLS(async (client) => {
      const result = await client.query(
        `DELETE FROM ${this.tableName} WHERE ${this.idColumn} = $1`,
        [id],
      )
      return (result.rowCount ?? 0) > 0
    })
  }

  override async countByPatient(patientId: string): Promise<number> {
    return this.withRLS(async (client) => {
      const result = await client.query(
        `SELECT COUNT(*)::int as count FROM ${this.tableName}
         WHERE patient_id = $1
           AND fhir_resource->'category' @> '[{"coding":[{"code":"communication"}]}]'`,
        [patientId],
      )
      return (result.rows[0] as { count?: number } | undefined)?.count ?? 0
    })
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

export class PortalMessagingService {
  private readonly commRepo: CommunicationRepository

  constructor(rlsContext: RLSContext) {
    this.commRepo = new CommunicationRepository(rlsContext)
  }

  /**
   * Create a new secure messaging thread.
   */
  async createThread(input: CreateThreadInput): Promise<MessageThread> {
    validateId(input.patientId, 'patientId')
    if (!input.subject || input.subject.trim().length === 0) {
      throw new Error('Subject is required')
    }
    if (!input.initialMessage || input.initialMessage.trim().length === 0) {
      throw new Error('Initial message is required')
    }
    if (input.subject.length > 200) {
      throw new Error('Subject must be 200 characters or less')
    }

    const senderRef = `Patient/${input.patientId}`
    const docRef = await this.commRepo.createThread(
      input.patientId,
      input.practitionerReference,
      input.subject.trim(),
      input.initialMessage.trim(),
      senderRef,
    )

    return this.toThread(docRef, input.patientId)
  }

  /**
   * Add a message to an existing thread.
   */
  async addMessage(input: CreateMessageInput): Promise<MessageThread> {
    validateId(input.threadId, 'threadId')
    if (!input.body || input.body.trim().length === 0) {
      throw new Error('Message body is required')
    }
    if (input.body.length > 5000) {
      throw new Error('Message body must be 5000 characters or less')
    }

    const updated = await this.commRepo.addMessage(
      input.threadId,
      input.senderReference,
      input.recipientReference,
      input.body.trim(),
    )

    const patientId = this.extractPatientId(updated)
    return this.toThread(updated, patientId)
  }

  /**
   * Get a single thread by ID.
   */
  async getThread(threadId: string, patientId: string): Promise<MessageThread | null> {
    validateId(threadId, 'threadId')
    validateId(patientId, 'patientId')

    const docRef = await this.commRepo.findById(threadId)
    if (!docRef) return null

    // Verify ownership — patient can only see their own threads
    const threadPatientId = this.extractPatientId(docRef)
    if (threadPatientId !== patientId) {
      throw new Error('Thread does not belong to this patient')
    }

    return this.toThread(docRef, patientId)
  }

  /**
   * List all threads for a patient.
   */
  async listThreads(
    patientId: string,
    params: ThreadSearchParams = {},
  ): Promise<{ threads: MessageThread[]; total: number }> {
    validateId(patientId, 'patientId')
    const limit = sanitizeLimit(params.limit)
    const offset = sanitizeOffset(params.offset)

    const [docRefs, total] = await Promise.all([
      this.commRepo.findByPatient(patientId, limit, offset),
      this.commRepo.countByPatient(patientId),
    ])

    const threads = docRefs.map((dr) => this.toThread(dr, patientId))
    return { threads, total }
  }

  /**
   * Get thread summaries (lightweight overview for dashboard).
   */
  async getThreadSummaries(
    patientId: string,
    params: ThreadSearchParams = {},
  ): Promise<{ summaries: ThreadSummary[]; total: number }> {
    const { threads, total } = await this.listThreads(patientId, params)
    const summaries: ThreadSummary[] = threads.map((t) => ({
      threadId: t.id,
      subject: t.subject,
      messageCount: t.messages.length,
      lastMessageAt: t.updatedAt,
      participants: t.participantReferences,
    }))
    return { summaries, total }
  }

  /**
   * Delete (soft-delete by setting status to 'superseded') a thread.
   */
  async deleteThread(threadId: string, patientId: string): Promise<boolean> {
    validateId(threadId, 'threadId')
    validateId(patientId, 'patientId')

    const thread = await this.getThread(threadId, patientId)
    if (!thread) return false

    return this.commRepo.delete(threadId)
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private toThread(docRef: DocumentReference, patientId: string): MessageThread {
    const docRefId = (docRef as DocumentReference & { id?: string }).id ?? ''
    const messages: ThreadMessage[] = (docRef.content || []).map((c, i) => {
      let body = ''
      let senderReference: string | undefined
      let recipientReference: string | undefined
      let sentAt: string | undefined
      if (c.attachment?.data) {
        const decoded = Buffer.from(c.attachment.data, 'base64').toString('utf-8')
        try {
          const parsed = JSON.parse(decoded) as {
            body?: string
            sender?: string
            recipient?: string
            sentAt?: string
          }
          if (parsed && typeof parsed.body === 'string') {
            body = parsed.body
            senderReference = parsed.sender
            recipientReference = parsed.recipient
            sentAt = parsed.sentAt
          } else {
            body = decoded
          }
        } catch {
          body = decoded
        }
      }
      return {
        id: `${docRefId}-msg-${i}`,
        senderReference:
          senderReference ??
          (docRef.author?.[0] as { reference?: string } | undefined)?.reference ??
          `Patient/${patientId}`,
        recipientReference: recipientReference ?? docRef.context?.related?.[0]?.ref?.reference ?? '',
        body,
        sentAt: sentAt ?? docRef.date ?? new Date().toISOString(),
        status: 'delivered' as const,
      }
    })

    const participants: Array<{ reference: string; display?: string }> = [
      ...(docRef.author ?? []).map((a) => ({
        reference: (a as { reference?: string }).reference ?? '',
        display: a.display,
      })),
      ...(docRef.context?.related ?? []).map((r) => ({
        reference: r.ref?.reference ?? '',
        display: r.ref?.display,
      })),
    ]

    return {
      id: docRefId,
      patientId,
      subject: docRef.description ?? 'Untitled thread',
      participantReferences: participants,
      messages,
      createdAt: docRef.date ?? new Date().toISOString(),
      updatedAt: docRef.date ?? new Date().toISOString(),
    }
  }

  private extractPatientId(docRef: DocumentReference): string {
    const ref = docRef.subject?.reference ?? ''
    return ref.replace('Patient/', '')
  }
}

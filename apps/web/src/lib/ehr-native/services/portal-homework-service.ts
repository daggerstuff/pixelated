/**
 * Portal Homework Service — F1.11 Client Portal Feature #3
 *
 * Homework assignments are therapeutic tasks assigned by clinicians.
 * Patients view assignments and mark them complete.
 *
 * Storage: Homework assignments stored as DocumentReference with category "homework".
 * Completion status tracked in the DocumentReference context extension.
 */

import type { RLSContext } from '@/lib/ehr-native/repositories/base-repository'
import { BaseRepository } from '@/lib/ehr-native/repositories/base-repository'
import {
  documentReferenceSchema,
  type DocumentReference,
} from '@/lib/ehr-native/types'

// ── Validation helpers (local, matching pattern in scheduling-service.ts) ──

function validateId(id: string, label: string): string {
  const sanitized = id.trim()
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      sanitized,
    )
  ) {
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

export interface HomeworkAssignment {
  id: string
  patientId: string
  practitionerId: string
  title: string
  description: string
  instructions: string
  dueDate?: string
  assignedAt: string
  completedAt?: string
  status: 'assigned' | 'in-progress' | 'completed' | 'overdue'
  patientNotes?: string
}

export interface HomeworkSummary {
  totalAssigned: number
  completed: number
  pending: number
  overdue: number
  upcoming: number
}

export interface UpdateHomeworkInput {
  status?: 'assigned' | 'in-progress' | 'completed'
  patientNotes?: string
}

export interface HomeworkSearchParams {
  status?: string
  limit?: number
  offset?: number
}

// ── Repository ──────────────────────────────────────────────────────────────

class HomeworkRepository extends BaseRepository<
  DocumentReference & { id?: string }
> {
  protected readonly tableName = 'ehr_document_reference'
  protected readonly idColumn = 'document_reference_id'
  protected readonly resourceType = 'DocumentReference'

  async createAssignment(
    patientId: string,
    practitionerRef: string,
    assignment: Omit<HomeworkAssignment, 'id' | 'patientId' | 'practitionerId'>,
  ): Promise<DocumentReference> {
    const now = new Date().toISOString()
    const docRef: DocumentReference = {
      resourceType: 'DocumentReference',
      status: 'current',
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: '77826-2',
            display: 'Questionnaire',
          },
        ],
        text: 'Homework Assignment',
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/document-category',
              code: 'homework',
              display: 'Homework',
            },
          ],
          text: 'Therapy Homework Assignment',
        },
      ],
      subject: { reference: `Patient/${patientId}` },
      date: now,
      author: [{ reference: practitionerRef }],
      description: assignment.title,
      content: [
        {
          attachment: {
            contentType: 'application/json',
            data: Buffer.from(
              JSON.stringify({
                description: assignment.description,
                instructions: assignment.instructions,
                dueDate: assignment.dueDate,
                assignedAt: assignment.assignedAt,
                completedAt: assignment.completedAt,
                status: assignment.status,
                patientNotes: assignment.patientNotes,
              }),
            ).toString('base64'),
            title: assignment.title,
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
      return (result.rows[0] as { fhir_resource: DocumentReference })
        .fhir_resource
    })
  }

  async updateAssignment(
    id: string,
    updates: UpdateHomeworkInput,
  ): Promise<DocumentReference | null> {
    const existing = await this.findById(id)
    if (!existing) return null

    const payload = this.extractPayload(existing)
    const updatedPayload = {
      ...payload,
      ...(updates.status !== undefined && { status: updates.status }),
      ...(updates.patientNotes !== undefined && {
        patientNotes: updates.patientNotes,
      }),
      ...(updates.status === 'completed' && {
        completedAt: new Date().toISOString(),
      }),
    }

    const now = new Date().toISOString()
    const updated: DocumentReference = {
      ...existing,
      date: now,
      content: [
        {
          attachment: {
            contentType: 'application/json',
            data: Buffer.from(JSON.stringify(updatedPayload)).toString(
              'base64',
            ),
            title:
              existing.content?.[0]?.attachment?.title ?? 'Homework Assignment',
          },
        },
      ],
    }

    const parsed = documentReferenceSchema.parse(updated)
    return this.withRLS(async (client) => {
      const result = await client.query(
        `UPDATE ${this.tableName}
         SET fhir_resource = $2, updated_at = NOW()
         WHERE ${this.idColumn} = $1
         RETURNING fhir_resource`,
        [id, JSON.stringify(parsed)],
      )
      return (
        (result.rows[0] as { fhir_resource?: DocumentReference } | undefined)
          ?.fhir_resource ?? null
      )
    })
  }

  override async findByPatient(
    patientId: string,
    limit: number,
    offset: number,
    statusFilter?: string,
  ): Promise<DocumentReference[]> {
    return this.withRLS(async (client) => {
      let query = `SELECT fhir_resource FROM ${this.tableName}
        WHERE patient_id = $1
          AND fhir_resource->'category' @> '[{"coding":[{"code":"homework"}]}]'`
      const params: unknown[] = [patientId]
      let paramIdx = 2

      if (statusFilter) {
        query += ` AND convert_from(decode(fhir_resource->'content'->0->'attachment'->>'data', 'base64'), 'UTF8')::jsonb->>'status' = $${paramIdx}`
        params.push(statusFilter)
        paramIdx += 1
      }

      query += ` ORDER BY updated_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`
      params.push(limit, offset)
      const result = await client.query(query, params)
      return (result.rows as Array<{ fhir_resource: DocumentReference }>).map(
        (r) => r.fhir_resource,
      )
    })
  }

  override async countByPatient(
    patientId: string,
    statusFilter?: string,
  ): Promise<number> {
    return this.withRLS(async (client) => {
      let query = `SELECT COUNT(*)::int as count FROM ${this.tableName}
         WHERE patient_id = $1
           AND fhir_resource->'category' @> '[{"coding":[{"code":"homework"}]}]'`
      const params: unknown[] = [patientId]
      if (statusFilter) {
        query += ` AND convert_from(decode(fhir_resource->'content'->0->'attachment'->>'data', 'base64'), 'UTF8')::jsonb->>'status' = $2`
        params.push(statusFilter)
      }
      const result = await client.query(query, params)
      return (result.rows[0] as { count?: number } | undefined)?.count ?? 0
    })
  }

  override async findById(id: string): Promise<DocumentReference | null> {
    return super.findById(id)
  }

  private extractPayload(docRef: DocumentReference): Record<string, unknown> {
    const data = docRef.content?.[0]?.attachment?.data
    if (!data) return {}
    try {
      return JSON.parse(Buffer.from(data, 'base64').toString('utf-8'))
    } catch {
      return {}
    }
  }
}

// ── Service ──────────────────────────────────────────────────────────────────

export class PortalHomeworkService {
  private readonly homeworkRepo: HomeworkRepository

  constructor(rlsContext: RLSContext) {
    this.homeworkRepo = new HomeworkRepository(rlsContext)
  }

  /**
   * List homework assignments for a patient, optionally filtered by status.
   */
  async listAssignments(
    patientId: string,
    params: HomeworkSearchParams = {},
  ): Promise<{ assignments: HomeworkAssignment[]; total: number }> {
    validateId(patientId, 'patientId')
    const limit = sanitizeLimit(params.limit)
    const offset = sanitizeOffset(params.offset)

    const [docRefs, total] = await Promise.all([
      this.homeworkRepo.findByPatient(patientId, limit, offset, params.status),
      this.homeworkRepo.countByPatient(patientId, params.status),
    ])

    const assignments = docRefs.map((dr) => this.toAssignment(dr))
    return { assignments, total }
  }

  /**
   * Get a single homework assignment.
   */
  async getAssignment(
    assignmentId: string,
    patientId: string,
  ): Promise<HomeworkAssignment | null> {
    validateId(assignmentId, 'assignmentId')
    validateId(patientId, 'patientId')

    const docRef = await this.homeworkRepo.findById(assignmentId)
    if (!docRef) return null

    const assignment = this.toAssignment(docRef)
    if (assignment.patientId !== patientId) {
      throw new Error('Assignment does not belong to this patient')
    }

    return assignment
  }

  /**
   * Update homework status (patient marks assignment complete or in-progress).
   */
  async updateAssignment(
    assignmentId: string,
    patientId: string,
    updates: UpdateHomeworkInput,
  ): Promise<HomeworkAssignment | null> {
    validateId(assignmentId, 'assignmentId')
    validateId(patientId, 'patientId')

    const existing = await this.getAssignment(assignmentId, patientId)
    if (!existing) return null

    if (updates.patientNotes && updates.patientNotes.length > 2000) {
      throw new Error('Patient notes must be 2000 characters or less')
    }

    const updated = await this.homeworkRepo.updateAssignment(
      assignmentId,
      updates,
    )
    if (!updated) return null

    return this.toAssignment(updated)
  }

  /**
   * Mark assignment as completed.
   */
  async completeAssignment(
    assignmentId: string,
    patientId: string,
    patientNotes?: string,
  ): Promise<HomeworkAssignment | null> {
    return this.updateAssignment(assignmentId, patientId, {
      status: 'completed',
      patientNotes,
    })
  }

  /**
   * Get homework summary for dashboard widget.
   */
  async getSummary(patientId: string): Promise<HomeworkSummary> {
    validateId(patientId, 'patientId')
    // Fetch all assignments for summary to avoid pagination truncation.
    // Use repository directly with large limit to ensure complete summary.
    const docRefs = await this.homeworkRepo.findByPatient(patientId, 1000, 0)
    const assignments = docRefs.map((dr) => this.toAssignment(dr))

    const now = new Date()
    return {
      totalAssigned: assignments.length,
      completed: assignments.filter((a) => a.status === 'completed').length,
      pending: assignments.filter(
        (a) => a.status === 'assigned' || a.status === 'in-progress',
      ).length,
      overdue: assignments.filter(
        (a) =>
          a.dueDate && new Date(a.dueDate) < now && a.status !== 'completed',
      ).length,
      upcoming: assignments.filter(
        (a) =>
          a.dueDate && new Date(a.dueDate) > now && a.status !== 'completed',
      ).length,
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private toAssignment(docRef: DocumentReference): HomeworkAssignment {
    const payload = this.extractPayload(docRef)
    const patientId = (docRef.subject?.reference ?? '').replace('Patient/', '')
    const practitionerRef = docRef.context?.related?.[0]?.ref?.reference ?? ''
    const practitionerId = practitionerRef.replace('Practitioner/', '')
    const docRefId = (docRef as DocumentReference & { id?: string }).id ?? ''

    return {
      id: docRefId,
      patientId,
      practitionerId,
      title: docRef.description ?? 'Untitled Assignment',
      description: (payload['description'] as string) ?? '',
      instructions: (payload['instructions'] as string) ?? '',
      dueDate: payload['dueDate'] as string | undefined,
      assignedAt:
        (payload['assignedAt'] as string) ??
        docRef.date ??
        new Date().toISOString(),
      completedAt: payload['completedAt'] as string | undefined,
      status: (payload['status'] as HomeworkAssignment['status']) ?? 'assigned',
      patientNotes: payload['patientNotes'] as string | undefined,
    }
  }

  private extractPayload(docRef: DocumentReference): Record<string, unknown> {
    const data = docRef.content?.[0]?.attachment?.data
    if (!data) return {}
    try {
      return JSON.parse(Buffer.from(data, 'base64').toString('utf-8'))
    } catch {
      return {}
    }
  }
}

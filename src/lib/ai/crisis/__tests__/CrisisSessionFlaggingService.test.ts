import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ObjectId } from 'mongodb'
import { CrisisSessionFlaggingService } from '../CrisisSessionFlaggingService'
import type { FlagSessionRequest } from '../CrisisSessionFlaggingService'

const collectionState = new Map<string, any>()

vi.mock('@lib/audit', () => ({
  createAuditLog: vi.fn(),
  AuditEventType: { SECURITY_ALERT: 'SECURITY_ALERT' },
}))

vi.mock('@lib/logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

vi.mock('@lib/db/mongoClient', () => ({
  __esModule: true,
  default: {
    connect: vi.fn(async () => ({
      collection: vi.fn(() => ({
        insertOne: async (doc: any) => {
          const storedId = doc._id ?? new ObjectId()
          const stored = { ...doc, _id: storedId, id: storedId.toString() }
          collectionState.set(storedId.toString(), stored)
          return { insertedId: storedId }
        },
        findOne: async (query: any) => {
          if (query?._id) {
            return collectionState.get(query._id.toString()) ?? null
          }
          return null
        },
        findOneAndUpdate: async (filter: any, update: any) => {
          const existing = collectionState.get(filter._id.toString())
          if (!existing) {
            return { value: null }
          }
          const updated = { ...existing, ...update.$set }
          collectionState.set(filter._id.toString(), updated)
          return { value: updated }
        },
        find: (query: any) => ({
          sort: () => ({
            toArray: async () => {
              return Array.from(collectionState.values()).filter(doc => {
                              if (query.user_id && doc.user_id !== query.user_id) return false
                              if (query.status && query.status.$nin) {
                                return !query.status.$nin.includes(doc.status)
                              }
                              return true
                            });
            },
          }),
        }),
      })),
    })),
  },
}))

describe('CrisisSessionFlaggingService (Mongo implementation)', () => {
  let service: CrisisSessionFlaggingService
  let validRequest: FlagSessionRequest
  let auditLogMock: any

  beforeEach(async () => {
    collectionState.clear()
    vi.clearAllMocks()
    service = new CrisisSessionFlaggingService()

    const auditModule = await import('@lib/audit')
    auditLogMock = auditModule.createAuditLog

    validRequest = {
      userId: 'user_123',
      sessionId: 'session_123',
      crisisId: 'crisis_123',
      timestamp: '2024-01-01T00:00:00Z',
      reason: 'Crisis detected by AI',
      severity: 'high',
      detectedRisks: ['suicidal_ideation', 'self_harm'],
      confidence: 0.92,
      textSample: 'I want to end it all',
      routingDecision: { route: 'crisis', confidence: 0.92 },
      metadata: { source: 'unit-test' },
    }
  })

  it('flags a session for review and writes audit log', async () => {
    const result = await service.flagSessionForReview(validRequest)

    expect(result.id).toMatch(/^[a-f\d]{24}$/i)
    expect(result.userId).toBe(validRequest.userId)
    expect(result.sessionId).toBe(validRequest.sessionId)
    expect(result.severity).toBe('high')
    expect(result.status).toBe('pending')
    expect(result.detectedRisks).toEqual(validRequest.detectedRisks)
    expect(auditLogMock).toHaveBeenCalledWith(
      'SECURITY_ALERT',
      'crisis_session_flagged',
      validRequest.userId,
      validRequest.sessionId,
      expect.objectContaining({
        crisisId: validRequest.crisisId,
        severity: validRequest.severity,
        confidence: validRequest.confidence,
      }),
    )
  })

  it('rejects invalid identifiers during flagging', async () => {
    const invalidRequest = { ...validRequest, userId: 'bad id' }

    await expect(
      service.flagSessionForReview(invalidRequest),
    ).rejects.toThrow('Invalid userId')
  })

  it('updates an existing flag status', async () => {
    const created = await service.flagSessionForReview(validRequest)

    const updated = await service.updateFlagStatus({
      flagId: created.id,
      status: 'resolved',
      reviewerNotes: 'Escalated and resolved',
      resolutionNotes: 'Handled by on-call clinician',
    })

    expect(updated.status).toBe('resolved')
    expect(updated.resolvedAt).toBeDefined()
    expect(updated.reviewerNotes).toBe('Escalated and resolved')
    expect(updated.resolutionNotes).toBe('Handled by on-call clinician')
  })

  it('rejects invalid flag identifiers on update', async () => {
    await expect(
      service.updateFlagStatus({ flagId: 'not-a-valid-object-id', status: 'reviewed' }),
    ).rejects.toThrow('Invalid flagId provided.')
  })

  it('returns open crisis flags by default', async () => {
    await service.flagSessionForReview(validRequest)
    await service.flagSessionForReview({
      ...validRequest,
      crisisId: 'crisis_124',
      sessionId: 'session_closed',
      severity: 'low',
      detectedRisks: ['support'],
      confidence: 0.2,
      metadata: { status: 'closed' },
    })

    const openFlags = await service.getUserCrisisFlags(validRequest.userId)

    expect(openFlags.length).toBe(2)
  })

  it('includes resolved flags when requested', async () => {
    const created = await service.flagSessionForReview(validRequest)
    await service.updateFlagStatus({ flagId: created.id, status: 'resolved' })

    const withResolved = await service.getUserCrisisFlags(
      validRequest.userId,
      true,
    )

    expect(withResolved.some(flag => flag.status === 'resolved')).toBe(true)
  })
})

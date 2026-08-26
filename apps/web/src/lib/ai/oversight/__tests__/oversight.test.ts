/**
 * Tests for Human Oversight: Intervention Approval Queue, Manual Override,
 * Audit Trail, and Governance Checklist
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getInterventionApprovalQueue,
  resetInterventionApprovalQueue,
  getManualOverrideService,
  resetManualOverrideService,
  getAuditTrailService,
  resetAuditTrailService,
  DEFAULT_CHECKLIST_ITEMS,
  getDefaultChecklist,
  validateChecklist,
  createChecklistResult,
  createSatisfiedChecklistResult,
} from '../index'
import type { TherapeuticResponse } from '../../models/ai-types'
import type { GovernanceChecklistItem } from '../types'

const mockResponse: TherapeuticResponse = {
  content:
    'I understand you are feeling anxious. Let us try a grounding exercise.',
  confidence: 0.85,
  intervention: true,
  techniques: ['GROUNDING_TECHNIQUES'],
}

const mockResponse2: TherapeuticResponse = {
  content:
    'That sounds really difficult. Can you tell me more about what happened?',
  confidence: 0.72,
  intervention: false,
  techniques: ['ACTIVE_LISTENING'],
}

function makeChecklist(
  satisfied: boolean,
  therapistId = 'therapist-001',
): ReturnType<typeof createChecklistResult> {
  const items: GovernanceChecklistItem[] = DEFAULT_CHECKLIST_ITEMS.map(
    (item) => ({
      ...item,
      satisfied,
      notes: null,
    }),
  )
  return createChecklistResult(items, therapistId)
}

describe('Governance Checklist', () => {
  it('should have 8 default checklist items', () => {
    expect(DEFAULT_CHECKLIST_ITEMS).toHaveLength(8)
  })

  it('should return all items unsatisfied from getDefaultChecklist', () => {
    const checklist = getDefaultChecklist()
    expect(checklist).toHaveLength(8)
    expect(checklist.every((item) => !item.satisfied)).toBe(true)
  })

  it('should fail validation when items are unsatisfied', () => {
    const items = getDefaultChecklist()
    const result = validateChecklist(items)
    expect(result.passed).toBe(false)
    expect(result.unsatisfied).toHaveLength(8)
  })

  it('should pass validation when all items are satisfied', () => {
    const items = getDefaultChecklist().map((item) => ({
      ...item,
      satisfied: true,
    }))
    const result = validateChecklist(items)
    expect(result.passed).toBe(true)
    expect(result.unsatisfied).toHaveLength(0)
  })

  it('should create a passing checklist result', () => {
    const items = getDefaultChecklist().map((item) => ({
      ...item,
      satisfied: true,
    }))
    const result = createChecklistResult(items, 'therapist-001')
    expect(result.passed).toBe(true)
    expect(result.items).toHaveLength(8)
    expect(result.evaluatedBy).toBe('therapist-001')
    expect(result.evaluatedAt).toBeTruthy()
  })

  it('should create a satisfied checklist result (all pass)', () => {
    const result = createSatisfiedChecklistResult('admin-001')
    expect(result.passed).toBe(true)
    expect(result.items.every((item) => item.satisfied)).toBe(true)
    expect(result.evaluatedBy).toBe('admin-001')
  })
})

describe('Intervention Approval Queue', () => {
  let queue: ReturnType<typeof getInterventionApprovalQueue>

  beforeEach(() => {
    queue = getInterventionApprovalQueue()
    queue.reset()
    resetAuditTrailService()
  })

  it('should enqueue an intervention', () => {
    const intervention = queue.enqueue(
      'session-001',
      mockResponse,
      'Patient expressed anxiety about upcoming exam',
      { priority: 'high', metadata: {} },
    )
    expect(intervention.requestId).toBeTruthy()
    expect(intervention.status).toBe('pending')
    expect(intervention.sessionId).toBe('session-001')
    expect(intervention.response).toBe(mockResponse)
    expect(intervention.priority).toBe('high')
  })

  it('should return the intervention by ID', () => {
    const enqueued = queue.enqueue(
      'session-001',
      mockResponse,
      'Test context',
      { priority: 'medium', metadata: {} },
    )
    const retrieved = queue.getById(enqueued.requestId)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.requestId).toBe(enqueued.requestId)
  })

  it('should return null for non-existent ID', () => {
    expect(queue.getById('nonexistent')).toBeNull()
  })

  it('should get pending interventions sorted by priority', () => {
    queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'low',
      metadata: {},
    })
    queue.enqueue('s2', mockResponse, 'ctx', {
      priority: 'critical',
      metadata: {},
    })
    queue.enqueue('s3', mockResponse, 'ctx', {
      priority: 'medium',
      metadata: {},
    })

    const pending = queue.getPending()
    expect(pending).toHaveLength(3)
    expect(pending[0].priority).toBe('critical')
    expect(pending[1].priority).toBe('medium')
    expect(pending[2].priority).toBe('low')
  })

  it('should approve an intervention with passing checklist', () => {
    const enqueued = queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })
    const checklist = createSatisfiedChecklistResult('therapist-001')

    const approved = queue.approve(enqueued.requestId, {
      therapistId: 'therapist-001',
      checklistResult: checklist,
      metadata: {},
    })

    expect(approved.status).toBe('approved')
    expect(approved.decidedBy).toBe('therapist-001')
    expect(approved.decidedAt).toBeTruthy()
    expect(approved.checklistResult).toBe(checklist)
  })

  it('should throw when approving non-existent intervention', () => {
    expect(() =>
      queue.approve('nonexistent', {
        therapistId: 'therapist-001',
        checklistResult: createSatisfiedChecklistResult('therapist-001'),
        metadata: {},
      }),
    ).toThrow('Intervention not found')
  })

  it('should throw when approving already-decided intervention', () => {
    const enqueued = queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })
    queue.approve(enqueued.requestId, {
      therapistId: 'therapist-001',
      checklistResult: createSatisfiedChecklistResult('therapist-001'),
      metadata: {},
    })

    expect(() =>
      queue.approve(enqueued.requestId, {
        therapistId: 'therapist-002',
        checklistResult: createSatisfiedChecklistResult('therapist-002'),
        metadata: {},
      }),
    ).toThrow('Cannot approve intervention with status approved')
  })

  it('should throw when checklist did not pass', () => {
    const enqueued = queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })
    const failedChecklist = createChecklistResult(
      getDefaultChecklist(),
      'therapist-001',
    )

    expect(() =>
      queue.approve(enqueued.requestId, {
        therapistId: 'therapist-001',
        checklistResult: failedChecklist,
        metadata: {},
      }),
    ).toThrow('governance checklist did not pass')
  })

  it('should reject an intervention with reason', () => {
    const enqueued = queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })

    const rejected = queue.reject(enqueued.requestId, {
      therapistId: 'therapist-001',
      reason: 'Response too generic for the clinical context',
      metadata: {},
    })

    expect(rejected.status).toBe('rejected')
    expect(rejected.decidedBy).toBe('therapist-001')
    expect(rejected.reason).toBe(
      'Response too generic for the clinical context',
    )
  })

  it('should throw when rejecting non-existent intervention', () => {
    expect(() =>
      queue.reject('nonexistent', {
        therapistId: 'therapist-001',
        reason: 'test',
        metadata: {},
      }),
    ).toThrow('Intervention not found')
  })

  it('should override an intervention with replacement response', () => {
    const enqueued = queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })

    const overridden = queue.override(
      enqueued.requestId,
      'therapist-001',
      mockResponse2,
      'Original response did not address the specific anxiety trigger',
    )

    expect(overridden.status).toBe('overridden')
    expect(overridden.replacementResponse).toBe(mockResponse2)
    expect(overridden.reason).toBe(
      'Original response did not address the specific anxiety trigger',
    )
    expect(overridden.decidedBy).toBe('therapist-001')
  })

  it('should throw when overriding non-pending intervention', () => {
    const enqueued = queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })
    queue.approve(enqueued.requestId, {
      therapistId: 'therapist-001',
      checklistResult: createSatisfiedChecklistResult('therapist-001'),
      metadata: {},
    })

    expect(() =>
      queue.override(
        enqueued.requestId,
        'therapist-001',
        mockResponse2,
        'test',
      ),
    ).toThrow('Cannot override intervention with status approved')
  })

  it('should get interventions by session', () => {
    queue.enqueue('session-A', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })
    queue.enqueue('session-A', mockResponse2, 'ctx', {
      priority: 'medium',
      metadata: {},
    })
    queue.enqueue('session-B', mockResponse, 'ctx', {
      priority: 'low',
      metadata: {},
    })

    const sessionA = queue.getBySession('session-A')
    expect(sessionA).toHaveLength(2)
    expect(sessionA.every((i) => i.sessionId === 'session-A')).toBe(true)
  })

  it('should compute queue stats correctly', () => {
    const i1 = queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })
    const i2 = queue.enqueue('s2', mockResponse, 'ctx', {
      priority: 'low',
      metadata: {},
    })
    queue.enqueue('s3', mockResponse, 'ctx', {
      priority: 'medium',
      metadata: {},
    })

    queue.approve(i1.requestId, {
      therapistId: 't1',
      checklistResult: createSatisfiedChecklistResult('t1'),
      metadata: {},
    })
    queue.reject(i2.requestId, {
      therapistId: 't1',
      reason: 'Inappropriate',
      metadata: {},
    })

    const stats = queue.getStats()
    expect(stats.total).toBe(3)
    expect(stats.pending).toBe(1)
    expect(stats.approved).toBe(1)
    expect(stats.rejected).toBe(1)
    expect(stats.overridden).toBe(0)
    expect(stats.expired).toBe(0)
  })

  it('should expire stale pending interventions', () => {
    queue.setTimeout(-1) // Immediately expire
    queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })

    // Wait a tiny bit so age > 0ms
    const expired = queue.expireStale()
    expect(expired).toBe(1)

    const pending = queue.getPending()
    expect(pending).toHaveLength(0)
  })

  it('should not expire decided interventions', () => {
    queue.setTimeout(-1)
    const i1 = queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })
    queue.approve(i1.requestId, {
      therapistId: 't1',
      checklistResult: createSatisfiedChecklistResult('t1'),
      metadata: {},
    })

    const expired = queue.expireStale()
    expect(expired).toBe(0)
  })
})

describe('Manual Override Service', () => {
  let overrideService: ReturnType<typeof getManualOverrideService>

  beforeEach(() => {
    overrideService = getManualOverrideService()
    overrideService.reset()
    resetAuditTrailService()
  })

  it('should replace a response with audit trail', () => {
    const action = overrideService.replaceResponse(
      'session-001',
      mockResponse,
      mockResponse2,
      'therapist-001',
      'More empathetic response needed',
    )

    expect(action.overrideId).toBeTruthy()
    expect(action.sessionId).toBe('session-001')
    expect(action.originalResponse).toBe(mockResponse)
    expect(action.replacementResponse).toBe(mockResponse2)
    expect(action.therapistId).toBe('therapist-001')
    expect(action.reason).toBe('More empathetic response needed')
    expect(action.action).toBe('replace')
    expect(action.timestamp).toBeTruthy()
  })

  it('should reject a response without replacement', () => {
    const action = overrideService.rejectResponse(
      'session-001',
      mockResponse,
      'therapist-001',
      'Response contains incorrect clinical advice',
    )

    expect(action.action).toBe('reject')
    expect(action.replacementResponse).toBeNull()
    expect(action.reason).toBe('Response contains incorrect clinical advice')
  })

  it('should get overrides by session', () => {
    overrideService.replaceResponse(
      'session-A',
      mockResponse,
      mockResponse2,
      'therapist-001',
      'reason 1',
    )
    overrideService.rejectResponse(
      'session-A',
      mockResponse,
      'therapist-002',
      'reason 2',
    )
    overrideService.replaceResponse(
      'session-B',
      mockResponse,
      mockResponse2,
      'therapist-001',
      'reason 3',
    )

    const sessionA = overrideService.getSessionOverrides('session-A')
    expect(sessionA).toHaveLength(2)
    expect(sessionA.every((o) => o.sessionId === 'session-A')).toBe(true)
  })

  it('should get overrides by therapist', () => {
    overrideService.replaceResponse(
      's1',
      mockResponse,
      mockResponse2,
      'therapist-A',
      'reason',
    )
    overrideService.rejectResponse('s2', mockResponse, 'therapist-B', 'reason')
    overrideService.replaceResponse(
      's3',
      mockResponse,
      mockResponse2,
      'therapist-A',
      'reason',
    )

    const therapistA = overrideService.getTherapistOverrides('therapist-A')
    expect(therapistA).toHaveLength(2)
    expect(therapistA.every((o) => o.therapistId === 'therapist-A')).toBe(true)
  })

  it('should get recent overrides', () => {
    for (let i = 0; i < 5; i++) {
      overrideService.replaceResponse(
        `session-${i}`,
        mockResponse,
        mockResponse2,
        'therapist-001',
        `reason ${i}`,
      )
    }

    const recent = overrideService.getRecent(3)
    expect(recent).toHaveLength(3)
    // Most recent first
    expect(recent[0].reason).toBe('reason 4')
    expect(recent[2].reason).toBe('reason 2')
  })
})

describe('Audit Trail Service', () => {
  beforeEach(() => {
    resetInterventionApprovalQueue()
    resetManualOverrideService()
    resetAuditTrailService()
  })

  it('should log intervention queue events', () => {
    const queue = getInterventionApprovalQueue()
    const audit = getAuditTrailService()

    queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })

    const entries = audit.getByActionType('queue')
    expect(entries).toHaveLength(1)
    expect(entries[0].actionType).toBe('queue')
    expect(entries[0].sessionId).toBe('s1')
  })

  it('should log approval events with checklist', () => {
    const queue = getInterventionApprovalQueue()
    const audit = getAuditTrailService()

    const enqueued = queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })
    queue.approve(enqueued.requestId, {
      therapistId: 'therapist-001',
      checklistResult: createSatisfiedChecklistResult('therapist-001'),
      metadata: {},
    })

    const approvals = audit.getByActionType('approval')
    expect(approvals).toHaveLength(1)
    expect(approvals[0].therapistId).toBe('therapist-001')
    expect(approvals[0].checklistResult).not.toBeNull()
    expect(approvals[0].checklistResult?.passed).toBe(true)
  })

  it('should log rejection events with reason', () => {
    const queue = getInterventionApprovalQueue()
    const audit = getAuditTrailService()

    const enqueued = queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })
    queue.reject(enqueued.requestId, {
      therapistId: 'therapist-001',
      reason: 'Inappropriate technique',
      metadata: {},
    })

    const rejections = audit.getByActionType('rejection')
    expect(rejections).toHaveLength(1)
    expect(rejections[0].reason).toBe('Inappropriate technique')
    expect(rejections[0].resultingResponse).toBeNull()
  })

  it('should log override events from approval queue', () => {
    const queue = getInterventionApprovalQueue()
    const audit = getAuditTrailService()

    const enqueued = queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })
    queue.override(
      enqueued.requestId,
      'therapist-001',
      mockResponse2,
      'Better response',
    )

    const overrides = audit.getByActionType('override')
    expect(overrides).toHaveLength(1)
    expect(overrides[0].originalResponse).toBe(mockResponse)
    expect(overrides[0].resultingResponse).toBe(mockResponse2)
  })

  it('should log manual override events', () => {
    const overrideService = getManualOverrideService()
    const audit = getAuditTrailService()

    overrideService.replaceResponse(
      's1',
      mockResponse,
      mockResponse2,
      'therapist-001',
      'Manual replacement',
    )

    const overrides = audit.getByActionType('override')
    expect(overrides).toHaveLength(1)
    expect(overrides[0].reason).toBe('Manual replacement')
  })

  it('should get audit entries by session', () => {
    const queue = getInterventionApprovalQueue()
    const audit = getAuditTrailService()

    queue.enqueue('session-A', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })
    queue.enqueue('session-B', mockResponse, 'ctx', {
      priority: 'low',
      metadata: {},
    })

    const sessionA = audit.getSessionEntries('session-A')
    expect(sessionA).toHaveLength(1)
    expect(sessionA[0].sessionId).toBe('session-A')
  })

  it('should get audit entries by request ID', () => {
    const queue = getInterventionApprovalQueue()
    const audit = getAuditTrailService()

    const enqueued = queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })
    queue.approve(enqueued.requestId, {
      therapistId: 't1',
      checklistResult: createSatisfiedChecklistResult('t1'),
      metadata: {},
    })

    const entries = audit.getRequestEntries(enqueued.requestId)
    // Queue entry + approval entry
    expect(entries).toHaveLength(2)
  })

  it('should get recent audit entries', () => {
    const queue = getInterventionApprovalQueue()
    const audit = getAuditTrailService()

    for (let i = 0; i < 10; i++) {
      queue.enqueue(`s${i}`, mockResponse, 'ctx', {
        priority: 'medium',
        metadata: {},
      })
    }

    const recent = audit.getRecent(5)
    expect(recent).toHaveLength(5)
  })

  it('should log expiration events', () => {
    const queue = getInterventionApprovalQueue()
    const audit = getAuditTrailService()

    queue.setTimeout(-1)
    queue.enqueue('s1', mockResponse, 'ctx', {
      priority: 'high',
      metadata: {},
    })
    queue.expireStale()

    const expirations = audit.getByActionType('expire')
    expect(expirations).toHaveLength(1)
    expect(expirations[0].reason).toBe(
      'Intervention expired without human review',
    )
  })
})

describe('End-to-end approval workflow', () => {
  beforeEach(() => {
    resetInterventionApprovalQueue()
    resetManualOverrideService()
    resetAuditTrailService()
  })

  it('should complete full approve workflow: enqueue → checklist → approve', () => {
    const queue = getInterventionApprovalQueue()
    const audit = getAuditTrailService()

    // 1. Enqueue
    const intervention = queue.enqueue(
      'session-e2e',
      mockResponse,
      'Patient shows anxiety symptoms',
      { priority: 'high', metadata: { source: 'simulator' } },
    )

    expect(intervention.status).toBe('pending')

    // 2. Complete governance checklist
    const checklist = createSatisfiedChecklistResult('therapist-001')

    // 3. Approve
    const approved = queue.approve(intervention.requestId, {
      therapistId: 'therapist-001',
      checklistResult: checklist,
      metadata: { reviewNotes: 'All items verified' },
    })

    expect(approved.status).toBe('approved')
    expect(approved.checklistResult?.passed).toBe(true)

    // 4. Verify audit trail
    const sessionEntries = audit.getSessionEntries('session-e2e')
    expect(sessionEntries.length).toBeGreaterThanOrEqual(2)
    expect(sessionEntries.some((e) => e.actionType === 'queue')).toBe(true)
    expect(sessionEntries.some((e) => e.actionType === 'approval')).toBe(true)
  })

  it('should complete full reject workflow: enqueue → reject', () => {
    const queue = getInterventionApprovalQueue()
    const audit = getAuditTrailService()

    const intervention = queue.enqueue(
      'session-reject',
      mockResponse,
      'Test context',
      { priority: 'medium', metadata: {} },
    )

    queue.reject(intervention.requestId, {
      therapistId: 'therapist-001',
      reason: 'Response does not match patient needs',
      metadata: {},
    })

    const rejected = queue.getById(intervention.requestId)
    expect(rejected?.status).toBe('rejected')
    expect(rejected?.reason).toBe('Response does not match patient needs')

    const entries = audit.getSessionEntries('session-reject')
    expect(entries.some((e) => e.actionType === 'rejection')).toBe(true)
  })

  it('should complete override workflow: enqueue → override with replacement', () => {
    const queue = getInterventionApprovalQueue()
    const audit = getAuditTrailService()

    const intervention = queue.enqueue(
      'session-override',
      mockResponse,
      'ctx',
      {
        priority: 'high',
        metadata: {},
      },
    )

    queue.override(
      intervention.requestId,
      'therapist-001',
      mockResponse2,
      'Replaced with more specific intervention',
    )

    const overridden = queue.getById(intervention.requestId)
    expect(overridden?.status).toBe('overridden')
    expect(overridden?.replacementResponse).toBe(mockResponse2)

    const entries = audit.getSessionEntries('session-override')
    expect(entries.some((e) => e.actionType === 'override')).toBe(true)
  })

  it('should support manual override outside the queue (mid-session)', () => {
    const overrideService = getManualOverrideService()
    const audit = getAuditTrailService()

    // Therapist rejects AI response mid-session (no queue involvement)
    const action = overrideService.rejectResponse(
      'session-mid',
      mockResponse,
      'therapist-001',
      'AI response triggered crisis indicators not properly handled',
    )

    expect(action.action).toBe('reject')

    const entries = audit.getSessionEntries('session-mid')
    expect(entries).toHaveLength(1)
    expect(entries[0].actionType).toBe('override')
    expect(entries[0].reason).toBe(
      'AI response triggered crisis indicators not properly handled',
    )
  })
})

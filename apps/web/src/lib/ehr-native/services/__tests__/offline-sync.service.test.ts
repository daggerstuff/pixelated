// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import {
  OfflineSyncService,
  InMemoryStorageAdapter,
  EncryptedLocalStorageAdapter,
} from '../offline-sync.service'

describe('OfflineSyncService', () => {
  let service: OfflineSyncService
  let mockStorage: InMemoryStorageAdapter

  beforeEach(() => {
    mockStorage = new InMemoryStorageAdapter()
    service = new OfflineSyncService(mockStorage)
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('Draft Notes Queueing & Conflict Handling', () => {
    it('queues a new draft note and assigns version 1', async () => {
      const draft = await service.queueDraftNote({
        id: 'draft-1',
        templateId: 'individual-therapy-progress',
        patientId: 'pat-123',
        authorId: 'prac-456',
        content: { chief_complaint: 'Patient reports mild anxiety' },
      })

      expect(draft.id).toBe('draft-1')
      expect(draft.version).toBe(1)
      expect(draft.syncStatus).toBe('pending')
      expect(service.getDraftNote('draft-1')).toBeDefined()
    })

    it('increments version on update to existing draft', async () => {
      await service.queueDraftNote({
        id: 'draft-1',
        templateId: 'individual-therapy-progress',
        patientId: 'pat-123',
        authorId: 'prac-456',
        content: { chief_complaint: 'Initial note' },
      })

      const updated = await service.queueDraftNote({
        id: 'draft-1',
        templateId: 'individual-therapy-progress',
        patientId: 'pat-123',
        authorId: 'prac-456',
        content: { chief_complaint: 'Updated note' },
      })

      expect(updated.version).toBe(2)
      expect(updated.content.chief_complaint).toBe('Updated note')
    })

    it('lists drafts filtered by patient ID', async () => {
      await service.queueDraftNote({
        id: 'draft-1',
        templateId: 'individual-therapy-progress',
        patientId: 'pat-1',
        authorId: 'prac-1',
        content: { text: 'Note 1' },
      })
      await service.queueDraftNote({
        id: 'draft-2',
        templateId: 'individual-therapy-progress',
        patientId: 'pat-2',
        authorId: 'prac-1',
        content: { text: 'Note 2' },
      })

      const pat1Drafts = service.listDraftNotes({ patientId: 'pat-1' })
      expect(pat1Drafts).toHaveLength(1)
      expect(pat1Drafts[0].id).toBe('draft-1')
    })

    it('deletes a draft note', async () => {
      await service.queueDraftNote({
        id: 'draft-1',
        templateId: 'individual-therapy-progress',
        patientId: 'pat-1',
        authorId: 'prac-1',
        content: { text: 'Note' },
      })

      const deleted = await service.deleteDraftNote('draft-1')
      expect(deleted).toBe(true)
      expect(service.getDraftNote('draft-1')).toBeUndefined()
    })

    it('resolves 409 conflict with client-wins strategy', async () => {
      service.setDefaultConflictStrategy('client-wins')
      await service.queueDraftNote({
        id: 'draft-1',
        templateId: 'individual-therapy-progress',
        patientId: 'pat-1',
        authorId: 'prac-1',
        content: { text: 'Client edit' },
      })

      // Mock first call returns 409, second override call returns 200
      const fetchMock = vi.fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 409,
          json: async () => ({ serverVersion: 3 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        })

      vi.stubGlobal('fetch', fetchMock)

      const success = await service.syncDraftNote('draft-1', { conflictStrategy: 'client-wins' })
      expect(success).toBe(true)
      const synced = service.getDraftNote('draft-1')
      expect(synced?.syncStatus).toBe('synced')
    })

    it('resolves 409 conflict with server-wins strategy by discarding local draft', async () => {
      await service.queueDraftNote({
        id: 'draft-1',
        templateId: 'individual-therapy-progress',
        patientId: 'pat-1',
        authorId: 'prac-1',
        content: { text: 'Client edit' },
      })

      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ serverVersion: 3 }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const success = await service.syncDraftNote('draft-1', { conflictStrategy: 'server-wins' })
      expect(success).toBe(true)
      expect(service.getDraftNote('draft-1')).toBeUndefined()
    })

    it('flags manual conflict when conflict strategy is manual', async () => {
      await service.queueDraftNote({
        id: 'draft-1',
        templateId: 'individual-therapy-progress',
        patientId: 'pat-1',
        authorId: 'prac-1',
        content: { text: 'Client edit' },
      })

      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({ serverVersion: 3 }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const onConflict = vi.fn()
      service.on('conflict', onConflict)

      const success = await service.syncDraftNote('draft-1', { conflictStrategy: 'manual' })
      expect(success).toBe(false)
      const conflictDraft = service.getDraftNote('draft-1')
      expect(conflictDraft?.syncStatus).toBe('conflict')
      expect(onConflict).toHaveBeenCalledTimes(1)
    })
  })

  describe('Scheduling Actions Queueing & Sync', () => {
    it('queues an appointment creation action and syncs when online', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'appt-123' } }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const action = await service.queueAppointmentAction({
        actionType: 'create',
        patientId: 'pat-123',
        practitionerId: 'prac-456',
        start: '2026-09-01T10:00:00Z',
        end: '2026-09-01T10:50:00Z',
        reason: 'Therapy intake',
      })

      expect(action.actionType).toBe('create')
      expect(action.patientId).toBe('pat-123')
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/portal/v1/scheduling',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('queues an appointment cancellation action and syncs correctly', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const action = await service.queueAppointmentAction({
        actionType: 'cancel',
        appointmentId: 'appt-123',
        patientId: 'pat-123',
        practitionerId: 'prac-456',
        cancelReason: 'Client unwell',
      })

      expect(action.appointmentId).toBe('appt-123')
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/portal/v1/scheduling/appt-123/cancel',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('queues an appointment reschedule action and syncs correctly', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const action = await service.queueAppointmentAction({
        actionType: 'reschedule',
        appointmentId: 'appt-123',
        patientId: 'pat-123',
        practitionerId: 'prac-456',
        start: '2026-09-02T14:00:00Z',
        end: '2026-09-02T14:50:00Z',
      })

      expect(action.actionType).toBe('reschedule')
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/portal/v1/scheduling/appt-123/reschedule',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('Messaging Queueing & Sync', () => {
    it('queues a new message thread and syncs when online', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'thread-1' } }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const msg = await service.queueMessage({
        subject: 'Question regarding exercise',
        recipientReference: 'Practitioner/prac-1',
        senderReference: 'Patient/pat-1',
        body: 'Can I do the relaxation exercise before bed?',
      })

      expect(msg.subject).toBe('Question regarding exercise')
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/portal/v1/messaging',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('queues a message reply on an existing thread', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'thread-1' } }),
      })
      vi.stubGlobal('fetch', fetchMock)

      await service.queueMessage({
        threadId: 'thread-123',
        recipientReference: 'Practitioner/prac-1',
        senderReference: 'Patient/pat-1',
        body: 'Thank you for the reply!',
      })

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/portal/v1/messaging/thread-123',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('Outcome Submissions Queueing & Sync', () => {
    it('queues and syncs outcome measures like PHQ-9', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { id: 'resp-1' } }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const item = await service.queueOutcomeSubmission({
        questionnaireId: 'phq-9',
        patientId: 'pat-1',
        responses: { q1: 1, q2: 2, q3: 0, q4: 1, q5: 2, q6: 0, q7: 1, q8: 0, q9: 0 },
        totalScore: 7,
      })

      expect(item.totalScore).toBe(7)
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/portal/v1/outcomes',
        expect.objectContaining({ method: 'POST' }),
      )
    })
  })

  describe('Sync All and Offline Status', () => {
    it('skips sync when offline and preserves items in queue', async () => {
      service.setOnlineStatusForTesting(false)
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      await service.queueDraftNote({
        id: 'draft-offline',
        templateId: 'individual-therapy-progress',
        patientId: 'pat-1',
        authorId: 'prac-1',
        content: { text: 'Draft while offline' },
      })

      expect(fetchMock).not.toHaveBeenCalled()
      const status = service.getStatus()
      expect(status.isOnline).toBe(false)
      expect(status.pendingNotesCount).toBe(1)
      expect(status.totalPendingCount).toBe(1)
    })

    it('syncAll processes multiple queues and returns aggregate metrics', async () => {
      service.setOnlineStatusForTesting(false)

      await service.queueDraftNote({
        id: 'note-1',
        templateId: 'individual-therapy-progress',
        patientId: 'pat-1',
        authorId: 'prac-1',
        content: { text: 'Note 1' },
      })
      await service.queueMessage({
        recipientReference: 'Practitioner/prac-1',
        senderReference: 'Patient/pat-1',
        body: 'Offline message',
      })

      service.setOnlineStatusForTesting(true)
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      })
      vi.stubGlobal('fetch', fetchMock)

      const result = await service.syncAll()
      expect(result.syncedCount).toBe(2)
      expect(result.failedCount).toBe(0)
      expect(result.conflictCount).toBe(0)
    })
  })

  describe('HIPAA Session Purge Guardrail', () => {
    it('immediately purges all drafts, queued actions, messages, and persistent storage on session logout', async () => {
      service.setOnlineStatusForTesting(false)

      await service.queueDraftNote({
        id: 'draft-sensitive',
        templateId: 'individual-therapy-progress',
        patientId: 'pat-secret',
        authorId: 'prac-1',
        content: { clinical_details: 'Confidential clinical info' },
      })
      await service.queueMessage({
        recipientReference: 'Practitioner/prac-1',
        senderReference: 'Patient/pat-secret',
        body: 'Sensitive medical query',
      })

      expect(service.getStatus().totalPendingCount).toBe(2)

      // Invoke session clear
      await service.clearSessionData()

      const statusAfter = service.getStatus()
      expect(statusAfter.totalPendingCount).toBe(0)
      expect(statusAfter.pendingNotesCount).toBe(0)
      expect(statusAfter.pendingMessagesCount).toBe(0)
      expect(service.getDraftNote('draft-sensitive')).toBeUndefined()
    })
  })

  describe('Storage Persistence & Initialization', () => {
    it('restores cached items on initialize()', async () => {
      await mockStorage.setItem(
        'draft_notes',
        JSON.stringify([
          {
            id: 'restored-1',
            templateId: 'individual-therapy-progress',
            patientId: 'pat-1',
            authorId: 'prac-1',
            content: { text: 'Restored' },
            docStatus: 'preliminary',
            version: 1,
            clientCreatedAt: '2026-08-28T00:00:00Z',
            clientUpdatedAt: '2026-08-28T00:00:00Z',
            syncStatus: 'pending',
          },
        ]),
      )

      const newService = new OfflineSyncService(mockStorage)
      await newService.initialize()

      expect(newService.getDraftNote('restored-1')).toBeDefined()
      expect(newService.getDraftNote('restored-1')?.content.text).toBe('Restored')
    })
  })
})

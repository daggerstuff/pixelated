/* @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies before importing the module under test.
// All paths resolve relative to this test file:
//   src/lib/services/patient-rights/__tests__/dataPortabilityService.test.ts
//   ../ → patient-rights/, ../../ → services/, ../../../ → lib/, ../../../../ → src/
vi.mock('../../../../db/mongoClient', () => {
  const collectionMock = {
    find: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue([]),
    }),
  }
  return {
    default: {
      get db() {
        return {
          collection: vi.fn().mockReturnValue(collectionMock),
        }
      },
    },
  }
})

vi.mock('../../../../services/mongodb.dao', () => ({
  dataExportDAO: {
    create: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findAll: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(undefined),
    addFile: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../../../db', () => ({
  userManager: {
    getUserById: vi.fn().mockResolvedValue(null),
  },
}))

vi.mock('../../../db/ai', () => ({
  aiRepository: {
    isTherapistForClient: vi.fn().mockResolvedValue(false),
  },
}))

vi.mock('../../../audit', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AuditEventType: { SECURITY: 'SECURITY', ACCESS: 'ACCESS' },
}))

vi.mock('../../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('uuid', () => ({
  v4: vi.fn().mockReturnValue('test-uuid-1234'),
}))

import { dataExportDAO } from '../../mongodb.dao'
import { createAuditLog } from '../../../audit'
import { userManager } from '../../../db'
import { aiRepository } from '../../../db/ai'
import {
  createDataExportRequest,
  getDataExportDetails,
  getDataExportRequest,
  cancelDataExportRequest,
  downloadDataExport,
} from '../dataPortabilityService'

// Typed mock objects: avoids unbound-method lint on expect(mock.method) assertions
const mockedUserManager = userManager as unknown as {
  getUserById: ReturnType<typeof vi.fn>
}
const mockedAiRepository = aiRepository as unknown as {
  isTherapistForClient: ReturnType<typeof vi.fn>
}
const mockedDataExportDAO = dataExportDAO as unknown as {
  create: ReturnType<typeof vi.fn>
  findById: ReturnType<typeof vi.fn>
  findAll: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  addFile: ReturnType<typeof vi.fn>
}
const mockedCreateAuditLog = createAuditLog as unknown as ReturnType<
  typeof vi.fn
>

function makeExportInput(overrides: Record<string, unknown> = {}) {
  return {
    patientId: 'patient-001',
    formats: ['json'] as string[],
    dataTypes: ['demographics'],
    reason: 'patient request',
    priority: 'normal' as string,
    requestedBy: 'user-001',
    ...overrides,
  }
}

describe('dataPortabilityService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── verifyPatientDataAccess (via createDataExportRequest) ──

  describe('access control (verifyPatientDataAccess)', () => {
    it('allows admin to export any patient data', async () => {
      mockedUserManager.getUserById.mockResolvedValue({
        id: 'user-001',
        role: 'admin',
      } as any)

      const result = await createDataExportRequest(makeExportInput() as any)

      expect(result.success).toBe(true)
      expect(result.exportId).toBe('test-uuid-1234')
      expect(mockedDataExportDAO.create).toHaveBeenCalledOnce()
    })

    it('allows patient to export own data', async () => {
      mockedUserManager.getUserById.mockResolvedValue({
        id: 'patient-001',
        role: 'patient',
      } as any)

      const result = await createDataExportRequest(
        makeExportInput({ requestedBy: 'patient-001' }) as any,
      )

      expect(result.success).toBe(true)
    })

    it('denies patient from exporting another patient data', async () => {
      mockedUserManager.getUserById.mockResolvedValue({
        id: 'user-002',
        role: 'patient',
      } as any)

      const result = await createDataExportRequest(makeExportInput() as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('unauthorized')
    })

    it('allows therapist to export assigned patient data', async () => {
      mockedUserManager.getUserById.mockResolvedValue({
        id: 'therapist-001',
        role: 'therapist',
      } as any)
      mockedAiRepository.isTherapistForClient.mockResolvedValue(true)

      const result = await createDataExportRequest(
        makeExportInput({ requestedBy: 'therapist-001' }) as any,
      )

      expect(result.success).toBe(true)
      expect(mockedAiRepository.isTherapistForClient).toHaveBeenCalledWith(
        'therapist-001',
        'patient-001',
      )
    })

    it('denies therapist for unassigned patient', async () => {
      mockedUserManager.getUserById.mockResolvedValue({
        id: 'therapist-001',
        role: 'therapist',
      } as any)
      mockedAiRepository.isTherapistForClient.mockResolvedValue(false)

      const result = await createDataExportRequest(
        makeExportInput({ requestedBy: 'therapist-001' }) as any,
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('unauthorized')
    })

    it('denies unknown role', async () => {
      mockedUserManager.getUserById.mockResolvedValue({
        id: 'user-001',
        role: 'guest',
      } as any)

      const result = await createDataExportRequest(makeExportInput() as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('unauthorized')
    })

    it('denies non-existent user', async () => {
      mockedUserManager.getUserById.mockResolvedValue(null)

      const result = await createDataExportRequest(makeExportInput() as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('not_found')
    })
  })

  // ── cancelDataExportRequest ──

  describe('cancelDataExportRequest', () => {
    it('cancels a pending export and stores cancelled status', async () => {
      mockedDataExportDAO.findById.mockResolvedValue({
        id: 'export-001',
        patientId: 'patient-001',
        requestedBy: 'user-001',
        status: 'pending',
        createdAt: new Date(),
      } as any)

      const result = await cancelDataExportRequest({
        exportId: 'export-001',
        cancelledBy: 'user-001',
        reason: 'no longer needed',
      })

      expect(result.success).toBe(true)
      expect(result.status).toBe('cancelled')
      // The critical fix: update must be called with 'cancelled', not 'failed'
      expect(mockedDataExportDAO.update).toHaveBeenCalledWith(
        'export-001',
        expect.objectContaining({ status: 'cancelled' }),
      )
      expect(mockedDataExportDAO.update).not.toHaveBeenCalledWith(
        'export-001',
        expect.objectContaining({ status: 'failed' }),
      )
      expect(mockedCreateAuditLog).toHaveBeenCalledOnce()
    })

    it('refuses to cancel a completed export', async () => {
      mockedDataExportDAO.findById.mockResolvedValue({
        id: 'export-001',
        patientId: 'patient-001',
        requestedBy: 'user-001',
        status: 'completed',
        createdAt: new Date(),
      } as any)

      const result = await cancelDataExportRequest({
        exportId: 'export-001',
        cancelledBy: 'user-001',
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('already completed')
    })

    it('refuses to cancel a failed export', async () => {
      mockedDataExportDAO.findById.mockResolvedValue({
        id: 'export-001',
        patientId: 'patient-001',
        requestedBy: 'user-001',
        status: 'failed',
        createdAt: new Date(),
      } as any)

      const result = await cancelDataExportRequest({
        exportId: 'export-001',
        cancelledBy: 'user-001',
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('already failed')
    })

    it('returns not-found for missing export', async () => {
      mockedDataExportDAO.findById.mockResolvedValue(null)

      const result = await cancelDataExportRequest({
        exportId: 'missing-id',
        cancelledBy: 'user-001',
      })

      expect(result.success).toBe(false)
      expect(result.message).toContain('not found')
    })
  })

  // ── getDataExportDetails ──

  describe('getDataExportDetails', () => {
    it('returns export details for the initiator', async () => {
      const now = new Date()
      mockedDataExportDAO.findById.mockResolvedValue({
        id: 'export-001',
        patientId: 'patient-001',
        requestedBy: 'user-001',
        status: 'completed',
        formats: ['json'],
        dataTypes: ['demographics'],
        priority: 'normal',
        createdAt: now,
        completedAt: now,
        files: [],
      } as any)

      const result = await getDataExportDetails('export-001', 'user-001')

      expect(result.success).toBe(true)
      expect(result.status).toBe('completed')
      expect(result.progress).toBe(100)
    })

    it('denies non-initiator', async () => {
      mockedDataExportDAO.findById.mockResolvedValue({
        id: 'export-001',
        patientId: 'patient-001',
        requestedBy: 'user-001',
        status: 'pending',
        formats: ['json'],
        dataTypes: [],
        priority: 'normal',
        createdAt: new Date(),
      } as any)

      const result = await getDataExportDetails('export-001', 'other-user')

      expect(result.success).toBe(false)
      expect(result.error).toBe('unauthorized')
    })

    it('returns not-found for missing export', async () => {
      mockedDataExportDAO.findById.mockResolvedValue(null)

      const result = await getDataExportDetails('missing', 'user-001')

      expect(result.success).toBe(false)
      expect(result.error).toBe('not_found')
    })
  })

  // ── downloadDataExport ──

  describe('downloadDataExport', () => {
    const fileContent = Buffer.from(
      JSON.stringify({ patient_profiles: [] }, null, 2),
    ).toString('base64')

    it('returns file content for authorized completed export', async () => {
      mockedUserManager.getUserById.mockResolvedValue({
        id: 'patient-001',
        role: 'patient',
      } as any)
      mockedDataExportDAO.findById.mockResolvedValue({
        id: 'export-001',
        patientId: 'patient-001',
        requestedBy: 'patient-001',
        status: 'completed',
        formats: ['json'],
        dataTypes: ['demographics'],
        createdAt: new Date(),
        completedAt: new Date(),
        files: [
          {
            id: 'file-001',
            exportId: 'export-001',
            format: 'json',
            dataType: 'demographics',
            url: '',
            size: fileContent.length,
            createdAt: new Date(),
            content: fileContent,
          },
        ],
      } as any)

      const result = await downloadDataExport(
        'export-001',
        'patient-001',
        'json',
      )

      expect(result.success).toBe(true)
      expect(result.format).toBe('json')
      expect(result.fileData).toBeDefined()
      expect(result.filename).toContain('.json')
      expect(mockedCreateAuditLog).toHaveBeenCalledOnce()
    })

    it('denies unauthorized user', async () => {
      mockedUserManager.getUserById.mockResolvedValue({
        id: 'other-patient',
        role: 'patient',
      } as any)
      mockedDataExportDAO.findById.mockResolvedValue({
        id: 'export-001',
        patientId: 'patient-001',
        requestedBy: 'patient-001',
        status: 'completed',
        formats: ['json'],
        dataTypes: [],
        createdAt: new Date(),
        completedAt: new Date(),
        files: [],
      } as any)

      const result = await downloadDataExport('export-001', 'other-patient')

      expect(result.success).toBe(false)
      expect(result.error).toBe('unauthorized')
    })

    it('returns not_ready for incomplete export', async () => {
      mockedUserManager.getUserById.mockResolvedValue({
        id: 'patient-001',
        role: 'patient',
      } as any)
      mockedDataExportDAO.findById.mockResolvedValue({
        id: 'export-001',
        patientId: 'patient-001',
        requestedBy: 'patient-001',
        status: 'processing',
        formats: ['json'],
        dataTypes: [],
        createdAt: new Date(),
        files: [],
      } as any)

      const result = await downloadDataExport('export-001', 'patient-001')

      expect(result.success).toBe(false)
      expect(result.error).toBe('not_ready')
    })

    it('returns not_found when no matching file exists', async () => {
      mockedUserManager.getUserById.mockResolvedValue({
        id: 'patient-001',
        role: 'patient',
      } as any)
      mockedDataExportDAO.findById.mockResolvedValue({
        id: 'export-001',
        patientId: 'patient-001',
        requestedBy: 'patient-001',
        status: 'completed',
        formats: ['json'],
        dataTypes: [],
        createdAt: new Date(),
        completedAt: new Date(),
        files: [],
      } as any)

      const result = await downloadDataExport(
        'export-001',
        'patient-001',
        'csv',
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('not_found')
    })
  })

  // ── getDataExportRequest ──

  describe('getDataExportRequest', () => {
    it('returns the export request when found', async () => {
      mockedDataExportDAO.findById.mockResolvedValue({
        id: 'export-001',
        patientId: 'patient-001',
        status: 'pending',
      } as any)

      const result = await getDataExportRequest('export-001')

      expect(result).not.toBeNull()
      expect(result?.id).toBe('export-001')
    })

    it('returns null when not found', async () => {
      mockedDataExportDAO.findById.mockResolvedValue(null)

      const result = await getDataExportRequest('missing')

      expect(result).toBeNull()
    })
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AuditEventType } from '../../../audit/events'
import { EHRAuditAction } from '../../audit/events'
import { ehrActionToEventType } from '../../audit/events'
import type { EPrescribingAdapter } from '../../integrations/e-prescribing/adapter'
import type {
  ControlledSubstanceCheckResult,
  MedicationInfo,
  PrescriptionStatusResponse,
} from '../../integrations/e-prescribing/types'
import {
  EPrescribeAuditWriteError,
  EPrescribingOrchestrationService,
} from '../eprescribing.service'

const { mockAuditService, mockConsentService } = vi.hoisted(() => ({
  mockAuditService: {
    logEPrescribeControlledSubstanceCheck: vi.fn(async () => 'audit-id'),
    logEPrescribePrescriptionStatusCheck: vi.fn(async () => 'audit-id'),
  },
  mockConsentService: {
    hasActiveConsent: vi.fn(async () => true),
  },
}))

vi.mock('../../audit/ehr-audit-service', () => ({
  EHRAuditService: {
    getInstance: () => mockAuditService,
  },
}))

vi.mock('../../../security/consent/ConsentService', () => ({
  consentService: mockConsentService,
}))

const MEDICATION: MedicationInfo = {
  code: '1043400',
  name: 'Test controlled medication',
  schedule: 'II',
  prescriberNPI: '1234567890',
}

const CONTROLLED_RESULT: ControlledSubstanceCheckResult = {
  allowed: true,
  pdmpChecked: true,
  epcsRequired: true,
}

const STATUS_RESULT: PrescriptionStatusResponse = {
  transmissionId: 'RX-001',
  status: 'transmitted',
  updatedAt: '2026-08-30T16:00:00.000Z',
}

function makeAdapter(
  overrides: Partial<EPrescribingAdapter> = {},
): EPrescribingAdapter {
  return {
    searchPharmacies: vi.fn(),
    checkControlledSubstance: vi.fn().mockResolvedValue(CONTROLLED_RESULT),
    checkDrugInteractions: vi.fn(),
    transmitPrescription: vi.fn(),
    checkPrescriptionStatus: vi.fn().mockResolvedValue(STATUS_RESULT),
    cancelPrescription: vi.fn(),
    ...overrides,
  }
}

describe('EPrescribingOrchestrationService audit actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('audits controlled-substance success and failure with the dedicated action', async () => {
    const service = new EPrescribingOrchestrationService({
      adapter: makeAdapter(),
    })
    await service.checkControlledSubstance(
      'user-001',
      MEDICATION,
      'patient-001',
      MEDICATION.prescriberNPI,
    )
    expect(
      mockAuditService.logEPrescribeControlledSubstanceCheck,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-001',
        patientId: 'patient-001',
        status: 'success',
        metadata: { allowed: true, epcsRequired: true },
      }),
    )

    const failingService = new EPrescribingOrchestrationService({
      adapter: makeAdapter({
        checkControlledSubstance: vi
          .fn()
          .mockRejectedValue(new Error('PDMP unavailable')),
      }),
    })
    await expect(
      failingService.checkControlledSubstance(
        'user-001',
        MEDICATION,
        'patient-001',
        MEDICATION.prescriberNPI,
      ),
    ).rejects.toThrow('PDMP unavailable')
    expect(
      mockAuditService.logEPrescribeControlledSubstanceCheck,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-001',
        patientId: 'patient-001',
        status: 'failure',
        errorMessage: 'PDMP unavailable',
      }),
    )
  })

  it('audits prescription-status success and failure with the dedicated action', async () => {
    const service = new EPrescribingOrchestrationService({
      adapter: makeAdapter(),
    })
    await service.checkPrescriptionStatus('user-001', 'patient-001', 'RX-001')
    expect(
      mockAuditService.logEPrescribePrescriptionStatusCheck,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-001',
        patientId: 'patient-001',
        status: 'success',
        metadata: { transmissionId: 'RX-001', status: 'transmitted' },
      }),
    )

    const failingService = new EPrescribingOrchestrationService({
      adapter: makeAdapter({
        checkPrescriptionStatus: vi
          .fn()
          .mockRejectedValue(new Error('status unavailable')),
      }),
    })
    await expect(
      failingService.checkPrescriptionStatus(
        'user-001',
        'patient-001',
        'RX-001',
      ),
    ).rejects.toThrow('status unavailable')
    expect(
      mockAuditService.logEPrescribePrescriptionStatusCheck,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-001',
        patientId: 'patient-001',
        status: 'failure',
        errorMessage: 'status unavailable',
      }),
    )
  })

  it('maps the status audit action to an access event', () => {
    expect(
      ehrActionToEventType(EHRAuditAction.EPRESCRIBE_PRESCRIPTION_STATUS_CHECK),
    ).toBe(AuditEventType.ACCESS)
  })

  it('waits for an audit write before resolving the operation', async () => {
    let resolveAudit: ((auditId: string) => void) | undefined
    const auditPromise = new Promise<string>((resolve) => {
      resolveAudit = resolve
    })
    const adapter = makeAdapter()
    const service = new EPrescribingOrchestrationService({ adapter })
    vi.mocked(
      mockAuditService.logEPrescribeControlledSubstanceCheck,
    ).mockImplementationOnce(() => auditPromise)

    const operation = service.checkControlledSubstance(
      'user-001',
      MEDICATION,
      'patient-001',
      MEDICATION.prescriberNPI,
    )
    await vi.waitFor(() => {
      expect(
        mockAuditService.logEPrescribeControlledSubstanceCheck,
      ).toHaveBeenCalledTimes(1)
    })

    expect(await Promise.race([operation, Promise.resolve('pending')])).toBe(
      'pending',
    )

    resolveAudit?.('audit-id')
    await expect(operation).resolves.toEqual(CONTROLLED_RESULT)
  })

  it('fails closed when the audit write rejects', async () => {
    const adapter = makeAdapter()
    const service = new EPrescribingOrchestrationService({ adapter })
    vi.mocked(
      mockAuditService.logEPrescribeControlledSubstanceCheck,
    ).mockRejectedValueOnce(new Error('audit unavailable'))

    let auditWriteError: unknown
    try {
      await service.checkControlledSubstance(
        'user-001',
        MEDICATION,
        'patient-001',
        MEDICATION.prescriberNPI,
      )
    } catch (error) {
      auditWriteError = error
    }

    expect(auditWriteError).toBeInstanceOf(EPrescribeAuditWriteError)
    if (auditWriteError instanceof EPrescribeAuditWriteError) {
      expect(auditWriteError.cause).toBeInstanceOf(Error)
      expect(auditWriteError.operationError).toBeUndefined()
    }
  })

  it('preserves the operation error when auditing a failure fails', async () => {
    const adapter = makeAdapter({
      checkControlledSubstance: vi
        .fn()
        .mockRejectedValue(new Error('PDMP unavailable')),
    })
    const service = new EPrescribingOrchestrationService({ adapter })
    vi.mocked(
      mockAuditService.logEPrescribeControlledSubstanceCheck,
    ).mockRejectedValueOnce(new Error('audit unavailable'))

    let auditWriteError: unknown
    try {
      await service.checkControlledSubstance(
        'user-001',
        MEDICATION,
        'patient-001',
        MEDICATION.prescriberNPI,
      )
    } catch (error) {
      auditWriteError = error
    }

    expect(auditWriteError).toBeInstanceOf(EPrescribeAuditWriteError)
    if (auditWriteError instanceof EPrescribeAuditWriteError) {
      const operationError = auditWriteError.operationError
      expect(operationError).toBeInstanceOf(Error)
      if (operationError instanceof Error) {
        expect(operationError.message).toBe('PDMP unavailable')
      }
    }
  })
})

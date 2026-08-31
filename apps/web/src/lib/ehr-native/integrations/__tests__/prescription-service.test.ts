/**
 * Tests for PrescriptionService — e-prescribing domain service.
 *
 * Focus: transmission safety-gate behavior, especially controlled substance
 * schedule inference (known codes, unknown codes defaulting to non-controlled,
 * missing codes failing closed) and DEA requirements.
 *
 * @vitest-environment node
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import type { EPrescribingAdapter } from '../adapter'
import type {
  ControlledSubstanceCheckResult,
  DrugInteractionCheckResponse,
  PrescriptionTransmissionResponse,
} from '../types'
import { PrescriptionService } from '../e-prescribing/prescription-service'
import type { MedicationRequest } from '../../../types/medication-request'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PHARMACY = {
  ncpdpId: 'PHARM-001',
  name: 'Central Pharmacy',
  address: ['123 Main St'],
  city: 'Springfield',
  state: 'IL',
  zipCode: '62701',
  phone: '217-555-0100',
  type: 'retail' as const,
}

const PRESCRIBER = {
  npi: '1234567890',
  name: 'Dr. Test',
  deaNumber: 'AB1234563',
}

const PRESCRIBER_NO_DEA = {
  npi: '1234567890',
  name: 'Dr. Test',
}

function makeMedicationRequest(
  code?: string,
  overrides: Partial<MedicationRequest> = {},
): MedicationRequest {
  return {
    resourceType: 'MedicationRequest',
    status: 'active',
    intent: 'order',
    subject: { reference: 'Patient/patient-001' },
    ...(code !== undefined
      ? {
          medicationCodeableConcept: {
            coding: [
              { system: 'http://www.nlm.nih.gov/research/rxnorm', code },
            ],
            text: 'Test medication',
          },
        }
      : {}),
    ...overrides,
  } as MedicationRequest
}

const TRANSMIT_RESPONSE: PrescriptionTransmissionResponse = {
  transmissionId: 'RX-test-1',
  status: 'transmitted',
  transmittedAt: '2026-08-30T16:00:00.000Z',
}

const NO_INTERACTIONS: DrugInteractionCheckResponse = {
  hasInteractions: false,
  alerts: [],
}

function makeAdapter(
  controlledResult: ControlledSubstanceCheckResult,
): EPrescribingAdapter {
  return {
    searchPharmacies: vi.fn(),
    checkControlledSubstance: vi.fn().mockResolvedValue(controlledResult),
    checkDrugInteractions: vi.fn().mockResolvedValue(NO_INTERACTIONS),
    transmitPrescription: vi.fn().mockResolvedValue(TRANSMIT_RESPONSE),
    checkPrescriptionStatus: vi.fn(),
    cancelPrescription: vi.fn(),
  }
}

const ALLOWED = {
  allowed: true,
  pdmpChecked: false,
  epcsRequired: false,
} as const

const BLOCKED = {
  allowed: false,
  reason: 'DEA number required for controlled substance prescribing',
  pdmpChecked: false,
  epcsRequired: true,
} as const

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PrescriptionService.transmitPrescription', () => {
  let service: PrescriptionService
  let adapter: EPrescribingAdapter

  beforeEach(() => {
    adapter = makeAdapter(ALLOWED)
    service = new PrescriptionService(adapter)
  })

  describe('schedule inference', () => {
    it('treats unknown medication code (e.g. ibuprofen) as non-controlled and transmits', async () => {
      const result = await service.transmitPrescription(
        makeMedicationRequest('111111'), // not in known formulary
        PHARMACY,
        PRESCRIBER_NO_DEA,
      )
      expect(result).toEqual(TRANSMIT_RESPONSE)
      expect(adapter.checkControlledSubstance).toHaveBeenCalledWith(
        expect.objectContaining({
          medication: expect.objectContaining({
            code: '111111',
            schedule: 'non-controlled',
          }),
        }),
      )
    })

    it('treats known Schedule II code as controlled', async () => {
      await service.transmitPrescription(
        makeMedicationRequest('1043400'), // oxycodone
        PHARMACY,
        PRESCRIBER,
      )
      expect(adapter.checkControlledSubstance).toHaveBeenCalledWith(
        expect.objectContaining({
          medication: expect.objectContaining({ schedule: 'II' }),
        }),
      )
    })

    it('treats known Schedule IV code as controlled', async () => {
      await service.transmitPrescription(
        makeMedicationRequest('1043600'), // alprazolam
        PHARMACY,
        PRESCRIBER,
      )
      expect(adapter.checkControlledSubstance).toHaveBeenCalledWith(
        expect.objectContaining({
          medication: expect.objectContaining({ schedule: 'IV' }),
        }),
      )
    })

    it('throws (fail closed) when medication has no code', async () => {
      await expect(
        service.transmitPrescription(
          makeMedicationRequest(undefined),
          PHARMACY,
          PRESCRIBER,
        ),
      ).rejects.toThrow('Medication code is required')
      expect(adapter.transmitPrescription).not.toHaveBeenCalled()
    })
  })

  describe('controlled substance safety gate', () => {
    it('blocks transmission when controlled substance check disallows', async () => {
      const blockedAdapter = makeAdapter(BLOCKED)
      const blockedService = new PrescriptionService(blockedAdapter)

      await expect(
        blockedService.transmitPrescription(
          makeMedicationRequest('1043400'),
          PHARMACY,
          PRESCRIBER_NO_DEA,
        ),
      ).rejects.toThrow('Transmission blocked by controlled substance check')
      expect(blockedAdapter.transmitPrescription).not.toHaveBeenCalled()
    })

    it('passes deaNumber through to the controlled substance check', async () => {
      await service.transmitPrescription(
        makeMedicationRequest('1043400'),
        PHARMACY,
        PRESCRIBER,
      )
      expect(adapter.checkControlledSubstance).toHaveBeenCalledWith(
        expect.objectContaining({
          medication: expect.objectContaining({
            deaNumber: PRESCRIBER.deaNumber,
          }),
        }),
      )
    })
  })

  describe('patient ID normalization', () => {
    it('extracts bare patient ID from subject reference for safety checks', async () => {
      await service.transmitPrescription(
        makeMedicationRequest('1043400'),
        PHARMACY,
        PRESCRIBER,
      )
      expect(adapter.checkControlledSubstance).toHaveBeenCalledWith(
        expect.objectContaining({ patientId: 'patient-001' }),
      )
      expect(adapter.checkDrugInteractions).toHaveBeenCalledWith(
        expect.objectContaining({ patientId: 'patient-001' }),
      )
    })

    it('throws (fail closed) when subject reference is missing', async () => {
      await expect(
        service.transmitPrescription(
          makeMedicationRequest('1043400', { subject: undefined }),
          PHARMACY,
          PRESCRIBER,
        ),
      ).rejects.toThrow('MedicationRequest.subject.reference is required')
      expect(adapter.transmitPrescription).not.toHaveBeenCalled()
    })

    it('throws (fail closed) on malformed subject reference', async () => {
      await expect(
        service.transmitPrescription(
          makeMedicationRequest('1043400', {
            subject: { reference: 'patient-001' },
          }),
          PHARMACY,
          PRESCRIBER,
        ),
      ).rejects.toThrow('Invalid subject reference: patient-001')
      expect(adapter.transmitPrescription).not.toHaveBeenCalled()
    })
  })

  describe('drug interaction safety gate', () => {
    it('blocks transmission on a critical interaction', async () => {
      const adapterWithAlerts = {
        ...makeAdapter(ALLOWED),
        checkDrugInteractions: vi.fn().mockResolvedValue({
          hasInteractions: true,
          alerts: [
            {
              severity: 'critical' as const,
              description: 'Fatal risk when combined',
              interactingDrugs: ['A', 'B'],
            },
          ],
        }),
      } as EPrescribingAdapter
      const alertService = new PrescriptionService(adapterWithAlerts)

      await expect(
        alertService.transmitPrescription(
          makeMedicationRequest('111111'),
          PHARMACY,
          PRESCRIBER,
        ),
      ).rejects.toThrow('1 major/critical drug interaction(s)')
      expect(adapterWithAlerts.transmitPrescription).not.toHaveBeenCalled()
    })

    it('does not block on minor/moderate alerts', async () => {
      const adapterWithMinor = {
        ...makeAdapter(ALLOWED),
        checkDrugInteractions: vi.fn().mockResolvedValue({
          hasInteractions: true,
          alerts: [
            {
              severity: 'minor' as const,
              description: 'Take with food',
              interactingDrugs: ['A', 'C'],
            },
          ],
        }),
      } as EPrescribingAdapter
      const minorService = new PrescriptionService(adapterWithMinor)

      const result = await minorService.transmitPrescription(
        makeMedicationRequest('111111'),
        PHARMACY,
        PRESCRIBER,
      )
      expect(result).toEqual(TRANSMIT_RESPONSE)
    })
  })
})

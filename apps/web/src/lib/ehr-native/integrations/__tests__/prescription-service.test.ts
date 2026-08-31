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

import type { MedicationRequest } from '../../types/medication-request'
import type { EPrescribingAdapter } from '../e-prescribing/adapter'
import { PrescriptionService } from '../e-prescribing/prescription-service'
import type {
  ControlledSubstanceCheckResult,
  DrugInteractionCheckResponse,
  PrescriptionTransmissionResponse,
} from '../e-prescribing/types'

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
  }
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

/**
 * Adapter double with every method exposed as a typed vitest mock, so
 * assertions reference the mock values directly (keeps oxc unbound-method
 * quiet while preserving call-signature typing).
 */
type MockedEPrescribingAdapter = {
  [K in keyof EPrescribingAdapter]: ReturnType<
    typeof vi.fn<EPrescribingAdapter[K]>
  >
}

function makeAdapter(
  controlledResult: ControlledSubstanceCheckResult,
  overrides: Partial<MockedEPrescribingAdapter> = {},
): MockedEPrescribingAdapter {
  return {
    searchPharmacies: vi.fn(),
    checkControlledSubstance: vi.fn().mockResolvedValue(controlledResult),
    checkDrugInteractions: vi.fn().mockResolvedValue(NO_INTERACTIONS),
    transmitPrescription: vi.fn().mockResolvedValue(TRANSMIT_RESPONSE),
    checkPrescriptionStatus: vi.fn(),
    cancelPrescription: vi.fn(),
    ...overrides,
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
  let adapter: MockedEPrescribingAdapter

  beforeEach(() => {
    adapter = makeAdapter(ALLOWED)
    service = new PrescriptionService(adapter)
  })

  describe('schedule inference', () => {
    it('fails closed on unknown medication code pending manual verification', async () => {
      await expect(
        service.transmitPrescription(
          makeMedicationRequest('111111'), // not in known formulary
          PHARMACY,
          PRESCRIBER_NO_DEA,
        ),
      ).rejects.toThrow(
        "Unknown medication code '111111' - cannot infer controlled substance schedule; verification required",
      )
      expect(adapter.checkControlledSubstance).not.toHaveBeenCalled()
      expect(adapter.transmitPrescription).not.toHaveBeenCalled()
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
      const adapterWithAlerts = makeAdapter(ALLOWED, {
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
      })
      const alertService = new PrescriptionService(adapterWithAlerts)

      await expect(
        alertService.transmitPrescription(
          makeMedicationRequest('1043620'), // known code so schedule inference passes
          PHARMACY,
          PRESCRIBER,
        ),
      ).rejects.toThrow('1 major/critical drug interaction(s)')
      expect(adapterWithAlerts.transmitPrescription).not.toHaveBeenCalled()
    })

    it('does not block on minor/moderate alerts', async () => {
      const adapterWithMinor = makeAdapter(ALLOWED, {
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
      })
      const minorService = new PrescriptionService(adapterWithMinor)

      const result = await minorService.transmitPrescription(
        makeMedicationRequest('1043620'), // known code so schedule inference passes
        PHARMACY,
        PRESCRIBER,
      )
      expect(result).toEqual(TRANSMIT_RESPONSE)
    })
  })
})

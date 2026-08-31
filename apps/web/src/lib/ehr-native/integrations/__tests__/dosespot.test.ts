import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { medicationRequestSchema } from '../../types/medication-request'
import type {
  PharmacyInfo,
  PrescriptionTransmissionRequest,
} from '../e-prescribing/types'

const { secureSend } = vi.hoisted(() => ({
  secureSend: vi.fn(),
}))

vi.mock('../transport', () => ({
  secureEphiUrl: (url: string) => new URL(url),
  secureSend,
}))

import { DoseSpotAdapter } from '../e-prescribing/dosespot'

const pharmacy: PharmacyInfo = {
  ncpdpId: 'PHARM-001',
  name: 'Central Pharmacy',
  address: ['123 Main St'],
  city: 'Springfield',
  state: 'IL',
  zipCode: '62701',
  phone: '217-555-0100',
  type: 'retail',
}

const response = new Response(
  JSON.stringify({
    TransmissionId: 'RX-001',
    Status: 'sent',
    TransmittedAt: '2026-08-30T16:00:00.000Z',
  }),
  { status: 200, headers: { 'Content-Type': 'application/json' } },
)

function makeRequest(
  subject: PrescriptionTransmissionRequest['medicationRequest']['subject'],
): PrescriptionTransmissionRequest {
  return {
    medicationRequest: medicationRequestSchema.parse({
      resourceType: 'MedicationRequest',
      status: 'active',
      intent: 'order',
      subject,
      medicationCodeableConcept: {
        coding: [
          { system: 'http://www.nlm.nih.gov/research/rxnorm', code: '111111' },
        ],
        text: 'Test medication',
      },
    }),
    pharmacy,
    prescriber: {
      npi: '1234567890',
      name: 'Dr. Test',
    },
  }
}

describe('DoseSpotAdapter.transmitPrescription', () => {
  const adapter = new DoseSpotAdapter({
    apiKey: 'test-api-key',
    clinicKey: 'test-clinic-key',
    baseUrl: 'http://127.0.0.1',
  })

  beforeEach(() => {
    secureSend.mockResolvedValue(response)
  })

  afterEach(() => {
    secureSend.mockReset()
  })

  it('includes the patient ID from the medication request subject', async () => {
    await adapter.transmitPrescription(
      makeRequest({ reference: 'Patient/patient-001' }),
    )

    expect(secureSend).toHaveBeenCalledTimes(1)
    const [, options] = secureSend.mock.calls[0] ?? []
    expect(JSON.parse(String(options?.body))).toEqual(
      expect.objectContaining({
        patientId: 'patient-001',
        medicationRequest: expect.objectContaining({
          medicationCode: '111111',
          medicationName: 'Test medication',
        }),
      }),
    )
  })

  it('fails closed for an invalid patient reference', async () => {
    await expect(
      adapter.transmitPrescription(makeRequest({})),
    ).rejects.toThrow('Invalid MedicationRequest.subject.reference: missing')
    expect(secureSend).not.toHaveBeenCalled()
  })
})

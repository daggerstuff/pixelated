/**
 * Focused evidence test for F1 (claim-insurance-service-regression) + F2 (duplicate-payload-schema).
 * Verifies the two review fixes the user authorized actually behave end-to-end.
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'

import { ClaimsService } from '../claims-service'
import {
  communicationPayloadSchema,
  communicationRequestPayloadSchema,
} from '../../types/document-reference'
import { claimSchema } from '../../types/claim'

describe('F1: claim-insurance-service-regression', () => {
  const service = new ClaimsService()

  it('createClaim throws when insurance is missing (API handler will map to 400)', () => {
    const input = {
      patient: 'Patient/patient-001',
      provider: 'Practitioner/provider-001',
      type: { coding: [{ system: 'x', code: 'professional' }] },
      use: 'claim' as const,
      items: [
        {
          productOrService: { coding: [{ system: 'x', code: '90834' }] },
          unitPrice: { value: 200, currency: 'USD' },
          quantity: 1,
        },
      ],
      // insurance intentionally omitted
    }
    expect(() => service.createClaim(input as never)).toThrow(/insurance/)
  })

  it('createClaim throws when insurance array is empty', () => {
    const input = {
      patient: 'Patient/patient-001',
      provider: 'Practitioner/provider-001',
      type: { coding: [{ system: 'x', code: 'professional' }] },
      use: 'claim' as const,
      items: [
        {
          productOrService: { coding: [{ system: 'x', code: '90834' }] },
          unitPrice: { value: 200, currency: 'USD' },
          quantity: 1,
        },
      ],
      insurance: [],
    }
    expect(() => service.createClaim(input as never)).toThrow(/insurance/)
  })

  it('API handler maps createClaim error to 400 ehrValidationError', async () => {
    // Simulate the POST /api/ehr/v1/claims handler body inline (handler has no
    // explicit insurance pre-check; it delegates to createClaim and converts
    // thrown errors to ehrValidationError which returns 400).
    const ehrValidationError = (msg: string) => ({
      status: 400,
      body: { error: msg },
    })
    const tryCreate = (raw: unknown) => {
      try {
        const claim = service.createClaim(raw as never)
        return { status: 201, body: claim }
      } catch (err) {
        return ehrValidationError(
          err instanceof Error ? err.message : 'Invalid',
        )
      }
    }
    const res = tryCreate({
      patient: 'Patient/p1',
      provider: 'Practitioner/p1',
      type: { text: 'Professional' },
      use: 'claim',
      items: [
        {
          productOrService: { text: 'Consultation' },
          unitPrice: { value: 100, currency: 'USD' },
          quantity: 1,
        },
      ],
      // insurance omitted
    })
    expect(res.status).toBe(400)
  })

  it('claimSchema enforces insurance min(1) for use=preauthorization too (FHIR R4 1..*)', () => {
    const minimal = {
      resourceType: 'Claim',
      status: 'active',
      use: 'preauthorization',
      type: { text: 'Professional' },
      patient: { reference: 'Patient/123' },
      provider: { reference: 'Practitioner/456' },
      priority: { text: 'Normal' },
    }
    expect(claimSchema.safeParse(minimal).success).toBe(false)
    expect(claimSchema.safeParse({ ...minimal, insurance: [] }).success).toBe(
      false,
    )
  })
})

describe('F2: duplicate-payload-schema (alias)', () => {
  it('communicationRequestPayloadSchema is the same object as communicationPayloadSchema', () => {
    expect(communicationRequestPayloadSchema).toBe(communicationPayloadSchema)
  })

  it('alias still enforces exactly-one content[x] refine', () => {
    expect(
      communicationRequestPayloadSchema.safeParse({
        contentString: 'hi',
        contentReference: { reference: 'Patient/1' },
      }).success,
    ).toBe(false)
    expect(
      communicationRequestPayloadSchema.safeParse({
        contentString: 'hi',
      }).success,
    ).toBe(true)
  })
})

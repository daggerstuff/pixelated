/**
 * Tests for EHR Native Claims Service (F1.10)
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'

import { ClaimsService } from '../claims-service'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidClaimInput() {
  return {
    patient: 'Patient/patient-001',
    provider: 'Practitioner/provider-001',
    type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
    use: 'claim' as const,
    insurer: 'Organization/insurer-001',
    items: [
      {
        productOrService: { coding: [{ system: 'http://hl7.org/fhir/sid/cpt', code: '90834' }] },
        unitPrice: { value: 200, currency: 'USD' },
        quantity: 1,
      },
    ],
    diagnoses: [
      { sequence: 1, diagnosisCodeableConcept: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: 'F41.1' }] } },
    ],
    insurance: [
      { focal: true, coverage: 'Coverage/coverage-001' },
    ],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClaimsService', () => {
  const service = new ClaimsService()

  describe('createClaim', () => {
    it('creates a draft claim from valid input', () => {
      const claim = service.createClaim(makeValidClaimInput())
      expect(claim.status).toBe('draft')
      expect(claim.resourceType).toBe('Claim')
      expect(claim.use).toBe('claim')
      expect(claim.item).toHaveLength(1)
    })

    it('throws when items array is empty', () => {
      const input = makeValidClaimInput()
      input.items = []
      expect(() => service.createClaim(input)).toThrow('line item')
    })
  })

  describe('validateClaim', () => {
    it('validates a well-formed claim', () => {
      const claim = service.createClaim(makeValidClaimInput())
      const result = service.validateClaim(claim)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('rejects a claim with empty items', () => {
      const claim = service.createClaim(makeValidClaimInput())
      claim.item = []
      const result = service.validateClaim(claim)
      expect(result.valid).toBe(false)
    })
  })

  describe('calculateTotal', () => {
    it('calculates the total from item unit prices and quantities', () => {
      const claim = service.createClaim(makeValidClaimInput())
      const total = service.calculateTotal(claim)
      expect(total.value).toBe(200)
      expect(total.currency).toBe('USD')
    })

    it('sums multiple items', () => {
      const input = makeValidClaimInput()
      input.items.push(
        { productOrService: { coding: [{ system: 'http://hl7.org/fhir/sid/cpt', code: '90837' }] }, unitPrice: { value: 250, currency: 'USD' }, quantity: 1 },
        { productOrService: { coding: [{ system: 'http://hl7.org/fhir/sid/cpt', code: '90791' }] }, unitPrice: { value: 150, currency: 'USD' }, quantity: 2 },
      )
      const claim = service.createClaim(input)
      const total = service.calculateTotal(claim)
      expect(total.value).toBe(200 + 250 + 300)
    })
  })

  describe('validateStatusTransition', () => {
    it('allows draft → active', () => {
      expect(service.validateStatusTransition('draft', 'active').allowed).toBe(true)
    })

    it('allows active → cancelled', () => {
      expect(service.validateStatusTransition('active', 'cancelled').allowed).toBe(true)
    })

    it('allows active → entered-in-error', () => {
      expect(service.validateStatusTransition('active', 'entered-in-error').allowed).toBe(true)
    })

    it('allows draft → cancelled', () => {
      expect(service.validateStatusTransition('draft', 'cancelled').allowed).toBe(true)
    })

    it('disallows cancelled → active', () => {
      expect(service.validateStatusTransition('cancelled', 'active').allowed).toBe(false)
    })

    it('disallows entered-in-error → active', () => {
      expect(service.validateStatusTransition('entered-in-error', 'active').allowed).toBe(false)
    })
  })

  describe('updateStatus', () => {
    it('updates status when transition is valid', () => {
      const claim = service.createClaim(makeValidClaimInput())
      const updated = service.updateStatus(claim, 'active')
      expect(updated.status).toBe('active')
    })

    it('throws on invalid transition', () => {
      const claim = service.createClaim(makeValidClaimInput())
      const active = service.updateStatus(claim, 'active')
      expect(() => service.updateStatus(active, 'draft')).toThrow()
    })
  })

  describe('prepareForSubmission', () => {
    it('transitions a draft claim to active', () => {
      const claim = service.createClaim(makeValidClaimInput())
      const prepared = service.prepareForSubmission(claim)
      expect(prepared.status).toBe('active')
    })

    it('throws when claim is already active', () => {
      const claim = service.createClaim(makeValidClaimInput())
      const active = service.prepareForSubmission(claim)
      expect(() => service.prepareForSubmission(active)).toThrow()
    })

    it('throws when claim is cancelled', () => {
      const claim = service.createClaim(makeValidClaimInput())
      const cancelled = service.updateStatus(claim, 'cancelled')
      expect(() => service.prepareForSubmission(cancelled)).toThrow()
    })
  })
})

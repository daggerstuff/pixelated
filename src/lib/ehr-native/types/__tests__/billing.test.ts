import { describe, it, expect } from 'vitest'
import {
  claimSchema,
  claimResponseSchema,
  coverageSchema,
  explanationOfBenefitSchema,
} from '../index.js'

// ---------------------------------------------------------------------------
// Claim
// ---------------------------------------------------------------------------

describe('claimSchema', () => {
  const validClaim = {
    resourceType: 'Claim',
    status: 'active',
    use: 'claim',
    patient: { reference: 'Patient/123' },
    created: '2024-01-15',
    provider: { reference: 'Practitioner/456' },
    priority: { text: 'Normal' },
    insurance: [
      {
        sequence: 1,
        focal: true,
        coverage: { reference: 'Coverage/789' },
      },
    ],
  }

  it('validates a minimal claim with all required fields', () => {
    const result = claimSchema.parse(validClaim)
    expect(result.status).toBe('active')
  })
  it('validates a complete claim resource', () => {
    const result = claimSchema.parse({
      ...validClaim,
      id: 'claim-1',
      type: { text: 'Professional' },
      billablePeriod: { start: '2024-01-01', end: '2024-01-31' },
      insurer: { reference: 'Organization/ins' },
      payee: { type: { text: 'Provider' } },
      careTeam: [
        {
          sequence: 1,
          provider: { reference: 'Practitioner/456' },
        },
      ],
      diagnosis: [
        {
          sequence: 1,
          diagnosisCodeableConcept: { text: 'Hypertension' },
        },
      ],
      item: [
        {
          sequence: 1,
          productOrService: { text: 'Consultation' },
        },
      ],
      total: { value: 150.0, currency: 'USD' },
    })
    expect(result.total?.value).toBe(150.0)
  })
  it('rejects missing status', () => {
    const { status, ...rest } = validClaim
    expect(claimSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing use', () => {
    const { use, ...rest } = validClaim
    expect(claimSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing patient', () => {
    const { patient, ...rest } = validClaim
    expect(claimSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing created', () => {
    const { created, ...rest } = validClaim
    expect(claimSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing provider', () => {
    const { provider, ...rest } = validClaim
    expect(claimSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing priority', () => {
    const { priority, ...rest } = validClaim
    expect(claimSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing insurance', () => {
    const { insurance, ...rest } = validClaim
    expect(claimSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects empty insurance array (min 1)', () => {
    expect(
      claimSchema.safeParse({ ...validClaim, insurance: [] }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      claimSchema.safeParse({ ...validClaim, resourceType: 'Patient' }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      claimSchema.safeParse({ ...validClaim, status: 'invalid' }).success,
    ).toBe(false)
  })
  it('rejects invalid use enum', () => {
    expect(
      claimSchema.safeParse({ ...validClaim, use: 'invalid' }).success,
    ).toBe(false)
  })
  it('validates all status enum values', () => {
    for (const status of ['active', 'cancelled', 'draft', 'entered-in-error']) {
      expect(claimSchema.safeParse({ ...validClaim, status }).success).toBe(
        true,
      )
    }
  })
  it('validates all use enum values', () => {
    for (const use of ['claim', 'preauthorization', 'predetermination']) {
      expect(claimSchema.safeParse({ ...validClaim, use }).success).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// ClaimResponse
// ---------------------------------------------------------------------------

describe('claimResponseSchema', () => {
  const validClaimResponse = {
    resourceType: 'ClaimResponse',
    status: 'active',
    use: 'claim',
    patient: { reference: 'Patient/123' },
    created: '2024-01-15',
    insurer: { reference: 'Organization/ins' },
    outcome: 'complete',
  }

  it('validates a minimal claimResponse with all required fields', () => {
    const result = claimResponseSchema.parse(validClaimResponse)
    expect(result.status).toBe('active')
  })
  it('validates a complete claimResponse resource', () => {
    const result = claimResponseSchema.parse({
      ...validClaimResponse,
      id: 'claim-resp-1',
      type: { text: 'Professional' },
      disposition: 'Approved',
      preAuthRef: 'PREAUTH-123',
      total: [
        {
          category: { text: 'Submitted' },
          amount: { value: 150.0, currency: 'USD' },
        },
      ],
      payment: {
        type: { text: 'Complete' },
        amount: { value: 150.0, currency: 'USD' },
      },
      processNote: [{ text: 'All good' }],
    })
    expect(result.outcome).toBe('complete')
  })
  it('rejects missing status', () => {
    const { status, ...rest } = validClaimResponse
    expect(claimResponseSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing use', () => {
    const { use, ...rest } = validClaimResponse
    expect(claimResponseSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing patient', () => {
    const { patient, ...rest } = validClaimResponse
    expect(claimResponseSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing created', () => {
    const { created, ...rest } = validClaimResponse
    expect(claimResponseSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing insurer', () => {
    const { insurer, ...rest } = validClaimResponse
    expect(claimResponseSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing outcome', () => {
    const { outcome, ...rest } = validClaimResponse
    expect(claimResponseSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      claimResponseSchema.safeParse({
        ...validClaimResponse,
        resourceType: 'Patient',
      }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      claimResponseSchema.safeParse({
        ...validClaimResponse,
        status: 'invalid',
      }).success,
    ).toBe(false)
  })
  it('rejects invalid outcome enum', () => {
    expect(
      claimResponseSchema.safeParse({
        ...validClaimResponse,
        outcome: 'invalid',
      }).success,
    ).toBe(false)
  })
  it('validates all outcome enum values', () => {
    for (const outcome of ['queued', 'complete', 'error', 'partial']) {
      expect(
        claimResponseSchema.safeParse({ ...validClaimResponse, outcome })
          .success,
      ).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

describe('coverageSchema', () => {
  const validCoverage = {
    resourceType: 'Coverage',
    status: 'active',
    beneficiary: { reference: 'Patient/123' },
    payor: [{ reference: 'Organization/ins' }],
  }

  it('validates a minimal coverage with all required fields', () => {
    const result = coverageSchema.parse(validCoverage)
    expect(result.status).toBe('active')
  })
  it('validates a complete coverage resource', () => {
    const result = coverageSchema.parse({
      ...validCoverage,
      id: 'coverage-1',
      type: { text: 'Health Insurance' },
      policyHolder: { reference: 'Patient/123' },
      subscriber: { reference: 'Patient/123' },
      subscriberId: 'SUB-123',
      dependent: '01',
      relationship: { text: 'Self' },
      period: { start: '2024-01-01', end: '2024-12-31' },
      order: 1,
      network: 'PPO Network',
    })
    expect(result.payor?.length).toBe(1)
  })
  it('rejects missing status', () => {
    const { status, ...rest } = validCoverage
    expect(coverageSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing beneficiary', () => {
    const { beneficiary, ...rest } = validCoverage
    expect(coverageSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing payor', () => {
    const { payor, ...rest } = validCoverage
    expect(coverageSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects empty payor array (min 1)', () => {
    expect(
      coverageSchema.safeParse({ ...validCoverage, payor: [] }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      coverageSchema.safeParse({
        ...validCoverage,
        resourceType: 'Patient',
      }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      coverageSchema.safeParse({ ...validCoverage, status: 'invalid' }).success,
    ).toBe(false)
  })
  it('validates all status enum values', () => {
    for (const status of ['active', 'entered-in-error', 'draft', 'cancelled']) {
      expect(
        coverageSchema.safeParse({ ...validCoverage, status }).success,
      ).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// ExplanationOfBenefit
// ---------------------------------------------------------------------------

describe('explanationOfBenefitSchema', () => {
  const validEob = {
    resourceType: 'ExplanationOfBenefit',
    status: 'active',
    use: 'claim',
    patient: { reference: 'Patient/123' },
    created: '2024-01-15',
    insurer: { reference: 'Organization/ins' },
    provider: { reference: 'Practitioner/456' },
    outcome: 'complete',
    insurance: {
      focal: true,
      coverage: { reference: 'Coverage/789' },
    },
  }

  it('validates a minimal EOB with all required fields', () => {
    const result = explanationOfBenefitSchema.parse(validEob)
    expect(result.status).toBe('active')
  })
  it('validates a complete EOB resource', () => {
    const result = explanationOfBenefitSchema.parse({
      ...validEob,
      id: 'eob-1',
      type: { text: 'Professional' },
      billablePeriod: { start: '2024-01-01', end: '2024-01-31' },
      disposition: 'Approved',
      preAuthRef: ['PREAUTH-123'],
      total: [
        {
          category: { text: 'Submitted' },
          amount: { value: 150.0, currency: 'USD' },
        },
      ],
      payment: {
        type: { text: 'Complete' },
        amount: { value: 150.0, currency: 'USD' },
      },
      benefitBalance: [
        {
          category: { text: 'Medical' },
          financial: [
            {
              type: { text: 'Copay' },
              usedMoney: { value: 20.0, currency: 'USD' },
            },
          ],
        },
      ],
    })
    expect(result.outcome).toBe('complete')
  })
  it('rejects missing status', () => {
    const { status, ...rest } = validEob
    expect(explanationOfBenefitSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing use', () => {
    const { use, ...rest } = validEob
    expect(explanationOfBenefitSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing patient', () => {
    const { patient, ...rest } = validEob
    expect(explanationOfBenefitSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing created', () => {
    const { created, ...rest } = validEob
    expect(explanationOfBenefitSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing insurer', () => {
    const { insurer, ...rest } = validEob
    expect(explanationOfBenefitSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing provider', () => {
    const { provider, ...rest } = validEob
    expect(explanationOfBenefitSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing outcome', () => {
    const { outcome, ...rest } = validEob
    expect(explanationOfBenefitSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects missing insurance', () => {
    const { insurance, ...rest } = validEob
    expect(explanationOfBenefitSchema.safeParse(rest).success).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      explanationOfBenefitSchema.safeParse({
        ...validEob,
        resourceType: 'Patient',
      }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      explanationOfBenefitSchema.safeParse({
        ...validEob,
        status: 'invalid',
      }).success,
    ).toBe(false)
  })
  it('rejects invalid outcome enum', () => {
    expect(
      explanationOfBenefitSchema.safeParse({
        ...validEob,
        outcome: 'invalid',
      }).success,
    ).toBe(false)
  })
  it('validates all outcome enum values', () => {
    for (const outcome of ['queued', 'complete', 'error', 'partial']) {
      expect(
        explanationOfBenefitSchema.safeParse({ ...validEob, outcome }).success,
      ).toBe(true)
    }
  })
})

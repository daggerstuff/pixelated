/**
 * Tests for the FHIR R4 CarePlan Zod schema (F2.3 / PIX-4412)
 *
 * @vitest-environment node
 */

import { describe, it, expect } from 'vitest'

import { carePlanSchema } from '../care-plan'
import {
  ehrResourceSchema,
  validateEHRResource,
  safeValidateEHRResource,
} from '../index'

// ---------------------------------------------------------------------------
// Minimal valid CarePlan fixture
// ---------------------------------------------------------------------------

const validCarePlan = {
  resourceType: 'CarePlan',
  status: 'active',
  intent: 'plan',
  subject: {
    reference: 'Patient/example',
  },
}

const fullCarePlan = {
  ...validCarePlan,
  id: 'careplan-1',
  identifier: [{ system: 'urn:ietf:rfc:3986', value: 'plan-001' }],
  instantiatesCanonical: ['PlanDefinition/example'],
  instantiatesUri: ['http://example.com/plan'],
  basedOn: [{ reference: 'CarePlan/base' }],
  replaces: [{ reference: 'CarePlan/old' }],
  partOf: [{ reference: 'CarePlan/parent' }],
  category: [{ text: 'Behavioral health' }],
  title: 'CBT Treatment Plan',
  description: '16-week CBT protocol for major depressive disorder',
  encounter: { reference: 'Encounter/1' },
  period: { start: '2026-01-01', end: '2026-05-01' },
  created: '2026-01-01T00:00:00Z',
  author: { reference: 'Practitioner/1' },
  contributor: [{ reference: 'PractitionerRole/2' }],
  careTeam: [{ reference: 'CareTeam/1' }],
  addresses: [{ reference: 'Condition/depression' }],
  supportingInfo: [{ reference: 'Observation/phq9-1' }],
  goal: [{ reference: 'Goal/reduce-phq9' }],
  activity: [
    {
      outcomeCodeableConcept: [{ text: 'PHQ-9 score < 10' }],
      outcomeReference: [{ reference: 'Observation/phq9-final' }],
      progress: [
        {
          time: '2026-02-01',
          text: 'Patient reports reduced rumination.',
        },
      ],
      reference: { reference: 'ServiceRequest/cbt-session-1' },
      detail: {
        kind: 'ServiceRequest',
        code: { text: 'CBT session' },
        reasonCode: [{ text: 'Major depressive disorder' }],
        reasonReference: [{ reference: 'Condition/depression' }],
        goal: [{ reference: 'Goal/reduce-phq9' }],
        status: 'in-progress',
        statusReason: 'Patient improving',
        doNotPerform: false,
        scheduledString: 'Weekly',
        location: { reference: 'Location/office' },
        performer: [{ reference: 'Practitioner/1' }],
        dailyAmount: { value: 1, unit: 'session' },
        quantity: { value: 16, unit: 'sessions' },
        description: 'Weekly 50-minute CBT sessions',
      },
    },
  ],
  note: [
    {
      authorString: 'Dr. Lee',
      time: '2026-01-15',
      text: 'Plan discussed with patient and consented.',
    },
  ],
}

// ---------------------------------------------------------------------------
// carePlanSchema
// ---------------------------------------------------------------------------

describe('carePlanSchema', () => {
  it('parses a minimal valid CarePlan (required status, intent, subject)', () => {
    const result = carePlanSchema.safeParse(validCarePlan)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.resourceType).toBe('CarePlan')
      expect(result.data.status).toBe('active')
      expect(result.data.intent).toBe('plan')
      expect(result.data.subject.reference).toBe('Patient/example')
    }
  })

  it('parses a full CarePlan with every R4 field populated', () => {
    const result = carePlanSchema.safeParse(fullCarePlan)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.activity).toHaveLength(1)
      expect(result.data.activity?.[0]?.detail?.kind).toBe('ServiceRequest')
      expect(result.data.activity?.[0]?.detail?.status).toBe('in-progress')
      expect(result.data.activity?.[0]?.progress?.[0]?.text).toBe(
        'Patient reports reduced rumination.',
      )
      expect(result.data.note?.[0]?.authorString).toBe('Dr. Lee')
      expect(result.data.identifier?.[0]?.value).toBe('plan-001')
    }
  })

  it('rejects wrong resourceType', () => {
    const result = carePlanSchema.safeParse({
      ...validCarePlan,
      resourceType: 'Patient',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing required status', () => {
    const { status: _status, ...rest } = validCarePlan
    void _status
    const result = carePlanSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing required intent', () => {
    const { intent: _intent, ...rest } = validCarePlan
    void _intent
    const result = carePlanSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects missing required subject', () => {
    const { subject: _subject, ...rest } = validCarePlan
    void _subject
    const result = carePlanSchema.safeParse(rest)
    expect(result.success).toBe(false)
  })

  it('rejects invalid status enum', () => {
    const result = carePlanSchema.safeParse({
      ...validCarePlan,
      status: 'invalid-status',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid intent enum', () => {
    const result = carePlanSchema.safeParse({
      ...validCarePlan,
      intent: 'invalid-intent',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid status values', () => {
    const statuses = [
      'draft',
      'active',
      'on-hold',
      'revoked',
      'completed',
      'entered-in-error',
      'unknown',
    ]
    for (const status of statuses) {
      expect(
        carePlanSchema.safeParse({ ...validCarePlan, status }).success,
      ).toBe(true)
    }
  })

  it('accepts all valid intent values', () => {
    const intents = ['proposal', 'plan', 'order', 'option']
    for (const intent of intents) {
      expect(
        carePlanSchema.safeParse({ ...validCarePlan, intent }).success,
      ).toBe(true)
    }
  })

  it('rejects invalid activity.detail.kind enum', () => {
    const result = carePlanSchema.safeParse({
      ...validCarePlan,
      activity: [
        {
          detail: { kind: 'NotARealKind' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid activity.detail.status enum', () => {
    const result = carePlanSchema.safeParse({
      ...validCarePlan,
      activity: [
        {
          detail: { status: 'not-a-status' },
        },
      ],
    })
    expect(result.success).toBe(false)
  })

  // PIX-4412 follow-up: FHIR R4 cardinality 1..1 — detail.status is required
  // when detail is present. Pre-fix this was `.optional()` and parsed.
  it('rejects activity.detail with missing required status (FHIR R4 1..1)', () => {
    const result = carePlanSchema.safeParse({
      ...validCarePlan,
      activity: [
        {
          detail: { kind: 'ServiceRequest' },
        },
      ],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const statusIssue = result.error.issues.find(
        (issue) => issue.path.join('.') === 'activity.0.detail.status',
      )
      expect(statusIssue).toBeDefined()
      expect(['invalid_type', 'invalid_value']).toContain(statusIssue?.code)
    }
  })

  it('infers the CarePlan TypeScript type', () => {
    // Type-level assertion: carePlanSchema.parse returns CarePlan
    const parsed = carePlanSchema.parse(validCarePlan)
    // If this compiles, the inferred type works; the runtime assertion follows
    expect(parsed.resourceType).toBe('CarePlan')
    expect(parsed.status).toBe('active')
  })
})

// ---------------------------------------------------------------------------
// Discriminated union integration
// ---------------------------------------------------------------------------

describe('carePlanSchema in ehrResourceSchema discriminated union', () => {
  it('ehrResourceSchema parses a valid CarePlan', () => {
    const result = ehrResourceSchema.safeParse(validCarePlan)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.resourceType).toBe('CarePlan')
    }
  })

  it('validateEHRResource returns CarePlan with resourceType', () => {
    const parsed = validateEHRResource(validCarePlan)
    expect(parsed.resourceType).toBe('CarePlan')
  })

  it('safeValidateEHRResource returns success for CarePlan', () => {
    const result = safeValidateEHRResource(validCarePlan)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.resourceType).toBe('CarePlan')
    }
  })

  it('routes CarePlan through the discriminator (not another resource)', () => {
    // Ensure the discriminated union actually picks carePlanSchema, not
    // accidentally a different schema that happens to accept the shape.
    const parsed = validateEHRResource(fullCarePlan)
    expect(parsed.resourceType).toBe('CarePlan')
    expect(parsed.title).toBe('CBT Treatment Plan')
    expect(parsed.activity?.[0]?.detail?.kind).toBe('ServiceRequest')
  })
})

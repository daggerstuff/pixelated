// @vitest-environment node
import { describe, it, expect } from 'vitest'

import { provenanceSchema, validateEHRResource } from '../index.js'

describe('FHIR R4 Provenance Resource Schema', () => {
  it('validates a valid Provenance resource for note co-signing', () => {
    const validProvenance = {
      resourceType: 'Provenance',
      id: 'prov-001',
      target: [{ reference: 'DocumentReference/doc-123' }],
      recorded: '2026-08-28T12:00:00.000Z',
      activity: {
        coding: [
          {
            system:
              'http://terminology.hl7.org/CodeSystem/v3-DocumentCompletion',
            code: 'AU',
            display: 'authenticated',
          },
        ],
        text: 'Clinical Note Co-Signature',
      },
      agent: [
        {
          type: {
            coding: [
              {
                system:
                  'http://terminology.hl7.org/CodeSystem/provenance-participant-type',
                code: 'verifier',
                display: 'Verifier / Co-signer',
              },
            ],
          },
          who: {
            reference: 'Practitioner/sup-456',
            display: 'Dr. Sarah Jenkins, PhD, Supervisor',
          },
        },
      ],
      signature: [
        {
          type: [
            {
              system: 'urn:iso-astm:E1762-95:2013',
              code: '1.2.840.10065.1.12.1.1',
              display: 'Author / Co-signer signature',
            },
          ],
          when: '2026-08-28T12:00:00.000Z',
          who: {
            reference: 'Practitioner/sup-456',
          },
          data: 'c3VwZXJ2aXNvci1kaWdpdGFsLXNpZ25hdHVyZQ==',
        },
      ],
    }

    const parsed = provenanceSchema.parse(validProvenance)
    expect(parsed.resourceType).toBe('Provenance')
    expect(parsed.target[0]?.reference).toBe('DocumentReference/doc-123')
    expect(parsed.agent[0]?.who.reference).toBe('Practitioner/sup-456')

    const validated = validateEHRResource(validProvenance)
    expect(validated.resourceType).toBe('Provenance')
  })

  it('rejects Provenance missing target', () => {
    const invalid = {
      resourceType: 'Provenance',
      recorded: '2026-08-28T12:00:00.000Z',
      target: [],
      agent: [
        {
          who: { reference: 'Practitioner/sup-456' },
        },
      ],
    }

    const result = provenanceSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects Provenance missing recorded instant', () => {
    const invalid = {
      resourceType: 'Provenance',
      target: [{ reference: 'DocumentReference/doc-123' }],
      agent: [
        {
          who: { reference: 'Practitioner/sup-456' },
        },
      ],
    }

    const result = provenanceSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects Provenance missing agent array', () => {
    const invalid = {
      resourceType: 'Provenance',
      target: [{ reference: 'DocumentReference/doc-123' }],
      recorded: '2026-08-28T12:00:00.000Z',
      agent: [],
    }

    const result = provenanceSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })
})

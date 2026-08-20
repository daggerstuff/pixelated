import { describe, it, expect } from 'vitest'

import {
  documentReferenceSchema,
  communicationSchema,
  communicationPayloadSchema,
  communicationRequestSchema,
  communicationRequestPayloadSchema,
} from '../index.js'

// ---------------------------------------------------------------------------
// DocumentReference
// ---------------------------------------------------------------------------

describe('documentReferenceSchema', () => {
  it('validates a minimal documentReference with status and content', () => {
    const result = documentReferenceSchema.parse({
      resourceType: 'DocumentReference',
      status: 'current',
      content: [
        {
          attachment: {
            contentType: 'application/pdf',
            url: 'https://example.com/doc.pdf',
          },
        },
      ],
    })
    expect(result.status).toBe('current')
  })
  it('validates a complete documentReference resource', () => {
    const result = documentReferenceSchema.parse({
      resourceType: 'DocumentReference',
      id: 'docref-1',
      masterIdentifier: { value: 'MASTER-123' },
      identifier: [{ value: 'DOC-123' }],
      status: 'current',
      docStatus: 'final',
      type: { text: 'Discharge Summary' },
      category: [{ text: 'Clinical Note' }],
      subject: { reference: 'Patient/123' },
      date: '2024-01-15T10:30:00Z',
      author: [{ reference: 'Practitioner/456' }],
      custodian: { reference: 'Organization/789' },
      description: 'Discharge summary for patient',
      content: [
        {
          attachment: {
            contentType: 'application/pdf',
            language: 'en',
            url: 'https://example.com/doc.pdf',
            title: 'Discharge Summary',
            creation: '2024-01-15',
          },
          format: {
            system: 'https://example.com/format',
            code: 'pdf',
            display: 'PDF',
          },
        },
      ],
      context: {
        encounter: { reference: 'Encounter/123' },
        period: { start: '2024-01-01', end: '2024-01-15' },
      },
    })
    expect(result.content?.length).toBe(1)
  })
  it('rejects missing status', () => {
    expect(
      documentReferenceSchema.safeParse({
        resourceType: 'DocumentReference',
        content: [{ attachment: { contentType: 'application/pdf' } }],
      }).success,
    ).toBe(false)
  })
  it('rejects missing content array', () => {
    expect(
      documentReferenceSchema.safeParse({
        resourceType: 'DocumentReference',
        status: 'current',
      }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      documentReferenceSchema.safeParse({
        resourceType: 'Patient',
        status: 'current',
        content: [{ attachment: {} }],
      }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      documentReferenceSchema.safeParse({
        resourceType: 'DocumentReference',
        status: 'invalid',
        content: [{ attachment: {} }],
      }).success,
    ).toBe(false)
  })
  it('rejects invalid docStatus enum', () => {
    expect(
      documentReferenceSchema.safeParse({
        resourceType: 'DocumentReference',
        status: 'current',
        docStatus: 'invalid',
        content: [{ attachment: {} }],
      }).success,
    ).toBe(false)
  })
  it('validates all status enum values', () => {
    for (const status of ['current', 'superseded', 'entered-in-error']) {
      expect(
        documentReferenceSchema.safeParse({
          resourceType: 'DocumentReference',
          status,
          content: [{ attachment: {} }],
        }).success,
      ).toBe(true)
    }
  })
  it('validates all docStatus enum values', () => {
    for (const docStatus of [
      'preliminary',
      'final',
      'amended',
      'entered-in-error',
    ]) {
      expect(
        documentReferenceSchema.safeParse({
          resourceType: 'DocumentReference',
          status: 'current',
          docStatus,
          content: [{ attachment: {} }],
        }).success,
      ).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Communication
// ---------------------------------------------------------------------------

describe('communicationSchema', () => {
  it('validates a minimal communication with status', () => {
    const result = communicationSchema.parse({
      resourceType: 'Communication',
      status: 'completed',
    })
    expect(result.status).toBe('completed')
  })
  it('validates a complete communication resource', () => {
    const result = communicationSchema.parse({
      resourceType: 'Communication',
      id: 'comm-1',
      status: 'completed',
      priority: 'urgent',
      subject: { reference: 'Patient/123' },
      sent: '2024-01-15T10:30:00Z',
      received: '2024-01-15T11:00:00Z',
      sender: { reference: 'Practitioner/456' },
      recipient: [{ reference: 'Patient/123' }],
      payload: [
        { contentString: 'Hello patient' },
        { contentReference: { reference: 'Observation/789' } },
      ],
    })
    expect(result.payload?.length).toBe(2)
  })
  it('rejects missing status', () => {
    expect(
      communicationSchema.safeParse({ resourceType: 'Communication' }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      communicationSchema.safeParse({
        resourceType: 'Patient',
        status: 'completed',
      }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      communicationSchema.safeParse({
        resourceType: 'Communication',
        status: 'invalid',
      }).success,
    ).toBe(false)
  })
  it('validates all status enum values', () => {
    for (const status of [
      'preparation',
      'in-progress',
      'not-done',
      'on-hold',
      'stopped',
      'completed',
      'entered-in-error',
      'unknown',
    ]) {
      expect(
        communicationSchema.safeParse({
          resourceType: 'Communication',
          status,
        }).success,
      ).toBe(true)
    }
  })
})

describe('communicationPayloadSchema refine', () => {
  it('validates payload with contentString', () => {
    expect(
      communicationPayloadSchema.safeParse({ contentString: 'hello' }).success,
    ).toBe(true)
  })
  it('validates payload with contentAttachment', () => {
    expect(
      communicationPayloadSchema.safeParse({
        contentAttachment: { contentType: 'text/plain' },
      }).success,
    ).toBe(true)
  })
  it('validates payload with contentReference', () => {
    expect(
      communicationPayloadSchema.safeParse({
        contentReference: { reference: 'Patient/123' },
      }).success,
    ).toBe(true)
  })
  it('rejects payload with no content field', () => {
    expect(communicationPayloadSchema.safeParse({}).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// CommunicationRequest
// ---------------------------------------------------------------------------

describe('communicationRequestSchema', () => {
  it('validates a minimal communicationRequest with status', () => {
    const result = communicationRequestSchema.parse({
      resourceType: 'CommunicationRequest',
      status: 'active',
    })
    expect(result.status).toBe('active')
  })
  it('validates a complete communicationRequest resource', () => {
    const result = communicationRequestSchema.parse({
      resourceType: 'CommunicationRequest',
      id: 'commreq-1',
      status: 'active',
      priority: 'urgent',
      subject: { reference: 'Patient/123' },
      authoredOn: '2024-01-15',
      requester: { reference: 'Practitioner/456' },
      recipient: [{ reference: 'Patient/123' }],
      payload: [{ contentString: 'Follow-up reminder' }],
      occurrenceDateTime: '2024-02-01',
    })
    expect(result.priority).toBe('urgent')
  })
  it('rejects missing status', () => {
    expect(
      communicationRequestSchema.safeParse({
        resourceType: 'CommunicationRequest',
      }).success,
    ).toBe(false)
  })
  it('rejects wrong resourceType', () => {
    expect(
      communicationRequestSchema.safeParse({
        resourceType: 'Patient',
        status: 'active',
      }).success,
    ).toBe(false)
  })
  it('rejects invalid status enum', () => {
    expect(
      communicationRequestSchema.safeParse({
        resourceType: 'CommunicationRequest',
        status: 'invalid',
      }).success,
    ).toBe(false)
  })
  it('validates all status enum values', () => {
    for (const status of [
      'draft',
      'active',
      'on-hold',
      'cancelled',
      'completed',
      'entered-in-error',
      'unknown',
    ]) {
      expect(
        communicationRequestSchema.safeParse({
          resourceType: 'CommunicationRequest',
          status,
        }).success,
      ).toBe(true)
    }
  })
})

describe('communicationRequestPayloadSchema refine', () => {
  it('validates payload with contentString', () => {
    expect(
      communicationRequestPayloadSchema.safeParse({
        contentString: 'hello',
      }).success,
    ).toBe(true)
  })
  it('validates payload with contentAttachment', () => {
    expect(
      communicationRequestPayloadSchema.safeParse({
        contentAttachment: { contentType: 'text/plain' },
      }).success,
    ).toBe(true)
  })
  it('validates payload with contentReference', () => {
    expect(
      communicationRequestPayloadSchema.safeParse({
        contentReference: { reference: 'Patient/123' },
      }).success,
    ).toBe(true)
  })
  it('rejects payload with no content field', () => {
    expect(communicationRequestPayloadSchema.safeParse({}).success).toBe(false)
  })
})

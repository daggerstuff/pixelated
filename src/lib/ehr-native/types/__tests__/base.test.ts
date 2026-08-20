import { describe, it, expect } from 'vitest'
import {
  fhirStringSchema,
  fhirCodeSchema,
  fhirIdSchema,
  fhirBooleanSchema,
  fhirIntegerSchema,
  fhirPositiveIntSchema,
  fhirDecimalSchema,
  fhirUriSchema,
  fhirUrlSchema,
  fhirCanonicalSchema,
  fhirUuidSchema,
  fhirDateSchema,
  fhirDateTimeSchema,
  fhirInstantSchema,
  fhirTimeSchema,
  fhirExtensionSchema,
  fhirNarrativeSchema,
  fhirCodingSchema,
  fhirCodeableConceptSchema,
  fhirIdentifierSchema,
  fhirPeriodSchema,
  fhirQuantitySchema,
  fhirRangeSchema,
  fhirRatioSchema,
  fhirMoneySchema,
  fhirReferenceSchema,
  fhirReferenceStringSchema,
  fhirMetaSchema,
  fhirBaseSchema,
  fhirContactPointSchema,
  fhirAddressSchema,
  fhirHumanNameSchema,
} from '../index.js'

// ---------------------------------------------------------------------------
// Primitive Types
// ---------------------------------------------------------------------------

describe('fhirStringSchema', () => {
  it('validates a valid string', () => {
    expect(fhirStringSchema.parse('hello world')).toBe('hello world')
  })
  it('validates an empty string', () => {
    expect(fhirStringSchema.parse('')).toBe('')
  })
  it('rejects a non-string', () => {
    expect(fhirStringSchema.safeParse(123).success).toBe(false)
  })
})

describe('fhirCodeSchema', () => {
  it('validates a simple code', () => {
    expect(fhirCodeSchema.parse('active')).toBe('active')
  })
  it('validates a code with hyphens and dots', () => {
    expect(fhirCodeSchema.parse('entered-in-error')).toBe('entered-in-error')
  })
  it('rejects a code with whitespace', () => {
    expect(fhirCodeSchema.safeParse('active code').success).toBe(false)
  })
  it('rejects a code with leading space', () => {
    expect(fhirCodeSchema.safeParse(' active').success).toBe(false)
  })
  it('rejects a code with trailing space', () => {
    expect(fhirCodeSchema.safeParse('active ').success).toBe(false)
  })
  it('rejects an empty string', () => {
    expect(fhirCodeSchema.safeParse('').success).toBe(false)
  })
  it('rejects a non-string', () => {
    expect(fhirCodeSchema.safeParse(123).success).toBe(false)
  })
})

describe('fhirIdSchema', () => {
  it('validates a simple id', () => {
    expect(fhirIdSchema.parse('abc123')).toBe('abc123')
  })
  it('validates a single character id', () => {
    expect(fhirIdSchema.parse('a')).toBe('a')
  })
  it('validates an id with hyphens and dots', () => {
    expect(fhirIdSchema.parse('patient-1.2')).toBe('patient-1.2')
  })
  it('validates a 64-character id', () => {
    const id = 'a'.repeat(64)
    expect(fhirIdSchema.parse(id)).toBe(id)
  })
  it('rejects a 65-character id', () => {
    expect(fhirIdSchema.safeParse('a'.repeat(65)).success).toBe(false)
  })
  it('rejects an empty string', () => {
    expect(fhirIdSchema.safeParse('').success).toBe(false)
  })
  it('rejects an id with underscores', () => {
    expect(fhirIdSchema.safeParse('abc_def').success).toBe(false)
  })
  it('rejects an id with spaces', () => {
    expect(fhirIdSchema.safeParse('abc def').success).toBe(false)
  })
  it('rejects a non-string', () => {
    expect(fhirIdSchema.safeParse(123).success).toBe(false)
  })
})

describe('fhirBooleanSchema', () => {
  it('validates true', () => {
    expect(fhirBooleanSchema.parse(true)).toBe(true)
  })
  it('validates false', () => {
    expect(fhirBooleanSchema.parse(false)).toBe(false)
  })
  it('rejects a non-boolean', () => {
    expect(fhirBooleanSchema.safeParse('true').success).toBe(false)
  })
})

describe('fhirIntegerSchema', () => {
  it('validates a positive integer', () => {
    expect(fhirIntegerSchema.parse(42)).toBe(42)
  })
  it('validates zero', () => {
    expect(fhirIntegerSchema.parse(0)).toBe(0)
  })
  it('validates a negative integer', () => {
    expect(fhirIntegerSchema.parse(-1)).toBe(-1)
  })
  it('rejects a float', () => {
    expect(fhirIntegerSchema.safeParse(1.5).success).toBe(false)
  })
  it('rejects a string', () => {
    expect(fhirIntegerSchema.safeParse('42').success).toBe(false)
  })
})

describe('fhirPositiveIntSchema', () => {
  it('validates a positive integer', () => {
    expect(fhirPositiveIntSchema.parse(1)).toBe(1)
  })
  it('validates a large positive integer', () => {
    expect(fhirPositiveIntSchema.parse(9999)).toBe(9999)
  })
  it('rejects zero', () => {
    expect(fhirPositiveIntSchema.safeParse(0).success).toBe(false)
  })
  it('rejects a negative integer', () => {
    expect(fhirPositiveIntSchema.safeParse(-1).success).toBe(false)
  })
  it('rejects a float', () => {
    expect(fhirPositiveIntSchema.safeParse(1.5).success).toBe(false)
  })
})

describe('fhirDecimalSchema', () => {
  it('validates an integer as decimal', () => {
    expect(fhirDecimalSchema.parse(42)).toBe(42)
  })
  it('validates a float', () => {
    expect(fhirDecimalSchema.parse(3.14)).toBe(3.14)
  })
  it('validates zero', () => {
    expect(fhirDecimalSchema.parse(0)).toBe(0)
  })
  it('rejects a string', () => {
    expect(fhirDecimalSchema.safeParse('3.14').success).toBe(false)
  })
})

describe('fhirUriSchema', () => {
  it('validates an https URL', () => {
    expect(fhirUriSchema.safeParse('https://example.com').success).toBe(true)
  })
  it('validates an http URL', () => {
    expect(fhirUriSchema.safeParse('http://hl7.org/fhir').success).toBe(true)
  })
  it('validates a urn:uuid URI', () => {
    expect(
      fhirUriSchema.safeParse('urn:uuid:550e8400-e29b-41d4-a716-446655440000')
        .success,
    ).toBe(true)
  })
  it('rejects a relative reference', () => {
    expect(fhirUriSchema.safeParse('Patient/123').success).toBe(false)
  })
  it('rejects a non-URL string', () => {
    expect(fhirUriSchema.safeParse('not-a-url').success).toBe(false)
  })
  it('rejects an empty string', () => {
    expect(fhirUriSchema.safeParse('').success).toBe(false)
  })
})

describe('fhirUrlSchema', () => {
  it('validates an https URL', () => {
    expect(fhirUrlSchema.safeParse('https://example.com').success).toBe(true)
  })
  it('validates an http URL', () => {
    expect(fhirUrlSchema.safeParse('http://hl7.org/fhir').success).toBe(true)
  })
  it('rejects a non-URL string', () => {
    expect(fhirUrlSchema.safeParse('not-a-url').success).toBe(false)
  })
})

describe('fhirCanonicalSchema', () => {
  it('validates a canonical URL', () => {
    expect(
      fhirCanonicalSchema.safeParse(
        'https://hl7.org/fhir/StructureDefinition/Patient',
      ).success,
    ).toBe(true)
  })
  it('rejects a non-URL string', () => {
    expect(fhirCanonicalSchema.safeParse('not-a-url').success).toBe(false)
  })
})

describe('fhirUuidSchema', () => {
  it('validates a valid UUID', () => {
    expect(
      fhirUuidSchema.safeParse('550e8400-e29b-41d4-a716-446655440000').success,
    ).toBe(true)
  })
  it('rejects an invalid UUID', () => {
    expect(fhirUuidSchema.safeParse('not-a-uuid').success).toBe(false)
  })
  it('rejects a truncated UUID', () => {
    expect(fhirUuidSchema.safeParse('550e8400-e29b-41d4-a716').success).toBe(
      false,
    )
  })
})

describe('fhirDateSchema', () => {
  it('validates YYYY format', () => {
    expect(fhirDateSchema.parse('2024')).toBe('2024')
  })
  it('validates YYYY-MM format', () => {
    expect(fhirDateSchema.parse('2024-01')).toBe('2024-01')
  })
  it('validates YYYY-MM-DD format', () => {
    expect(fhirDateSchema.parse('2024-01-15')).toBe('2024-01-15')
  })
  it('rejects YYYY-M format (single digit month)', () => {
    expect(fhirDateSchema.safeParse('2024-1').success).toBe(false)
  })
  it('rejects YYYY-MM-D format (single digit day)', () => {
    expect(fhirDateSchema.safeParse('2024-01-5').success).toBe(false)
  })
  it('rejects a datetime string', () => {
    expect(fhirDateSchema.safeParse('2024-01-15T10:30:00').success).toBe(false)
  })
  it('rejects an empty string', () => {
    expect(fhirDateSchema.safeParse('').success).toBe(false)
  })
})

describe('fhirDateTimeSchema', () => {
  it('validates YYYY format', () => {
    expect(fhirDateTimeSchema.parse('2024')).toBe('2024')
  })
  it('validates YYYY-MM format', () => {
    expect(fhirDateTimeSchema.parse('2024-01')).toBe('2024-01')
  })
  it('validates YYYY-MM-DD format', () => {
    expect(fhirDateTimeSchema.parse('2024-01-15')).toBe('2024-01-15')
  })
  it('validates full ISO datetime with Z', () => {
    expect(fhirDateTimeSchema.safeParse('2024-01-15T10:30:00Z').success).toBe(
      true,
    )
  })
  it('validates full ISO datetime with timezone offset', () => {
    expect(
      fhirDateTimeSchema.safeParse('2024-01-15T10:30:00+05:30').success,
    ).toBe(true)
  })
  it('validates full ISO datetime with milliseconds', () => {
    expect(
      fhirDateTimeSchema.safeParse('2024-01-15T10:30:00.123Z').success,
    ).toBe(true)
  })
  it('validates datetime without timezone', () => {
    expect(fhirDateTimeSchema.safeParse('2024-01-15T10:30:00').success).toBe(
      true,
    )
  })
  it('rejects an invalid format', () => {
    expect(fhirDateTimeSchema.safeParse('2024/01/15').success).toBe(false)
  })
})

describe('fhirInstantSchema', () => {
  it('validates full ISO datetime with Z', () => {
    expect(fhirInstantSchema.parse('2024-01-15T10:30:00Z')).toBe(
      '2024-01-15T10:30:00Z',
    )
  })
  it('validates full ISO datetime with timezone offset', () => {
    expect(fhirInstantSchema.parse('2024-01-15T10:30:00+05:30')).toBe(
      '2024-01-15T10:30:00+05:30',
    )
  })
  it('validates with milliseconds', () => {
    expect(fhirInstantSchema.parse('2024-01-15T10:30:00.123Z')).toBe(
      '2024-01-15T10:30:00.123Z',
    )
  })
  it('rejects datetime without timezone', () => {
    expect(fhirInstantSchema.safeParse('2024-01-15T10:30:00').success).toBe(
      false,
    )
  })
  it('rejects YYYY format', () => {
    expect(fhirInstantSchema.safeParse('2024').success).toBe(false)
  })
  it('rejects YYYY-MM-DD format', () => {
    expect(fhirInstantSchema.safeParse('2024-01-15').success).toBe(false)
  })
})

describe('fhirTimeSchema', () => {
  it('validates HH:MM:SS', () => {
    expect(fhirTimeSchema.parse('10:30:00')).toBe('10:30:00')
  })
  it('validates HH:MM:SS with milliseconds', () => {
    expect(fhirTimeSchema.parse('10:30:00.123')).toBe('10:30:00.123')
  })
  it('rejects HH:MM (missing seconds)', () => {
    expect(fhirTimeSchema.safeParse('10:30').success).toBe(false)
  })
  it('rejects an empty string', () => {
    expect(fhirTimeSchema.safeParse('').success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Complex Datatypes
// ---------------------------------------------------------------------------

describe('fhirExtensionSchema', () => {
  it('validates an extension with url only', () => {
    const result = fhirExtensionSchema.parse({
      url: 'https://example.com/extension',
    })
    expect(result.url).toBe('https://example.com/extension')
  })
  it('validates an extension with url and valueString', () => {
    const result = fhirExtensionSchema.parse({
      url: 'https://example.com/extension',
      valueString: 'some value',
    })
    expect(result.valueString).toBe('some value')
  })
  it('validates an extension with url and valueBoolean', () => {
    const result = fhirExtensionSchema.parse({
      url: 'https://example.com/extension',
      valueBoolean: true,
    })
    expect(result.valueBoolean).toBe(true)
  })
  it('rejects an extension without url', () => {
    expect(
      fhirExtensionSchema.safeParse({ valueString: 'hello' }).success,
    ).toBe(false)
  })
  it('rejects an extension with invalid url', () => {
    expect(fhirExtensionSchema.safeParse({ url: 'not-a-url' }).success).toBe(
      false,
    )
  })
})

describe('fhirNarrativeSchema', () => {
  it('validates a narrative with status and div', () => {
    const result = fhirNarrativeSchema.parse({
      status: 'generated',
      div: '<div xmlns="http://www.w3.org/1999/xhtml">Content</div>',
    })
    expect(result.status).toBe('generated')
  })
  it('validates status extensions', () => {
    expect(
      fhirNarrativeSchema.safeParse({ status: 'extensions', div: '<div/>' })
        .success,
    ).toBe(true)
  })
  it('validates status additional', () => {
    expect(
      fhirNarrativeSchema.safeParse({ status: 'additional', div: '<div/>' })
        .success,
    ).toBe(true)
  })
  it('rejects a narrative without status', () => {
    expect(fhirNarrativeSchema.safeParse({ div: '<div/>' }).success).toBe(false)
  })
  it('rejects a narrative without div', () => {
    expect(fhirNarrativeSchema.safeParse({ status: 'generated' }).success).toBe(
      false,
    )
  })
  it('rejects a narrative with empty div', () => {
    expect(
      fhirNarrativeSchema.safeParse({ status: 'generated', div: '' }).success,
    ).toBe(false)
  })
  it('rejects an invalid status value', () => {
    expect(
      fhirNarrativeSchema.safeParse({ status: 'invalid', div: '<div/>' })
        .success,
    ).toBe(false)
  })
})

describe('fhirCodingSchema', () => {
  it('validates a full coding', () => {
    const result = fhirCodingSchema.parse({
      system: 'http://hl7.org/fhir/CodeSystem/care-plan-category',
      version: '4.0.1',
      code: 'assess-plan',
      display: 'Assess and Plan',
      userSelected: true,
    })
    expect(result.code).toBe('assess-plan')
  })
  it('validates an empty coding object', () => {
    expect(fhirCodingSchema.safeParse({}).success).toBe(true)
  })
  it('validates a coding with only code', () => {
    expect(fhirCodingSchema.safeParse({ code: 'active' }).success).toBe(true)
  })
  it('rejects a coding with whitespace in code', () => {
    expect(fhirCodingSchema.safeParse({ code: 'active code' }).success).toBe(
      false,
    )
  })
})

describe('fhirCodeableConceptSchema', () => {
  it('validates a codeable concept with coding array', () => {
    const result = fhirCodeableConceptSchema.parse({
      coding: [{ code: 'active', system: 'http://example.com' }],
      text: 'Active',
    })
    expect(result.text).toBe('Active')
  })
  it('validates an empty codeable concept', () => {
    expect(fhirCodeableConceptSchema.safeParse({}).success).toBe(true)
  })
  it('validates a codeable concept with only text', () => {
    expect(
      fhirCodeableConceptSchema.safeParse({ text: 'Some text' }).success,
    ).toBe(true)
  })
})

describe('fhirIdentifierSchema', () => {
  it('validates a full identifier', () => {
    const result = fhirIdentifierSchema.parse({
      use: 'official',
      type: { text: 'MR' },
      system: 'https://example.com/identifiers/mr',
      value: '12345',
    })
    expect(result.value).toBe('12345')
  })
  it('validates an empty identifier', () => {
    expect(fhirIdentifierSchema.safeParse({}).success).toBe(true)
  })
  it('rejects an invalid use value', () => {
    expect(fhirIdentifierSchema.safeParse({ use: 'invalid' }).success).toBe(
      false,
    )
  })
  it('validates all use enum values', () => {
    for (const use of ['usual', 'official', 'temp', 'secondary', 'old']) {
      expect(fhirIdentifierSchema.safeParse({ use }).success).toBe(true)
    }
  })
})

describe('fhirPeriodSchema', () => {
  it('validates a period with start and end', () => {
    const result = fhirPeriodSchema.parse({
      start: '2024-01-01',
      end: '2024-12-31',
    })
    expect(result.start).toBe('2024-01-01')
  })
  it('validates an empty period', () => {
    expect(fhirPeriodSchema.safeParse({}).success).toBe(true)
  })
  it('validates a period with only start', () => {
    expect(fhirPeriodSchema.safeParse({ start: '2024-01-01' }).success).toBe(
      true,
    )
  })
})

describe('fhirQuantitySchema', () => {
  it('validates a full quantity', () => {
    const result = fhirQuantitySchema.parse({
      value: 42.5,
      comparator: '>=',
      unit: 'mg',
      system: 'http://unitsofmeasure.org',
      code: 'mg',
    })
    expect(result.value).toBe(42.5)
  })
  it('validates an empty quantity', () => {
    expect(fhirQuantitySchema.safeParse({}).success).toBe(true)
  })
  it('rejects an invalid comparator', () => {
    expect(fhirQuantitySchema.safeParse({ comparator: '!=' }).success).toBe(
      false,
    )
  })
  it('validates all comparator values', () => {
    for (const comparator of ['<', '<=', '>=', '>']) {
      expect(fhirQuantitySchema.safeParse({ comparator }).success).toBe(true)
    }
  })
})

describe('fhirRangeSchema', () => {
  it('validates a range with low and high', () => {
    const result = fhirRangeSchema.parse({
      low: { value: 10 },
      high: { value: 100 },
    })
    expect(result.low?.value).toBe(10)
  })
  it('validates an empty range', () => {
    expect(fhirRangeSchema.safeParse({}).success).toBe(true)
  })
})

describe('fhirRatioSchema', () => {
  it('validates a ratio with numerator and denominator', () => {
    const result = fhirRatioSchema.parse({
      numerator: { value: 10, unit: 'mg' },
      denominator: { value: 1, unit: 'L' },
    })
    expect(result.numerator?.value).toBe(10)
  })
  it('validates an empty ratio', () => {
    expect(fhirRatioSchema.safeParse({}).success).toBe(true)
  })
})

describe('fhirMoneySchema', () => {
  it('validates money with value and currency', () => {
    const result = fhirMoneySchema.parse({
      value: 99.99,
      currency: 'USD',
    })
    expect(result.value).toBe(99.99)
  })
  it('validates an empty money object', () => {
    expect(fhirMoneySchema.safeParse({}).success).toBe(true)
  })
})

describe('fhirReferenceStringSchema', () => {
  it('validates a relative reference', () => {
    expect(fhirReferenceStringSchema.safeParse('Patient/123').success).toBe(
      true,
    )
  })
  it('validates an absolute URL reference', () => {
    expect(
      fhirReferenceStringSchema.safeParse('https://example.com/Patient/123')
        .success,
    ).toBe(true)
  })
  it('validates an http URL reference', () => {
    expect(
      fhirReferenceStringSchema.safeParse('http://example.com/Patient/123')
        .success,
    ).toBe(true)
  })
  it('validates an internal fragment reference', () => {
    expect(fhirReferenceStringSchema.safeParse('#frag1').success).toBe(true)
  })
  it('validates a urn:uuid reference', () => {
    expect(
      fhirReferenceStringSchema.safeParse(
        'urn:uuid:550e8400-e29b-41d4-a716-446655440000',
      ).success,
    ).toBe(true)
  })
  it('rejects a lowercase resource type', () => {
    expect(fhirReferenceStringSchema.safeParse('patient/123').success).toBe(
      false,
    )
  })
  it('rejects a reference without slash', () => {
    expect(fhirReferenceStringSchema.safeParse('invalid').success).toBe(false)
  })
  it('rejects an empty fragment', () => {
    expect(fhirReferenceStringSchema.safeParse('#').success).toBe(false)
  })
  it('rejects a reference with empty id', () => {
    expect(fhirReferenceStringSchema.safeParse('Patient/').success).toBe(false)
  })
  it('rejects a plain string', () => {
    expect(fhirReferenceStringSchema.safeParse('not-a-reference').success).toBe(
      false,
    )
  })
})

describe('fhirReferenceSchema', () => {
  it('validates a reference with reference field', () => {
    const result = fhirReferenceSchema.parse({
      reference: 'Patient/123',
      display: 'John Doe',
    })
    expect(result.reference).toBe('Patient/123')
  })
  it('validates an empty reference object', () => {
    expect(fhirReferenceSchema.safeParse({}).success).toBe(true)
  })
  it('validates a reference with identifier', () => {
    expect(
      fhirReferenceSchema.safeParse({
        identifier: { value: '12345' },
      }).success,
    ).toBe(true)
  })
  it('rejects an invalid reference string', () => {
    expect(
      fhirReferenceSchema.safeParse({ reference: 'invalid' }).success,
    ).toBe(false)
  })
})

describe('fhirMetaSchema', () => {
  it('validates a full meta object', () => {
    const result = fhirMetaSchema.parse({
      versionId: '1',
      lastUpdated: '2024-01-15T10:30:00Z',
      source: 'https://example.com/source',
      profile: ['https://hl7.org/fhir/StructureDefinition/Patient'],
      security: [{ code: 'test' }],
      tag: [{ code: 'active' }],
    })
    expect(result.versionId).toBe('1')
  })
  it('validates an empty meta object', () => {
    expect(fhirMetaSchema.safeParse({}).success).toBe(true)
  })
  it('rejects an invalid versionId', () => {
    expect(fhirMetaSchema.safeParse({ versionId: 'invalid_id!' }).success).toBe(
      false,
    )
  })
  it('rejects an invalid lastUpdated (no timezone)', () => {
    expect(
      fhirMetaSchema.safeParse({ lastUpdated: '2024-01-15T10:30:00' }).success,
    ).toBe(false)
  })
})

describe('fhirBaseSchema', () => {
  it('validates an empty base object', () => {
    expect(fhirBaseSchema.safeParse({}).success).toBe(true)
  })
  it('validates a base with id', () => {
    const result = fhirBaseSchema.parse({ id: 'patient-1' })
    expect(result.id).toBe('patient-1')
  })
  it('validates a base with meta', () => {
    expect(
      fhirBaseSchema.safeParse({
        meta: { versionId: '1' },
      }).success,
    ).toBe(true)
  })
  it('rejects an invalid id', () => {
    expect(fhirBaseSchema.safeParse({ id: 'invalid_id!' }).success).toBe(false)
  })
})

describe('fhirContactPointSchema', () => {
  it('validates a full contact point', () => {
    const result = fhirContactPointSchema.parse({
      system: 'phone',
      value: '555-1234',
      use: 'home',
      rank: 1,
      period: { start: '2024-01-01' },
    })
    expect(result.system).toBe('phone')
  })
  it('validates an empty contact point', () => {
    expect(fhirContactPointSchema.safeParse({}).success).toBe(true)
  })
  it('rejects an invalid system value', () => {
    expect(
      fhirContactPointSchema.safeParse({ system: 'invalid' }).success,
    ).toBe(false)
  })
  it('rejects an invalid use value', () => {
    expect(fhirContactPointSchema.safeParse({ use: 'invalid' }).success).toBe(
      false,
    )
  })
  it('rejects rank of zero', () => {
    expect(fhirContactPointSchema.safeParse({ rank: 0 }).success).toBe(false)
  })
  it('validates all system enum values', () => {
    for (const system of [
      'phone',
      'fax',
      'email',
      'pager',
      'url',
      'sms',
      'other',
    ]) {
      expect(fhirContactPointSchema.safeParse({ system }).success).toBe(true)
    }
  })
})

describe('fhirAddressSchema', () => {
  it('validates a full address', () => {
    const result = fhirAddressSchema.parse({
      use: 'home',
      type: 'postal',
      text: '123 Main St, Anytown, USA',
      line: ['123 Main St'],
      city: 'Anytown',
      district: 'County',
      state: 'CA',
      postalCode: '12345',
      country: 'USA',
      period: { start: '2024-01-01' },
    })
    expect(result.city).toBe('Anytown')
  })
  it('validates an empty address', () => {
    expect(fhirAddressSchema.safeParse({}).success).toBe(true)
  })
  it('rejects an invalid use value', () => {
    expect(fhirAddressSchema.safeParse({ use: 'invalid' }).success).toBe(false)
  })
  it('rejects an invalid type value', () => {
    expect(fhirAddressSchema.safeParse({ type: 'invalid' }).success).toBe(false)
  })
  it('validates all use enum values', () => {
    for (const use of ['home', 'work', 'temp', 'old', 'billing']) {
      expect(fhirAddressSchema.safeParse({ use }).success).toBe(true)
    }
  })
  it('validates all type enum values', () => {
    for (const type of ['postal', 'physical', 'both']) {
      expect(fhirAddressSchema.safeParse({ type }).success).toBe(true)
    }
  })
})

describe('fhirHumanNameSchema', () => {
  it('validates a full human name', () => {
    const result = fhirHumanNameSchema.parse({
      use: 'official',
      text: 'John Q. Doe',
      family: 'Doe',
      given: ['John', 'Quincy'],
      prefix: ['Mr.'],
      suffix: ['Jr.'],
      period: { start: '2024-01-01' },
    })
    expect(result.family).toBe('Doe')
  })
  it('validates an empty human name', () => {
    expect(fhirHumanNameSchema.safeParse({}).success).toBe(true)
  })
  it('rejects an invalid use value', () => {
    expect(fhirHumanNameSchema.safeParse({ use: 'invalid' }).success).toBe(
      false,
    )
  })
  it('validates all use enum values', () => {
    for (const use of [
      'usual',
      'official',
      'temp',
      'nickname',
      'anonymous',
      'old',
      'maiden',
    ]) {
      expect(fhirHumanNameSchema.safeParse({ use }).success).toBe(true)
    }
  })
})

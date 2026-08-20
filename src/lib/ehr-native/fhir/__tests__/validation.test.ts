/**
 * Tests for FHIR R4 validation pipeline.
 */

import { describe, it, expect } from 'vitest';
import {
  validateResource,
  validateResourceType,
  isSupportedResourceType,
  getRegistryEntry,
  RESOURCE_REGISTRY,
  SCHEMA_REGISTRY,
} from '../validation.js';
import { SUPPORTED_RESOURCE_TYPES, DEDICATED_TABLE_RESOURCES } from '../types.js';

describe('isSupportedResourceType', () => {
  it('returns true for all supported resource types', () => {
    for (const rt of SUPPORTED_RESOURCE_TYPES) {
      expect(isSupportedResourceType(rt)).toBe(true);
    }
  });

  it('returns false for unsupported resource types', () => {
    expect(isSupportedResourceType('Foo')).toBe(false);
    expect(isSupportedResourceType('')).toBe(false);
    expect(isSupportedResourceType('patient')).toBe(false);
  });

  it('acts as a type guard', () => {
    const value: string = 'Patient';
    if (isSupportedResourceType(value)) {
      // Inside this block, value is FHIRResourceType
      const entry = getRegistryEntry(value);
      expect(entry.resourceType).toBe('Patient');
    }
  });
});

describe('validateResourceType', () => {
  it('validates when body resourceType matches expected', () => {
    const result = validateResourceType('Patient', { resourceType: 'Patient' });
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('rejects when body resourceType does not match', () => {
    const result = validateResourceType('Patient', { resourceType: 'Practitioner' });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects when body has no resourceType field', () => {
    const result = validateResourceType('Patient', { name: 'test' });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('rejects when body is not an object', () => {
    const result = validateResourceType('Patient', 'not an object');
    expect(result.valid).toBe(false);
  });

  it('rejects when body is null', () => {
    const result = validateResourceType('Patient', null);
    expect(result.valid).toBe(false);
  });
});

describe('validateResource', () => {
  it('validates a valid Patient resource', () => {
    const patient = {
      resourceType: 'Patient',
      id: 'patient-1',
      name: [{ family: 'Doe', given: ['John'] }],
      gender: 'male',
      birthDate: '1990-01-01',
    };
    const result = validateResource('Patient', patient);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!['resourceType']).toBe('Patient');
  });

  it('rejects a Patient with wrong resourceType', () => {
    const patient = {
      resourceType: 'Practitioner',
      name: [{ family: 'Doe' }],
    };
    const result = validateResource('Patient', patient);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('validates a valid Practitioner resource', () => {
    const practitioner = {
      resourceType: 'Practitioner',
      id: 'prac-1',
      name: [{ family: 'Smith', given: ['Jane'] }],
    };
    const result = validateResource('Practitioner', practitioner);
    expect(result.success).toBe(true);
  });

  it('validates a valid Observation resource', () => {
    const observation = {
      resourceType: 'Observation',
      id: 'obs-1',
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '1234-5' }] },
      subject: { reference: 'Patient/patient-1' },
    };
    const result = validateResource('Observation', observation);
    expect(result.success).toBe(true);
  });

  it('validates Consent with fhirBaseSchema fallback', () => {
    const consent = {
      resourceType: 'Consent',
      id: 'consent-1',
    };
    const result = validateResource('Consent', consent);
    expect(result.success).toBe(true);
  });

  it('validates ServiceRequest with fhirBaseSchema fallback', () => {
    const serviceRequest = {
      resourceType: 'ServiceRequest',
      id: 'sr-1',
    };
    const result = validateResource('ServiceRequest', serviceRequest);
    expect(result.success).toBe(true);
  });

  it('returns error issues for invalid resource', () => {
    const patient = { resourceType: 'Patient', name: 'not-an-array' };
    const result = validateResource('Patient', patient);
    expect(result.success).toBe(false);
    if (result.error) {
      expect(result.error.issues).toBeDefined();
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });
});

describe('getRegistryEntry', () => {
  it('returns registry entry for Patient (dedicated)', () => {
    const entry = getRegistryEntry('Patient');
    expect(entry.resourceType).toBe('Patient');
    expect(entry.table).toBe('ehr_patient');
    expect(entry.pkColumn).toBe('patient_id');
    expect(entry.isGeneric).toBe(false);
  });

  it('returns registry entry for Condition (generic)', () => {
    const entry = getRegistryEntry('Condition');
    expect(entry.resourceType).toBe('Condition');
    expect(entry.table).toBe('ehr_resource');
    expect(entry.pkColumn).toBe('resource_id');
    expect(entry.isGeneric).toBe(true);
  });

  it('returns registry entry for Practitioner (dedicated)', () => {
    const entry = getRegistryEntry('Practitioner');
    expect(entry.table).toBe('ehr_practitioner');
    expect(entry.pkColumn).toBe('practitioner_id');
    expect(entry.isGeneric).toBe(false);
  });
});

describe('RESOURCE_REGISTRY', () => {
  it('has entries for all 23 supported resource types', () => {
    for (const rt of SUPPORTED_RESOURCE_TYPES) {
      expect(RESOURCE_REGISTRY[rt]).toBeDefined();
    }
  });

  it('marks dedicated table resources as non-generic', () => {
    for (const rt of DEDICATED_TABLE_RESOURCES) {
      expect(RESOURCE_REGISTRY[rt].isGeneric).toBe(false);
    }
  });

  it('marks non-dedicated resources as generic', () => {
    for (const rt of SUPPORTED_RESOURCE_TYPES) {
      if (!DEDICATED_TABLE_RESOURCES.includes(rt)) {
        expect(RESOURCE_REGISTRY[rt].isGeneric).toBe(true);
        expect(RESOURCE_REGISTRY[rt].table).toBe('ehr_resource');
      }
    }
  });
});

describe('SCHEMA_REGISTRY', () => {
  it('has schemas for all 23 supported resource types', () => {
    for (const rt of SUPPORTED_RESOURCE_TYPES) {
      expect(SCHEMA_REGISTRY[rt]).toBeDefined();
    }
  });
});

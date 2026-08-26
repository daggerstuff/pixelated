/**
 * EHR Native — FHIR R4 Internal Server
 *
 * Internal FHIR R4 REST endpoint mounted at /fhir/r4.
 * Exposes resources to the integration layer and external apps.
 *
 * Key components:
 * - CapabilityStatement at /fhir/r4/metadata
 * - Resource validation pipeline: validateResource() → persist() → audit() → index()
 * - FHIR search parameters for supported resource types
 *
 * @see docs/adr/ADR-002-fhir-r4-canonical.md
 * @see src/lib/ehr-native/legacy/services/fhir.client.ts for existing FHIR client
 */

export {}

/**
 * EHR Native — Repositories
 *
 * Data access layer for FHIR R4 resources stored as JSONB in Postgres.
 * Each repository handles a single FHIR resource type with:
 * - CRUD operations (create, read, update, delete)
 * - Version history (via _history table triggers)
 * - Tenant isolation (via RLS — see ADR-001)
 * - Audit emission (via audit module — see ADR-006)
 *
 * Planned repositories:
 * - PatientRepository
 * - EncounterRepository
 * - AppointmentRepository
 * - DocumentReferenceRepository (clinical notes)
 * - ClaimRepository
 * - ConsentRepository
 * - ObservationRepository
 */

export {}

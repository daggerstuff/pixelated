/**
 * EHR Native — Repositories
 *
 * Data access layer for FHIR R4 resources stored as JSONB in Postgres.
 * Each repository handles a single FHIR resource type with:
 * - CRUD operations (create, read, update, delete)
 * - Tenant isolation (via RLS — see ADR-001)
 * - Audit emission (via audit module — see ADR-006)
 *
 * Repositories:
 * - PatientRepository
 * - EncounterRepository
 * - AppointmentRepository
 * - ObservationRepository
 * - QuestionnaireRepository (F2.4) — outcome measure definitions
 * - QuestionnaireResponseRepository (F2.4) — client-completed measures
 */

export { BaseRepository, type RLSContext } from './base-repository'
export { PatientRepository } from './patient-repository'
export { EncounterRepository } from './encounter-repository'
export { AppointmentRepository } from './appointment-repository'
export { ObservationRepository } from './observation-repository'
export {
  QuestionnaireRepository,
  QuestionnaireResponseRepository,
} from './questionnaire-repository'

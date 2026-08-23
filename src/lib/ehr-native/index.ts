/**
 * EHR Native Module — barrel export
 *
 * In-house EHR module add-on for Pixelated Empathy.
 * Provides clinical charting, scheduling, claims tracking, consent management,
 * and telehealth integration as a native module (not an external EHR integration).
 *
 * @see docs/plans/ehr-module-build-plan.md
 * @see docs/adr/ADR-002-fhir-r4-canonical.md
 */

// Type system (F1.0)
export type {} from './types'

// Repositories (F1.4)
export {
  BaseRepository,
  type RLSContext,
  PatientRepository,
  EncounterRepository,
  AppointmentRepository,
  ObservationRepository,
} from './repositories'

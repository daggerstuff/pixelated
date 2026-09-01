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

// Services (F1.7–F1.12)
export { TelehealthService } from './services'
export type {
  TelehealthSession,
  StartSessionInput,
  JoinSessionInput,
  DeviceCheckResult,
  WebRTCConfig,
  TelehealthProvider,
} from './types'

// Risk Stratification (F2.2 / PIX-4411)
export { RiskStratificationService } from './services'
export type {
  RiskStratificationRequest,
  RiskStratificationResponse,
  RiskStratificationResult,
  RiskLevel,
  RiskScoreBreakdown,
  RiskServiceHealth,
} from './services'

/**
 * EHR Native — Domain Services
 *
 * Business logic services for the EHR module.
 * Services are stateless; they depend on repositories for persistence
 * and the audit module for write-path logging.
 *
 * Services:
 * - PatientService (F1.7) — chart management
 * - NoteTemplateService (F1.8) — modality-specific note templates
 * - SchedulingService (F1.9) — appointment management
 * - ClaimsService (F1.10) — clearinghouse API claims tracking
 */

export { PatientService, type PatientChart, type PatientChartSummary, type PatientSearchParams, type CreatePatientInput, type UpdatePatientInput } from './patient-service'

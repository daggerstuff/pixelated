/**
 * EHR Native — Services
 *
 * Domain services orchestrate multiple repositories to provide
 * higher-level operations for the EHR application.
 *
 * Services are stateless; they depend on repositories for persistence
 * and the audit module for write-path logging.
 *
 * Services:
 * - PatientService (F1.7) — chart management
 * - NoteTemplateService (F1.8) — modality-specific note templates
 * - SchedulingService (F1.9) — appointment management
 * - ClaimsService (F1.10) — clearinghouse API claims tracking
 */

export {
  PatientService,
  type PatientChart,
  type PatientChartSummary,
  type PatientSearchParams,
  type CreatePatientInput,
  type UpdatePatientInput,
} from './patient-service'

export {
  NoteTemplateService,
  noteTemplateService,
  type NoteModality,
  type NoteSection,
  type NoteTemplate,
  type CreateNoteFromTemplateInput,
  type NoteTemplateValidationResult,
} from './note-template-service'

export {
  SchedulingService,
  type CreateAppointmentInput,
  type UpdateAppointmentInput,
  type ScheduleSearchParams,
  type DateRangeParams,
  type PractitionerScheduleParams,
  type ScheduleSummary,
} from './scheduling-service'

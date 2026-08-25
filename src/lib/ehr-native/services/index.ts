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
 * - PortalMessagingService (F1.11) — secure patient messaging
 * - PortalHomeworkService (F1.11) — therapy homework assignments
 * - PortalStatementService (F1.11) — patient financial statements
 * - TelehealthService (F1.12) — native telehealth sessions
 */

export { PatientService } from './patient-service'

export {
  NoteTemplateService,
  noteTemplateService,
} from './note-template-service'

export { SchedulingService } from './scheduling-service'

export { ClaimsService, claimsService } from './claims-service'

export {
  PortalMessagingService,
  type CreateThreadInput,
  type CreateMessageInput,
} from './portal-messaging-service'

export {
  PortalHomeworkService,
  type UpdateHomeworkInput,
} from './portal-homework-service'

export { PortalStatementService } from './portal-statement-service'

export { TelehealthService } from './telehealth-service'

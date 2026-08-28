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
 * - NoteSigningService (F2.2) — AI no auto-sign compliance gate
 * - OutcomesService (F2.4) — outcome measure trending (PHQ-9, GAD-7, OQ-45)
 * - AnalyticsService (PIX-4413) — customizable dashboard metrics, RBAC, and saved views
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

export {
  NoteSigningService,
  noteSigningService,
  type AIDraftMetadata,
  type SignNoteInput,
  type SignNoteResult,
  type ManualSignValidation,
} from './note-signing-service'

export {
  OutcomesService,
  type MeasureConfigInput,
  type SubmitMeasureInput,
  type OutcomeTrendResult,
  type OutcomeTrendPoint,
  type OutcomeAlertResult,
} from './outcomes.service'

export {
  RiskStratificationService,
  type RiskStratificationRequest,
  type RiskStratificationResponse,
  type RiskStratificationResult,
  type RiskLevel,
  type RiskScoreBreakdown,
  type RiskServiceHealth,
  type PHQ9Scores,
  type GAD7Scores,
  type CSSRSScreen,
  type ClinicalContext,
} from './risk.service'

export {
  AnalyticsService,
  type DashboardType,
  type DashboardFilter,
  type TimeRange,
  type PracticeMetrics,
  type OutcomesMetrics,
  type UtilizationMetrics,
  type BillingMetrics,
  type ComplianceMetrics,
  type DashboardMetrics,
  type AnalyticsRepository,
  canAccessDashboard,
  getAccessibleDashboards,
  DASHBOARD_TYPES,
  DASHBOARD_RBAC,
} from './analytics.service'

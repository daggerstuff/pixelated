// Security and Audit Events
// Separated from security.ts to avoid coupling cryptography with domain event logic

export const AuthEvents = {
  AUTHENTICATION_SUCCESS: 'auth_success',
  AUTHENTICATION_FAILED: 'authentication_failed',
  AUTHORIZATION_FAILED: 'authorization_failed',
  MFA_REQUIRED: 'mfa_required',
  MFA_ENROLLMENT_STARTED: 'mfa_enrollment_started',
  MFA_ENROLLMENT_COMPLETED: 'mfa_enrollment_completed',
  MFA_FACTOR_DELETED: 'mfa_factor_deleted',
  MFA_PREFERRED_FACTOR_SET: 'mfa_preferred_factor_set',
  MFA_VERIFICATION_COMPLETED: 'mfa_verification_completed',
  MFA_VERIFICATION_FAILED: 'mfa_verification_failed',
  MFA_CHALLENGE_SENT: 'mfa_challenge_sent',
  WEBAUTHN_REGISTRATION_STARTED: 'webauthn_registration_started',
  WEBAUTHN_REGISTRATION_COMPLETED: 'webauthn_registration_completed',
  WEBAUTHN_REGISTRATION_FAILED: 'webauthn_registration_failed',
  WEBAUTHN_AUTHENTICATION_STARTED: 'webauthn_authentication_started',
  WEBAUTHN_AUTHENTICATION_COMPLETED: 'webauthn_authentication_completed',
  WEBAUTHN_AUTHENTICATION_FAILED: 'webauthn_authentication_failed',
  WEBAUTHN_CREDENTIAL_RENAMED: 'webauthn_credential_renamed',
  WEBAUTHN_CREDENTIAL_DELETED: 'webauthn_credential_deleted',
  WEBAUTHN_RESPONSE_VALIDATED: 'webauthn_response_validated',
  WEBAUTHN_RESPONSE_VALIDATION_FAILED: 'webauthn_response_validation_failed',
} as const

export const UserEvents = {
  USER_CREATED: 'user_created',
  USER_SOFT_DELETED: 'user_soft_deleted',
  USER_PURGED: 'user_purged',
  USER_RESTORED: 'user_restored',
  ROLE_ASSIGNED: 'role_assigned',
  ROLE_REMOVED: 'role_removed',
  IMPERSONATION_STARTED: 'impersonation_started',
  IMPERSONATION_ENDED: 'impersonation_ended',
  IMPERSONATION_DENIED: 'impersonation_denied',
  IMPERSONATION_EXTENDED: 'impersonation_extended',
  IMPERSONATION_ERROR: 'impersonation_error',
  ACCOUNT_LINKED: 'account_linked',
  ACCOUNT_UNLINKED: 'account_unlinked',
} as const

export const BulkOperationEvents = {
  BULK_IMPORT_COMPLETED: 'bulk_import_completed',
  BULK_IMPORT_ERROR: 'bulk_import_error',
  BULK_EXPORT_COMPLETED: 'bulk_export_completed',
  BULK_EXPORT_ERROR: 'bulk_export_error',
  USER_BULK_IMPORT_SUCCESS: 'user_bulk_import_success',
  USER_BULK_IMPORT_ERROR: 'user_bulk_import_error',
  BULK_IMPORT_JOB_STATUS_CHECK: 'bulk_import_job_status_check',
  BULK_IMPORT_JOB_STATUS_ERROR: 'bulk_import_job_status_error',
  RECURRING_EXPORT_SCHEDULED: 'recurring_export_scheduled',
  RECURRING_EXPORT_SCHEDULE_ERROR: 'recurring_export_schedule_error',
} as const

export const SessionEvents = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  TOKEN_CREATED: 'token_created',
  TOKEN_REFRESHED: 'token_refreshed',
  TOKEN_REVOKED: 'token_revoked',
  TOKEN_VALIDATED: 'token_validated',
  TOKEN_VALIDATION_FAILED: 'token_validation_failed',
  TOKEN_CLEANED_UP: 'token_cleaned_up',
  SESSION_TERMINATED: 'session_terminated',
  SESSION_TERMINATION_ERROR: 'session_termination_error',
} as const

export const AuditEvents = {
  ACCESS: 'access',
  ACCESS_ATTEMPT: 'access_attempt',
  API_ACCESS: 'api_access',
  DATA_ACCESS: 'data_access',
  COMPLIANCE_CHECK: 'compliance_check',
  RISK_ASSESSMENT: 'risk_assessment',
  SENSITIVE_ACTION: 'sensitive_action',
  PERMISSION_DENIED: 'permission_denied',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  SECURITY_HEADER_VIOLATION: 'security_header_violation',
  CSRF_VIOLATION: 'csrf_violation',
  THERAPY_CHAT_REQUEST: 'therapy_chat_request',
  THERAPY_CHAT_RESPONSE: 'therapy_chat_response',
  THERAPY_CHAT_ERROR: 'therapy_chat_error',
} as const

export const SystemEvents = {
  CONFIG_CHANGE: 'config_change',
  CONFIGURATION_CHANGED: 'configuration_changed',
  DATA_RETENTION_POLICY_UPDATED: 'data_retention_policy_updated',
  KEY_ROTATION: 'key_rotation',
  ENCRYPTED_OPERATION: 'encrypted_operation',
  ERROR: 'error',
  MESSAGE: 'message',
} as const

export const RoleTransitionEvents = {
  ROLE_TRANSITION_AUDIT: 'role_transition_audit',
  ROLE_TRANSITION_REQUEST_FAILED: 'role_transition_request_failed',
  ROLE_TRANSITION_EXECUTION_FAILED: 'role_transition_execution_failed',
  ROLE_TRANSITION_CANCELLATION_FAILED: 'role_transition_cancellation_failed',
  ROLE_TRANSITION_APPROVAL_FAILED: 'role_transition_approval_failed',
} as const

export const UserRetentionEvents = {
  USER_RETENTION_EXTENDED: 'user_retention_extended',
  USER_RETENTION_EXTENSION_ERROR: 'user_retention_extension_error',
  USER_PURGE_NOTIFICATION_SENT: 'user_purge_notification_sent',
  USER_PURGE_ERROR: 'user_purge_error',
  USER_SOFT_DELETE_ERROR: 'user_soft_delete_error',
  USER_RESTORE_ERROR: 'user_restore_error',
} as const

export const SecurityEventType = {
  ...AuthEvents,
  ...UserEvents,
  ...BulkOperationEvents,
  ...SessionEvents,
  ...AuditEvents,
  ...SystemEvents,
  ...RoleTransitionEvents,
  ...UserRetentionEvents,
} as const

export type SecurityEventTypeValue =
  (typeof SecurityEventType)[keyof typeof SecurityEventType]

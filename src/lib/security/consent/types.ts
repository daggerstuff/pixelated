/**
 * Types for the Consent Management System
 * These types correspond to the database schema defined in consent-management.sql
 */

/**
 * Consent Type - defines a category of consent
 */
export interface ConsentType {
  id: string
  name: string
  description: string
  scope: 'research' | 'data_processing' | 'analytics' | 'communications'
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Consent Version - represents a specific version of a consent document
 */
export interface ConsentVersion {
  id: string
  consentTypeId: string
  version: string // semantic versioning
  effectiveDate: string // ISO date string
  expirationDate?: string // ISO date string
  documentText: string
  summary: string
  isCurrent: boolean
  approvalDate: string
  approvedBy: string
  createdAt: string
  updatedAt: string
}

/**
 * User Consent - records a user's consent to a specific version
 */
export interface UserConsent {
  id: string
  userId: string
  consentVersionId: string
  grantedAt: string
  ipAddress?: string
  userAgent?: string
  isActive: boolean
  withdrawalDate?: string
  withdrawalReason?: string
  granularOptions?: Record<string, boolean>
  proofOfConsent?: string
  createdAt: string
  updatedAt: string
}

/**
 * Consent Audit Trail - records all actions related to consent
 */
export interface ConsentAuditTrail {
  id: string
  userId: string
  consentId?: string
  action: 'grant' | 'withdraw' | 'update' | 'view'
  actionTimestamp: string
  performedBy: string
  ipAddress?: string
  userAgent?: string
  details: Record<string, unknown>
  createdAt: string
}

/**
 * Consent Option - defines granular options for a consent type
 */
export interface ConsentOption {
  id: string
  consentTypeId: string
  optionName: string
  description: string
  isRequired: boolean
  defaultValue: boolean
  displayOrder: number
  createdAt: string
  updatedAt: string
}

/**
 * Consent Reminder - scheduled reminder for consent renewal
 */
export interface ConsentReminder {
  id: string
  userId: string
  consentId: string
  reminderDate: string
  sentAt?: string
  message: string
  status: 'pending' | 'sent' | 'failed'
  createdAt: string
  updatedAt: string
}

/**
 * User's consent status for a specific type
 */
export interface UserConsentStatus {
  consentType: ConsentType
  currentVersion: ConsentVersion
  userConsent?: UserConsent
  hasActiveConsent: boolean
  consentOptions?: ConsentOption[]
  selectedOptions?: Record<string, boolean>
}

/**
 * Parameters for granting consent
 */
export interface GrantConsentParams {
  userId: string
  consentVersionId: string
  ipAddress?: string
  userAgent?: string
  granularOptions?: Record<string, boolean>
  proofOfConsent?: string
}

/**
 * Parameters for withdrawing consent
 */
export interface WithdrawConsentParams {
  userId: string
  consentId: string
  reason?: string
  ipAddress?: string
  userAgent?: string
}

/**
 * Parameters for getting user consent status
 */
export interface GetConsentStatusParams {
  userId: string
  consentTypeName?: string
  consentTypeId?: string
}

/**
 * Supabase table names for consent management
 */
export const CONSENT_TABLES = {
  CONSENT_TYPES: 'consent_types',
  CONSENT_VERSIONS: 'consent_versions',
  USER_CONSENTS: 'user_consents',
  CONSENT_AUDIT_TRAIL: 'consent_audit_trail',
  CONSENT_OPTIONS: 'consent_options',
  CONSENT_REMINDERS: 'consent_reminders',
}

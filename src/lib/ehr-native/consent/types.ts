export type ConsentStatus = 'active' | 'expired' | 'withdrawn' | 'draft'

export type TreatmentType =
  | 'therapy'
  | 'psychiatry'
  | 'telehealth'
  | 'assessment'
  | 'general'

export type ConsentScope =
  | 'patient-privacy'
  | 'treatment'
  | 'research'
  | 'data-sharing'

export interface ConsentRecord {
  id: string
  patientId: string
  treatmentType: TreatmentType
  scope: ConsentScope
  status: ConsentStatus
  grantedAt: string
  expiresAt: string | null
  withdrawnAt: string | null
  withdrawnReason: string | null
  performerId: string
  organizationId: string | null
  provenanceId: string | null
  policyRule: string | null
  provisions: ConsentProvision[]
}

export interface ConsentProvision {
  type: 'permit' | 'deny'
  code: string[]
  period?: { start: string; end: string }
}

export interface ConsentCheckResult {
  hasConsent: boolean
  consentId: string | null
  status: ConsentStatus | null
  reason: string
  treatmentType: TreatmentType
  patientId: string
  checkedAt: string
}

export interface ConsentEngineConfig {
  defaultExpiryDays: number
  warningDays: number
  criticalDays: number
}

export interface DigitalSignature {
  who: string
  data: string
  format: string
}

/**
 * Business Associate Agreement (BAA) Template System
 *
 * This module defines the types and interfaces for the BAA template system,
 * which helps maintain HIPAA compliance by standardizing and managing
 * Business Associate Agreements.
 */

/**
 * Type of organization that would require a BAA
 */
export enum BusinessAssociateType {
  VENDOR = 'vendor',
  PARTNER = 'partner',
  SUBCONTRACTOR = 'subcontractor',
  SERVICE_PROVIDER = 'service_provider',
  OTHER = 'other',
  EHR_VENDOR = 'EHR_VENDOR',
  CLOUD_SERVICE = 'CLOUD_SERVICE',
  DATA_ANALYTICS = 'DATA_ANALYTICS',
  TELEMEDICINE = 'TELEMEDICINE',
}

/**
 * Service categories that might involve PHI
 */
export enum ServiceCategory {
  DATA_STORAGE = 'data_storage',
  DATA_PROCESSING = 'data_processing',
  TECHNICAL_SUPPORT = 'technical_support',
  CONSULTATION = 'consultation',
  ANALYTICS = 'analytics',
  PATIENT_CARE = 'patient_care',
  ADMINISTRATIVE = 'administrative',
  OTHER = 'other',
  SOFTWARE_SERVICES = 'software_services',
  CONSULTING = 'consulting',
}

/**
 * Status of a BAA
 */
export enum BaaStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  PENDING_SIGNATURE = 'pending_signature',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TERMINATED = 'terminated',
  ARCHIVED = 'archived',
}

/**
 * Compliance level of a business associate
 */
export enum ComplianceLevel {
  NOT_VERIFIED = 'not_verified',
  SELF_ATTESTED = 'self_attested',
  THIRD_PARTY_VERIFIED = 'third_party_verified',
  HIPAA_CERTIFIED = 'hipaa_certified',
  NON_COMPLIANT = 'non_compliant',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

/**
 * Interface for BAA template placeholders
 */
export interface BaaPlaceholder {
  key: string
  label: string
  description: string
  required: boolean
  defaultValue?: string
}

/**
 * Interface for a BAA template section
 */
export interface BaaTemplateSection {
  id: string
  title: string
  description?: string
  content: string
  required: boolean
  order: number
}

/**
 * Interface for a BAA template
 */
export interface BaaTemplate {
  id: string
  name: string
  description: string
  version: string
  lastUpdated: Date
  createdBy: string
  associateTypes: BusinessAssociateType[]
  serviceCategories: ServiceCategory[]
  sections: BaaTemplateSection[]
  placeholders: BaaPlaceholder[]
  isDefault?: boolean
  tags?: string[]
}

/**
 * Interface for a business associate
 */
export interface BusinessAssociate {
  id: string
  name: string
  type: BusinessAssociateType
  serviceCategories: ServiceCategory[]
  contactName: string
  contactEmail: string
  contactPhone?: string
  address?: string
  website?: string
  notes?: string
  dateAdded: Date
  complianceLevel: ComplianceLevel
  complianceVerificationDate?: Date
  complianceExpiryDate?: Date
  activeAgreementId?: string
  agreementHistory: string[] // IDs of previous agreements
}

/**
 * Interface for a BAA document
 */
export interface BaaDocument {
  id: string
  templateId: string
  businessAssociateId: string
  name: string
  effectiveDate?: Date
  expirationDate?: Date
  status: BaaStatus
  createdDate: Date
  lastModifiedDate: Date
  createdBy: string
  lastModifiedBy: string
  filledPlaceholders: Record<string, string>
  includedSectionIds: string[]
  documentUrl?: string
  signedDocumentUrl?: string
  signatureDate?: Date
  terminationDate?: Date
  terminationReason?: string
  auditTrail: BaaAuditEvent[]
}

/**
 * Interface for a BAA audit event
 */
export interface BaaAuditEvent {
  id: string
  documentId: string
  eventType:
    | 'created'
    | 'modified'
    | 'status_changed'
    | 'sent'
    | 'signed'
    | 'terminated'
    | 'accessed'
    | 'downloaded'
  timestamp: Date
  userId: string
  details: string
  ipAddress?: string
}

/**
 * Type of verification method used for compliance verification
 */
export enum VerificationMethod {
  SELF_ASSESSMENT = 'self_assessment',
  DOCUMENTATION_REVIEW = 'documentation_review',
  THIRD_PARTY_AUDIT = 'third_party_audit',
  CERTIFICATION_VALIDATION = 'certification_validation',
  ONSITE_ASSESSMENT = 'onsite_assessment',
  QUESTIONNAIRE = 'questionnaire',
  SELF_ATTESTATION = 'SELF_ATTESTATION',
}

/**
 * Interface for a compliance verification event
 */
export interface ComplianceVerification {
  id: string
  businessAssociateId: string
  verificationDate: Date
  expiryDate?: Date
  complianceLevel: ComplianceLevel
  verificationMethod: VerificationMethod
  verifiedBy: string // User ID
  notes?: string
  attachments?: string[] // Document IDs
}

/**
 * Interface for a compliance document
 */
export interface ComplianceDocument {
  id: string
  businessAssociateId: string
  name: string
  description?: string
  type:
    | 'certification'
    | 'attestation'
    | 'audit_report'
    | 'questionnaire'
    | 'policy'
    | 'other'
  uploadDate: Date
  expiryDate?: Date
  documentUrl: string
  uploadedBy: string // User ID
  tags?: string[]
  relatedVerificationId?: string
  isValid: boolean
}

/**
 * Interface for a compliance requirement
 */
export interface ComplianceRequirement {
  id: string
  name: string
  description: string
  applicableTypes: BusinessAssociateType[]
  applicableCategories: ServiceCategory[]
  requiredDocuments: string[]
  minimumComplianceLevel: ComplianceLevel
  isRequired: boolean
  verificationMethod: VerificationMethod
  frequency:
    | 'once'
    | 'monthly'
    | 'quarterly'
    | 'semi_annually'
    | 'annually'
    | 'biannually'
}

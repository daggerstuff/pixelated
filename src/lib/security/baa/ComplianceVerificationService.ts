import type {
  ComplianceDocument,
  ComplianceVerification,
  ComplianceRequirement,
} from './types'
import {
  ComplianceLevel,
  VerificationMethod,
  BusinessAssociateType,
  ServiceCategory,
} from './types'
import { generateId } from '../../utils/ids'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

// Initialize logger for PHI audit logging
const logger = createBuildSafeLogger('phi-audit')

/**
 * Service for managing vendor compliance verification
 */
export class ComplianceVerificationService {
  private verifications: Map<string, ComplianceVerification> = new Map()
  private documents: Map<string, ComplianceDocument> = new Map()
  private requirements: Map<string, ComplianceRequirement> = new Map()

  constructor() {
    // Log initialization for audit trail
    logger.info('ComplianceVerificationService initialized', {
      component: 'ComplianceVerificationService',
      action: 'initialize',
    })
  }

  /**
   * Create a new compliance verification entry
   */
  public createVerification(
    businessAssociateId: string,
    complianceLevel: ComplianceLevel,
    verificationMethod: VerificationMethod,
    verifiedBy: string,
    verificationDate: Date = new Date(),
    expiryDate?: Date,
    notes?: string,
    attachments: string[] = [],
  ): ComplianceVerification {
    const id = generateId()
    const verification: ComplianceVerification = {
      id,
      businessAssociateId,
      verificationDate,
      expiryDate,
      complianceLevel,
      verificationMethod,
      verifiedBy,
      notes,
      attachments,
    }

    this.verifications.set(id, verification)

    // Audit log for verification creation
    logger.info('Compliance verification created', {
      verificationId: id,
      businessAssociateId,
      complianceLevel,
      verificationMethod,
      verifiedBy,
      action: 'create_verification',
    })

    return verification
  }

  /**
   * Get all verifications for a business associate
   */
  public getVerifications(
    businessAssociateId: string,
  ): ComplianceVerification[] {
    const verifications = Array.from(this.verifications.values())
      .filter((v) => v.businessAssociateId === businessAssociateId)
      .sort(
        (a, b) => b.verificationDate.getTime() - a.verificationDate.getTime(),
      )

    // Audit log for retrieving verifications
    logger.info('Compliance verifications accessed', {
      businessAssociateId,
      count: verifications.length,
      action: 'get_verifications',
    })

    return verifications
  }

  /**
   * Get a verification by ID
   */
  public getVerification(id: string): ComplianceVerification | undefined {
    const verification = this.verifications.get(id)

    // Audit log for verification access
    logger.info('Compliance verification accessed', {
      verificationId: id,
      found: !!verification,
      action: 'get_verification',
    })

    return verification
  }

  /**
   * Update a verification
   */
  public updateVerification(
    id: string,
    updates: Partial<ComplianceVerification>,
  ): ComplianceVerification | undefined {
    const verification = this.verifications.get(id)
    if (!verification) {
      logger.warn(
        'Compliance verification update failed - verification not found',
        {
          verificationId: id,
          action: 'update_verification_failed',
        },
      )
      return undefined
    }

    // Prevent modification of certain fields
    const { id: _, ...updatableFields } = updates

    const updatedVerification = {
      ...verification,
      ...updatableFields,
    }

    this.verifications.set(id, updatedVerification)

    // Audit log for verification update
    logger.info('Compliance verification updated', {
      verificationId: id,
      businessAssociateId: verification.businessAssociateId,
      updatedFields: Object.keys(updatableFields),
      action: 'update_verification',
    })

    return updatedVerification
  }

  /**
   * Delete a verification
   */
  public deleteVerification(id: string): boolean {
    const verification = this.verifications.get(id)
    const result = this.verifications.delete(id)

    // Audit log for verification deletion
    logger.info('Compliance verification deleted', {
      verificationId: id,
      businessAssociateId: verification?.businessAssociateId,
      success: result,
      action: 'delete_verification',
    })

    return result
  }

  /**
   * Create a new compliance document
   */
  public createDocument(
    businessAssociateId: string,
    name: string,
    documentUrl: string,
    uploadedBy: string,
    type: ComplianceDocument['type'] = 'other',
    description?: string,
    expiryDate?: Date,
    tags: string[] = [],
    relatedVerificationId?: string,
    isValid: boolean = true,
  ): ComplianceDocument {
    const id = generateId()
    const document: ComplianceDocument = {
      id,
      businessAssociateId,
      name,
      description,
      type,
      uploadDate: new Date(),
      expiryDate,
      documentUrl,
      uploadedBy,
      tags,
      relatedVerificationId,
      isValid,
    }

    this.documents.set(id, document)

    // Audit log for document creation
    logger.info('Compliance document created', {
      documentId: id,
      businessAssociateId,
      documentType: type,
      uploadedBy,
      action: 'create_document',
    })

    return document
  }

  /**
   * Get all documents for a business associate
   */
  public getDocuments(businessAssociateId: string): ComplianceDocument[] {
    const documents = Array.from(this.documents.values())
      .filter((d) => d.businessAssociateId === businessAssociateId)
      .sort((a, b) => b.uploadDate.getTime() - a.uploadDate.getTime())

    // Audit log for retrieving documents
    logger.info('Compliance documents accessed', {
      businessAssociateId,
      count: documents.length,
      action: 'get_documents',
    })

    return documents
  }

  /**
   * Get a document by ID
   */
  public getDocument(id: string): ComplianceDocument | undefined {
    const document = this.documents.get(id)

    // Audit log for document access
    logger.info('Compliance document accessed', {
      documentId: id,
      found: !!document,
      action: 'get_document',
    })

    return document
  }

  /**
   * Update a document
   */
  public updateDocument(
    id: string,
    updates: Partial<ComplianceDocument>,
  ): ComplianceDocument | undefined {
    const document = this.documents.get(id)
    if (!document) {
      logger.warn('Compliance document update failed - document not found', {
        documentId: id,
        action: 'update_document_failed',
      })
      return undefined
    }

    // Prevent modification of certain fields
    const { id: _, ...updatableFields } = updates

    const updatedDocument = {
      ...document,
      ...updatableFields,
    }

    this.documents.set(id, updatedDocument)

    // Audit log for document update
    logger.info('Compliance document updated', {
      documentId: id,
      businessAssociateId: document.businessAssociateId,
      updatedFields: Object.keys(updatableFields),
      action: 'update_document',
    })

    return updatedDocument
  }

  /**
   * Set document validity
   */
  public setDocumentValidity(
    id: string,
    isValid: boolean,
  ): ComplianceDocument | undefined {
    const document = this.documents.get(id)
    if (!document) {
      logger.warn(
        'Compliance document validity update failed - document not found',
        {
          documentId: id,
          action: 'update_document_validity_failed',
        },
      )
      return undefined
    }

    const updatedDocument = {
      ...document,
      isValid,
    }

    this.documents.set(id, updatedDocument)

    // Audit log for document validity update
    logger.info('Compliance document validity updated', {
      documentId: id,
      businessAssociateId: document.businessAssociateId,
      isValid,
      action: 'update_document_validity',
    })

    return updatedDocument
  }

  /**
   * Delete a document
   */
  public deleteDocument(id: string): boolean {
    const document = this.documents.get(id)
    const result = this.documents.delete(id)

    // Audit log for document deletion
    logger.info('Compliance document deleted', {
      documentId: id,
      businessAssociateId: document?.businessAssociateId,
      success: result,
      action: 'delete_document',
    })

    return result
  }

  /**
   * Create a new compliance requirement
   */
  public createRequirement(
    name: string,
    description: string,
    applicableTypes: BusinessAssociateType[],
    applicableCategories: ServiceCategory[],
    requiredDocuments: string[],
    minimumComplianceLevel: ComplianceLevel,
    isRequired: boolean,
    verificationMethod: VerificationMethod,
    frequency: ComplianceRequirement['frequency'],
  ): ComplianceRequirement {
    const id = generateId()
    const requirement: ComplianceRequirement = {
      id,
      name,
      description,
      applicableTypes,
      applicableCategories,
      requiredDocuments,
      minimumComplianceLevel,
      isRequired,
      verificationMethod,
      frequency,
    }

    this.requirements.set(id, requirement)

    // Audit log for requirement creation
    logger.info('Compliance requirement created', {
      requirementId: id,
      name,
      minimumComplianceLevel,
      isRequired,
      action: 'create_requirement',
    })

    return requirement
  }

  /**
   * Get all compliance requirements
   */
  public getAllRequirements(): ComplianceRequirement[] {
    const requirements = Array.from(this.requirements.values())

    // Audit log for retrieving all requirements
    logger.info('All compliance requirements accessed', {
      count: requirements.length,
      action: 'get_all_requirements',
    })

    return requirements
  }

  /**
   * Get applicable requirements for a business associate
   */
  public getApplicableRequirements(
    type: BusinessAssociateType,
    categories: ServiceCategory[],
  ): ComplianceRequirement[] {
    const requirements = Array.from(this.requirements.values()).filter(
      (req) => {
        return (
          req.applicableTypes.includes(type) &&
          req.applicableCategories.some((cat) => categories.includes(cat))
        )
      },
    )

    // Audit log for retrieving applicable requirements
    logger.info('Applicable compliance requirements accessed', {
      associateType: type,
      serviceCategories: categories,
      count: requirements.length,
      action: 'get_applicable_requirements',
    })

    return requirements
  }

  /**
   * Get a requirement by ID
   */
  public getRequirement(id: string): ComplianceRequirement | undefined {
    const requirement = this.requirements.get(id)

    // Audit log for requirement access
    logger.info('Compliance requirement accessed', {
      requirementId: id,
      found: !!requirement,
      action: 'get_requirement',
    })

    return requirement
  }

  /**
   * Update a requirement
   */
  public updateRequirement(
    id: string,
    updates: Partial<ComplianceRequirement>,
  ): ComplianceRequirement | undefined {
    const requirement = this.requirements.get(id)
    if (!requirement) {
      logger.warn(
        'Compliance requirement update failed - requirement not found',
        {
          requirementId: id,
          action: 'update_requirement_failed',
        },
      )
      return undefined
    }

    // Prevent modification of certain fields
    const { id: _, ...updatableFields } = updates

    const updatedRequirement = {
      ...requirement,
      ...updatableFields,
    }

    this.requirements.set(id, updatedRequirement)

    // Audit log for requirement update
    logger.info('Compliance requirement updated', {
      requirementId: id,
      updatedFields: Object.keys(updatableFields),
      action: 'update_requirement',
    })

    return updatedRequirement
  }

  /**
   * Delete a requirement
   */
  public deleteRequirement(id: string): boolean {
    const requirement = this.requirements.get(id)
    const result = this.requirements.delete(id)

    // Audit log for requirement deletion
    logger.info('Compliance requirement deleted', {
      requirementId: id,
      name: requirement?.name,
      success: result,
      action: 'delete_requirement',
    })

    return result
  }

  /**
   * Initialize with default HIPAA compliance requirements
   */
  public initializeDefaultRequirements() {
    // Clear any existing requirements
    this.requirements.clear()

    logger.info('Initializing default compliance requirements', {
      action: 'initialize_default_requirements',
    })

    // HIPAA Security Rule requirements
    this.createRequirement(
      'Security Risk Assessment',
      'A comprehensive evaluation of potential risks and vulnerabilities to the confidentiality, integrity, and availability of PHI.',
      [
        BusinessAssociateType.EHR_VENDOR,
        BusinessAssociateType.CLOUD_SERVICE,
        BusinessAssociateType.DATA_ANALYTICS,
        BusinessAssociateType.TELEMEDICINE,
      ],
      [
        ServiceCategory.DATA_STORAGE,
        ServiceCategory.SOFTWARE_SERVICES,
        ServiceCategory.CONSULTING,
      ],
      ['risk_assessment'],
      ComplianceLevel.HIGH,
      true,
      VerificationMethod.THIRD_PARTY_AUDIT,
      'annual',
    )

    this.createRequirement(
      'HIPAA Security Training',
      'Evidence of regular HIPAA and security awareness training for all staff with access to PHI.',
      [
        BusinessAssociateType.EHR_VENDOR,
        BusinessAssociateType.CLOUD_SERVICE,
        BusinessAssociateType.DATA_ANALYTICS,
        BusinessAssociateType.TELEMEDICINE,
      ],
      [
        ServiceCategory.DATA_STORAGE,
        ServiceCategory.SOFTWARE_SERVICES,
        ServiceCategory.CONSULTING,
      ],
      ['training_records'],
      ComplianceLevel.MEDIUM,
      true,
      VerificationMethod.DOCUMENTATION_REVIEW,
      'annual',
    )

    // Additional standard requirements...
    // Note: Actual implementation would include many more requirements

    logger.info('Default compliance requirements initialized', {
      count: this.requirements.size,
      action: 'default_requirements_initialized',
    })
  }

  /**
   * Get verification statistics
   */
  public getVerificationStatistics(): {
    totalVerifications: number
    verificationsByLevel: Record<ComplianceLevel, number>
    verificationsByMethod: Record<VerificationMethod, number>
    documentsUploaded: number
    expiringVerifications: number
  } {
    const verifications = Array.from(this.verifications.values())
    const documents = Array.from(this.documents.values())

    const stats = {
      totalVerifications: verifications.length,
      verificationsByLevel: {
        [ComplianceLevel.LOW]: 0,
        [ComplianceLevel.MEDIUM]: 0,
        [ComplianceLevel.HIGH]: 0,
        [ComplianceLevel.NOT_VERIFIED]: 0,
        [ComplianceLevel.SELF_ATTESTED]: 0,
        [ComplianceLevel.THIRD_PARTY_VERIFIED]: 0,
        [ComplianceLevel.HIPAA_CERTIFIED]: 0,
        [ComplianceLevel.NON_COMPLIANT]: 0,
      },
      verificationsByMethod: {
        [VerificationMethod.SELF_ATTESTATION]: 0,
        [VerificationMethod.DOCUMENTATION_REVIEW]: 0,
        [VerificationMethod.THIRD_PARTY_AUDIT]: 0,
        [VerificationMethod.ONSITE_ASSESSMENT]: 0,
        [VerificationMethod.SELF_ASSESSMENT]: 0,
        [VerificationMethod.CERTIFICATION_VALIDATION]: 0,
        [VerificationMethod.QUESTIONNAIRE]: 0,
      },
      documentsUploaded: documents.length,
      expiringVerifications: 0,
    }

    // Calculate stats
    verifications.forEach((verification) => {
      // Count by level
      stats.verificationsByLevel[verification.complianceLevel]++

      // Count by method
      stats.verificationsByMethod[verification.verificationMethod]++

      // Count expiring (within 30 days)
      if (
        verification.expiryDate &&
        verification.expiryDate.getTime() - new Date().getTime() <
          30 * 24 * 60 * 60 * 1000
      ) {
        stats.expiringVerifications++
      }
    })

    // Audit log for statistics access
    logger.info('Compliance verification statistics accessed', {
      totalVerifications: stats.totalVerifications,
      documentsUploaded: stats.documentsUploaded,
      expiringVerifications: stats.expiringVerifications,
      action: 'get_verification_statistics',
    })

    return stats
  }
}

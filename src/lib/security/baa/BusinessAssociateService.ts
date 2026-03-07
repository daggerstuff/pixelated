import type {
  BusinessAssociate,
  BusinessAssociateType,
  ServiceCategory,
} from './types'
import { ComplianceLevel } from './types'
import { generateId } from '../../utils/ids'

/**
 * Service for managing Business Associates (vendors, partners, etc.)
 * and their HIPAA compliance verification
 */
export class BusinessAssociateService {
  private businessAssociates: Map<string, BusinessAssociate> = new Map()

  /**
   * Create a new business associate record
   */
  public createBusinessAssociate(
    name: string,
    type: BusinessAssociateType,
    serviceCategories: ServiceCategory[],
    contactName: string,
    contactEmail: string,
    complianceLevel: ComplianceLevel = ComplianceLevel.NOT_VERIFIED,
    contactPhone?: string,
    address?: string,
    website?: string,
    notes?: string,
  ): BusinessAssociate {
    const id = generateId()
    const associate: BusinessAssociate = {
      id,
      name,
      type,
      serviceCategories,
      contactName,
      contactEmail,
      contactPhone,
      address,
      website,
      notes,
      dateAdded: new Date(),
      complianceLevel,
      agreementHistory: [],
    }

    this.businessAssociates.set(id, associate)
    return associate
  }

  /**
   * Get a business associate by ID
   */
  public getBusinessAssociate(id: string): BusinessAssociate | undefined {
    return this.businessAssociates.get(id)
  }

  /**
   * Get all business associates
   */
  public getAllBusinessAssociates(): BusinessAssociate[] {
    return Array.from(this.businessAssociates.values())
  }

  /**
   * Update a business associate
   */
  public updateBusinessAssociate(
    id: string,
    updates: Partial<BusinessAssociate>,
  ): BusinessAssociate | undefined {
    const associate = this.businessAssociates.get(id)
    if (!associate) {
      return undefined
    }

    // Prevent modification of certain fields
    const { id: _, ...updatableFields } = updates

    const updatedAssociate = {
      ...associate,
      ...updatableFields,
    }

    this.businessAssociates.set(id, updatedAssociate)
    return updatedAssociate
  }

  /**
   * Delete a business associate
   */
  public deleteBusinessAssociate(id: string): boolean {
    return this.businessAssociates.delete(id)
  }

  /**
   * Search for business associates by name, type, or compliance level
   */
  public searchBusinessAssociates(
    query: string,
    type?: BusinessAssociateType,
    complianceLevel?: ComplianceLevel,
  ): BusinessAssociate[] {
    const normalizedQuery = query.toLowerCase()
    return this.getAllBusinessAssociates().filter((associate) => {
      const matchesQuery =
        !query || associate.name.toLowerCase().includes(normalizedQuery)
      const matchesType = !type || associate.type === type
      const matchesCompliance =
        !complianceLevel || associate.complianceLevel === complianceLevel

      return matchesQuery && matchesType && matchesCompliance
    })
  }

  /**
   * Update the compliance verification status of a business associate
   */
  public verifyCompliance(
    id: string,
    complianceLevel: ComplianceLevel,
    verificationDate: Date = new Date(),
    expiryDate?: Date,
    notes?: string,
  ): BusinessAssociate | undefined {
    const associate = this.businessAssociates.get(id)
    if (!associate) {
      return undefined
    }

    const updatedAssociate = {
      ...associate,
      complianceLevel,
      complianceVerificationDate: verificationDate,
      complianceExpiryDate: expiryDate,
      notes: notes
        ? associate.notes
          ? `${associate.notes}\n\n${notes}`
          : notes
        : associate.notes,
    }

    this.businessAssociates.set(id, updatedAssociate)
    return updatedAssociate
  }

  /**
   * Add a BAA agreement to a business associate's history
   */
  public addAgreement(
    id: string,
    agreementId: string,
    isActive: boolean = true,
  ): BusinessAssociate | undefined {
    const associate = this.businessAssociates.get(id)
    if (!associate) {
      return undefined
    }

    const updatedHistory = [...associate.agreementHistory]
    if (!updatedHistory.includes(agreementId)) {
      updatedHistory.push(agreementId)
    }

    const updatedAssociate = {
      ...associate,
      agreementHistory: updatedHistory,
      activeAgreementId: isActive ? agreementId : associate.activeAgreementId,
    }

    this.businessAssociates.set(id, updatedAssociate)
    return updatedAssociate
  }

  /**
   * Get business associates with expiring compliance verification
   * @param daysThreshold Number of days until expiration to include
   */
  public getExpiringCompliance(
    daysThreshold: number = 30,
  ): BusinessAssociate[] {
    const now = new Date()
    const thresholdDate = new Date()
    thresholdDate.setDate(now.getDate() + daysThreshold)

    return this.getAllBusinessAssociates().filter((associate) => {
      if (!associate.complianceExpiryDate) {
        return false
      }

      return (
        associate.complianceExpiryDate <= thresholdDate &&
        associate.complianceExpiryDate > now
      )
    })
  }

  /**
   * Get business associates with expired compliance verification
   */
  public getExpiredCompliance(): BusinessAssociate[] {
    const now = new Date()

    return this.getAllBusinessAssociates().filter((associate) => {
      if (!associate.complianceExpiryDate) {
        return false
      }

      return associate.complianceExpiryDate < now
    })
  }

  /**
   * Get business associates grouped by compliance level
   */
  public getComplianceStatistics(): Record<ComplianceLevel, number> {
    const stats = Object.values(ComplianceLevel).reduce(
      (acc, level) => {
        acc[level] = 0
        return acc
      },
      {} as Record<ComplianceLevel, number>,
    )

    this.getAllBusinessAssociates().forEach((associate) => {
      stats[associate.complianceLevel]++
    })

    return stats
  }
}

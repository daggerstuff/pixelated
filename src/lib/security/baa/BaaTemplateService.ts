import type {
  BaaTemplate,
  BaaTemplateSection,
  BaaPlaceholder,
  BusinessAssociateType,
  ServiceCategory,
} from './types'
import { generateId } from '../../utils/ids'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

// Initialize logger for PHI audit logging
const logger = createBuildSafeLogger('phi-audit')

/**
 * Service for managing Business Associate Agreement (BAA) templates
 */
export class BaaTemplateService {
  private templates: Map<string, BaaTemplate> = new Map()

  constructor() {
    // Log initialization for audit trail
    logger.info('BaaTemplateService initialized', {
      component: 'BaaTemplateService',
      action: 'initialize',
    })
  }

  /**
   * Create a new BAA template
   */
  public createTemplate(
    name: string,
    description: string,
    version: string,
    createdBy: string,
    associateTypes: BusinessAssociateType[],
    serviceCategories: ServiceCategory[],
    sections: BaaTemplateSection[] = [],
    placeholders: BaaPlaceholder[] = [],
    isDefault: boolean = false,
    tags: string[] = [],
  ): BaaTemplate {
    const id = generateId()
    const template: BaaTemplate = {
      id,
      name,
      description,
      version,
      lastUpdated: new Date(),
      createdBy,
      associateTypes,
      serviceCategories,
      sections,
      placeholders,
      isDefault,
      tags,
    }

    this.templates.set(id, template)

    // Audit log for template creation
    logger.info('BAA Template created', {
      templateId: id,
      name,
      version,
      createdBy,
      action: 'create_template',
    })

    return template
  }

  /**
   * Get a template by ID
   */
  public getTemplate(id: string): BaaTemplate | undefined {
    const template = this.templates.get(id)

    // Audit log for template access
    logger.info('BAA Template accessed', {
      templateId: id,
      found: !!template,
      action: 'get_template',
    })

    return template
  }

  /**
   * Update an existing template
   */
  public updateTemplate(
    id: string,
    updates: Partial<BaaTemplate>,
  ): BaaTemplate | undefined {
    const template = this.templates.get(id)
    if (!template) {
      logger.warn('BAA Template update failed - template not found', {
        templateId: id,
        action: 'update_template_failed',
      })
      return undefined
    }

    const updatedTemplate = {
      ...template,
      ...updates,
      lastUpdated: new Date(),
    }

    this.templates.set(id, updatedTemplate)

    // Audit log for template update
    logger.info('BAA Template updated', {
      templateId: id,
      updatedFields: Object.keys(updates),
      action: 'update_template',
    })

    return updatedTemplate
  }

  /**
   * Delete a template
   */
  public deleteTemplate(id: string): boolean {
    const result = this.templates.delete(id)

    // Audit log for template deletion
    logger.info('BAA Template deleted', {
      templateId: id,
      success: result,
      action: 'delete_template',
    })

    return result
  }

  /**
   * Add a section to a template
   */
  public addSection(
    templateId: string,
    title: string,
    content: string,
    required: boolean = true,
    description?: string,
  ): BaaTemplate | undefined {
    const template = this.templates.get(templateId)
    if (!template) {
      logger.warn('BAA Template section add failed - template not found', {
        templateId,
        sectionTitle: title,
        action: 'add_section_failed',
      })
      return undefined
    }

    const sectionId = generateId()
    const newSection: BaaTemplateSection = {
      id: sectionId,
      title,
      description,
      content,
      required,
      order: template.sections.length,
    }

    const updatedTemplate = {
      ...template,
      sections: [...template.sections, newSection],
      lastUpdated: new Date(),
    }

    this.templates.set(templateId, updatedTemplate)

    // Audit log for section addition
    logger.info('BAA Template section added', {
      templateId,
      sectionId,
      sectionTitle: title,
      action: 'add_section',
    })

    return updatedTemplate
  }

  /**
   * Update a section in a template
   */
  public updateSection(
    templateId: string,
    sectionId: string,
    updates: Partial<BaaTemplateSection>,
  ): BaaTemplate | undefined {
    const template = this.templates.get(templateId)
    if (!template) {
      logger.warn('BAA Template section update failed - template not found', {
        templateId,
        sectionId,
        action: 'update_section_failed',
      })
      return undefined
    }

    const sectionIndex = template.sections.findIndex(
      (section) => section.id === sectionId,
    )
    if (sectionIndex === -1) {
      logger.warn('BAA Template section update failed - section not found', {
        templateId,
        sectionId,
        action: 'update_section_failed',
      })
      return undefined
    }

    const updatedSections = [...template.sections]
    updatedSections[sectionIndex] = {
      ...updatedSections[sectionIndex],
      ...updates,
    }

    const updatedTemplate = {
      ...template,
      sections: updatedSections,
      lastUpdated: new Date(),
    }

    this.templates.set(templateId, updatedTemplate)

    // Audit log for section update
    logger.info('BAA Template section updated', {
      templateId,
      sectionId,
      updatedFields: Object.keys(updates),
      action: 'update_section',
    })

    return updatedTemplate
  }

  /**
   * Remove a section from a template
   */
  public removeSection(
    templateId: string,
    sectionId: string,
  ): BaaTemplate | undefined {
    const template = this.templates.get(templateId)
    if (!template) {
      logger.warn('BAA Template section removal failed - template not found', {
        templateId,
        sectionId,
        action: 'remove_section_failed',
      })
      return undefined
    }

    const updatedSections = template.sections.filter(
      (section) => section.id !== sectionId,
    )

    // Reorder sections
    const reorderedSections = updatedSections.map((section, index) => ({
      ...section,
      order: index,
    }))

    const updatedTemplate = {
      ...template,
      sections: reorderedSections,
      lastUpdated: new Date(),
    }

    this.templates.set(templateId, updatedTemplate)

    // Audit log for section removal
    logger.info('BAA Template section removed', {
      templateId,
      sectionId,
      action: 'remove_section',
    })

    return updatedTemplate
  }

  /**
   * Add a placeholder to a template
   */
  public addPlaceholder(
    templateId: string,
    key: string,
    label: string,
    description: string,
    required: boolean = true,
    defaultValue?: string,
  ): BaaTemplate | undefined {
    const template = this.templates.get(templateId)
    if (!template) {
      logger.warn('BAA Template placeholder add failed - template not found', {
        templateId,
        placeholderKey: key,
        action: 'add_placeholder_failed',
      })
      return undefined
    }

    // Check if placeholder with this key already exists
    if (template.placeholders.some((p) => p.key === key)) {
      logger.warn('BAA Template placeholder add failed - key already exists', {
        templateId,
        placeholderKey: key,
        action: 'add_placeholder_failed',
      })
      return undefined
    }

    const newPlaceholder: BaaPlaceholder = {
      key,
      label,
      description,
      required,
      defaultValue,
    }

    const updatedTemplate = {
      ...template,
      placeholders: [...template.placeholders, newPlaceholder],
      lastUpdated: new Date(),
    }

    this.templates.set(templateId, updatedTemplate)

    // Audit log for placeholder addition
    logger.info('BAA Template placeholder added', {
      templateId,
      placeholderKey: key,
      action: 'add_placeholder',
    })

    return updatedTemplate
  }

  /**
   * Update a placeholder in a template
   */
  public updatePlaceholder(
    templateId: string,
    key: string,
    updates: Partial<BaaPlaceholder>,
  ): BaaTemplate | undefined {
    const template = this.templates.get(templateId)
    if (!template) {
      logger.warn(
        'BAA Template placeholder update failed - template not found',
        {
          templateId,
          placeholderKey: key,
          action: 'update_placeholder_failed',
        },
      )
      return undefined
    }

    const placeholderIndex = template.placeholders.findIndex(
      (p) => p.key === key,
    )
    if (placeholderIndex === -1) {
      logger.warn(
        'BAA Template placeholder update failed - placeholder not found',
        {
          templateId,
          placeholderKey: key,
          action: 'update_placeholder_failed',
        },
      )
      return undefined
    }

    const updatedPlaceholders = [...template.placeholders]
    updatedPlaceholders[placeholderIndex] = {
      ...updatedPlaceholders[placeholderIndex],
      ...updates,
    }

    const updatedTemplate = {
      ...template,
      placeholders: updatedPlaceholders,
      lastUpdated: new Date(),
    }

    this.templates.set(templateId, updatedTemplate)

    // Audit log for placeholder update
    logger.info('BAA Template placeholder updated', {
      templateId,
      placeholderKey: key,
      updatedFields: Object.keys(updates),
      action: 'update_placeholder',
    })

    return updatedTemplate
  }

  /**
   * Remove a placeholder from a template
   */
  public removePlaceholder(
    templateId: string,
    key: string,
  ): BaaTemplate | undefined {
    const template = this.templates.get(templateId)
    if (!template) {
      logger.warn(
        'BAA Template placeholder removal failed - template not found',
        {
          templateId,
          placeholderKey: key,
          action: 'remove_placeholder_failed',
        },
      )
      return undefined
    }

    const updatedPlaceholders = template.placeholders.filter(
      (p) => p.key !== key,
    )
    if (updatedPlaceholders.length === template.placeholders.length) {
      // No placeholder was removed
      logger.warn(
        'BAA Template placeholder removal failed - placeholder not found',
        {
          templateId,
          placeholderKey: key,
          action: 'remove_placeholder_failed',
        },
      )
      return undefined
    }

    const updatedTemplate = {
      ...template,
      placeholders: updatedPlaceholders,
      lastUpdated: new Date(),
    }

    this.templates.set(templateId, updatedTemplate)

    // Audit log for placeholder removal
    logger.info('BAA Template placeholder removed', {
      templateId,
      placeholderKey: key,
      action: 'remove_placeholder',
    })

    return updatedTemplate
  }

  /**
   * Get all templates
   */
  public getAllTemplates(): BaaTemplate[] {
    const templates = Array.from(this.templates.values())

    // Audit log for retrieving all templates
    logger.info('All BAA Templates accessed', {
      templateCount: templates.length,
      action: 'get_all_templates',
    })

    return templates
  }

  /**
   * Filter templates by criteria
   */
  public filterTemplates(criteria: {
    associateType?: BusinessAssociateType
    serviceCategory?: ServiceCategory
    isDefault?: boolean
    tag?: string
  }): BaaTemplate[] {
    const templates = Array.from(this.templates.values()).filter((template) => {
      if (
        criteria.associateType &&
        !template.associateTypes.includes(criteria.associateType)
      ) {
        return false
      }
      if (
        criteria.serviceCategory &&
        !template.serviceCategories.includes(criteria.serviceCategory)
      ) {
        return false
      }
      if (
        criteria.isDefault !== undefined &&
        template.isDefault !== criteria.isDefault
      ) {
        return false
      }
      if (criteria.tag && !template.tags.includes(criteria.tag)) {
        return false
      }
      return true
    })

    // Audit log for filtering templates
    logger.info('BAA Templates filtered', {
      criteria: JSON.stringify(criteria),
      resultCount: templates.length,
      action: 'filter_templates',
    })

    return templates
  }

  /**
   * Create a default BAA template with standard sections
   */
  public createDefaultTemplate(createdBy: string): BaaTemplate {
    // Create template with default values
    const template = this.createTemplate(
      'Standard HIPAA Business Associate Agreement',
      'Default BAA template compliant with HIPAA regulations',
      '1.0',
      createdBy,
      ['EHR_VENDOR', 'CLOUD_SERVICE', 'DATA_ANALYTICS', 'TELEMEDICINE'],
      ['DATA_STORAGE', 'SOFTWARE_SERVICES', 'CONSULTING'],
      [],
      [],
      true,
      ['hipaa', 'default', 'standard'],
    )

    // Add standard sections
    this.addSection(
      template.id,
      'Definitions',
      '1.1. **Business Associate** shall have the same meaning as the term "business associate" in 45 CFR § 160.103.\n\n' +
        '1.2. **Covered Entity** shall have the same meaning as the term "covered entity" in 45 CFR § 160.103.\n\n' +
        '1.3. **HIPAA Rules** shall mean the Privacy, Security, Breach Notification, and Enforcement Rules at 45 CFR Part 160 and Part 164.\n\n' +
        '1.4. **Protected Health Information** or **PHI** shall have the same meaning as the term "protected health information" in 45 CFR § 160.103, limited to the information created, received, maintained, or transmitted by Business Associate on behalf of Covered Entity.',
      true,
      'Defines key terms used throughout the agreement',
    )

    this.addSection(
      template.id,
      'Obligations of Business Associate',
      '2.1. Not use or disclose PHI other than as permitted or required by this Agreement or as required by law.\n\n' +
        '2.2. Use appropriate safeguards, and comply with Subpart C of 45 CFR Part 164 with respect to electronic PHI, to prevent use or disclosure of PHI other than as provided for by this Agreement.\n\n' +
        '2.3. Report to Covered Entity any use or disclosure of PHI not provided for by this Agreement of which it becomes aware, including breaches of unsecured PHI as required by 45 CFR § 164.410, and any security incident of which it becomes aware.\n\n' +
        '2.4. In accordance with 45 CFR §§ 164.502(e)(1)(ii) and 164.308(b)(2), ensure that any subcontractors that create, receive, maintain, or transmit PHI on behalf of the Business Associate agree to the same restrictions, conditions, and requirements that apply to the Business Associate with respect to such information.',
      true,
      'Outlines the responsibilities of the Business Associate',
    )

    this.addSection(
      template.id,
      'Permitted Uses and Disclosures',
      'Business Associate may only use or disclose PHI as necessary to perform the services set forth in the Service Agreement between the parties, provided that such use or disclosure would not violate HIPAA if done by Covered Entity.\n\n' +
        'Business Associate may use or disclose PHI as required by law.\n\n' +
        "Business Associate agrees to make uses and disclosures and requests for PHI consistent with Covered Entity's minimum necessary policies and procedures.",
      true,
      'Describes how PHI may be used by the Business Associate',
    )

    this.addSection(
      template.id,
      'Obligations of Covered Entity',
      "4.1. Notify Business Associate of any limitation(s) in the notice of privacy practices of Covered Entity under 45 CFR § 164.520, to the extent that such limitation may affect Business Associate's use or disclosure of PHI.\n\n" +
        "4.2. Notify Business Associate of any changes in, or revocation of, the permission by an individual to use or disclose his or her PHI, to the extent that such changes may affect Business Associate's use or disclosure of PHI.\n\n" +
        "4.3. Notify Business Associate of any restriction on the use or disclosure of PHI that Covered Entity has agreed to or is required to abide by under 45 CFR § 164.522, to the extent that such restriction may affect Business Associate's use or disclosure of PHI.",
      true,
      'Outlines the responsibilities of the Covered Entity',
    )

    this.addSection(
      template.id,
      'Term and Termination',
      '5.1. **Term**. The term of this Agreement shall be effective as of [EFFECTIVE_DATE], and shall terminate on the earlier of (a) the termination of the Service Agreement or (b) the date Covered Entity terminates for cause as authorized in paragraph 5.2 of this Section.\n\n' +
        '5.2. **Termination for Cause**. Business Associate authorizes termination of this Agreement by Covered Entity, if Covered Entity determines Business Associate has violated a material term of the Agreement and Business Associate has not cured the breach or ended the violation within a reasonable time specified by Covered Entity.\n\n' +
        '5.3. **Obligations upon Termination**. Upon termination of this Agreement for any reason, Business Associate shall return to Covered Entity or, if agreed to by Covered Entity, destroy all PHI received from Covered Entity, or created, maintained, or received by Business Associate on behalf of Covered Entity. Business Associate shall retain no copies of the PHI. If return or destruction is infeasible, the protections of this Agreement shall continue to apply to such PHI, and Business Associate shall limit further uses and disclosures of such PHI to those purposes that make the return or destruction infeasible.',
      true,
      'Specifies agreement duration and termination conditions',
    )

    // Add standard placeholders
    this.addPlaceholder(
      template.id,
      'EFFECTIVE_DATE',
      'Effective Date',
      'The effective date of this BAA',
      true,
    )

    // Log creation of default template
    logger.info('Default BAA Template created', {
      templateId: template.id,
      createdBy,
      action: 'create_default_template',
    })

    return template
  }
}

/**
 * Consent Management Service
 *
 * Provides a complete solution for managing user consent in compliance with
 * HIPAA and other privacy regulations. Handles research consent, data processing
 * consent, and other consent types with complete versioning and audit trails.
 */

import { supabase } from '../../supabase'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { createAuditLog, AuditEventType } from '../../audit'
import type {
  ConsentType,
  ConsentVersion,
  UserConsent,
  ConsentOption,
  UserConsentStatus,
  GrantConsentParams,
  WithdrawConsentParams,
  GetConsentStatusParams,
} from './types'

// Initialize logger
const logger = createBuildSafeLogger('consent-service')

export class ConsentService {
  private tables = {
    consentTypes: 'consent_types',
    consentVersions: 'consent_versions',
    userConsents: 'user_consents',
    consentAuditTrail: 'consent_audit_trail',
    consentOptions: 'consent_options',
    consentReminders: 'consent_reminders',
  }

  /**
   * Get all active consent types
   */
  async getConsentTypes(): Promise<ConsentType[]> {
    try {
      const { data, error } = await supabase
        .from(this.tables.consentTypes)
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) {
        logger.error('Error fetching consent types', error)
        throw new Error('Failed to fetch consent types')
      }

      // Convert snake_case to camelCase
      return data.map((type) => ({
        id: type.id,
        name: type.name,
        description: type.description,
        scope: type.scope,
        isActive: type.is_active,
        createdAt: type.created_at,
        updatedAt: type.updated_at,
      }))
    } catch (error) {
      logger.error('Unexpected error in getConsentTypes', error)
      throw new Error('Failed to fetch consent types')
    }
  }

  /**
   * Get the current version of a specific consent type
   */
  async getCurrentConsentVersion(
    consentTypeId: string,
  ): Promise<ConsentVersion> {
    try {
      const { data, error } = await supabase
        .from(this.tables.consentVersions)
        .select('*')
        .eq('consent_type_id', consentTypeId)
        .eq('is_current', true)
        .single()

      if (error) {
        logger.error('Error fetching current consent version', error)
        throw new Error('Failed to fetch current consent version')
      }

      // Convert snake_case to camelCase
      return {
        id: data.id,
        consentTypeId: data.consent_type_id,
        version: data.version,
        effectiveDate: data.effective_date,
        expirationDate: data.expiration_date,
        documentText: data.document_text,
        summary: data.summary,
        isCurrent: data.is_current,
        approvalDate: data.approval_date,
        approvedBy: data.approved_by,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    } catch (error) {
      logger.error('Unexpected error in getCurrentConsentVersion', error)
      throw new Error('Failed to fetch current consent version')
    }
  }

  /**
   * Get options for a specific consent type
   */
  async getConsentOptions(consentTypeId: string): Promise<ConsentOption[]> {
    try {
      const { data, error } = await supabase
        .from(this.tables.consentOptions)
        .select('*')
        .eq('consent_type_id', consentTypeId)
        .order('display_order')

      if (error) {
        logger.error('Error fetching consent options', error)
        throw new Error('Failed to fetch consent options')
      }

      // Convert snake_case to camelCase
      return data.map((option) => ({
        id: option.id,
        consentTypeId: option.consent_type_id,
        optionName: option.option_name,
        description: option.description,
        isRequired: option.is_required,
        defaultValue: option.default_value,
        displayOrder: option.display_order,
        createdAt: option.created_at,
        updatedAt: option.updated_at,
      }))
    } catch (error) {
      logger.error('Unexpected error in getConsentOptions', error)
      throw new Error('Failed to fetch consent options')
    }
  }

  /**
   * Get a user's active consent for a specific consent type
   */
  async getUserConsent(
    userId: string,
    consentTypeId: string,
  ): Promise<UserConsent | null> {
    try {
      // Get current version ID for this consent type
      const { data: versionData, error: versionError } = await supabase
        .from(this.tables.consentVersions)
        .select('id')
        .eq('consent_type_id', consentTypeId)
        .eq('is_current', true)
        .single()

      if (versionError) {
        logger.error('Error fetching current consent version', versionError)
        throw new Error('Failed to fetch current consent version')
      }

      // Get user's consent for this version
      const { data, error } = await supabase
        .from(this.tables.userConsents)
        .select('*')
        .eq('user_id', userId)
        .eq('consent_version_id', versionData.id)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        logger.error('Error fetching user consent', error)
        throw new Error('Failed to fetch user consent')
      }

      if (!data) {
        return null
      }

      // Log the access to the audit trail
      await this.logConsentAccess(userId, data.id)

      // Convert snake_case to camelCase
      return {
        id: data.id,
        userId: data.user_id,
        consentVersionId: data.consent_version_id,
        grantedAt: data.granted_at,
        ipAddress: data.ip_address,
        userAgent: data.user_agent,
        isActive: data.is_active,
        withdrawalDate: data.withdrawal_date,
        withdrawalReason: data.withdrawal_reason,
        granularOptions: data.granular_options,
        proofOfConsent: data.proof_of_consent,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    } catch (error) {
      logger.error('Unexpected error in getUserConsent', error)
      throw new Error('Failed to fetch user consent')
    }
  }

  /**
   * Get a user's consent status for all consent types or a specific type
   */
  async getUserConsentStatus(
    params: GetConsentStatusParams,
  ): Promise<UserConsentStatus[]> {
    try {
      // Get consent types - either all or specific one
      let consentTypesQuery = supabase
        .from(this.tables.consentTypes)
        .select('*')
        .eq('is_active', true)

      if (params.consentTypeId) {
        consentTypesQuery = consentTypesQuery.eq('id', params.consentTypeId)
      } else if (params.consentTypeName) {
        consentTypesQuery = consentTypesQuery.eq('name', params.consentTypeName)
      }

      const { data: consentTypesData, error: consentTypesError } =
        await consentTypesQuery

      if (consentTypesError) {
        logger.error('Error fetching consent types', consentTypesError)
        throw new Error('Failed to fetch consent types')
      }

      // Process each consent type
      const statuses: UserConsentStatus[] = []

      for (const typeData of consentTypesData) {
        // Get current version for this type
        const { data: versionData, error: versionError } = await supabase
          .from(this.tables.consentVersions)
          .select('*')
          .eq('consent_type_id', typeData.id)
          .eq('is_current', true)
          .single()

        if (versionError) {
          logger.error(
            `Error fetching current version for consent type ${typeData.id}`,
            versionError,
          )
          continue
        }

        // Get user's consent for this version
        const { data: consentData, error: consentError } = await supabase
          .from(this.tables.userConsents)
          .select('*')
          .eq('user_id', params.userId)
          .eq('consent_version_id', versionData.id)
          .eq('is_active', true)
          .maybeSingle()

        if (consentError) {
          logger.error(
            `Error fetching user consent for type ${typeData.id}`,
            consentError,
          )
          continue
        }

        // Get options for this consent type
        const { data: optionsData, error: optionsError } = await supabase
          .from(this.tables.consentOptions)
          .select('*')
          .eq('consent_type_id', typeData.id)
          .order('display_order')

        if (optionsError) {
          logger.error(
            `Error fetching options for consent type ${typeData.id}`,
            optionsError,
          )
          continue
        }

        // If user has consent, log access to audit trail
        if (consentData) {
          await this.logConsentAccess(params.userId, consentData.id)
        }

        // Convert data and add to results
        statuses.push({
          consentType: {
            id: typeData.id,
            name: typeData.name,
            description: typeData.description,
            scope: typeData.scope,
            isActive: typeData.is_active,
            createdAt: typeData.created_at,
            updatedAt: typeData.updated_at,
          },
          currentVersion: {
            id: versionData.id,
            consentTypeId: versionData.consent_type_id,
            version: versionData.version,
            effectiveDate: versionData.effective_date,
            expirationDate: versionData.expiration_date,
            documentText: versionData.document_text,
            summary: versionData.summary,
            isCurrent: versionData.is_current,
            approvalDate: versionData.approval_date,
            approvedBy: versionData.approved_by,
            createdAt: versionData.created_at,
            updatedAt: versionData.updated_at,
          },
          userConsent: consentData
            ? {
                id: consentData.id,
                userId: consentData.user_id,
                consentVersionId: consentData.consent_version_id,
                grantedAt: consentData.granted_at,
                ipAddress: consentData.ip_address,
                userAgent: consentData.user_agent,
                isActive: consentData.is_active,
                withdrawalDate: consentData.withdrawal_date,
                withdrawalReason: consentData.withdrawal_reason,
                granularOptions: consentData.granular_options,
                proofOfConsent: consentData.proof_of_consent,
                createdAt: consentData.created_at,
                updatedAt: consentData.updated_at,
              }
            : undefined,
          hasActiveConsent: !!consentData,
          consentOptions: optionsData.map((option) => ({
            id: option.id,
            consentTypeId: option.consent_type_id,
            optionName: option.option_name,
            description: option.description,
            isRequired: option.is_required,
            defaultValue: option.default_value,
            displayOrder: option.display_order,
            createdAt: option.created_at,
            updatedAt: option.updated_at,
          })),
          selectedOptions: consentData?.granular_options,
        })
      }

      return statuses
    } catch (error) {
      logger.error('Unexpected error in getUserConsentStatus', error)
      throw new Error('Failed to fetch user consent status')
    }
  }

  /**
   * Grant consent for a user
   */
  async grantConsent(params: GrantConsentParams): Promise<UserConsent> {
    try {
      // Check if there's already an active consent for this version
      const { data: existingConsent, error: checkError } = await supabase
        .from(this.tables.userConsents)
        .select('*')
        .eq('user_id', params.userId)
        .eq('consent_version_id', params.consentVersionId)
        .eq('is_active', true)
        .maybeSingle()

      if (checkError) {
        logger.error('Error checking existing consent', checkError)
        throw new Error('Failed to check existing consent')
      }

      // If consent already exists, return it
      if (existingConsent) {
        return {
          id: existingConsent.id,
          userId: existingConsent.user_id,
          consentVersionId: existingConsent.consent_version_id,
          grantedAt: existingConsent.granted_at,
          ipAddress: existingConsent.ip_address,
          userAgent: existingConsent.user_agent,
          isActive: existingConsent.is_active,
          withdrawalDate: existingConsent.withdrawal_date,
          withdrawalReason: existingConsent.withdrawal_reason,
          granularOptions: existingConsent.granular_options,
          proofOfConsent: existingConsent.proof_of_consent,
          createdAt: existingConsent.created_at,
          updatedAt: existingConsent.updated_at,
        }
      }

      // Get the consent version details for audit
      const { data: versionData, error: versionError } = await supabase
        .from(this.tables.consentVersions)
        .select('*, consent_types(name)')
        .eq('id', params.consentVersionId)
        .single()

      if (versionError) {
        logger.error('Error fetching consent version', versionError)
        throw new Error('Failed to fetch consent version')
      }

      // Insert new consent record
      const { data, error } = await supabase
        .from(this.tables.userConsents)
        .insert({
          user_id: params.userId,
          consent_version_id: params.consentVersionId,
          ip_address: params.ipAddress,
          user_agent: params.userAgent,
          granular_options: params.granularOptions,
          proof_of_consent: params.proofOfConsent,
        })
        .select()
        .single()

      if (error) {
        logger.error('Error granting consent', error)
        throw new Error('Failed to grant consent')
      }

      // Log the grant action to the audit trail
      const consentType = versionData.consent_types.name

      await createAuditLog(
        AuditEventType.CONSENT,
        `granted_${consentType.toLowerCase().replace(/\s+/g, '_')}_consent`,
        params.userId,
        'user_consents',
        {
          consentId: data.id,
          consentTypeId: versionData.consent_type_id,
          consentTypeName: consentType,
          consentVersion: versionData.version,
          granted: true,
          granularOptions: params.granularOptions,
        },
      )

      // Convert snake_case to camelCase
      return {
        id: data.id,
        userId: data.user_id,
        consentVersionId: data.consent_version_id,
        grantedAt: data.granted_at,
        ipAddress: data.ip_address,
        userAgent: data.user_agent,
        isActive: data.is_active,
        withdrawalDate: data.withdrawal_date,
        withdrawalReason: data.withdrawal_reason,
        granularOptions: data.granular_options,
        proofOfConsent: data.proof_of_consent,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      }
    } catch (error) {
      logger.error('Unexpected error in grantConsent', error)
      throw new Error('Failed to grant consent')
    }
  }

  /**
   * Withdraw a user's consent
   */
  async withdrawConsent(params: WithdrawConsentParams): Promise<boolean> {
    try {
      // Get the consent record
      const { data: consentData, error: consentError } = await supabase
        .from(this.tables.userConsents)
        .select('*, consent_versions(consent_type_id, consent_types(name))')
        .eq('id', params.consentId)
        .eq('user_id', params.userId)
        .eq('is_active', true)
        .single()

      if (consentError) {
        logger.error('Error fetching consent record', consentError)
        throw new Error('Failed to fetch consent record')
      }

      // Update the consent record
      const { error } = await supabase
        .from(this.tables.userConsents)
        .update({
          is_active: false,
          withdrawal_date: new Date().toISOString(),
          withdrawal_reason: params.reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', params.consentId)
        .eq('user_id', params.userId)

      if (error) {
        logger.error('Error withdrawing consent', error)
        throw new Error('Failed to withdraw consent')
      }

      // Log the withdrawal action to the audit trail
      const consentType = consentData.consent_versions.consent_types.name

      await createAuditLog(
        AuditEventType.CONSENT,
        `withdrew_${consentType.toLowerCase().replace(/\s+/g, '_')}_consent`,
        params.userId,
        'user_consents',
        {
          consentId: consentData.id,
          consentTypeId: consentData.consent_versions.consent_type_id,
          consentTypeName: consentType,
          withdrawn: true,
          reason: params.reason,
        },
      )

      return true
    } catch (error) {
      logger.error('Unexpected error in withdrawConsent', error)
      throw new Error('Failed to withdraw consent')
    }
  }

  /**
   * Check if a user has active consent for a specific type
   */
  async hasActiveConsent(
    userId: string,
    consentTypeName: string,
  ): Promise<boolean> {
    try {
      // Get the consent type
      const { data: typeData, error: typeError } = await supabase
        .from(this.tables.consentTypes)
        .select('id')
        .eq('name', consentTypeName)
        .eq('is_active', true)
        .single()

      if (typeError) {
        logger.error('Error fetching consent type', typeError)
        throw new Error('Failed to fetch consent type')
      }

      // Get current version for this type
      const { data: versionData, error: versionError } = await supabase
        .from(this.tables.consentVersions)
        .select('id')
        .eq('consent_type_id', typeData.id)
        .eq('is_current', true)
        .single()

      if (versionError) {
        logger.error('Error fetching current consent version', versionError)
        throw new Error('Failed to fetch current consent version')
      }

      // Check if user has active consent for this version
      const { data, error } = await supabase
        .from(this.tables.userConsents)
        .select('id')
        .eq('user_id', userId)
        .eq('consent_version_id', versionData.id)
        .eq('is_active', true)
        .maybeSingle()

      if (error) {
        logger.error('Error checking user consent', error)
        throw new Error('Failed to check user consent')
      }

      return !!data
    } catch (error) {
      logger.error('Unexpected error in hasActiveConsent', error)
      throw new Error('Failed to check active consent')
    }
  }

  /**
   * Log access to consent information in the audit trail
   */
  private async logConsentAccess(
    userId: string,
    consentId: string,
  ): Promise<void> {
    try {
      // Get consent details for audit
      const { data: consentData, error: consentError } = await supabase
        .from(this.tables.userConsents)
        .select(
          'consent_version_id, consent_versions(consent_type_id, consent_types(name))',
        )
        .eq('id', consentId)
        .single()

      if (consentError) {
        logger.error('Error fetching consent details for audit', consentError)
        return
      }

      const consentType = consentData.consent_versions.consent_types.name

      await createAuditLog(
        AuditEventType.CONSENT,
        `viewed_${consentType.toLowerCase().replace(/\s+/g, '_')}_consent`,
        userId,
        'user_consents',
        {
          consentId,
          consentTypeId: consentData.consent_versions.consent_type_id,
          consentTypeName: consentType,
          viewed: true,
        },
      )
    } catch (error) {
      logger.error('Error logging consent access', error)
    }
  }
}

// Export a singleton instance
export const consentService = new ConsentService()

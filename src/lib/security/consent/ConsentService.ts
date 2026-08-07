/**
 * Consent Management Service
 *
 * Provides a complete solution for managing user consent in compliance with
 * HIPAA and other privacy regulations. Handles research consent, data processing
 * consent, and other consent types with complete versioning and audit trails.
 */

/* Supabase import removed - migrate to MongoDB */
import { v4 as uuidv4 } from 'uuid'
import crypto from 'node:crypto'
import { mongoClient } from '../../db/mongoClient'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import {
  CONSENT_TABLES,
  type ConsentType,
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
  /**
   * Get all active consent types
   */
  async getConsentTypes(): Promise<ConsentType[]> {
    try {
      const data = await mongoClient.db
        .collection(CONSENT_TABLES.CONSENT_TYPES)
        .find({ is_active: true })
        .toArray()

      return data.map((type: unknown) => {
        const t = type as {
          id: string
          name: string
          description: string
          scope: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        return {
          id: t['id'],
          name: t['name'],
          description: t['description'],
          scope: t['scope'],
          isActive: t['is_active'],
          createdAt: t['created_at'],
          updatedAt: t['updated_at'],
        }
      }) as ConsentType[]
    } catch (error: unknown) {
      logger.error('Unexpected error in getConsentTypes', error)
      throw new Error('Failed to fetch consent types', { cause: error })
    }
  }

  /**
   * Get the current version of a specific consent type
   */
  async getCurrentConsentVersion(
    consentTypeId: string,
  ): Promise<ConsentVersion> {
    try {
      const data = await mongoClient.db
        .collection(CONSENT_TABLES.CONSENT_VERSIONS)
        .find({ consent_type_id: consentTypeId, is_current: true })
        .sort({ effective_date: -1 })
        .limit(1)
        .toArray()
      const doc = data[0]
      if (!doc) {
        throw new Error('No current consent version found for type')
      }
      return {
        id: doc['id'] as string,
        consentTypeId: doc['consent_type_id'] as string,
        version: doc['version'] as string,
        effectiveDate: doc['effective_date'] as string,
        expirationDate: doc['expiration_date'] as string | undefined,
        documentText: doc['document_text'] as string,
        summary: doc['summary'] as string,
        isCurrent: doc['is_current'] as boolean,
        approvalDate: (doc['approval_date'] as string) || '',
        approvedBy: (doc['approved_by'] as string) || '',
        createdAt: doc['created_at'] as string,
        updatedAt: doc['updated_at'] as string,
      }
    } catch (error: unknown) {
      logger.error('Unexpected error in getCurrentConsentVersion', error)
      throw new Error('Failed to fetch current consent version', {
        cause: error,
      })
    }
  }

  /**
   * Get options for a specific consent type
   */
  async getConsentOptions(consentTypeId: string): Promise<ConsentOption[]> {
    try {
      const data = await mongoClient.db
        .collection(CONSENT_TABLES.CONSENT_OPTIONS)
        .find({ consent_type_id: consentTypeId })
        .sort({ display_order: 1 })
        .toArray()
      return data.map((option: Record<string, unknown>) => {
        const rawDefaultValue = option['default_value']
        const defaultValue =
          typeof rawDefaultValue === 'boolean'
            ? rawDefaultValue
            : rawDefaultValue === 'true' || rawDefaultValue === '1'

        return {
          id: option['id'] as string,
          consentTypeId: option['consent_type_id'] as string,
          optionName: option['option_name'] as string,
          description: option['description'] as string,
          isRequired: option['is_required'] as boolean,
          defaultValue,
          displayOrder: option['display_order'] as number,
          createdAt: option['created_at'] as string,
          updatedAt: option['updated_at'] as string,
        }
      })
    } catch (error: unknown) {
      logger.error('Unexpected error in getConsentOptions', error)
      throw new Error('Failed to fetch consent options', { cause: error })
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
      const pipeline = [
        { $match: { user_id: userId, is_active: true } },
        {
          $lookup: {
            from: CONSENT_TABLES.CONSENT_VERSIONS,
            localField: 'consent_version_id',
            foreignField: 'id',
            as: 'version',
          },
        },
        { $unwind: '$version' },
        { $match: { 'version.consent_type_id': consentTypeId } },
      ]

      const cursor = mongoClient.db
        .collection(CONSENT_TABLES.USER_CONSENTS)
        .aggregate(pipeline)
      const data = await cursor.toArray()
      const doc = data[0]

      if (!doc) {
        return null
      }

      return {
        id: doc['id'] as string,
        userId: doc['user_id'] as string,
        consentVersionId: doc['consent_version_id'] as string,
        grantedAt: doc['granted_at'] as string,
        ipAddress: doc['ip_address'] as string | undefined,
        userAgent: doc['user_agent'] as string | undefined,
        isActive: doc['is_active'] as boolean,
        withdrawalDate: doc['withdrawal_date'] as string | undefined,
        withdrawalReason: doc['withdrawal_reason'] as string | undefined,
        granularOptions: doc['granular_options'] as
          Record<string, boolean> | undefined,
        proofOfConsent: doc['proof_of_consent'] as string | undefined,
        createdAt: doc['created_at'] as string,
        updatedAt: doc['updated_at'] as string,
      }
    } catch (error: unknown) {
      logger.error('Unexpected error in getUserConsent', error)
      throw new Error('Failed to fetch user consent', { cause: error })
    }
  }

  /**
   * Get a user's consent status for all consent types or a specific type
   */
  async getUserConsentStatus(
    params: GetConsentStatusParams,
  ): Promise<UserConsentStatus[]> {
    try {
      const typeFilter: Record<string, unknown> = { is_active: true }
      if (params.consentTypeId) {
        typeFilter['id'] = params.consentTypeId
      } else if (params.consentTypeName) {
        typeFilter['name'] = params.consentTypeName
      }
      const typeDocs = await mongoClient.db
        .collection(CONSENT_TABLES.CONSENT_TYPES)
        .find(typeFilter)
        .toArray()

      const statuses: UserConsentStatus[] = []
      for (const typeDoc of typeDocs) {
        const consentTypeId = typeDoc['id'] as string
        const consentType: ConsentType = {
          id: consentTypeId,
          name: typeDoc['name'] as string,
          description: typeDoc['description'] as string,
          scope: typeDoc['scope'] as ConsentType['scope'],
          isActive: typeDoc['is_active'] as boolean,
          createdAt: typeDoc['created_at'] as string,
          updatedAt: typeDoc['updated_at'] as string,
        }

        const currentVersion =
          await this.getCurrentConsentVersion(consentTypeId)
        const userConsent = await this.getUserConsent(
          params.userId,
          consentTypeId,
        )
        const hasActive = await this.hasActiveConsent(
          params.userId,
          consentTypeId,
        )
        const consentOptions = await this.getConsentOptions(consentTypeId)

        statuses.push({
          consentType,
          currentVersion,
          userConsent: userConsent ?? undefined,
          hasActiveConsent: hasActive,
          consentOptions,
          selectedOptions: userConsent?.granularOptions,
        })
      }
      return statuses
    } catch (error: unknown) {
      logger.error('Unexpected error in getUserConsentStatus', error)
      throw new Error('Failed to fetch user consent status', { cause: error })
    }
  }

  /**
   * Grant consent for a user
   */
  async grantConsent(params: GrantConsentParams): Promise<UserConsent> {
    try {
      const existing = await mongoClient.db
        .collection(CONSENT_TABLES.USER_CONSENTS)
        .findOne({
          user_id: params.userId,
          consent_version_id: params.consentVersionId,
          is_active: true,
        })
      if (existing) {
        throw new Error('User already has an active consent for this version')
      }

      const now = new Date().toISOString()
      const consentId = uuidv4()
      const hashedIp = params.ipAddress
        ? crypto.createHash('sha256').update(params.ipAddress).digest('hex')
        : null

      const consentDoc = {
        id: consentId,
        user_id: params.userId,
        consent_version_id: params.consentVersionId,
        granted_at: now,
        ip_address: hashedIp,
        user_agent: params.userAgent ?? null,
        is_active: true,
        withdrawal_date: null,
        withdrawal_reason: null,
        granular_options: params.granularOptions ?? null,
        proof_of_consent: params.proofOfConsent ?? null,
        created_at: now,
        updated_at: now,
      }
      await mongoClient.db
        .collection(CONSENT_TABLES.USER_CONSENTS)
        .insertOne(consentDoc)

      const auditDoc = {
        id: uuidv4(),
        user_id: params.userId,
        consent_id: consentId,
        action: 'grant',
        action_timestamp: now,
        performed_by: params.userId,
        ip_address: hashedIp,
        user_agent: params.userAgent ?? null,
        details: {
          consentVersionId: params.consentVersionId,
          granularOptions: params.granularOptions ?? {},
        },
        created_at: now,
      }
      await mongoClient.db
        .collection(CONSENT_TABLES.CONSENT_AUDIT_TRAIL)
        .insertOne(auditDoc)

      return {
        id: consentId,
        userId: params.userId,
        consentVersionId: params.consentVersionId,
        grantedAt: now,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        isActive: true,
        withdrawalDate: undefined,
        withdrawalReason: undefined,
        granularOptions: params.granularOptions,
        proofOfConsent: params.proofOfConsent,
        createdAt: now,
        updatedAt: now,
      }
    } catch (error: unknown) {
      logger.error('Unexpected error in grantConsent', error)
      throw new Error('Failed to grant consent', { cause: error })
    }
  }

  /**
   * Withdraw a user's consent
   */
  async withdrawConsent(params: WithdrawConsentParams): Promise<boolean> {
    try {
      const existing = await mongoClient.db
        .collection(CONSENT_TABLES.USER_CONSENTS)
        .findOne({
          id: params.consentId,
          user_id: params.userId,
          is_active: true,
        })
      if (!existing) {
        return false
      }

      const now = new Date().toISOString()
      const updateResult = await mongoClient.db
        .collection(CONSENT_TABLES.USER_CONSENTS)
        .updateOne(
          { id: params.consentId },
          {
            $set: {
              is_active: false,
              withdrawal_date: now,
              withdrawal_reason: params.reason ?? null,
              updated_at: now,
            },
          },
        )
      if (updateResult.matchedCount === 0) {
        return false
      }

      const hashedIp = params.ipAddress
        ? crypto.createHash('sha256').update(params.ipAddress).digest('hex')
        : null

      const auditDoc = {
        id: uuidv4(),
        user_id: params.userId,
        consent_id: params.consentId,
        action: 'withdraw',
        action_timestamp: now,
        performed_by: params.userId,
        ip_address: hashedIp,
        user_agent: params.userAgent ?? null,
        details: { reason: params.reason ?? null },
        created_at: now,
      }
      await mongoClient.db
        .collection(CONSENT_TABLES.CONSENT_AUDIT_TRAIL)
        .insertOne(auditDoc)

      return true
    } catch (error: unknown) {
      logger.error('Unexpected error in withdrawConsent', error)
      throw new Error('Failed to withdraw consent', { cause: error })
    }
  }

  /**
   * Check if a user has active consent for a specific type
   */
  async hasActiveConsent(
    userId: string,
    consentTypeId: string,
  ): Promise<boolean> {
    try {
      const pipeline = [
        { $match: { user_id: userId, is_active: true } },
        {
          $lookup: {
            from: CONSENT_TABLES.CONSENT_VERSIONS,
            localField: 'consent_version_id',
            foreignField: 'id',
            as: 'version',
          },
        },
        { $unwind: '$version' },
        { $match: { 'version.consent_type_id': consentTypeId } },
        { $limit: 1 },
      ]
      const cursor = mongoClient.db
        .collection(CONSENT_TABLES.USER_CONSENTS)
        .aggregate(pipeline)
      const data = await cursor.toArray()
      return data.length > 0
    } catch (error: unknown) {
      logger.error('Unexpected error in hasActiveConsent', error)
      throw new Error('Failed to check active consent', { cause: error })
    }
  }
}

// Export a singleton instance
export const consentService = new ConsentService()

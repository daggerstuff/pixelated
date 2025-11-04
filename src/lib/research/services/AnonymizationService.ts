import { getLogger } from '@/lib/logging'
import { ResearchDataPoint } from '@/lib/research/types/research-types'
import crypto from 'crypto'

const logger = getLogger({ prefix: 'AnonymizationService' })

export interface AnonymizationConfig {
  kAnonymity: number
  epsilon: number
  delta: number
  temporalEpsilon: number
  fieldLevelEncryption: boolean
  noiseInjection: boolean
}

export interface AnonymizationResult {
  anonymizedData: ResearchDataPoint[]
  privacyMetrics: {
    kValue: number
    epsilonValue: number
    reidentificationRisk: number
    uniquenessScore: number
  }
  auditLog: AnonymizationAuditLog[]
}

export interface AnonymizationAuditLog {
  timestamp: string
  operation: string
  field: string
  originalValue?: string
  anonymizedValue?: string
  privacyLevel: string
}

export class AnonymizationService {
  private config: AnonymizationConfig

  constructor(
    config: AnonymizationConfig = {
      kAnonymity: 5,
      epsilon: 0.1,
      delta: 0.00001,
      temporalEpsilon: 0.05,
      fieldLevelEncryption: true,
      noiseInjection: true,
    },
  ) {
    this.config = config
  }

  /**
   * Main anonymization pipeline for research data
   */
  async anonymizeResearchData(
    rawData: ResearchDataPoint[],
    consentLevel: 'full' | 'limited' | 'minimal',
  ): Promise<AnonymizationResult> {
    logger.info('Starting anonymization pipeline', {
      dataSize: rawData.length,
      consentLevel,
      config: this.config,
    })

    try {
      // Step 1: K-anonymity implementation
      const kAnonymizedData = this.applyKAnonymity(
        rawData,
        this.config.kAnonymity,
      )

      // Step 2: Differential privacy noise injection
      const differentialPrivateData = this.applyDifferentialPrivacy(
        kAnonymizedData,
        this.config.epsilon,
        this.config.delta,
      )

      // Step 3: Temporal data obfuscation
      const temporalObfuscatedData = this.obfuscateTemporalData(
        differentialPrivateData,
        this.config.temporalEpsilon,
      )

      // Step 4: Field-level encryption for sensitive fields
      const encryptedData = this.config.fieldLevelEncryption
        ? this.encryptSensitiveFields(temporalObfuscatedData)
        : temporalObfuscatedData

      // Step 5: Cross-session linkage prevention
      const finalAnonymizedData = this.preventCrossSessionLinkage(encryptedData)

      // Calculate privacy metrics
      const privacyMetrics = this.calculatePrivacyMetrics(finalAnonymizedData)

      // Generate audit log
      const auditLog = this.generateAuditLog(rawData, finalAnonymizedData)

      logger.info('Anonymization pipeline completed', {
        privacyMetrics,
        originalSize: rawData.length,
        finalSize: finalAnonymizedData.length,
      })

      return {
        anonymizedData: finalAnonymizedData,
        privacyMetrics,
        auditLog,
      }
    } catch (error) {
      logger.error('Anonymization pipeline failed', { error })
      throw new Error(
        `Anonymization failed: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      )
    }
  }

  /**
   * Apply k-anonymity to prevent re-identification
   */
  private applyKAnonymity(
    data: ResearchDataPoint[],
    k: number,
  ): ResearchDataPoint[] {
    const quasiIdentifiers = ['age', 'gender', 'location', 'sessionDuration']

    // Group by quasi-identifiers
    const groups = new Map<string, ResearchDataPoint[]>()

    data.forEach((record) => {
      const key = quasiIdentifiers
        .map((field) => this.getFieldValue(record, field))
        .join('|')

      if (!groups.has(key)) {
        groups.set(key, [])
      }
      groups.get(key)!.push(record)
    })

    // Generalize groups with less than k records
    const anonymizedData: ResearchDataPoint[] = []

    groups.forEach((group) => {
      if (group.length >= k) {
        // Group meets k-anonymity requirement
        anonymizedData.push(...group)
      } else {
        // Generalize quasi-identifiers
        const generalizedGroup = this.generalizeQuasiIdentifiers(
          group,
          quasiIdentifiers,
        )
        anonymizedData.push(...generalizedGroup)
      }
    })

    return anonymizedData
  }

  /**
   * Apply differential privacy with Laplacian noise
   */
  private applyDifferentialPrivacy(
    data: ResearchDataPoint[],
    epsilon: number,
    _delta: number,
  ): ResearchDataPoint[] {
    const sensitivity = this.calculateSensitivity(data)

    return data.map((record) => {
      const noisyRecord = { ...record }

      // Add Laplacian noise to numerical fields
      if (record.emotionScores) {
        noisyRecord.emotionScores = Object.fromEntries(
          Object.entries(record.emotionScores).map(([emotion, score]) => [
            emotion,
            Math.max(
              0,
              Math.min(1, score + this.laplaceNoise(sensitivity / epsilon)),
            ),
          ]),
        )
      }

      if (record.techniqueEffectiveness) {
        noisyRecord.techniqueEffectiveness = Object.fromEntries(
          Object.entries(record.techniqueEffectiveness).map(
            ([technique, effectiveness]) => [
              technique,
              Math.max(
                0,
                Math.min(
                  100,
                  effectiveness + this.laplaceNoise(sensitivity / epsilon),
                ),
              ),
            ],
          ),
        )
      }

      return noisyRecord
    })
  }

  /**
   * Obfuscate temporal data to prevent temporal linkage attacks
   */
  private obfuscateTemporalData(
    data: ResearchDataPoint[],
    temporalEpsilon: number,
  ): ResearchDataPoint[] {
    return data.map((record) => {
      const obfuscatedRecord = { ...record }

      // Add noise to timestamps
      if (record.timestamp) {
        const noise = this.laplaceNoise((3600 * 1000) / temporalEpsilon) // ~1 hour noise
        const timestamp = new Date(record.timestamp)
        obfuscatedRecord.timestamp = new Date(timestamp.getTime() + noise)
      }

      // Obfuscate session duration
      if (record.sessionDuration) {
        const noise = this.laplaceNoise(300 / temporalEpsilon) // ~5 minutes noise
        obfuscatedRecord.sessionDuration = Math.max(
          0,
          record.sessionDuration + noise,
        )
      }

      return obfuscatedRecord
    })
  }

  /**
   * Encrypt sensitive fields using AES-256
   */
  private encryptSensitiveFields(
    data: ResearchDataPoint[],
  ): ResearchDataPoint[] {
    const sensitiveFields = ['clientId', 'therapistId', 'sessionNotes'] as const

    return data.map((record) => {
      const encryptedRecord = { ...record }

      sensitiveFields.forEach((field) => {
        const value = this.getFieldValue(record, field)
        if (value && typeof value === 'string') {
          const encryptedValue = this.encryptField(value)
          this.setFieldValue(encryptedRecord, field, encryptedValue)
        }
      })

      return encryptedRecord
    })
  }

  /**
   * Prevent cross-session linkage attacks
   */
  private preventCrossSessionLinkage(
    data: ResearchDataPoint[],
  ): ResearchDataPoint[] {
    // Generate unique session identifiers for each record
    const sessionMap = new Map<string, string>()

    return data.map((record) => {
      const linkageRecord = { ...record }

      // Replace original session ID with anonymized version
      if (record.sessionId) {
        if (!sessionMap.has(record.sessionId)) {
          sessionMap.set(record.sessionId, crypto.randomUUID())
        }
        linkageRecord.sessionId = sessionMap.get(record.sessionId)!
      }

      return linkageRecord
    })
  }

  /**
   * Calculate privacy metrics for the anonymized data
   */
  private calculatePrivacyMetrics(data: ResearchDataPoint[]): {
    kValue: number
    epsilonValue: number
    reidentificationRisk: number
    uniquenessScore: number
  } {
    // Calculate k-value
    const quasiIdentifiers = ['age', 'gender', 'location']
    const groups = new Map<string, number>()

    data.forEach((record) => {
      const key = quasiIdentifiers
        .map((field) => this.getFieldValue(record, field))
        .join('|')
      groups.set(key, (groups.get(key) || 0) + 1)
    })

    const kValue = Math.min(...Array.from(groups.values()))

    // Calculate uniqueness score
    const totalRecords = data.length
    const uniqueRecords = Array.from(groups.values()).filter(
      (count) => count === 1,
    ).length
    const uniquenessScore = uniqueRecords / totalRecords

    // Estimate re-identification risk
    const reidentificationRisk = Math.min(1, uniquenessScore * 10)

    return {
      kValue,
      epsilonValue: this.config.epsilon,
      reidentificationRisk,
      uniquenessScore,
    }
  }

  /**
   * Generate audit log for transparency
   */
  private generateAuditLog(
    _originalData: ResearchDataPoint[],
    _anonymizedData: ResearchDataPoint[],
  ): AnonymizationAuditLog[] {
    const auditLog: AnonymizationAuditLog[] = []

    // Log anonymization operations
    auditLog.push({
      timestamp: new Date().toISOString(),
      operation: 'k-anonymity',
      field: 'quasi-identifiers',
      privacyLevel: 'high',
    })

    auditLog.push({
      timestamp: new Date().toISOString(),
      operation: 'differential-privacy',
      field: 'numerical-fields',
      privacyLevel: 'high',
    })

    auditLog.push({
      timestamp: new Date().toISOString(),
      operation: 'temporal-obfuscation',
      field: 'timestamps',
      privacyLevel: 'medium',
    })

    return auditLog
  }

  /**
   * Helper methods
   */
  private getFieldValue(record: ResearchDataPoint, field: string): unknown {
    return (record as unknown as Record<string, unknown>)[field]
  }

  private setFieldValue(
    record: ResearchDataPoint,
    field: string,
    value: unknown,
  ): void {
    ;(record as unknown as Record<string, unknown>)[field] = value
  }

  private generalizeQuasiIdentifiers(
    records: ResearchDataPoint[],
    _quasiIdentifiers: string[],
  ): ResearchDataPoint[] {
    return records.map((record) => {
      const generalized = { ...record }

      // Age generalization (e.g., 25 → 20-30)
      if (record.age && typeof record.age === 'number') {
        const ageGroup = Math.floor(record.age / 10) * 10
        generalized.age = `${ageGroup}-${ageGroup + 9}`
      }

      // Location generalization (e.g., "New York, NY" → "Northeast")
      if (record.location) {
        generalized.location = this.generalizeLocation(record.location)
      }

      return generalized
    })
  }

  private generalizeLocation(location: string): string {
    const regions = {
      northeast: ['NY', 'NJ', 'CT', 'MA', 'RI', 'VT', 'NH', 'ME', 'PA'],
      southeast: [
        'FL',
        'GA',
        'SC',
        'NC',
        'VA',
        'TN',
        'KY',
        'WV',
        'AL',
        'MS',
        'LA',
        'AR',
      ],
      midwest: [
        'OH',
        'IN',
        'IL',
        'MI',
        'WI',
        'MN',
        'IA',
        'MO',
        'ND',
        'SD',
        'NE',
        'KS',
      ],
      southwest: ['TX', 'OK', 'NM', 'AZ'],
      west: ['CA', 'NV', 'UT', 'CO', 'WY', 'MT', 'ID', 'OR', 'WA', 'AK', 'HI'],
    }

    const state = location.split(',').pop()?.trim()
    if (!state) return 'Unknown'

    for (const [region, states] of Object.entries(regions)) {
      if (states.includes(state)) {
        return region.charAt(0).toUpperCase() + region.slice(1)
      }
    }

    return 'Other'
  }

  private calculateSensitivity(_data: ResearchDataPoint[]): number {
    // Calculate global sensitivity for differential privacy
    const maxChange = 1.0 // Maximum possible change in any single record
    return maxChange
  }

  private laplaceNoise(scale: number): number {
    const u = Math.random() - 0.5
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u))
  }

  private encryptField(value: string): string {
    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(
      process.env.RESEARCH_ENCRYPTION_KEY || 'default-key',
      'salt',
      32,
    )
    const iv = crypto.randomBytes(16)

    const cipher = crypto.createCipheriv(algorithm, key, iv)
    let encrypted = cipher.update(value, 'utf8', 'hex')
    encrypted += cipher.final('hex')

    return iv.toString('hex') + ':' + encrypted
  }

  /**
   * Validate anonymization effectiveness
   */
  async validateAnonymization(data: ResearchDataPoint[]): Promise<{
    isValid: boolean
    issues: string[]
    recommendations: string[]
  }> {
    const issues: string[] = []
    const recommendations: string[] = []

    // Check k-anonymity
    const quasiIdentifiers = ['age', 'gender', 'location']
    const groups = new Map<string, number>()

    data.forEach((record) => {
      const key = quasiIdentifiers
        .map((field) => this.getFieldValue(record, field))
        .join('|')
      groups.set(key, (groups.get(key) || 0) + 1)
    })

    const minK = Math.min(...Array.from(groups.values()))
    if (minK < this.config.kAnonymity) {
      issues.push(
        `K-anonymity requirement not met: ${minK} < ${this.config.kAnonymity}`,
      )
      recommendations.push(
        'Increase generalization or reduce quasi-identifiers',
      )
    }

    // Check uniqueness
    const uniquenessScore =
      Array.from(groups.values()).filter((count) => count === 1).length /
      data.length
    if (uniquenessScore > 0.05) {
      issues.push(`High uniqueness score: ${uniquenessScore.toFixed(3)}`)
      recommendations.push('Apply stronger generalization or add noise')
    }

    return {
      isValid: issues.length === 0,
      issues,
      recommendations,
    }
  }
}

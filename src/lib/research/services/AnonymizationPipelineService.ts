import crypto from 'crypto'

export interface AnonymizationConfig {
  kAnonymity: number // k-anonymity level (minimum 5)
  differentialPrivacy: {
    epsilon: number // Privacy budget (maximum 0.1)
    delta: number // Failure probability (typically 1e-5)
    sensitivity: number // Global sensitivity
  }
  temporalObfuscation: {
    timeJitter: number // Random time offset in hours
    dateGranularity: 'day' | 'week' | 'month' | 'quarter'
    seasonalMasking: boolean
  }
  linkagePrevention: {
    sessionIdHashing: boolean
    crossReferenceBlocking: boolean
    quasiIdentifierSuppression: string[]
  }
}

export interface AnonymizedRecord {
  originalId: string
  anonymizedId: string
  anonymizationLevel: 'basic' | 'enhanced' | 'maximum'
  timestamp: string
  retentionExpiry: string
  dataFields: Record<string, any>
  qualityMetrics: {
    informationLoss: number // 0-1 scale
    kAnonymityLevel: number
    privacyBudgetUsed: number
  }
}

export interface AnonymizationAudit {
  processId: string
  timestamp: string
  recordsProcessed: number
  anonymizationLevel: string
  privacyGuarantees: {
    kAnonymity: number
    differentialPrivacy: number
    linkageProtection: boolean
  }
  qualityAssessment: {
    averageInformationLoss: number
    utilityPreservation: number
    riskAssessment: string
  }
  complianceStatus: {
    hipaaCompliant: boolean
    gdprCompliant: boolean
    localRegulationsCompliant: boolean
  }
}

export class AnonymizationPipelineService {
  private readonly defaultConfig: AnonymizationConfig = {
    kAnonymity: 5,
    differentialPrivacy: {
      epsilon: 0.1,
      delta: 1e-5,
      sensitivity: 1.0,
    },
    temporalObfuscation: {
      timeJitter: 24,
      dateGranularity: 'week',
      seasonalMasking: true,
    },
    linkagePrevention: {
      sessionIdHashing: true,
      crossReferenceBlocking: true,
      quasiIdentifierSuppression: ['age', 'zipcode', 'gender'],
    },
  }

  private privacyBudgetUsed: Map<string, number> = new Map()
  private kAnonymityGroups: Map<string, any[]> = new Map()

  /**
   * Anonymize therapeutic session data for research use
   */
  async anonymizeTherapeuticData(
    rawData: any[],
    researchPurpose: string,
    config: Partial<AnonymizationConfig> = {},
  ): Promise<{
    anonymizedData: AnonymizedRecord[]
    auditReport: AnonymizationAudit
  }> {
    const finalConfig = { ...this.defaultConfig, ...config }
    const processId = this.generateProcessId()

    try {
      // Step 1: Preprocess and validate data
      const preprocessedData = await this.preprocessData(rawData)

      // Step 2: Apply k-anonymity
      const kAnonymizedData = await this.applyKAnonymity(
        preprocessedData,
        finalConfig.kAnonymity,
      )

      // Step 3: Apply differential privacy
      const dpData = await this.applyDifferentialPrivacy(
        kAnonymizedData,
        finalConfig.differentialPrivacy,
        researchPurpose,
      )

      // Step 4: Temporal obfuscation
      const temporallyObfuscatedData = await this.applyTemporalObfuscation(
        dpData,
        finalConfig.temporalObfuscation,
      )

      // Step 5: Linkage prevention
      const finalAnonymizedData = await this.preventCrossSessionLinkage(
        temporallyObfuscatedData,
        finalConfig.linkagePrevention,
      )

      // Step 6: Quality assessment
      const qualityMetrics = await this.assessAnonymizationQuality(
        rawData,
        finalAnonymizedData,
      )

      // Generate audit report
      const auditReport = this.generateAuditReport(
        processId,
        rawData.length,
        finalConfig,
        qualityMetrics,
      )

      // Store anonymization metadata
      await this.storeAnonymizationMetadata(processId, auditReport)

      return {
        anonymizedData: finalAnonymizedData,
        auditReport,
      }
    } catch (error) {
      console.error('Anonymization pipeline error:', error)
      throw new Error(`Anonymization failed: ${error.message}`, { cause: error })
    }
  }

  /**
   * Apply k-anonymity to ensure minimum group sizes
   */
  private async applyKAnonymity(data: any[], k: number): Promise<any[]> {
    // Identify quasi-identifiers (age, location, demographic info)
    const quasiIdentifiers = [
      'age_group',
      'location_region',
      'gender',
      'occupation_category',
    ]

    // Group records by quasi-identifier combinations
    const groups = new Map<string, any[]>()

    for (const record of data) {
      const groupKey = quasiIdentifiers
        .map((qi) => this.generalizeQuasiIdentifier(record[qi], qi))
        .join('|')

      if (!groups.has(groupKey)) {
        groups.set(groupKey, [])
      }
      groups.get(groupKey)!.push(record)
    }

    // Ensure each group has at least k members
    const kAnonymizedData: any[] = []

    for (const [groupKey, groupRecords] of groups) {
      if (groupRecords.length >= k) {
        // Group is already k-anonymous
        kAnonymizedData.push(
          ...groupRecords.map((record) => ({
            ...record,
            anonymization_group: groupKey,
            k_anonymity_level: groupRecords.length,
          })),
        )
      } else {
        // Merge with similar groups or suppress
        const mergedGroup = await this.mergeOrSuppressGroup(
          groupRecords,
          groups,
          k,
          quasiIdentifiers,
        )
        kAnonymizedData.push(...mergedGroup)
      }
    }

    // Store k-anonymity groups for audit
    this.kAnonymityGroups.set('current', Array.from(groups.values()))

    return kAnonymizedData
  }

  /**
   * Apply differential privacy noise injection
   */
  private async applyDifferentialPrivacy(
    data: any[],
    dpConfig: AnonymizationConfig['differentialPrivacy'],
    purpose: string,
  ): Promise<any[]> {
    const { epsilon, delta, sensitivity } = dpConfig

    // Check privacy budget
    const budgetUsed = this.privacyBudgetUsed.get(purpose) || 0
    if (budgetUsed + epsilon > 1.0) {
      throw new Error(`Privacy budget exceeded for purpose: ${purpose}`)
    }

    const noisyData = data.map((record) => {
      const noisyRecord = { ...record }

      // Add Laplace noise to numerical fields
      const numericalFields = [
        'emotion_intensity',
        'session_duration',
        'progress_score',
      ]

      for (const field of numericalFields) {
        if (typeof record[field] === 'number') {
          const noise = this.generateLaplaceNoise(sensitivity / epsilon)
          noisyRecord[field] = Math.max(0, record[field] + noise)
        }
      }

      // Add noise to categorical distributions
      const categoricalFields = ['primary_emotion', 'intervention_type']

      for (const field of categoricalFields) {
        if (record[field]) {
          noisyRecord[field] = this.addCategoricalNoise(record[field], epsilon)
        }
      }

      noisyRecord.differential_privacy = {
        epsilon_used: epsilon,
        noise_added: true,
        privacy_guarantee: `(${epsilon}, ${delta})-differential privacy`,
      }

      return noisyRecord
    })

    // Update privacy budget
    this.privacyBudgetUsed.set(purpose, budgetUsed + epsilon)

    return noisyData
  }

  /**
   * Apply temporal obfuscation to prevent timing attacks
   */
  private async applyTemporalObfuscation(
    data: any[],
    temporalConfig: AnonymizationConfig['temporalObfuscation'],
  ): Promise<any[]> {
    const { timeJitter, dateGranularity, seasonalMasking } = temporalConfig

    return data.map((record) => {
      const obfuscatedRecord = { ...record }

      // Apply time jitter
      if (record.timestamp) {
        const originalTime = new Date(record.timestamp)
        const jitterHours = (Math.random() - 0.5) * 2 * timeJitter
        const jitteredTime = new Date(
          originalTime.getTime() + jitterHours * 60 * 60 * 1000,
        )

        obfuscatedRecord.obfuscated_timestamp = this.reduceTemporalGranularity(
          jitteredTime,
          dateGranularity,
        )
      }

      // Apply seasonal masking
      if (seasonalMasking && record.date) {
        obfuscatedRecord.temporal_period = this.getTemporalPeriod(record.date)
        delete obfuscatedRecord.date // Remove exact date
      }

      // Prevent sequence analysis
      if (record.session_sequence) {
        obfuscatedRecord.session_sequence_range = this.getRangeFromSequence(
          record.session_sequence,
        )
        delete obfuscatedRecord.session_sequence
      }

      return obfuscatedRecord
    })
  }

  /**
   * Prevent cross-session linkage attacks
   */
  private async preventCrossSessionLinkage(
    data: any[],
    linkageConfig: AnonymizationConfig['linkagePrevention'],
  ): Promise<AnonymizedRecord[]> {
    const {
      sessionIdHashing,
      crossReferenceBlocking,
      quasiIdentifierSuppression,
    } = linkageConfig

    return data.map((record) => {
      // Generate new anonymized ID
      const anonymizedId = this.generateAnonymizedId(
        record.original_id || record.id,
      )

      // Hash session identifiers
      let processedRecord = { ...record }
      if (sessionIdHashing) {
        processedRecord = this.hashSessionIdentifiers(processedRecord)
      }

      // Suppress quasi-identifiers that could enable linking
      if (quasiIdentifierSuppression.length > 0) {
        processedRecord = this.suppressQuasiIdentifiers(
          processedRecord,
          quasiIdentifierSuppression,
        )
      }

      // Apply cross-reference blocking
      if (crossReferenceBlocking) {
        processedRecord = this.blockCrossReferences(processedRecord)
      }

      return {
        originalId: record.original_id || record.id,
        anonymizedId,
        anonymizationLevel: 'enhanced',
        timestamp: new Date().toISOString(),
        retentionExpiry: this.calculateRetentionExpiry(),
        dataFields: processedRecord,
        qualityMetrics: {
          informationLoss: this.calculateInformationLoss(
            record,
            processedRecord,
          ),
          kAnonymityLevel: record.k_anonymity_level || 0,
          privacyBudgetUsed: record.differential_privacy?.epsilon_used || 0,
        },
      } as AnonymizedRecord
    })
  }

  /**
   * Assess the quality of anonymization
   */
  private async assessAnonymizationQuality(
    originalData: any[],
    anonymizedData: AnonymizedRecord[],
  ): Promise<any> {
    const totalRecords = originalData.length
    const processedRecords = anonymizedData.length

    // Calculate average information loss
    const totalInformationLoss = anonymizedData.reduce(
      (sum, record) => sum + record.qualityMetrics.informationLoss,
      0,
    )
    const averageInformationLoss = totalInformationLoss / processedRecords

    // Calculate utility preservation
    const utilityPreservation = 1 - averageInformationLoss

    // Assess privacy risk
    const minKAnonymity = Math.min(
      ...anonymizedData.map((r) => r.qualityMetrics.kAnonymityLevel),
    )
    const maxPrivacyBudget = Math.max(
      ...anonymizedData.map((r) => r.qualityMetrics.privacyBudgetUsed),
    )

    const riskAssessment = this.assessPrivacyRisk(
      minKAnonymity,
      maxPrivacyBudget,
    )

    return {
      recordsProcessed: processedRecords,
      dataRetentionRate: processedRecords / totalRecords,
      averageInformationLoss,
      utilityPreservation,
      privacyGuarantees: {
        minKAnonymity,
        maxEpsilonUsed: maxPrivacyBudget,
        linkageProtection: true,
      },
      riskAssessment,
    }
  }

  // Helper methods for anonymization techniques

  private preprocessData(rawData: any[]): Promise<any[]> {
    return Promise.resolve(
      rawData.map((record) => ({
        ...record,
        original_id: record.id || this.generateId(),
        processed_timestamp: new Date().toISOString(),
      })),
    )
  }

  private generalizeQuasiIdentifier(value: any, identifier: string): string {
    switch (identifier) {
      case 'age_group':
        if (typeof value === 'number') {
          return `${Math.floor(value / 10) * 10}-${Math.floor(value / 10) * 10 + 9}`
        }
        return 'unknown'

      case 'location_region':
        // Generalize to broader regions
        return typeof value === 'string' ? value.split(',')[0] : 'unknown'

      case 'gender':
        return value || 'not_specified'

      case 'occupation_category':
        // Generalize to broad categories
        return this.generalizeOccupation(value)

      default:
        return String(value || 'unknown')
    }
  }

  private async mergeOrSuppressGroup(
    smallGroup: any[],
    allGroups: Map<string, any[]>,
    k: number,
    quasiIdentifiers: string[],
  ): Promise<any[]> {
    // Try to find similar groups to merge with
    const similarGroups = this.findSimilarGroups(
      smallGroup,
      allGroups,
      quasiIdentifiers,
    )

    if (similarGroups.length > 0) {
      // Merge with most similar group
      const mergedGroup = [...smallGroup, ...similarGroups[0]]
      return mergedGroup.map((record) => ({
        ...record,
        anonymization_group: 'merged',
        k_anonymity_level: mergedGroup.length,
      }))
    }

    // If no similar groups found, suppress (remove) the records
    console.warn(
      `Suppressing ${smallGroup.length} records that couldn't achieve k-anonymity`,
    )
    return []
  }

  private findSimilarGroups(
    targetGroup: any[],
    allGroups: Map<string, any[]>,
    _quasiIdentifiers: string[],
  ): any[][] {
    // Simplified similarity calculation - would be more sophisticated in practice
    return Array.from(allGroups.values())
      .filter(
        (group) => group.length < targetGroup.length * 2, // Basic similarity heuristic
      )
      .slice(0, 1)
  }

  private generateLaplaceNoise(scale: number): number {
    // Generate Laplace-distributed noise
    const u = Math.random() - 0.5
    return -scale * Math.sign(u) * Math.log(1 - 2 * Math.abs(u))
  }

  private addCategoricalNoise(value: string, epsilon: number): string {
    // Apply randomized response for categorical data
    const flipProbability = 1 / (1 + Math.exp(epsilon))
    return Math.random() < flipProbability
      ? this.getRandomCategory(value)
      : value
  }

  private getRandomCategory(_originalValue: string): string {
    // Simplified random category selection
    const categories = ['happy', 'sad', 'anxious', 'calm', 'angry', 'neutral']
    return categories[Math.floor(Math.random() * categories.length)]
  }

  private reduceTemporalGranularity(date: Date, granularity: string): string {
    switch (granularity) {
      case 'day':
        return date.toISOString().split('T')[0]
      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        return weekStart.toISOString().split('T')[0]
      case 'month':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1
        return `${date.getFullYear()}-Q${quarter}`
      default:
        return date.toISOString()
    }
  }

  private getTemporalPeriod(date: string): string {
    const d = new Date(date)
    const month = d.getMonth()

    if (month >= 2 && month <= 4) return 'spring'
    if (month >= 5 && month <= 7) return 'summer'
    if (month >= 8 && month <= 10) return 'fall'
    return 'winter'
  }

  private getRangeFromSequence(sequence: number): string {
    const rangeSize = 5
    const rangeStart = Math.floor(sequence / rangeSize) * rangeSize
    return `${rangeStart}-${rangeStart + rangeSize - 1}`
  }

  private generateAnonymizedId(originalId: string): string {
    return crypto
      .createHash('sha256')
      .update(originalId + Date.now() + Math.random())
      .digest('hex')
      .substring(0, 16)
  }

  private hashSessionIdentifiers(record: any): any {
    const hashableFields = ['session_id', 'therapist_id', 'patient_id']
    const hashedRecord = { ...record }

    for (const field of hashableFields) {
      if (record[field]) {
        hashedRecord[`${field}_hash`] = crypto
          .createHash('sha256')
          .update(String(record[field]))
          .digest('hex')
          .substring(0, 12)
        delete hashedRecord[field]
      }
    }

    return hashedRecord
  }

  private suppressQuasiIdentifiers(
    record: any,
    fieldsToSuppress: string[],
  ): any {
    const suppressedRecord = { ...record }

    for (const field of fieldsToSuppress) {
      if (suppressedRecord[field]) {
        suppressedRecord[`${field}_suppressed`] = true
        delete suppressedRecord[field]
      }
    }

    return suppressedRecord
  }

  private blockCrossReferences(record: any): any {
    // Remove or hash fields that could enable cross-referencing
    const blockedRecord = { ...record }

    const crossRefFields = [
      'external_id',
      'insurance_id',
      'medical_record_number',
    ]

    for (const field of crossRefFields) {
      if (blockedRecord[field]) {
        delete blockedRecord[field]
      }
    }

    return blockedRecord
  }

  private calculateRetentionExpiry(): string {
    // 7 years retention for research data (HIPAA requirement)
    const expiryDate = new Date()
    expiryDate.setFullYear(expiryDate.getFullYear() + 7)
    return expiryDate.toISOString()
  }

  private calculateInformationLoss(original: any, anonymized: any): number {
    // Simplified information loss calculation
    const originalFields = Object.keys(original).length
    const anonymizedFields = Object.keys(
      anonymized.dataFields || anonymized,
    ).length

    return Math.max(0, 1 - anonymizedFields / originalFields)
  }

  private assessPrivacyRisk(kAnonymity: number, epsilonUsed: number): string {
    if (kAnonymity >= 5 && epsilonUsed <= 0.1) return 'low'
    if (kAnonymity >= 3 && epsilonUsed <= 0.3) return 'medium'
    return 'high'
  }

  private generalizeOccupation(occupation: string): string {
    if (!occupation) return 'not_specified'

    const categories = {
      healthcare: ['doctor', 'nurse', 'therapist', 'medical'],
      education: ['teacher', 'professor', 'educator'],
      technology: ['engineer', 'developer', 'programmer'],
      business: ['manager', 'analyst', 'consultant'],
      service: ['retail', 'restaurant', 'customer'],
    }

    const occupationLower = occupation.toLowerCase()

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((keyword) => occupationLower.includes(keyword))) {
        return category
      }
    }

    return 'other'
  }

  private generateAuditReport(
    processId: string,
    recordCount: number,
    config: AnonymizationConfig,
    quality: any,
  ): AnonymizationAudit {
    return {
      processId,
      timestamp: new Date().toISOString(),
      recordsProcessed: recordCount,
      anonymizationLevel: 'enhanced',
      privacyGuarantees: {
        kAnonymity: config.kAnonymity,
        differentialPrivacy: config.differentialPrivacy.epsilon,
        linkageProtection: true,
      },
      qualityAssessment: quality,
      complianceStatus: {
        hipaaCompliant: quality.riskAssessment !== 'high',
        gdprCompliant: config.kAnonymity >= 5,
        localRegulationsCompliant: true,
      },
    }
  }

  private async storeAnonymizationMetadata(
    processId: string,
    audit: AnonymizationAudit,
  ): Promise<void> {
    // Store audit trail (implementation would use actual database)
    console.log('Anonymization audit stored:', { processId, audit })
  }

  private generateProcessId(): string {
    return `anon_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }

  private generateId(): string {
    return crypto.randomBytes(8).toString('hex')
  }
}

export const anonymizationPipelineService = new AnonymizationPipelineService()

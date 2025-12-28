/**
 * Advanced Patient Management System for Pixelated Empathy
 * Comprehensive patient data management with privacy and security
 */

import type {
  PatientProfile,
  TreatmentPlan,
  ProgressMetrics,
} from '@/types/patient'
import encryptionManager from '@/lib/security/encryptionManager'

export interface PatientSearchCriteria {
  name?: string
  therapistId?: string
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  lastSeenBefore?: Date
  lastSeenAfter?: Date
  diagnosis?: string[]
  treatmentStatus?: 'active' | 'inactive' | 'completed' | 'discharged'
}

export interface PatientUpdateData {
  contact?: Partial<PatientProfile['contact']>
  emergencyContact?: Partial<PatientProfile['emergencyContact']>
  treatmentPlan?: Partial<TreatmentPlan>
  notes?: string
  customFields?: Record<string, any>
}

export interface PatientTransferRequest {
  fromTherapistId: string
  toTherapistId: string
  reason: string
  patientConsent: boolean
  transferDate: Date
  notes?: string
}

/**
 * Advanced Patient Management System
 */
class PatientManager {
  private patientCache = new Map<string, PatientProfile>()
  private searchIndex = new Map<string, Set<string>>() // field -> patient IDs

  constructor() {
    this.initializeSearchIndex()
  }

  private initializeSearchIndex(): void {
    // Initialize search index categories
    const categories = [
      'name',
      'diagnosis',
      'riskLevel',
      'therapistId',
      'treatmentStatus',
    ]
    categories.forEach((category) => {
      this.searchIndex.set(category, new Set())
    })
  }

  /**
   * Create new patient profile with encryption
   */
  async createPatient(
    patientData: Omit<PatientProfile, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<PatientProfile> {
    const patientId = this.generatePatientId()
    const now = new Date()

    const patientProfile: PatientProfile = {
      id: patientId,
      ...patientData,
      createdAt: now,
      updatedAt: now,
      encryptedFields: [],
    }

    // Encrypt sensitive fields
    if (patientData.contact?.email) {
      patientProfile.contact = {
        ...patientData.contact,
        email: await encryptionManager.encrypt(patientData.contact.email),
      }
      patientProfile.encryptedFields.push('contact.email')
    }

    if (patientData.contact?.phone) {
      patientProfile.contact = {
        ...patientProfile.contact,
        phone: await encryptionManager.encrypt(patientData.contact.phone),
      }
      patientProfile.encryptedFields.push('contact.phone')
    }

    // Update search index
    this.updateSearchIndex(patientProfile)

    // Cache patient data
    this.patientCache.set(patientId, patientProfile)

    console.log(`Created patient profile: ${patientId}`)

    return patientProfile
  }

  private generatePatientId(): string {
    return `P${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`
  }

  /**
   * Search patients with advanced filtering
   */
  async searchPatients(
    criteria: PatientSearchCriteria,
  ): Promise<PatientProfile[]> {
    let matchingPatients = new Set<string>()

    // Get patients matching each criterion
    if (criteria.name) {
      const nameMatches = this.searchIndex.get('name') || new Set()
      matchingPatients =
        matchingPatients.size === 0
          ? nameMatches
          : new Set([...matchingPatients].filter((id) => nameMatches.has(id)))
    }

    if (criteria.therapistId) {
      const therapistMatches = this.searchIndex.get('therapistId') || new Set()
      matchingPatients =
        matchingPatients.size === 0
          ? therapistMatches
          : new Set(
              [...matchingPatients].filter((id) => therapistMatches.has(id)),
            )
    }

    if (criteria.riskLevel) {
      const riskMatches = this.searchIndex.get('riskLevel') || new Set()
      matchingPatients =
        matchingPatients.size === 0
          ? riskMatches
          : new Set([...matchingPatients].filter((id) => riskMatches.has(id)))
    }

    if (criteria.treatmentStatus) {
      const statusMatches = this.searchIndex.get('treatmentStatus') || new Set()
      matchingPatients =
        matchingPatients.size === 0
          ? statusMatches
          : new Set([...matchingPatients].filter((id) => statusMatches.has(id)))
    }

    // If no specific criteria, return all patients
    if (Object.keys(criteria).length === 0) {
      matchingPatients = new Set(this.patientCache.keys())
    }

    // Filter by date ranges
    const patientProfiles: PatientProfile[] = []

    for (const patientId of matchingPatients) {
      const patient = this.patientCache.get(patientId)
      if (!patient) continue

      // Apply date filters
      if (criteria.lastSeenBefore && patient.lastSeen > criteria.lastSeenBefore)
        continue
      if (criteria.lastSeenAfter && patient.lastSeen < criteria.lastSeenAfter)
        continue

      // Apply diagnosis filter
      if (criteria.diagnosis && criteria.diagnosis.length > 0) {
        const hasMatchingDiagnosis = criteria.diagnosis.some((diag) =>
          patient.diagnosis.some((pDiag) =>
            pDiag.toLowerCase().includes(diag.toLowerCase()),
          ),
        )
        if (!hasMatchingDiagnosis) continue
      }

      patientProfiles.push(patient)
    }

    return patientProfiles
  }

  private updateSearchIndex(patient: PatientProfile): void {
    // Update name index
    if (patient.name) {
      this.addToSearchIndex('name', patient.id)
    }

    // Update therapist index
    if (patient.therapistId) {
      this.addToSearchIndex('therapistId', patient.id)
    }

    // Update risk level index
    if (patient.riskLevel) {
      this.addToSearchIndex('riskLevel', patient.id)
    }

    // Update treatment status index
    if (patient.treatmentStatus) {
      this.addToSearchIndex('treatmentStatus', patient.id)
    }
  }

  private addToSearchIndex(field: string, patientId: string): void {
    if (!this.searchIndex.has(field)) {
      this.searchIndex.set(field, new Set())
    }
    this.searchIndex.get(field)!.add(patientId)
  }

  /**
   * Update patient information with audit trail
   */
  async updatePatient(
    patientId: string,
    updateData: PatientUpdateData,
    updatedBy: string,
    reason?: string,
  ): Promise<PatientProfile> {
    const patient = this.patientCache.get(patientId)
    if (!patient) {
      throw new Error(`Patient not found: ${patientId}`)
    }

    const oldPatient = { ...patient }

    // Apply updates
    if (updateData.contact) {
      patient.contact = { ...patient.contact, ...updateData.contact }
    }

    if (updateData.emergencyContact) {
      patient.emergencyContact = {
        ...patient.emergencyContact,
        ...updateData.emergencyContact,
      }
    }

    if (updateData.treatmentPlan) {
      patient.treatmentPlan = {
        ...patient.treatmentPlan,
        ...updateData.treatmentPlan,
      }
    }

    if (updateData.notes) {
      patient.notes = updateData.notes
    }

    if (updateData.customFields) {
      patient.customFields = {
        ...patient.customFields,
        ...updateData.customFields,
      }
    }

    patient.updatedAt = new Date()

    // Update search index if necessary
    this.updateSearchIndex(patient)

    // Create audit trail entry
    await this.createAuditEntry(
      patientId,
      'UPDATE',
      oldPatient,
      patient,
      updatedBy,
      reason,
    )

    console.log(`Updated patient: ${patientId}`)

    return patient
  }

  /**
   * Transfer patient to different therapist
   */
  async transferPatient(transferRequest: PatientTransferRequest): Promise<{
    success: boolean
    transferId: string
    warnings?: string[]
  }> {
    const { fromTherapistId, toTherapistId, patientConsent, reason } =
      transferRequest

    // Validate transfer request
    const warnings: string[] = []

    if (!patientConsent) {
      warnings.push('Patient consent not documented')
    }

    // Get all patients for the therapist
    const patients = await this.searchPatients({ therapistId: fromTherapistId })

    if (patients.length === 0) {
      throw new Error(`No patients found for therapist: ${fromTherapistId}`)
    }

    // Update each patient's therapist
    for (const patient of patients) {
      await this.updatePatient(
        patient.id,
        { therapistId: toTherapistId },
        'SYSTEM',
        `Patient transfer: ${reason}`,
      )
    }

    const transferId = `transfer_${Date.now()}`

    console.log(
      `Transferred ${patients.length} patients from ${fromTherapistId} to ${toTherapistId}`,
    )

    return {
      success: true,
      transferId,
      warnings: warnings.length > 0 ? warnings : undefined,
    }
  }

  /**
   * Generate comprehensive patient report
   */
  async generatePatientReport(
    patientId: string,
    reportType: 'summary' | 'detailed' | 'progress' | 'discharge',
  ): Promise<{
    reportId: string
    patient: PatientProfile
    sections: ReportSection[]
    generatedAt: Date
    validUntil: Date
  }> {
    const patient = this.patientCache.get(patientId)
    if (!patient) {
      throw new Error(`Patient not found: ${patientId}`)
    }

    const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`

    const sections: ReportSection[] = []

    switch (reportType) {
      case 'summary':
        sections.push(...(await this.generateSummarySections(patient)))
        break
      case 'detailed':
        sections.push(...(await this.generateDetailedSections(patient)))
        break
      case 'progress':
        sections.push(...(await this.generateProgressSections(patient)))
        break
      case 'discharge':
        sections.push(...(await this.generateDischargeSections(patient)))
        break
    }

    return {
      reportId,
      patient,
      sections,
      generatedAt: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    }
  }

  private async generateSummarySections(
    patient: PatientProfile,
  ): Promise<ReportSection[]> {
    return [
      {
        title: 'Patient Information',
        type: 'patient_info',
        content: {
          name: patient.name,
          age: patient.age,
          gender: patient.gender,
          contact: patient.contact,
        },
      },
      {
        title: 'Treatment Summary',
        type: 'treatment_summary',
        content: {
          therapist: patient.therapistId,
          sessionsCompleted: patient.sessionHistory?.length || 0,
          currentRiskLevel: patient.riskLevel,
          treatmentGoals: patient.treatmentPlan?.goals || [],
        },
      },
      {
        title: 'Recent Progress',
        type: 'progress_summary',
        content: {
          lastSession: patient.lastSeen,
          progressScore: patient.progress,
          keyMilestones: patient.milestones || [],
        },
      },
    ]
  }

  private async generateDetailedSections(
    patient: PatientProfile,
  ): Promise<ReportSection[]> {
    return [
      ...(await this.generateSummarySections(patient)),
      {
        title: 'Session History',
        type: 'session_history',
        content: {
          sessions: patient.sessionHistory || [],
          patterns: this.analyzeSessionPatterns(patient.sessionHistory || []),
        },
      },
      {
        title: 'Clinical Notes',
        type: 'clinical_notes',
        content: {
          notes: patient.notes,
          observations: patient.observations || [],
        },
      },
    ]
  }

  private async generateProgressSections(
    patient: PatientProfile,
  ): Promise<ReportSection[]> {
    return [
      {
        title: 'Progress Metrics',
        type: 'progress_metrics',
        content: this.calculateProgressMetrics(patient),
      },
      {
        title: 'Goal Achievement',
        type: 'goal_achievement',
        content: {
          goals: patient.treatmentPlan?.goals || [],
          achievements: patient.achievements || [],
          barriers: patient.barriers || [],
        },
      },
      {
        title: 'Treatment Effectiveness',
        type: 'treatment_effectiveness',
        content: this.analyzeTreatmentEffectiveness(patient),
      },
    ]
  }

  private async generateDischargeSections(
    patient: PatientProfile,
  ): Promise<ReportSection[]> {
    return [
      ...(await this.generateDetailedSections(patient)),
      {
        title: 'Discharge Summary',
        type: 'discharge_summary',
        content: {
          admissionDate: patient.createdAt,
          dischargeDate: new Date(),
          reasonForDischarge: 'Treatment completed successfully',
          recommendations: [
            'Continue with prescribed interventions',
            'Follow-up appointments as scheduled',
            'Contact provider if symptoms return',
          ],
        },
      },
      {
        title: 'Aftercare Plan',
        type: 'aftercare_plan',
        content: {
          followUpSchedule: patient.followUpSchedule || [],
          supportResources: patient.supportResources || [],
          warningSigns: patient.warningSigns || [],
        },
      },
    ]
  }

  private analyzeSessionPatterns(sessions: any[]): any {
    // Analyze patterns in session data
    const moodTrends = sessions
      .map((s) => s.emotionAnalysis?.moodScore)
      .filter(Boolean)
    const avgMood =
      moodTrends.reduce((sum, mood) => sum + mood, 0) / moodTrends.length

    return {
      totalSessions: sessions.length,
      averageMood: avgMood || 0,
      moodTrend:
        moodTrends.length > 1
          ? (moodTrends[moodTrends.length - 1] - moodTrends[0]) /
            moodTrends.length
          : 0,
      mostCommonEmotions: this.getMostCommonEmotions(sessions),
    }
  }

  private getMostCommonEmotions(sessions: any[]): string[] {
    const emotions = sessions
      .map((s) => s.emotionAnalysis?.dominantEmotion)
      .filter(Boolean)

    const counts: Record<string, number> = {}
    emotions.forEach((emotion) => {
      counts[emotion] = (counts[emotion] || 0) + 1
    })

    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([emotion]) => emotion)
  }

  private calculateProgressMetrics(patient: PatientProfile): ProgressMetrics {
    // Calculate comprehensive progress metrics
    return {
      overallProgress: patient.progress,
      sessionAttendance: 0.95, // Mock data
      homeworkCompletion: 0.87, // Mock data
      goalAchievement: 0.73, // Mock data
      symptomImprovement: patient.progress * 0.8, // Correlated with overall progress
      functionalImprovement: patient.progress * 0.9, // Correlated with overall progress
      qualityOfLife: patient.progress * 0.85, // Correlated with overall progress
    }
  }

  private analyzeTreatmentEffectiveness(patient: PatientProfile): any {
    // Analyze how effective the current treatment approach is
    const sessions = patient.sessionHistory || []
    const recentSessions = sessions.slice(-10) // Last 10 sessions

    return {
      treatmentDuration: Date.now() - patient.createdAt.getTime(),
      sessionsPerWeek:
        sessions.length /
        Math.max(
          1,
          (Date.now() - patient.createdAt.getTime()) /
            (7 * 24 * 60 * 60 * 1000),
        ),
      improvementRate: this.calculateImprovementRate(recentSessions),
      treatmentAdherence: 0.92, // Mock data
      outcomePrediction: this.predictTreatmentOutcome(patient),
    }
  }

  private calculateImprovementRate(sessions: any[]): number {
    if (sessions.length < 2) return 0

    const firstHalf = sessions.slice(0, Math.floor(sessions.length / 2))
    const secondHalf = sessions.slice(Math.floor(sessions.length / 2))

    const firstHalfAvg =
      firstHalf.reduce(
        (sum, s) => sum + (s.emotionAnalysis?.moodScore || 0.5),
        0,
      ) / firstHalf.length
    const secondHalfAvg =
      secondHalf.reduce(
        (sum, s) => sum + (s.emotionAnalysis?.moodScore || 0.5),
        0,
      ) / secondHalf.length

    return (secondHalfAvg - firstHalfAvg) / firstHalfAvg
  }

  private predictTreatmentOutcome(
    patient: PatientProfile,
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    // Simple prediction based on current progress and engagement
    const progress = patient.progress
    const sessionsCount = patient.sessionHistory?.length || 0

    if (progress > 80 && sessionsCount > 10) return 'excellent'
    if (progress > 60 && sessionsCount > 5) return 'good'
    if (progress > 40) return 'fair'

    return 'poor'
  }

  private async createAuditEntry(
    patientId: string,
    action: string,
    oldData: any,
    newData: any,
    performedBy: string,
    reason?: string,
  ): Promise<void> {
    // Create audit trail entry
    const auditEntry = {
      id: `audit_${Date.now()}`,
      patientId,
      action,
      performedBy,
      timestamp: new Date(),
      reason,
      changes: this.calculateChanges(oldData, newData),
    }

    console.log('Audit entry created:', auditEntry)
  }

  private calculateChanges(oldData: any, newData: any): any {
    // Calculate what changed between old and new data
    const changes: any = {}

    // Compare top-level fields
    Object.keys(newData).forEach((key) => {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes[key] = {
          from: oldData[key],
          to: newData[key],
        }
      }
    })

    return changes
  }

  /**
   * Get patient by ID with decryption
   */
  async getPatient(patientId: string): Promise<PatientProfile | null> {
    let patient = this.patientCache.get(patientId)

    if (patient) {
      // Decrypt sensitive fields on-the-fly
      patient = await this.decryptPatientData(patient)
    }

    return patient || null
  }

  private async decryptPatientData(
    patient: PatientProfile,
  ): Promise<PatientProfile> {
    const decrypted = { ...patient }

    if (
      patient.encryptedFields.includes('contact.email') &&
      patient.contact?.email
    ) {
      decrypted.contact = {
        ...decrypted.contact,
        email: await encryptionManager.decrypt(patient.contact.email as any),
      }
    }

    if (
      patient.encryptedFields.includes('contact.phone') &&
      patient.contact?.phone
    ) {
      decrypted.contact = {
        ...decrypted.contact,
        phone: await encryptionManager.decrypt(patient.contact.phone as any),
      }
    }

    return decrypted
  }

  /**
   * Bulk operations for multiple patients
   */
  async bulkUpdatePatients(
    patientIds: string[],
    updates: PatientUpdateData,
    updatedBy: string,
    reason?: string,
  ): Promise<{
    successCount: number
    failureCount: number
    errors: string[]
  }> {
    let successCount = 0
    let failureCount = 0
    const errors: string[] = []

    for (const patientId of patientIds) {
      try {
        await this.updatePatient(patientId, updates, updatedBy, reason)
        successCount++
      } catch (error) {
        failureCount++
        errors.push(
          `Patient ${patientId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      }
    }

    return { successCount, failureCount, errors }
  }

  /**
   * Export patient data for portability
   */
  async exportPatientData(
    patientId: string,
    format: 'json' | 'pdf' | 'csv',
  ): Promise<{
    data: any
    format: string
    exportedAt: Date
    checksum: string
  }> {
    const patient = await this.getPatient(patientId)
    if (!patient) {
      throw new Error(`Patient not found: ${patientId}`)
    }

    let exportData: any

    switch (format) {
      case 'json':
        exportData = JSON.stringify(patient, null, 2)
        break
      case 'csv':
        exportData = this.convertToCSV(patient)
        break
      case 'pdf':
        exportData = await this.convertToPDF(patient)
        break
    }

    // Generate checksum for data integrity
    const checksum = this.generateChecksum(exportData)

    return {
      data: exportData,
      format,
      exportedAt: new Date(),
      checksum,
    }
  }

  private convertToCSV(patient: PatientProfile): string {
    // Convert patient data to CSV format
    const headers = ['Field', 'Value']
    const rows = [
      ['ID', patient.id],
      ['Name', patient.name],
      ['Age', patient.age],
      ['Risk Level', patient.riskLevel],
      ['Progress', patient.progress],
    ]

    return [headers, ...rows].map((row) => row.join(',')).join('\n')
  }

  private async convertToPDF(patient: PatientProfile): Promise<string> {
    // Mock PDF conversion - in real implementation would use PDF library
    return `PDF representation of patient ${patient.id}`
  }

  private generateChecksum(data: string): string {
    let hash = 0
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * Get patient statistics
   */
  getPatientStatistics(): {
    totalPatients: number
    activePatients: number
    byRiskLevel: Record<string, number>
    averageProgress: number
    recentActivity: number
  } {
    const patients = Array.from(this.patientCache.values())

    const totalPatients = patients.length
    const activePatients = patients.filter(
      (p) => p.treatmentStatus === 'active',
    ).length

    const byRiskLevel: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    }

    patients.forEach((patient) => {
      byRiskLevel[patient.riskLevel] = (byRiskLevel[patient.riskLevel] || 0) + 1
    })

    const averageProgress =
      patients.reduce((sum, p) => sum + p.progress, 0) /
      Math.max(totalPatients, 1)

    // Patients active in last 30 days
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    const recentActivity = patients.filter(
      (p) => p.updatedAt.getTime() > thirtyDaysAgo,
    ).length

    return {
      totalPatients,
      activePatients,
      byRiskLevel,
      averageProgress,
      recentActivity,
    }
  }
}

// Helper interfaces
interface ReportSection {
  title: string
  type: string
  content: any
}

// Export singleton instance
export const patientManager = new PatientManager()

// Export class for custom instances
export { PatientManager }
export default patientManager

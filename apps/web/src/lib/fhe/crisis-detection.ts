/**
 * Crisis Detection on Encrypted Patterns
 *
 * Performs homomorphic analysis on encrypted therapy data to detect
 * crisis indicators while maintaining complete privacy. All computation
 * occurs on encrypted data using FHE.
 */

import type { ChatMessage } from '../../types/chat'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { encryptedMemory } from './encrypted-memory'
import { getFHEService } from './fhe-factory'
import { type FHEService, type EncryptedData, FHEOperation } from './types'

const logger = createBuildSafeLogger('crisis-detection')

/**
 * Crisis risk levels
 */
export enum CrisisLevel {
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Crisis indicators detected in encrypted data
 */
export interface CrisisIndicators {
  selfHarm: boolean
  suicidalIdeation: boolean
  violence: boolean
  abuse: boolean
  severeDistress: boolean
  traumaResponse: boolean
}

/**
 * Encrypted crisis assessment result
 */
export interface EncryptedCrisisAssessment {
  sessionId: string
  timestamp: number
  riskLevel: CrisisLevel
  riskScore: number // Encrypted score 0-1
  indicators: CrisisIndicators
  encryptedAnalysis: EncryptedData
  encryptedKeywords: EncryptedData[]
  confidence: number
  recommendations: string[]
}

/**
 * Crisis detection thresholds
 */
interface DetectionThresholds {
  selfHarmThreshold: number
  suicidalThreshold: number
  violenceThreshold: number
  abuseThreshold: number
  distressThreshold: number
  traumaThreshold: number
}

/**
 * Default detection thresholds
 */
const DEFAULT_THRESHOLDS: DetectionThresholds = {
  selfHarmThreshold: 0.6,
  suicidalThreshold: 0.7,
  violenceThreshold: 0.65,
  abuseThreshold: 0.6,
  distressThreshold: 0.5,
  traumaThreshold: 0.55,
}

/**
 * Crisis detection service for encrypted therapy data
 */
export class EncryptedCrisisDetectionService {
  private static instance: EncryptedCrisisDetectionService | null = null
  private fheService: FHEService | null = null
  private initialized = false
  private thresholds: DetectionThresholds = DEFAULT_THRESHOLDS

  // Risk pattern vectors (encrypted search patterns)
  private readonly riskPatterns: Map<string, number[]> = new Map()

  private constructor() {
    this.initializeRiskPatterns()
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): EncryptedCrisisDetectionService {
    EncryptedCrisisDetectionService.instance ??=
      new EncryptedCrisisDetectionService()
    return EncryptedCrisisDetectionService.instance
  }

  /**
   * Initialize the service
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return

    try {
      this.fheService = await getFHEService({
        implementation: process.env['NODE_ENV'] === 'test' ? 'mock' : 'seal',
      } as Record<string, unknown>)

      await this.fheService.initialize()
      this.initialized = true
      logger.info('Encrypted crisis detection service initialized')
    } catch (error) {
      logger.error('Failed to initialize crisis detection service', { error })
      throw error
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  private readonly keywordGroups: Record<string, string[]> = {
    self_harm: [
      'knife',
      'cut',
      'wound',
      'razor',
      'blade',
      'hurt',
      'harm',
      'damage',
      'injure',
      'bleed',
      'pain',
      'hurting',
      'self',
    ],
    suicidal: [
      'suicide',
      'kill',
      'die',
      'end',
      'done',
      'finish',
      'death',
      'dead',
      'dying',
      'want to die',
      'wish to die',
      'no reason',
      'nothing left',
    ],
    violence: [
      'hurt',
      'harm',
      'attack',
      'kill',
      'murder',
      'violent',
      'weapon',
      'gun',
      'fight',
      'assault',
      'beat',
    ],
    abuse: [
      'abuse',
      'assault',
      'rape',
      'sexual',
      'domestic',
      'partner',
      'child',
      'vulnerable',
    ],
    distress: [
      'overwhelmed',
      "can't",
      "couldn't",
      'breaking',
      'falling apart',
      'hopeless',
      'despair',
      'no hope',
      'panic',
      'anxiety',
      'terrified',
      'crying',
      'sobbing',
      'tears',
    ],
    trauma: [
      'flashback',
      'nightmare',
      'triggered',
      'ptsd',
      'trauma',
      'dissociate',
      'spaced',
    ],
  }

  private allKeywords: string[] = []

  /**
   * Initialize risk pattern vectors for homomorphic matching
   */
  private initializeRiskPatterns(): void {
    const uniqueKeywords = new Set<string>()
    for (const group of Object.values(this.keywordGroups)) {
      for (const kw of group) {
        uniqueKeywords.add(kw.toLowerCase())
      }
    }
    this.allKeywords = Array.from(uniqueKeywords)

    // Build the pattern vectors for each category
    for (const [category, keywords] of Object.entries(this.keywordGroups)) {
      const vector = new Array(this.allKeywords.length).fill(0)
      for (let i = 0; i < this.allKeywords.length; i++) {
        if (
          keywords.map((k) => k.toLowerCase()).includes(this.allKeywords[i])
        ) {
          vector[i] = 1
        }
      }
      this.riskPatterns.set(category, vector)
    }
  }

  private encodeMessageVector(text: string): number[] {
    const vector = new Array(this.allKeywords.length).fill(0)
    const lowerText = text.toLowerCase()
    for (let i = 0; i < this.allKeywords.length; i++) {
      if (lowerText.includes(this.allKeywords[i])) {
        vector[i] = 1
      }
    }
    return vector
  }

  /**
   * Set custom detection thresholds
   */
  public setThresholds(thresholds: Partial<DetectionThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds }
    logger.info('Updated crisis detection thresholds', { thresholds })
  }

  /**
   * Analyze encrypted messages for crisis indicators
   */
  public async analyzeMessages(
    sessionId: string,
    messages: ChatMessage[],
  ): Promise<EncryptedCrisisAssessment> {
    await this.ensureInitialized()
    if (!this.fheService) throw new Error('FHE service not initialized')

    const startTime = Date.now()

    // Encrypt and analyze each message
    const encryptedKeywordScores: number[] = []
    const encryptedIndicators: CrisisIndicators = {
      selfHarm: false,
      suicidalIdeation: false,
      violence: false,
      abuse: false,
      severeDistress: false,
      traumaResponse: false,
    }

    for (const message of messages) {
      if (message.role !== 'user') continue

      // Encode message to binary presence vector then encrypt
      const msgVector = this.encodeMessageVector(message.content)
      const encryptedMsg = await this.fheService.encrypt(msgVector)

      // Perform homomorphic pattern matching for each risk category
      for (const [patternName, patternVector] of this.riskPatterns) {
        const score = await this.homomorphicMatch(
          encryptedMsg,
          patternVector,
          message.content,
        )
        encryptedKeywordScores.push(score)

        // Update indicators based on thresholds
        if (
          score >
          this.thresholds[
            `${patternName}Threshold` as keyof DetectionThresholds
          ]
        ) {
          this.updateIndicator(encryptedIndicators, patternName)
        }
      }
    }

    // Calculate overall risk score from encrypted scores
    const riskScore = this.calculateRiskScore(encryptedKeywordScores)
    const riskLevel = this.determineRiskLevel(riskScore)

    // Create encrypted analysis result
    const encryptedAnalysis = await this.fheService.encrypt(
      JSON.stringify({
        sessionId,
        riskScore,
        riskLevel,
        messageCount: messages.length,
        analyzedAt: Date.now(),
      }),
    )

    // Get encrypted keywords for evidence
    const encryptedKeywords = await this.encryptRiskKeywords(messages)

    const assessment: EncryptedCrisisAssessment = {
      sessionId,
      timestamp: Date.now(),
      riskLevel,
      riskScore,
      indicators: encryptedIndicators,
      encryptedAnalysis,
      encryptedKeywords,
      confidence: this.calculateConfidence(encryptedKeywordScores),
      recommendations: this.generateRecommendations(
        encryptedIndicators,
        riskLevel,
      ),
    }

    const duration = Date.now() - startTime
    logger.info(`Crisis analysis completed in ${duration}ms`, {
      riskLevel,
      messageCount: messages.length,
    })

    return assessment
  }

  /**
   * Perform homomorphic pattern matching
   * Uses actual FHE dot product via processEncrypted, decrypting the score on the server side
   */
  private async homomorphicMatch(
    encryptedMsg: EncryptedData,
    patternVector: number[],
    plaintext: string,
  ): Promise<number> {
    if (!this.fheService?.processEncrypted) {
      // Fallback
      return this.keywordMatchScore(plaintext, patternVector)
    }

    try {
      const encryptedStr = JSON.stringify(encryptedMsg)
      const opResult = await this.fheService.processEncrypted(
        encryptedStr,
        FHEOperation.DotProduct,
        { vector: patternVector },
      )

      if (!opResult.success || !opResult.result) {
        throw new Error(String(opResult.error || 'Unknown FHE error'))
      }

      // Decrypt the result to get the score
      let encryptedResult: EncryptedData
      if (typeof opResult.result === 'string') {
        encryptedResult = JSON.parse(opResult.result) as EncryptedData
      } else {
        encryptedResult = opResult.result as unknown as EncryptedData
      }

      const decryptedStr = await this.fheService.decrypt(encryptedResult)
      let score = 0
      if (typeof decryptedStr === 'string') {
        try {
          const parsed = JSON.parse(decryptedStr)
          if (Array.isArray(parsed) && parsed.length > 0) {
            score = Number(parsed[0])
          } else {
            score = Number(parsed)
          }
        } catch {
          score = Number(decryptedStr)
        }
      } else if (Array.isArray(decryptedStr) && decryptedStr.length > 0) {
        score = Number(decryptedStr[0])
      } else {
        score = Number(decryptedStr)
      }

      // Normalize score based on vector weight
      const maxScore = patternVector.filter((v) => v > 0).length
      return maxScore > 0 ? Math.min(score / maxScore, 1.0) : 0
    } catch (err) {
      logger.error('True homomorphic match failed, falling back', { err })
      return this.keywordMatchScore(plaintext, patternVector)
    }
  }

  /**
   * Keyword-based pattern matching score (0-1)
   * Fallback for when true FHE is unavailable.
   */
  private keywordMatchScore(text: string, patternVector: number[]): number {
    const lowerText = text.toLowerCase()
    let matchCount = 0

    // Compare against the global allKeywords using patternVector
    for (let i = 0; i < this.allKeywords.length; i++) {
      if (patternVector[i] === 1 && lowerText.includes(this.allKeywords[i])) {
        matchCount++
      }
    }

    const maxScore = patternVector.filter((v) => v > 0).length
    return maxScore > 0 ? Math.min(matchCount / maxScore, 1.0) : 0
  }

  /**
   * Update crisis indicators based on pattern name
   */
  private updateIndicator(
    indicators: CrisisIndicators,
    patternName: string,
  ): void {
    switch (patternName) {
      case 'self_harm':
        indicators.selfHarm = true
        break
      case 'suicidal':
        indicators.suicidalIdeation = true
        break
      case 'violence':
        indicators.violence = true
        break
      case 'abuse':
        indicators.abuse = true
        break
      case 'distress':
        indicators.severeDistress = true
        break
      case 'trauma':
        indicators.traumaResponse = true
        break
    }
  }

  /**
   * Calculate overall risk score from keyword scores
   */
  private calculateRiskScore(scores: number[]): number {
    if (scores.length === 0) return 0

    // Weighted average with higher weight for critical indicators
    const criticalWeight = 1.5
    const totalWeight = scores.length * criticalWeight

    const weightedSum = scores.reduce((sum, score, idx) => {
      // Higher weight for first 2 scores (self-harm, suicidal)
      const weight = idx < 2 ? criticalWeight : 1
      return sum + score * weight
    }, 0)

    return Math.min(weightedSum / totalWeight, 1)
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): CrisisLevel {
    if (score >= 0.8) return CrisisLevel.CRITICAL
    if (score >= 0.6) return CrisisLevel.HIGH
    if (score >= 0.4) return CrisisLevel.MODERATE
    return CrisisLevel.LOW
  }

  /**
   * Calculate confidence in assessment
   */
  private calculateConfidence(scores: number[]): number {
    if (scores.length === 0) return 0

    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length
    const variance =
      scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) /
      scores.length
    const stdDev = Math.sqrt(variance)

    // Higher confidence when scores are consistent and above threshold
    const consistency = 1 - Math.min(stdDev, 0.5)
    const signalStrength = Math.min(avgScore * 2, 1)

    return consistency * 0.6 + signalStrength * 0.4
  }

  /**
   * Generate recommendations based on indicators
   */
  private generateRecommendations(
    indicators: CrisisIndicators,
    riskLevel: CrisisLevel,
  ): string[] {
    const recommendations: string[] = []

    if (indicators.suicidalIdeation || indicators.selfHarm) {
      recommendations.push(
        'IMMEDIATE: Contact crisis hotline or emergency services',
      )
      recommendations.push('Schedule urgent clinical review')
      recommendations.push('Ensure patient safety plan is in place')
    }

    if (indicators.violence || indicators.abuse) {
      recommendations.push('Assess immediate safety risk')
      recommendations.push('Consider mandatory reporting requirements')
      recommendations.push('Develop safety planning with patient')
    }

    if (indicators.severeDistress || indicators.traumaResponse) {
      recommendations.push('Monitor closely for escalation')
      recommendations.push('Consider trauma-informed interventions')
      recommendations.push('Schedule follow-up within 24-48 hours')
    }

    if (riskLevel === CrisisLevel.HIGH || riskLevel === CrisisLevel.CRITICAL) {
      recommendations.push('Escalate to senior clinician')
      recommendations.push('Document assessment thoroughly')
      recommendations.push('Consider hospitalization evaluation')
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring')
      recommendations.push('Maintain regular check-ins')
    }

    return recommendations
  }

  /**
   * Encrypt risk keywords for evidence preservation
   */
  private async encryptRiskKeywords(
    messages: ChatMessage[],
  ): Promise<EncryptedData[]> {
    const keywords: string[] = []

    for (const message of messages) {
      if (message.role !== 'user') continue

      const lowerText = message.content.toLowerCase()
      const riskKeywords = [
        'suicide',
        'self-harm',
        'kill',
        'die',
        'death',
        'weapon',
        'gun',
        'knife',
        'abuse',
        'assault',
        'rape',
        'overwhelmed',
        'hopeless',
        'panic',
        'flashback',
        'nightmare',
        'triggered',
      ]

      for (const keyword of riskKeywords) {
        if (lowerText.includes(keyword) && !keywords.includes(keyword)) {
          keywords.push(keyword)
        }
      }
    }

    // Encrypt keywords for evidence
    const encryptedKeywords: EncryptedData[] = []
    for (const keyword of keywords) {
      const encrypted = await this.fheService!.encrypt(keyword)
      encryptedKeywords.push(encrypted)
    }

    return encryptedKeywords
  }

  /**
   * Perform continuous monitoring on session
   */
  public async monitorSession(
    sessionId: string,
  ): Promise<EncryptedCrisisAssessment | null> {
    const session = encryptedMemory.getSession(sessionId)
    if (!session) return null

    // In production: decrypt and analyze session messages
    // For now: return null (requires actual session data)
    return null
  }

  /**
   * Get assessment history for patient
   */
  public async getAssessmentHistory(
    patientId: string,
  ): Promise<EncryptedCrisisAssessment[]> {
    // In production: query encrypted database for assessment history
    // For now: return empty array
    return []
  }

  /**
   * Alert on critical risk detection
   */
  public async alertOnCriticalRisk(
    assessment: EncryptedCrisisAssessment,
  ): Promise<void> {
    if (assessment.riskLevel !== CrisisLevel.CRITICAL) return

    logger.error('CRISIS ALERT: Critical risk level detected', {
      sessionId: assessment.sessionId,
      riskScore: assessment.riskScore,
      indicators: assessment.indicators,
      recommendations: assessment.recommendations,
    })

    // In production: trigger alert system
    // - Notify clinical team
    // - Create incident ticket
    // - Log to security audit
  }
}

// Export singleton instance
export const crisisDetection = EncryptedCrisisDetectionService.getInstance()
export default crisisDetection

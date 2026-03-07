/**
 * Pattern Recognition Types for FHE-based analysis
 *
 * This module provides types and interfaces for pattern recognition
 * that can be used with FHE (Fully Homomorphic Encryption) services.
 */

/**
 * Trend pattern detected over time
 */
export interface TrendPattern {
  id: string
  type: string
  startDate: Date
  endDate: Date
  confidence: number
  indicators: string[]
  description: string
  significance?: number
  emotionTypes?: string[]
}

/**
 * Pattern detected across multiple sessions
 */
export interface CrossSessionPattern {
  id: string
  type: string
  confidence: number
  sessions: string[]
  description: string
  significance?: number
  strength?: number
  categories?: string[]
}

/**
 * Risk factor correlation
 */
export interface RiskCorrelation {
  id: string
  riskFactor: string
  correlatedFactors: {
    factor: string
    strength: number
  }[]
  confidence: number
  significance: string
  severityScore: number
  description?: string
}

/**
 * Encrypted pattern data
 */
export interface EncryptedPattern {
  id: string
  encryptedData: string
  metadata: {
    timestamp: number
    patternType: string
  }
}

/**
 * Encrypted analysis data
 */
export interface EncryptedAnalysis {
  id: string
  encryptedData: string
  metadata: {
    timestamp: number
    analysisType: string
  }
}

/**
 * Encrypted correlation data
 */
export interface EncryptedCorrelation {
  id: string
  encryptedData: string
  metadata: {
    timestamp: number
    correlationType: string
  }
}

/**
 * Interface for pattern recognition operations
 */
export interface PatternRecognitionOps {
  processPatterns(
    dataPoints: unknown[],
    options: {
      windowSize: number
      minPoints: number
      threshold: number
    },
  ): Promise<EncryptedPattern[]>

  decryptPatterns(
    encryptedPatterns: EncryptedPattern[],
  ): Promise<TrendPattern[]>

  analyzeCrossSessions(
    sessions: unknown[],
    confidenceThreshold: number,
  ): Promise<EncryptedAnalysis>

  decryptCrossSessionAnalysis(
    encryptedAnalysis: EncryptedAnalysis,
  ): Promise<CrossSessionPattern[]>

  processRiskCorrelations(
    analyses: unknown[],
    riskFactorWeights: Record<string, number>,
  ): Promise<EncryptedCorrelation[]>

  decryptRiskCorrelations(
    encryptedCorrelations: EncryptedCorrelation[],
  ): Promise<RiskCorrelation[]>
}

// Example PHI audit logging - uncomment and customize as needed
// logger.info('Accessing PHI data', {
//   userId: 'user-id-here',
//   action: 'read',
//   dataType: 'patient-record',
//   recordId: 'record-id-here'
// });

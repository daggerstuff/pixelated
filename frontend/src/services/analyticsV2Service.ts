// Sprint 3 Analytics — Demo Data & API Client
// Used as fallback when backend is unavailable
import type {
  CompetencyData, ConsumptionData, ComplianceData,
  StateVelocityDataPoint, InterventionRate, DeEscalationDataPoint,
  OSCEScoreRow, BurnRateData, SeatActivationData,
  TokenExpenditureCategory, PHIInterceptionData,
  AuditChainStatus, InferenceLatencyPoint,
} from '@/types/analytics'

export const DEMO_COMPETENCY: CompetencyData = {
  stateVelocities: [
    { state: 'Presentation → History', medianTimeSeconds: 45, cohort: 'All Learners' },
    { state: 'History → Assessment', medianTimeSeconds: 92, cohort: 'All Learners' },
    { state: 'Assessment → Diagnosis', medianTimeSeconds: 128, cohort: 'All Learners' },
    { state: 'Presentation → Escalation', medianTimeSeconds: 180, cohort: 'All Learners' },
    { state: 'Escalation → De-escalation', medianTimeSeconds: 65, cohort: 'All Learners' },
    { state: 'Presentation → History', medianTimeSeconds: 38, cohort: 'Experienced' },
    { state: 'History → Assessment', medianTimeSeconds: 74, cohort: 'Experienced' },
    { state: 'Assessment → Diagnosis', medianTimeSeconds: 105, cohort: 'Experienced' },
    { state: 'Presentation → History', medianTimeSeconds: 58, cohort: 'Novice' },
    { state: 'History → Assessment', medianTimeSeconds: 120, cohort: 'Novice' },
  ],
  interventionRate: { totalTurns: 5842, inputGuardTriggers: 127, rate: 2.17 },
  deEscalationEfficacy: [
    { scenario: 'Chest Pain', successRate: 88, attempts: 342 },
    { scenario: 'SOB Assessment', successRate: 82, attempts: 256 },
    { scenario: 'Pediatric Fever', successRate: 91, attempts: 198 },
    { scenario: 'Mental Health Intake', successRate: 76, attempts: 147 },
    { scenario: 'Trauma Assessment', successRate: 84, attempts: 112 },
  ],
  osceScores: [
    { learnerName: 'Alex Thompson', infoExtractionRate: 92, communicationScore: 88, totalTurns: 24, criticalItemsFound: 8, criticalItemsTotal: 10 },
    { learnerName: 'Jane Miller', infoExtractionRate: 85, communicationScore: 79, totalTurns: 18, criticalItemsFound: 6, criticalItemsTotal: 10 },
    { learnerName: 'Robert Kim', infoExtractionRate: 78, communicationScore: 82, totalTurns: 15, criticalItemsFound: 5, criticalItemsTotal: 8 },
    { learnerName: 'Sarah Chen', infoExtractionRate: 95, communicationScore: 93, totalTurns: 28, criticalItemsFound: 9, criticalItemsTotal: 10 },
    { learnerName: 'Mike Torres', infoExtractionRate: 71, communicationScore: 75, totalTurns: 12, criticalItemsFound: 4, criticalItemsTotal: 8 },
  ],
}

export const DEMO_CONSUMPTION: ConsumptionData = {
  burnRate: { hoursConsumed: 843, hoursAllocated: 1200, periodStart: '2025-06-01', periodEnd: '2025-12-31' },
  seatActivation: { licensesProvisioned: 75, activeMonthlyUsers: 48, peakConcurrent: 12, utilizationRate: 64 },
  tokenExpenditure: [
    { category: 'Chest Pain Assessment', tokens: 890000 },
    { category: 'SOB Assessment', tokens: 620000 },
    { category: 'Pediatric Fever Protocol', tokens: 410000 },
    { category: 'Mental Health Intake', tokens: 350000 },
    { category: 'Trauma Assessment', tokens: 280000 },
    { category: 'Post-op Complications', tokens: 190000 },
  ],
}

export const DEMO_COMPLIANCE: ComplianceData = {
  phiInterceptions: {
    totalIntercepted: 47,
    byPattern: [
      { pattern: 'SSN', count: 12 },
      { pattern: 'Email', count: 18 },
      { pattern: 'Phone', count: 14 },
      { pattern: 'MRN', count: 3 },
    ],
    trend: 'decreasing',
  },
  auditChain: { chainValid: true, lastVerifiedAt: new Date().toISOString(), totalEntries: 14892 },
  inferenceLatency: [
    { timestamp: 'Jun 1', avgMs: 1240, p95Ms: 2100 },
    { timestamp: 'Jun 2', avgMs: 1180, p95Ms: 1950 },
    { timestamp: 'Jun 3', avgMs: 1310, p95Ms: 2250 },
    { timestamp: 'Jun 4', avgMs: 1090, p95Ms: 1880 },
    { timestamp: 'Jun 5', avgMs: 1150, p95Ms: 2010 },
    { timestamp: 'Jun 6', avgMs: 1220, p95Ms: 2150 },
    { timestamp: 'Jun 7', avgMs: 1050, p95Ms: 1820 },
    { timestamp: 'Jun 8', avgMs: 980, p95Ms: 1700 },
    { timestamp: 'Jun 9', avgMs: 1120, p95Ms: 1980 },
    { timestamp: 'Jun 10', avgMs: 1080, p95Ms: 1900 },
    { timestamp: 'Jun 11', avgMs: 1200, p95Ms: 2080 },
    { timestamp: 'Jun 12', avgMs: 950, p95Ms: 1650 },
    { timestamp: 'Jun 13', avgMs: 1020, p95Ms: 1780 },
    { timestamp: 'Jun 14', avgMs: 990, p95Ms: 1720 },
    { timestamp: 'Jun 15', avgMs: 1060, p95Ms: 1850 },
  ],
}

// API Client — will call real backend endpoints when available
import { api } from './apiClient'

export const analyticsApi = {
  getCompetency: () => api.get<CompetencyData>('/admin/analytics/competency'),
  getConsumption: () => api.get<ConsumptionData>('/admin/analytics/consumption'),
  getCompliance: () => api.get<ComplianceData>('/admin/analytics/compliance'),
  verifyAuditChain: () => api.get<{ chain_valid: boolean; last_verified_at: string }>('/admin/analytics/audit-chain/verify'),
}

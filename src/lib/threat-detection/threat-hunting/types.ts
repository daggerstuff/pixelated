import { EventEmitter } from 'events'

// Re-export types used by threat-data-utils
export type ThreatSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ThreatData {
  id: string
  timestamp: string
  source: string
  type: string
  severity: ThreatSeverity
  description: string
  raw_data?: unknown
  processed_at?: string
}

export interface ThreatPattern {
  id: string
  type: string
  source: string
  frequency: number
  first_seen: number
  last_seen: number
  confidence: number
  description: string
  related_threats: string[]
}

export interface ThreatFinding {
  id: string
  pattern_id: string
  title: string
  description: string
  severity: ThreatSeverity
  confidence: number
  related_threats: string[]
  created_at: string
  status: 'new' | 'investigating' | 'resolved'
}

/**
 * Interface abstractions for data stores to decouple service from direct implementations.
 * Enables easier testing with mocks and future repository pattern migration.
 */
export interface IRedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, mode?: string, duration?: number): Promise<'OK' | null>
  lrange(key: string, start: number, stop: number): Promise<string[]>
  incr(key: string): Promise<number>
  smembers(key: string): Promise<string[]>
  scan(cursor: string, ...args: any[]): Promise<[string, string[]]>
  lpush(key: string, ...values: string[]): Promise<number>
  lrem(key: string, count: number, element: string): Promise<number>
  mget(keys: string[]): Promise<(string | null)[]>
  quit(): Promise<'OK'>
}

export interface IMongoCollection {
  insertOne(doc: unknown): Promise<unknown>
  insertMany(docs: unknown[]): Promise<unknown>
  updateOne(filter: unknown, update: unknown, options?: unknown): Promise<unknown>
  replaceOne(filter: unknown, doc: unknown, options?: unknown): Promise<unknown>
  deleteMany(filter: unknown): Promise<unknown>
  findOne(filter: unknown): Promise<unknown>
  find(filter: unknown): {
    sort(spec: unknown): any
    limit(n: number): any
    toArray(): Promise<unknown[]>
  }
  countDocuments(filter?: unknown): Promise<number>
}

export interface IMongoDatabase {
  collection(name: string): IMongoCollection
}

export interface IMongoClient {
  db(name: string): IMongoDatabase
  connect(): Promise<this>
  close(): Promise<void>
}

export interface ThreatHuntingConfig {
  enabled: boolean
  huntingFrequency?: number // milliseconds
  investigationTimeout?: number
  mlModelConfig?: {
    enabled: boolean
    modelPath: string
    confidenceThreshold: number
  }
  huntingRules?: HuntingRule[]
  investigationTemplates?: InvestigationTemplate[]
  maxInvestigations?: number
  maxHuntQueries?: number
  timelineRetention?: number
  enableAIAnalysis?: boolean
  enableRealTimeHunting?: boolean
  autoArchiveCompleted?: boolean
  reportFormats?: string[]
  maxResultsPerQuery?: number
}

export interface HuntingRule {
  ruleId: string
  name: string
  description: string
  query: Record<string, unknown>
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  autoInvestigate: boolean
  investigationPriority: number
}

export interface InvestigationTemplate {
  templateId: string
  name: string
  description: string
  steps: InvestigationStep[]
  requiredData: string[]
  estimatedDuration: number
}

export interface InvestigationStep {
  stepId: string
  name: string
  description: string
  action: string
  parameters: Record<string, unknown>
  validationRules: ValidationRule[]
  timeout: number
}

export interface ValidationRule {
  type: 'threshold' | 'pattern' | 'existence'
  condition: string
  expectedValue?: unknown
  operator?: 'equals' | 'greater_than' | 'less_than' | 'contains' | 'exists'
}

export interface HuntResult {
  huntId: string
  ruleId: string
  timestamp: Date
  findings: HuntFinding[]
  investigationTriggered: boolean
  investigationId?: string
  confidence: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  metadata: Record<string, unknown>
}

export interface HuntFinding {
  findingId: string
  type: 'anomaly' | 'suspicious_pattern' | 'iocs' | 'behavioral_deviation'
  title: string
  description: string
  evidence: Record<string, unknown>[]
  confidence: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  recommendedActions: string[]
  relatedEntities: string[]
}

export interface Investigation {
  investigationId: string
  huntId?: string
  threatId?: string
  templateId?: string
  title?: string
  description?: string
  type?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'active' | 'in_progress' | 'resolved'
  priority: 'low' | 'medium' | 'high' | 'critical'
  assignedTo?: string
  steps: InvestigationStepResult[]
  findings: InvestigationFinding[]
  evidence?: Record<string, unknown>[]
  tags?: string[]
  externalTicketId?: string
  createdAt: Date
  updatedAt: Date
  completedAt?: Date
  metadata?: Record<string, unknown>
}

export interface InvestigationStepResult {
  stepId: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  executionTime: number
  timestamp: Date
  result?: Record<string, unknown>
  error?: string
}

export interface InvestigationFinding {
  findingId: string
  type: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  evidence: Record<string, unknown>[]
  timestamp: Date
}

export interface HuntReport {
  reportId: string
  huntId: string
  generatedAt: Date
  timestamp: Date // Alias for generatedAt to support investigation status reporting
  summary: {
    totalFindings: number
    severityDistribution: Record<string, number>
    avgConfidence: number
    investigationTriggered: boolean
  }
  meta: {
    threatLevel: 'low' | 'medium' | 'high' | 'critical'
    confidence: number
  }
  findings: HuntFinding[]
  recommendations: string[]
  exportUrl?: string
}

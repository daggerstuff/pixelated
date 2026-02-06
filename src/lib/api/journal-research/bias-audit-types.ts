import { z } from 'zod'

/**
 * Dataset Bias Audit & Quarantine Types
 *
 * This module defines types for the bias audit feature within the journal research pipeline.
 * It enables analysis of imported datasets for bias before they are merged into the training pool.
 */

// Quarantine status enum
export const QuarantineStatusSchema = z.enum([
  'pending_review',
  'under_audit',
  'approved',
  'quarantined',
  'rejected',
])
export type QuarantineStatus = z.infer<typeof QuarantineStatusSchema>

// Bias score distribution for histograms
export const BiasScoreDistributionSchema = z.object({
  range: z.string(), // e.g., "0.0-0.1", "0.1-0.2"
  count: z.number(),
  percentage: z.number(),
})
export type BiasScoreDistribution = z.infer<typeof BiasScoreDistributionSchema>

// Individual bias metric result
export const BiasMetricResultSchema = z.object({
  metricName: z.string(),
  score: z.number().min(0).max(1),
  threshold: z.number().min(0).max(1),
  passed: z.boolean(),
  details: z.string().optional(),
})
export type BiasMetricResult = z.infer<typeof BiasMetricResultSchema>

// Demographic bias breakdown
export const DemographicBiasBreakdownSchema = z.object({
  category: z.string(), // e.g., "gender", "age", "ethnicity", "cultural"
  scores: z.record(z.string(), z.number()), // e.g., { "male": 0.12, "female": 0.08 }
  overallScore: z.number().min(0).max(1),
  concernLevel: z.enum(['low', 'medium', 'high', 'critical']),
})
export type DemographicBiasBreakdown = z.infer<typeof DemographicBiasBreakdownSchema>

// Dataset audit result
export const DatasetAuditResultSchema = z.object({
  auditId: z.string(),
  datasetId: z.string(),
  datasetName: z.string(),
  auditedAt: z.date(),
  auditedBy: z.string(),
  overallBiasScore: z.number().min(0).max(1),
  passesThreshold: z.boolean(),
  quarantineStatus: QuarantineStatusSchema,
  sampleSize: z.number(),
  totalRecords: z.number(),
  metrics: z.array(BiasMetricResultSchema),
  demographicBreakdown: z.array(DemographicBiasBreakdownSchema),
  scoreDistribution: z.array(BiasScoreDistributionSchema),
  recommendations: z.array(z.string()),
  notes: z.string().optional(),
})
export type DatasetAuditResult = z.infer<typeof DatasetAuditResultSchema>

// Dataset for audit (input)
export const DatasetForAuditSchema = z.object({
  datasetId: z.string(),
  name: z.string(),
  sourceId: z.string().optional(),
  filePath: z.string(),
  fileSize: z.number(), // in bytes
  recordCount: z.number(),
  format: z.enum(['jsonl', 'csv', 'parquet', 'json']),
  uploadedAt: z.date(),
  uploadedBy: z.string(),
  quarantineStatus: QuarantineStatusSchema.default('pending_review'),
  lastAuditId: z.string().optional(),
  lastAuditScore: z.number().optional(),
})
export type DatasetForAudit = z.infer<typeof DatasetForAuditSchema>

// Audit configuration
export const AuditConfigSchema = z.object({
  sampleSize: z.number().min(100).max(100000).default(1000),
  thresholds: z.object({
    overall: z.number().min(0).max(1).default(0.3),
    gender: z.number().min(0).max(1).default(0.25),
    racial: z.number().min(0).max(1).default(0.25),
    age: z.number().min(0).max(1).default(0.25),
    cultural: z.number().min(0).max(1).default(0.25),
  }),
  enabledMetrics: z.array(z.string()).default([
    'genderBias',
    'racialBias',
    'ageBias',
    'culturalBias',
    'sentimentBias',
    'representationBias',
  ]),
  autoQuarantine: z.boolean().default(true),
  requireManualApproval: z.boolean().default(true),
})
export type AuditConfig = z.infer<typeof AuditConfigSchema>

// Audit summary for dashboard
export const AuditSummarySchema = z.object({
  totalDatasets: z.number(),
  pendingReview: z.number(),
  underAudit: z.number(),
  approved: z.number(),
  quarantined: z.number(),
  rejected: z.number(),
  averageBiasScore: z.number(),
  lastAuditDate: z.date().optional(),
})
export type AuditSummary = z.infer<typeof AuditSummarySchema>

// Quarantine action payload
export const QuarantineActionPayloadSchema = z.object({
  datasetId: z.string(),
  action: z.enum(['approve', 'quarantine', 'reject', 'request_reaudit']),
  reason: z.string().optional(),
  reviewedBy: z.string(),
  notes: z.string().optional(),
})
export type QuarantineActionPayload = z.infer<typeof QuarantineActionPayloadSchema>

// Audit history entry
export const AuditHistoryEntrySchema = z.object({
  historyId: z.string(),
  datasetId: z.string(),
  auditId: z.string(),
  action: z.string(),
  previousStatus: QuarantineStatusSchema,
  newStatus: QuarantineStatusSchema,
  performedBy: z.string(),
  performedAt: z.date(),
  reason: z.string().optional(),
})
export type AuditHistoryEntry = z.infer<typeof AuditHistoryEntrySchema>

// Paginated audit results
export const PaginatedAuditResultsSchema = z.object({
  items: z.array(DatasetAuditResultSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})
export type PaginatedAuditResults = z.infer<typeof PaginatedAuditResultsSchema>

// Paginated datasets for audit
export const PaginatedDatasetsForAuditSchema = z.object({
  items: z.array(DatasetForAuditSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
  totalPages: z.number(),
})
export type PaginatedDatasetsForAudit = z.infer<typeof PaginatedDatasetsForAuditSchema>

// Initiate audit payload
export const InitiateAuditPayloadSchema = z.object({
  datasetIds: z.array(z.string()),
  config: AuditConfigSchema.optional(),
})
export type InitiateAuditPayload = z.infer<typeof InitiateAuditPayloadSchema>

// Audit progress update (for real-time updates)
export const AuditProgressUpdateSchema = z.object({
  auditId: z.string(),
  datasetId: z.string(),
  status: z.enum(['started', 'sampling', 'analyzing', 'computing_metrics', 'completed', 'failed']),
  progress: z.number().min(0).max(100),
  currentStep: z.string(),
  estimatedTimeRemaining: z.number().optional(), // seconds
  error: z.string().optional(),
})
export type AuditProgressUpdate = z.infer<typeof AuditProgressUpdateSchema>

// Serialization helpers for API requests
export const serializeInitiateAuditPayload = (payload: InitiateAuditPayload) => {
  const parsed = InitiateAuditPayloadSchema.parse(payload)
  return {
    dataset_ids: parsed.datasetIds,
    config: parsed.config
      ? {
          sample_size: parsed.config.sampleSize,
          thresholds: {
            overall: parsed.config.thresholds.overall,
            gender: parsed.config.thresholds.gender,
            racial: parsed.config.thresholds.racial,
            age: parsed.config.thresholds.age,
            cultural: parsed.config.thresholds.cultural,
          },
          enabled_metrics: parsed.config.enabledMetrics,
          auto_quarantine: parsed.config.autoQuarantine,
          require_manual_approval: parsed.config.requireManualApproval,
        }
      : undefined,
  }
}

export const serializeQuarantineActionPayload = (payload: QuarantineActionPayload) => {
  const parsed = QuarantineActionPayloadSchema.parse(payload)
  return {
    dataset_id: parsed.datasetId,
    action: parsed.action,
    reason: parsed.reason,
    reviewed_by: parsed.reviewedBy,
    notes: parsed.notes,
  }
}

// Response schema transformers (for parsing API responses)
export const parseDatasetAuditResult = (data: Record<string, unknown>): DatasetAuditResult => {
  return DatasetAuditResultSchema.parse({
    auditId: data.audit_id,
    datasetId: data.dataset_id,
    datasetName: data.dataset_name,
    auditedAt: new Date(data.audited_at as string),
    auditedBy: data.audited_by,
    overallBiasScore: data.overall_bias_score,
    passesThreshold: data.passes_threshold,
    quarantineStatus: data.quarantine_status,
    sampleSize: data.sample_size,
    totalRecords: data.total_records,
    metrics: (data.metrics as Array<Record<string, unknown>>)?.map((m) => ({
      metricName: m.metric_name,
      score: m.score,
      threshold: m.threshold,
      passed: m.passed,
      details: m.details,
    })),
    demographicBreakdown: (data.demographic_breakdown as Array<Record<string, unknown>>)?.map((d) => ({
      category: d.category,
      scores: d.scores,
      overallScore: d.overall_score,
      concernLevel: d.concern_level,
    })),
    scoreDistribution: (data.score_distribution as Array<Record<string, unknown>>)?.map((s) => ({
      range: s.range,
      count: s.count,
      percentage: s.percentage,
    })),
    recommendations: data.recommendations,
    notes: data.notes,
  })
}

export const parseDatasetForAudit = (data: Record<string, unknown>): DatasetForAudit => {
  return DatasetForAuditSchema.parse({
    datasetId: data.dataset_id,
    name: data.name,
    sourceId: data.source_id,
    filePath: data.file_path,
    fileSize: data.file_size,
    recordCount: data.record_count,
    format: data.format,
    uploadedAt: new Date(data.uploaded_at as string),
    uploadedBy: data.uploaded_by,
    quarantineStatus: data.quarantine_status,
    lastAuditId: data.last_audit_id,
    lastAuditScore: data.last_audit_score,
  })
}

export const parseAuditSummary = (data: Record<string, unknown>): AuditSummary => {
  return AuditSummarySchema.parse({
    totalDatasets: data.total_datasets,
    pendingReview: data.pending_review,
    underAudit: data.under_audit,
    approved: data.approved,
    quarantined: data.quarantined,
    rejected: data.rejected,
    averageBiasScore: data.average_bias_score,
    lastAuditDate: data.last_audit_date ? new Date(data.last_audit_date as string) : undefined,
  })
}

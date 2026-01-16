import { z } from 'zod'

const isoDateSchema = z
  .string()
  .datetime()
  .transform((value) => new Date(value))

const optionalIsoDateSchema = z
  .string()
  .datetime()
  .transform((value) => new Date(value))
  .optional()
  .nullable()
  .transform((value) => (value || null))

export const SearchKeywordMapSchema = z.record(z.string(), z.array(z.string()))
export type SearchKeywordMap = z.infer<typeof SearchKeywordMapSchema>

export const WeeklyTargetsSchema = z.record(z.string(), z.number())
export type WeeklyTargets = z.infer<typeof WeeklyTargetsSchema>

export const ProgressMetricsSchema = z
  .object({
    sources_identified: z.number(),
    datasets_evaluated: z.number(),
    datasets_acquired: z.number(),
    integration_plans_created: z.number(),
    last_updated: optionalIsoDateSchema,
  })
  .transform((data) => ({
    sourcesIdentified: data.sources_identified,
    datasetsEvaluated: data.datasets_evaluated,
    datasetsAcquired: data.datasets_acquired,
    integrationPlansCreated: data.integration_plans_created,
    lastUpdated: data.last_updated,
  }))

export type ProgressMetrics = z.infer<typeof ProgressMetricsSchema>

export const SessionSchema = z
  .object({
    session_id: z.string(),
    start_date: isoDateSchema,
    target_sources: z.array(z.string()),
    search_keywords: SearchKeywordMapSchema,
    weekly_targets: WeeklyTargetsSchema,
    current_phase: z.string(),
    progress_metrics: z.record(z.string(), z.number()),
  })
  .transform((data) => ({
    sessionId: data.session_id,
    startDate: data.start_date,
    targetSources: data.target_sources,
    searchKeywords: data.search_keywords,
    weeklyTargets: data.weekly_targets,
    currentPhase: data.current_phase,
    progressMetrics: data.progress_metrics,
  }))

export type Session = z.infer<typeof SessionSchema>

export const SourceSchema = z
  .object({
    source_id: z.string(),
    title: z.string(),
    authors: z.array(z.string()),
    publication_date: isoDateSchema,
    source_type: z.string(),
    url: z.string().url(),
    doi: z.string().optional().nullable(),
    abstract: z.string(),
    keywords: z.array(z.string()),
    open_access: z.boolean(),
    data_availability: z.string(),
    discovery_date: isoDateSchema,
    discovery_method: z.string(),
  })
  .transform((data) => ({
    sourceId: data.source_id,
    title: data.title,
    authors: data.authors,
    publicationDate: data.publication_date,
    sourceType: data.source_type,
    url: data.url,
    doi: data.doi ?? null,
    abstract: data.abstract,
    keywords: data.keywords,
    openAccess: data.open_access,
    dataAvailability: data.data_availability,
    discoveryDate: data.discovery_date,
    discoveryMethod: data.discovery_method,
  }))

export type Source = z.infer<typeof SourceSchema>

export const DiscoveryResponseSchema = z
  .object({
    session_id: z.string(),
    sources: z.array(SourceSchema),
    total_sources: z.number(),
    discovery_status: z.string(),
  })
  .transform((data) => ({
    sessionId: data.session_id,
    sources: data.sources,
    totalSources: data.total_sources,
    discoveryStatus: data.discovery_status,
  }))

export type DiscoveryResponse = z.infer<typeof DiscoveryResponseSchema>

export const EvaluationSchema = z
  .object({
    evaluation_id: z.string(),
    source_id: z.string(),
    therapeutic_relevance: z.number(),
    data_structure_quality: z.number(),
    training_integration: z.number(),
    ethical_accessibility: z.number(),
    overall_score: z.number(),
    priority_tier: z.string(),
    evaluation_date: isoDateSchema,
    evaluator: z.string(),
  })
  .transform((data) => ({
    evaluationId: data.evaluation_id,
    sourceId: data.source_id,
    therapeuticRelevance: data.therapeutic_relevance,
    dataStructureQuality: data.data_structure_quality,
    trainingIntegration: data.training_integration,
    ethicalAccessibility: data.ethical_accessibility,
    overallScore: data.overall_score,
    priorityTier: data.priority_tier,
    evaluationDate: data.evaluation_date,
    evaluator: data.evaluator,
  }))

export type Evaluation = z.infer<typeof EvaluationSchema>

export const AcquisitionSchema = z
  .object({
    acquisition_id: z.string(),
    source_id: z.string(),
    status: z.string(),
    download_progress: z.number().optional().nullable(),
    file_path: z.string().optional().nullable(),
    file_size: z.number().optional().nullable(),
    acquired_date: optionalIsoDateSchema,
  })
  .transform((data) => ({
    acquisitionId: data.acquisition_id,
    sourceId: data.source_id,
    status: data.status,
    downloadProgress: data.download_progress ?? null,
    filePath: data.file_path ?? null,
    fileSizeMb: data.file_size ?? null,
    acquiredDate: data.acquired_date,
  }))

export type Acquisition = z.infer<typeof AcquisitionSchema>

export const IntegrationPlanSchema = z
  .object({
    plan_id: z.string(),
    source_id: z.string(),
    complexity: z.string(),
    target_format: z.string(),
    required_transformations: z.array(z.string()),
    estimated_effort_hours: z.number(),
    schema_mapping: z.record(z.string(), z.string()),
    created_date: isoDateSchema,
  })
  .transform((data) => ({
    planId: data.plan_id,
    sourceId: data.source_id,
    complexity: data.complexity,
    targetFormat: data.target_format,
    requiredTransformations: data.required_transformations,
    estimatedEffortHours: data.estimated_effort_hours,
    schemaMapping: data.schema_mapping,
    createdDate: data.created_date,
  }))

export type IntegrationPlan = z.infer<typeof IntegrationPlanSchema>

export const ProgressSchema = z
  .object({
    session_id: z.string(),
    current_phase: z.string(),
    progress_metrics: z.record(z.string(), z.number()),
    weekly_targets: WeeklyTargetsSchema,
    progress_percentage: z.number(),
  })
  .transform((data) => ({
    sessionId: data.session_id,
    currentPhase: data.current_phase,
    progressMetrics: data.progress_metrics,
    weeklyTargets: data.weekly_targets,
    progressPercentage: data.progress_percentage,
  }))

export type Progress = z.infer<typeof ProgressSchema>

export const ProgressMetricsResponseSchema = ProgressMetricsSchema

export const ReportSchema = z
  .object({
    report_id: z.string(),
    session_id: z.string(),
    report_type: z.string(),
    format: z.string(),
    generated_date: isoDateSchema,
    content: z.unknown().optional().nullable(),
    file_path: z.string().optional().nullable(),
  })
  .transform((data) => ({
    reportId: data.report_id,
    sessionId: data.session_id,
    reportType: data.report_type,
    format: data.format,
    generatedDate: data.generated_date,
    content: data.content ?? null,
    filePath: data.file_path ?? null,
  }))

export type Report = z.infer<typeof ReportSchema>

const PaginationEnvelopeSchema = z.object({
  total: z.number(),
  page: z.number(),
  page_size: z.number(),
  total_pages: z.number(),
})

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const createPaginatedSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  PaginationEnvelopeSchema.and(
    z.object({
      items: z.array(itemSchema),
    }),
  ).transform((data) => ({
    items: data.items as Array<z.infer<T>>,
    total: data.total,
    page: data.page,
    pageSize: data.page_size,
    totalPages: data.total_pages,
  }))

export const SessionListSchema = createPaginatedSchema(SessionSchema)
export type SessionList = z.infer<typeof SessionListSchema>

export const SourceListSchema = createPaginatedSchema(SourceSchema)
export type SourceList = z.infer<typeof SourceListSchema>

export const EvaluationListSchema = createPaginatedSchema(EvaluationSchema)
export type EvaluationList = z.infer<typeof EvaluationListSchema>

export const AcquisitionListSchema = createPaginatedSchema(AcquisitionSchema)
export type AcquisitionList = z.infer<typeof AcquisitionListSchema>

export const IntegrationPlanListSchema =
  createPaginatedSchema(IntegrationPlanSchema)
export type IntegrationPlanList = z.infer<typeof IntegrationPlanListSchema>

export const ReportListSchema = createPaginatedSchema(ReportSchema)
export type ReportList = z.infer<typeof ReportListSchema>

// Request payload schemas
export const CreateSessionPayloadSchema = z.object({
  sessionId: z.string().optional(),
  targetSources: z.array(z.string()).default(['pubmed', 'doaj']),
  searchKeywords: SearchKeywordMapSchema.default({}),
  weeklyTargets: WeeklyTargetsSchema.default({}),
})

export type CreateSessionPayload = z.input<typeof CreateSessionPayloadSchema>

export const UpdateSessionPayloadSchema = z.object({
  targetSources: z.array(z.string()).optional(),
  searchKeywords: SearchKeywordMapSchema.optional(),
  weeklyTargets: WeeklyTargetsSchema.optional(),
  currentPhase: z.string().optional(),
})

export type UpdateSessionPayload = z.input<typeof UpdateSessionPayloadSchema>

export const DiscoveryInitiatePayloadSchema = z.object({
  keywords: z.array(z.string()).default([]),
  sources: z.array(z.string()).default(['pubmed', 'doaj']),
})

export type DiscoveryInitiatePayload = z.input<
  typeof DiscoveryInitiatePayloadSchema
>

export const EvaluationInitiatePayloadSchema = z.object({
  sourceIds: z.array(z.string()).optional(),
})

export type EvaluationInitiatePayload = z.input<
  typeof EvaluationInitiatePayloadSchema
>

export const EvaluationUpdatePayloadSchema = z.object({
  therapeuticRelevance: z.number().min(1).max(10).optional(),
  dataStructureQuality: z.number().min(1).max(10).optional(),
  trainingIntegration: z.number().min(1).max(10).optional(),
  ethicalAccessibility: z.number().min(1).max(10).optional(),
  priorityTier: z.string().optional(),
})

export type EvaluationUpdatePayload = z.input<
  typeof EvaluationUpdatePayloadSchema
>

export const AcquisitionInitiatePayloadSchema = z.object({
  sourceIds: z.array(z.string()).optional(),
})

export type AcquisitionInitiatePayload = z.input<
  typeof AcquisitionInitiatePayloadSchema
>

export const AcquisitionUpdatePayloadSchema = z.object({
  status: z.enum(['pending', 'approved', 'in-progress', 'completed', 'failed']),
})

export type AcquisitionUpdatePayload = z.input<
  typeof AcquisitionUpdatePayloadSchema
>

export const IntegrationInitiatePayloadSchema = z.object({
  sourceIds: z.array(z.string()).optional(),
  targetFormat: z.string().default('chatml'),
})

export type IntegrationInitiatePayload = z.input<
  typeof IntegrationInitiatePayloadSchema
>

export const ReportGeneratePayloadSchema = z.object({
  reportType: z
    .enum(['session_report', 'weekly_report', 'summary_report'])
    .default('session_report'),
  format: z.enum(['json', 'markdown', 'pdf']).default('json'),
  dateRange: z
    .object({
      startDate: z.union([z.date(), z.string().datetime()]).optional(),
      endDate: z.union([z.date(), z.string().datetime()]).optional(),
    })
    .optional(),
})

export type ReportGeneratePayload = z.input<
  typeof ReportGeneratePayloadSchema
>

// Serialization helpers
export const serializeCreateSessionPayload = (
  payload: CreateSessionPayload,
) => {
  const parsed = CreateSessionPayloadSchema.parse(payload)
  return {
    session_id: parsed.sessionId,
    target_sources: parsed.targetSources,
    search_keywords: parsed.searchKeywords,
    weekly_targets: parsed.weeklyTargets,
  }
}

export const serializeUpdateSessionPayload = (
  payload: UpdateSessionPayload,
) => {
  const parsed = UpdateSessionPayloadSchema.parse(payload)
  return {
    target_sources: parsed.targetSources,
    search_keywords: parsed.searchKeywords,
    weekly_targets: parsed.weeklyTargets,
    current_phase: parsed.currentPhase,
  }
}

export const serializeDiscoveryInitiatePayload = (
  payload: DiscoveryInitiatePayload,
) => {
  const parsed = DiscoveryInitiatePayloadSchema.parse(payload)
  return {
    keywords: parsed.keywords,
    sources: parsed.sources,
  }
}

export const serializeEvaluationInitiatePayload = (
  payload: EvaluationInitiatePayload,
) => {
  const parsed = EvaluationInitiatePayloadSchema.parse(payload)
  return {
    source_ids: parsed.sourceIds,
  }
}

export const serializeEvaluationUpdatePayload = (
  payload: EvaluationUpdatePayload,
) => {
  const parsed = EvaluationUpdatePayloadSchema.parse(payload)
  return {
    therapeutic_relevance: parsed.therapeuticRelevance,
    data_structure_quality: parsed.dataStructureQuality,
    training_integration: parsed.trainingIntegration,
    ethical_accessibility: parsed.ethicalAccessibility,
    priority_tier: parsed.priorityTier,
  }
}

export const serializeAcquisitionInitiatePayload = (
  payload: AcquisitionInitiatePayload,
) => {
  const parsed = AcquisitionInitiatePayloadSchema.parse(payload)
  return {
    source_ids: parsed.sourceIds,
  }
}

export const serializeAcquisitionUpdatePayload = (
  payload: AcquisitionUpdatePayload,
) => {
  const parsed = AcquisitionUpdatePayloadSchema.parse(payload)
  return {
    status: parsed.status,
  }
}

export const serializeIntegrationInitiatePayload = (
  payload: IntegrationInitiatePayload,
) => {
  const parsed = IntegrationInitiatePayloadSchema.parse(payload)
  return {
    source_ids: parsed.sourceIds,
    target_format: parsed.targetFormat,
  }
}

export const serializeReportGeneratePayload = (
  payload: ReportGeneratePayload,
) => {
  const parsed = ReportGeneratePayloadSchema.parse(payload)
  return {
    report_type: parsed.reportType,
    format: parsed.format,
    date_range: parsed.dateRange
      ? {
        start_date:
          parsed.dateRange.startDate instanceof Date
            ? parsed.dateRange.startDate.toISOString()
            : parsed.dateRange.startDate,
        end_date:
          parsed.dateRange.endDate instanceof Date
            ? parsed.dateRange.endDate.toISOString()
            : parsed.dateRange.endDate,
      }
      : undefined,
  }
}



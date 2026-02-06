/**
 * BiasAuditDashboard Component
 *
 * Main dashboard for the Dataset Bias Audit & Quarantine feature.
 * Provides an overview of dataset bias audits, quarantine workflow management,
 * and detailed bias analysis visualization including histograms.
 */

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card/card'
import { useBiasAuditDashboard } from '@/lib/hooks/use-bias-audit'
import type {
  QuarantineStatus,
  DatasetForAudit,
  DatasetAuditResult,
  BiasScoreDistribution,
  DemographicBiasBreakdown,
} from '@/lib/api/journal-research/bias-audit-types'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

export interface BiasAuditDashboardProps {
  className?: string
}

// Status badge component
function StatusBadge({ status }: { status: QuarantineStatus }) {
  const statusConfig: Record<QuarantineStatus, { label: string; className: string }> = {
    pending_review: { label: 'Pending Review', className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
    under_audit: { label: 'Under Audit', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    approved: { label: 'Approved', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
    quarantined: { label: 'Quarantined', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    rejected: { label: 'Rejected', className: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  }

  const config = statusConfig[status]
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', config.className)}>
      {config.label}
    </span>
  )
}

// Bias score indicator
function BiasScoreIndicator({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const getColor = (s: number) => {
    if (s < 0.2) return 'text-green-400'
    if (s < 0.4) return 'text-yellow-400'
    if (s < 0.6) return 'text-orange-400'
    return 'text-red-400'
  }

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg font-semibold',
    lg: 'text-2xl font-bold',
  }

  return (
    <span className={cn(getColor(score), sizeClasses[size])}>
      {(score * 100).toFixed(1)}%
    </span>
  )
}

// Simple histogram component for bias score distribution
function BiasHistogram({ distribution, height = 120 }: { distribution: BiasScoreDistribution[]; height?: number }) {
  const maxCount = Math.max(...distribution.map((d) => d.count), 1)

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-1" style={{ height }}>
        {distribution.map((bucket, index) => {
          const barHeight = (bucket.count / maxCount) * 100
          const isLowBias = index < 3
          const isMediumBias = index >= 3 && index < 6
          const isHighBias = index >= 6

          let barColor = 'bg-green-500'
          if (isMediumBias) barColor = 'bg-yellow-500'
          if (isHighBias) barColor = 'bg-red-500'

          return (
            <div
              key={bucket.range}
              className="flex-1 flex flex-col items-center justify-end group relative"
            >
              <div
                className={cn('w-full rounded-t transition-all', barColor, 'opacity-70 hover:opacity-100')}
                style={{ height: `${Math.max(barHeight, 2)}%` }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  {bucket.range}: {bucket.count} ({bucket.percentage.toFixed(1)}%)
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between mt-2 text-xs text-muted-foreground">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-1">Bias Score Distribution</p>
    </div>
  )
}

// Demographic breakdown chart
function DemographicBreakdownChart({ breakdown }: { breakdown: DemographicBiasBreakdown[] }) {
  const concernColors: Record<string, string> = {
    low: 'bg-green-500',
    medium: 'bg-yellow-500',
    high: 'bg-orange-500',
    critical: 'bg-red-500',
  }

  return (
    <div className="space-y-4">
      {breakdown.map((demo) => (
        <div key={demo.category} className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium capitalize">{demo.category}</span>
            <span className={cn('text-xs px-2 py-0.5 rounded', concernColors[demo.concernLevel], 'bg-opacity-20')}>
              {demo.concernLevel}
            </span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={cn('h-full transition-all', concernColors[demo.concernLevel])}
              style={{ width: `${demo.overallScore * 100}%` }}
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            {Object.entries(demo.scores).map(([group, score]) => (
              <span key={group}>
                {group}: {(score * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// Summary statistics card
function SummaryCard({
  summary,
  isLoading,
}: {
  summary: ReturnType<typeof useBiasAuditDashboard>['summary']
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-700 rounded w-1/4" />
            <div className="grid grid-cols-3 gap-4">
              <div className="h-16 bg-gray-700 rounded" />
              <div className="h-16 bg-gray-700 rounded" />
              <div className="h-16 bg-gray-700 rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!summary) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Overview</CardTitle>
        <CardDescription>
          {summary.lastAuditDate
            ? `Last audit: ${format(summary.lastAuditDate, 'MMM d, yyyy HH:mm')}`
            : 'No audits performed yet'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="text-center p-4 bg-gray-800/50 rounded-lg">
            <p className="text-2xl font-bold">{summary.totalDatasets}</p>
            <p className="text-xs text-muted-foreground">Total Datasets</p>
          </div>
          <div className="text-center p-4 bg-yellow-500/10 rounded-lg">
            <p className="text-2xl font-bold text-yellow-400">{summary.pendingReview}</p>
            <p className="text-xs text-muted-foreground">Pending Review</p>
          </div>
          <div className="text-center p-4 bg-blue-500/10 rounded-lg">
            <p className="text-2xl font-bold text-blue-400">{summary.underAudit}</p>
            <p className="text-xs text-muted-foreground">Under Audit</p>
          </div>
          <div className="text-center p-4 bg-green-500/10 rounded-lg">
            <p className="text-2xl font-bold text-green-400">{summary.approved}</p>
            <p className="text-xs text-muted-foreground">Approved</p>
          </div>
          <div className="text-center p-4 bg-red-500/10 rounded-lg">
            <p className="text-2xl font-bold text-red-400">{summary.quarantined}</p>
            <p className="text-xs text-muted-foreground">Quarantined</p>
          </div>
          <div className="text-center p-4 bg-gray-500/10 rounded-lg">
            <p className="text-2xl font-bold">
              <BiasScoreIndicator score={summary.averageBiasScore} size="lg" />
            </p>
            <p className="text-xs text-muted-foreground">Avg Bias Score</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Dataset list component
function DatasetList({
  datasets,
  selectedId,
  onSelect,
  isLoading,
}: {
  datasets: ReturnType<typeof useBiasAuditDashboard>['datasets']
  selectedId: string | null
  onSelect: (id: string | null) => void
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse h-16 bg-gray-700 rounded" />
        ))}
      </div>
    )
  }

  if (!datasets || datasets.items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No datasets found.</p>
        <p className="text-sm">Import datasets to begin bias auditing.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {datasets.items.map((dataset) => (
        <button
          key={dataset.datasetId}
          onClick={() => onSelect(dataset.datasetId === selectedId ? null : dataset.datasetId)}
          className={cn(
            'w-full text-left p-4 rounded-lg border transition-all',
            dataset.datasetId === selectedId
              ? 'border-primary bg-primary/10'
              : 'border-gray-700 bg-gray-800/50 hover:bg-gray-800'
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium truncate">{dataset.name}</span>
            <StatusBadge status={dataset.quarantineStatus} />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{dataset.recordCount.toLocaleString()} records</span>
            {dataset.lastAuditScore !== undefined && (
              <BiasScoreIndicator score={dataset.lastAuditScore} size="sm" />
            )}
          </div>
        </button>
      ))}
    </div>
  )
}

// Audit detail panel
function AuditDetailPanel({
  audit,
  dataset,
  isLoading,
  onAction,
  actionLoading,
}: {
  audit: DatasetAuditResult | null | undefined
  dataset: DatasetForAudit | null | undefined
  isLoading: boolean
  onAction: (action: 'approve' | 'quarantine' | 'reject' | 'request_reaudit', reason?: string) => void
  actionLoading: boolean
}) {
  const [actionReason, setActionReason] = useState('')

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-700 rounded w-1/2" />
        <div className="h-32 bg-gray-700 rounded" />
        <div className="h-48 bg-gray-700 rounded" />
      </div>
    )
  }

  if (!dataset) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Select a dataset to view audit details</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Dataset Info */}
      <div>
        <h3 className="text-lg font-semibold mb-2">{dataset.name}</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Format:</span>{' '}
            <span className="uppercase">{dataset.format}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Records:</span>{' '}
            {dataset.recordCount.toLocaleString()}
          </div>
          <div>
            <span className="text-muted-foreground">Size:</span>{' '}
            {(dataset.fileSize / 1024 / 1024).toFixed(2)} MB
          </div>
          <div>
            <span className="text-muted-foreground">Uploaded:</span>{' '}
            {format(dataset.uploadedAt, 'MMM d, yyyy')}
          </div>
        </div>
      </div>

      {/* Audit Results */}
      {audit ? (
        <>
          {/* Overall Score */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Overall Bias Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <BiasScoreIndicator score={audit.overallBiasScore} size="lg" />
                <span className={cn('text-sm', audit.passesThreshold ? 'text-green-400' : 'text-red-400')}>
                  {audit.passesThreshold ? '✓ Passes threshold' : '✗ Exceeds threshold'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Analyzed {audit.sampleSize.toLocaleString()} of {audit.totalRecords.toLocaleString()} records
              </p>
            </CardContent>
          </Card>

          {/* Score Distribution Histogram */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Score Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <BiasHistogram distribution={audit.scoreDistribution} />
            </CardContent>
          </Card>

          {/* Metric Results */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Bias Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {audit.metrics.map((metric) => (
                  <div key={metric.metricName} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={metric.passed ? 'text-green-400' : 'text-red-400'}>
                        {metric.passed ? '✓' : '✗'}
                      </span>
                      <span className="text-sm">{metric.metricName}</span>
                    </div>
                    <div className="text-sm">
                      <BiasScoreIndicator score={metric.score} size="sm" />
                      <span className="text-muted-foreground ml-2">
                        / {(metric.threshold * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Demographic Breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Demographic Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <DemographicBreakdownChart breakdown={audit.demographicBreakdown} />
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {audit.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-primary">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <p>No audit results available</p>
          <p className="text-sm">Run an audit to see bias analysis</p>
        </div>
      )}

      {/* Actions */}
      {dataset.quarantineStatus !== 'approved' && dataset.quarantineStatus !== 'rejected' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground block mb-2">Reason (optional)</label>
              <textarea
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder="Add notes about your decision..."
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm resize-none"
                rows={2}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onAction('approve', actionReason)}
                disabled={actionLoading}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => onAction('quarantine', actionReason)}
                disabled={actionLoading}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
              >
                Quarantine
              </button>
              <button
                onClick={() => onAction('reject', actionReason)}
                disabled={actionLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => onAction('request_reaudit', actionReason)}
                disabled={actionLoading}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 rounded-md text-sm font-medium transition-colors"
              >
                Request Re-audit
              </button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Main dashboard component
export function BiasAuditDashboard({ className }: BiasAuditDashboardProps) {
  const {
    summary,
    summaryLoading,
    datasets,
    datasetsLoading,
    selectedDatasetId,
    selectedDataset,
    selectedDatasetLoading,
    selectedAudit,
    selectedAuditLoading,
    statusFilter,
    selectDataset,
    setStatusFilter,
    initiateAudit,
    initiateAuditLoading,
    auditProgress,
    processQuarantineAction,
    quarantineActionLoading,
    page,
    setPage,
  } = useBiasAuditDashboard()

  const statusOptions: { value: QuarantineStatus | 'all'; label: string }[] = [
    { value: 'all', label: 'All Datasets' },
    { value: 'pending_review', label: 'Pending Review' },
    { value: 'under_audit', label: 'Under Audit' },
    { value: 'approved', label: 'Approved' },
    { value: 'quarantined', label: 'Quarantined' },
    { value: 'rejected', label: 'Rejected' },
  ]

  const handleAuditSelected = async () => {
    if (selectedDatasetId) {
      await initiateAudit([selectedDatasetId])
    }
  }

  const handleAuditAllPending = async () => {
    const pendingDatasets = datasets?.items.filter((d) => d.quarantineStatus === 'pending_review') ?? []
    if (pendingDatasets.length > 0) {
      await initiateAudit(pendingDatasets.map((d) => d.datasetId))
    }
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dataset Bias Audit</h1>
          <p className="text-muted-foreground mt-1">
            Analyze imported datasets for bias before merging into training pool
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAuditSelected}
            disabled={!selectedDatasetId || initiateAuditLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initiateAuditLoading ? 'Auditing...' : 'Audit Selected'}
          </button>
          <button
            onClick={handleAuditAllPending}
            disabled={initiateAuditLoading || !datasets?.items.some((d) => d.quarantineStatus === 'pending_review')}
            className="rounded-md bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Audit All Pending
          </button>
        </div>
      </div>

      {/* Summary */}
      <SummaryCard summary={summary} isLoading={summaryLoading} />

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dataset List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Datasets</CardTitle>
            <div className="mt-2">
              <select
                value={statusFilter ?? 'all'}
                onChange={(e) => setStatusFilter(e.target.value === 'all' ? undefined : (e.target.value as QuarantineStatus))}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </CardHeader>
          <CardContent>
            <DatasetList
              datasets={datasets}
              selectedId={selectedDatasetId}
              onSelect={selectDataset}
              isLoading={datasetsLoading}
            />
            {datasets && datasets.totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm bg-gray-700 rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm">
                  {page} / {datasets.totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(datasets.totalPages, page + 1))}
                  disabled={page === datasets.totalPages}
                  className="px-3 py-1 text-sm bg-gray-700 rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Details */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Audit Details</CardTitle>
            {selectedDataset && (
              <CardDescription>
                <StatusBadge status={selectedDataset.quarantineStatus} />
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <AuditDetailPanel
              audit={selectedAudit}
              dataset={selectedDataset}
              isLoading={selectedDatasetLoading || selectedAuditLoading}
              onAction={processQuarantineAction}
              actionLoading={quarantineActionLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Audit Progress Overlay */}
      {auditProgress.size > 0 && (
        <div className="fixed bottom-4 right-4 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-lg p-4 space-y-3">
          <h4 className="font-medium">Audit Progress</h4>
          {Array.from(auditProgress.entries()).map(([datasetId, progress]) => (
            <div key={datasetId} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="truncate">{datasetId}</span>
                <span>{progress.progress}%</span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">{progress.currentStep}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default BiasAuditDashboard

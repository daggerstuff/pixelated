/**
 * BiasAuditDashboard Component
 *
 * Main dashboard for the Dataset Bias Audit & Quarantine feature.
 * Provides an overview of dataset bias audits, quarantine workflow management,
 * and detailed bias analysis visualization including histograms.
 */

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card/card'
import type {
  QuarantineStatus,
  DatasetForAudit,
  DatasetAuditResult,
  AuditSummary,
  PaginatedDatasetsForAudit,
} from '@/lib/api/journal-research/bias-audit-types'
import { useBiasAuditDashboard } from '@/lib/hooks/use-bias-audit'
import { cn } from '@/lib/utils'

export interface BiasAuditDashboardProps {
  className?: string
}

// Status badge component
function StatusBadge({ status }: { status: QuarantineStatus }) {
  const statusConfig: Record<
    QuarantineStatus,
    { label: string; className: string }
  > = {
    pending_review: {
      label: 'Pending Review',
      className: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    },
    under_audit: {
      label: 'Under Audit',
      className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    },
    approved: {
      label: 'Approved',
      className: 'bg-green-500/20 text-green-400 border-green-500/30',
    },
    quarantined: {
      label: 'Quarantined',
      className: 'bg-red-500/20 text-red-400 border-red-500/30',
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    },
  }

  const config = statusConfig[status]
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}

/** Summary card showing audit statistics */
function SummaryCard({
  summary,
  isLoading,
}: {
  summary: AuditSummary | undefined
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="bg-muted h-4 w-20 animate-pulse rounded" />
                <div className="bg-muted h-8 w-16 animate-pulse rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  const stats = [
    { label: 'Total Datasets', value: summary?.totalDatasets ?? 0 },
    { label: 'Pending Review', value: summary?.pendingReview ?? 0 },
    { label: 'Under Audit', value: summary?.underAudit ?? 0 },
    { label: 'Approved', value: summary?.approved ?? 0 },
    { label: 'Quarantined', value: summary?.quarantined ?? 0 },
    {
      label: 'Avg Bias Score',
      value: summary?.averageBiasScore?.toFixed(3) ?? '—',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Summary</CardTitle>
        {summary?.lastAuditDate && (
          <CardDescription>
            Last audit: {new Date(summary.lastAuditDate).toLocaleDateString()}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {stats.map((stat) => (
            <div key={stat.label} className="space-y-1">
              <p className="text-muted-foreground text-xs font-medium">
                {stat.label}
              </p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/** Dataset list panel */
function DatasetList({
  datasets,
  selectedId,
  onSelect,
  isLoading,
}: {
  datasets: PaginatedDatasetsForAudit | undefined
  selectedId: string | null
  onSelect: (id: string) => void
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-muted h-12 animate-pulse rounded" />
        ))}
      </div>
    )
  }

  if (!datasets || datasets.items.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        No datasets found
      </p>
    )
  }

  return (
    <div className="space-y-1">
      {datasets.items.map((dataset) => (
        <button
          key={dataset['datasetId']}
          onClick={() => onSelect(dataset['datasetId'])}
          className={cn(
            'flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors',
            selectedId === dataset['datasetId']
              ? 'bg-primary/10 border-primary/30 border'
              : 'hover:bg-muted border border-transparent',
          )}
        >
          <div className="min-w-0 flex-1 truncate">
            <p className="truncate font-medium">{dataset['name']}</p>
            <p className="text-muted-foreground text-xs">
              {dataset['recordCount'].toLocaleString()} records ·{' '}
              {dataset['format']}
            </p>
          </div>
          <StatusBadge status={dataset['quarantineStatus']} />
        </button>
      ))}
    </div>
  )
}

/** Audit detail panel */
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
  onAction: (action: string, reason?: string) => Promise<unknown>
  actionLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
        <div className="bg-muted h-24 animate-pulse rounded" />
        <div className="bg-muted h-24 animate-pulse rounded" />
      </div>
    )
  }

  if (!dataset) {
    return (
      <p className="text-muted-foreground py-8 text-center text-sm">
        Select a dataset to view audit details
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Dataset info */}
      <div>
        <h3 className="text-lg font-semibold">{dataset['name']}</h3>
        <div className="text-muted-foreground mt-1 grid grid-cols-2 gap-2 text-sm">
          <div>
            Format: <span className="font-medium">{dataset['format']}</span>
          </div>
          <div>
            Records:{' '}
            <span className="font-medium">
              {dataset['recordCount'].toLocaleString()}
            </span>
          </div>
          <div>
            Size:{' '}
            <span className="font-medium">
              {(dataset['fileSize'] / 1024 / 1024).toFixed(1)} MB
            </span>
          </div>
          <div>
            Uploaded:{' '}
            <span className="font-medium">
              {new Date(dataset['uploadedAt']).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Audit results */}
      {audit ? (
        <>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Bias Score</span>
              <span
                className={cn(
                  'text-lg font-bold',
                  audit.overallBiasScore < 0.3
                    ? 'text-green-500'
                    : audit.overallBiasScore < 0.6
                      ? 'text-yellow-500'
                      : 'text-red-500',
                )}
              >
                {(audit.overallBiasScore * 100).toFixed(1)}%
              </span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full">
              <div
                className={cn(
                  'h-full transition-all',
                  audit.overallBiasScore < 0.3
                    ? 'bg-green-500'
                    : audit.overallBiasScore < 0.6
                      ? 'bg-yellow-500'
                      : 'bg-red-500',
                )}
                style={{ width: `${audit.overallBiasScore * 100}%` }}
              />
            </div>
          </div>

          {/* Metrics */}
          {audit.metrics.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Bias Metrics</h4>
              {audit.metrics.map((metric) => (
                <div
                  key={metric.metricName}
                  className={cn(
                    'flex items-center justify-between rounded-md px-3 py-2 text-sm',
                    metric.passed
                      ? 'bg-green-500/10 text-green-400'
                      : 'bg-red-500/10 text-red-400',
                  )}
                >
                  <span>{metric.metricName}</span>
                  <span className="font-medium">
                    {(metric.score * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Recommendations */}
          {audit.recommendations.length > 0 && (
            <div className="space-y-1">
              <h4 className="text-sm font-medium">Recommendations</h4>
              <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                {audit.recommendations.map((rec, i) => (
                  <li key={i}>{rec}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          {dataset['quarantineStatus'] !== 'approved' &&
            dataset['quarantineStatus'] !== 'rejected' && (
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={() => onAction('approve')}
                  disabled={actionLoading}
                  className="bg-green-600 hover:bg-green-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {actionLoading ? 'Processing...' : 'Approve'}
                </button>
                <button
                  onClick={() => onAction('quarantine')}
                  disabled={actionLoading}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Quarantine
                </button>
                <button
                  onClick={() => onAction('reject')}
                  disabled={actionLoading}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            )}
        </>
      ) : (
        <p className="text-muted-foreground py-4 text-center text-sm">
          No audit results available for this dataset
        </p>
      )}
    </div>
  )
}

const BiasAuditDashboard: React.FC<BiasAuditDashboardProps> = ({
  className,
}: BiasAuditDashboardProps) => {
  const {
    selectedDatasetId,
    selectDataset,
    summary,
    summaryLoading,
    datasets,
    datasetsLoading,
    selectedDataset,
    selectedDatasetLoading,
    selectedAudit,
    selectedAuditLoading,
    auditProgress,
    initiateAudit,
    initiateAuditLoading,
    processQuarantineAction,
    quarantineActionLoading,
    setStatusFilter,
    setPage,
    statusFilter,
    page,
  } = useBiasAuditDashboard()

  const statusOptions: { value: string; label: string }[] = [
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
    const pendingDatasets =
      datasets?.items.filter((d) => d.quarantineStatus === 'pending_review') ??
      []
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
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            {initiateAuditLoading ? 'Auditing...' : 'Audit Selected'}
          </button>
          <button
            onClick={handleAuditAllPending}
            disabled={
              initiateAuditLoading ||
              !datasets?.items.some(
                (d) => d.quarantineStatus === 'pending_review',
              )
            }
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90 rounded-md px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
          >
            Audit All Pending
          </button>
        </div>
      </div>

      {/* Summary */}
      <SummaryCard summary={summary} isLoading={summaryLoading} />

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Dataset List */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Datasets</CardTitle>
            <div className="mt-2">
              <select
                value={statusFilter ?? 'all'}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value === 'all'
                      ? undefined
                      : (e.target.value as QuarantineStatus),
                  )
                }
                className="bg-gray-800 border-gray-700 w-full rounded-md border px-3 py-2 text-sm"
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
              <div className="mt-4 flex justify-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="bg-gray-700 rounded px-3 py-1 text-sm disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-3 py-1 text-sm">
                  {page} / {datasets.totalPages}
                </span>
                <button
                  onClick={() =>
                    setPage(Math.min(datasets.totalPages, page + 1))
                  }
                  disabled={page === datasets.totalPages}
                  className="bg-gray-700 rounded px-3 py-1 text-sm disabled:opacity-50"
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
              onAction={
                processQuarantineAction as (
                  action: string,
                  reason?: string,
                ) => Promise<unknown>
              }
              actionLoading={quarantineActionLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Audit Progress Overlay */}
      {auditProgress.size > 0 && (
        <div className="bg-gray-800 border-gray-700 fixed bottom-4 right-4 w-80 space-y-3 rounded-lg border p-4 shadow-lg">
          <h4 className="font-medium">Audit Progress</h4>
          {Array.from(auditProgress.entries()).map(([datasetId, progress]) => (
            <div key={datasetId} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="truncate">{datasetId}</span>
                <span>{progress.progress}%</span>
              </div>
              <div className="bg-gray-700 h-2 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-full transition-all"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                {progress.currentStep}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default BiasAuditDashboard

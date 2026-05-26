/**
 * BiasAuditDashboard Component
 *
 * Main dashboard for the Dataset Bias Audit & Quarantine feature.
 * Provides an overview of dataset bias audits, quarantine workflow management,
 * and detailed bias analysis visualization including histograms.
 */

import { format } from 'date-fns'
import { useState } from 'react'

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
  BiasScoreDistribution,
  DemographicBiasBreakdown,
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

// Bias score indicator
function BiasScoreIndicator({
  score,
  size = 'md',
}: {
  score: number
  size?: 'sm' | 'md' | 'lg'
}) {
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
function BiasHistogram({
  distribution,
  height = 120,
}: {
  distribution: BiasScoreDistribution[]
  height?: number
}) {
  const maxCount = Math.max(...distribution.map((d) => d.count), 1)

  return (
    <div className="w-full">
      <div className="flex items-end justify-between gap-1" style={{ height }}>
        {distribution.map((bucket, index) => {
          const barHeight = (bucket.count / maxCount) * 100
          return (
            <div
              key={index}
              className="bg-primary/80 hover:bg-primary flex-1 rounded-t transition-colors"
              style={{ height: `${barHeight}%` }}
              title={`${bucket.label}: ${bucket.count} records`}
            />
          )
        })}
      </div>
    </div>
  )
}

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
              onAction={processQuarantineAction}
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

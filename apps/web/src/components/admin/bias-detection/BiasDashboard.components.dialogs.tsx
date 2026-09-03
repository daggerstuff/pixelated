/**
 * BiasDashboard.components.dialogs.tsx — presentational components extracted from
 * BiasDashboard.components.tsx. Pure components; no state, no effects, no API calls.
 */

import React from 'react'
import {
  Download,
  X,
} from 'lucide-react'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Progress, TabsContent } from '@/components/ui'
import {
  type BiasAnalysisItem,
  type DashboardRecommendation,
} from './BiasDashboard.types'
import {
  getBiasScoreColor,
  type DateRange,
} from './BiasDashboard.helpers'

// 6. ExportDialog
// ---------------------------------------------------------------------------

export interface ExportDialogProps {
  showExportDialog: boolean
  exportFormat: string
  setExportFormat: (format: string) => void
  exportDateRange: DateRange
  setExportDateRange: (range: DateRange) => void
  exportDataTypes: Record<string, boolean>
  setExportDataTypes: (types: Record<string, boolean>) => void
  exportFilters: {
    applyCurrentFilters: boolean
    includeArchived: boolean
    minBiasScore: number
    maxBiasScore: number
  }
  setExportFilters: (filters: ExportDialogProps['exportFilters']) => void
  exportProgress: { isExporting: boolean; progress: number; status: string }
  isExportFormat: (value: unknown) => value is 'json' | 'csv' | 'pdf'
  onExport: () => void
  onClose: () => void
}

export const ExportDialog: React.FC<ExportDialogProps> = ({
  showExportDialog,
  exportFormat,
  setExportFormat,
  exportDateRange,
  setExportDateRange,
  exportDataTypes,
  setExportDataTypes,
  exportFilters,
  setExportFilters,
  exportProgress,
  isExportFormat,
  onExport,
  onClose,
}) => {
  if (!showExportDialog) return null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Download className="mr-2 h-5 w-5" />
            Export Dashboard Data
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={exportProgress.isExporting}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Export Format */}
        <div>
          <h4 className="mb-2 font-semibold">Export Format</h4>
          <div className="flex space-x-4">
            {(['json', 'csv', 'pdf'] as const).map((fmt) => (
              <label key={fmt} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="exportFormat"
                  value={fmt}
                  checked={exportFormat === fmt}
                  onChange={(e) => {
                    if (isExportFormat(e.target.value)) {
                      setExportFormat(e.target.value)
                    }
                  }}
                />
                <span className="text-sm uppercase">{fmt}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <h4 className="mb-2 font-semibold">Date Range</h4>
          <div className="flex space-x-4">
            <div>
              <label className="text-sm">Start Date</label>
              <input
                type="date"
                value={exportDateRange.start}
                onChange={(e) =>
                  setExportDateRange({ ...exportDateRange, start: e.target.value })
                }
                className="block rounded border p-1"
              />
            </div>
            <div>
              <label className="text-sm">End Date</label>
              <input
                type="date"
                value={exportDateRange.end}
                onChange={(e) =>
                  setExportDateRange({ ...exportDateRange, end: e.target.value })
                }
                className="block rounded border p-1"
              />
            </div>
          </div>
        </div>

        {/* Data Types */}
        <div>
          <h4 className="mb-2 font-semibold">Data Types to Export</h4>
          <div className="grid grid-cols-2 gap-2">
            {['summary', 'alerts', 'trends', 'demographics', 'sessions', 'recommendations'].map(
              (type) => (
                <label key={type} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={exportDataTypes[type] ?? false}
                    onChange={(e) =>
                      setExportDataTypes({
                        ...exportDataTypes,
                        [type]: e.target.checked,
                      })
                    }
                  />
                  <span className="text-sm capitalize">{type}</span>
                </label>
              ),
            )}
          </div>
        </div>

        {/* Export Filters */}
        <div>
          <h4 className="mb-2 font-semibold">Export Options</h4>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={exportFilters.applyCurrentFilters}
                onChange={(e) =>
                  setExportFilters({ ...exportFilters, applyCurrentFilters: e.target.checked })
                }
              />
              <span className="text-sm">Apply current dashboard filters</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={exportFilters.includeArchived}
                onChange={(e) =>
                  setExportFilters({ ...exportFilters, includeArchived: e.target.checked })
                }
              />
              <span className="text-sm">Include archived data</span>
            </label>
            <div className="flex space-x-4">
              <div>
                <label className="text-sm">Min Bias Score</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={exportFilters.minBiasScore}
                  onChange={(e) =>
                    setExportFilters({
                      ...exportFilters,
                      minBiasScore: Number(e.target.value),
                    })
                  }
                  className="block w-20 rounded border p-1"
                />
              </div>
              <div>
                <label className="text-sm">Max Bias Score</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={exportFilters.maxBiasScore}
                  onChange={(e) =>
                    setExportFilters({
                      ...exportFilters,
                      maxBiasScore: Number(e.target.value),
                    })
                  }
                  className="block w-20 rounded border p-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Progress */}
        {exportProgress.isExporting && (
          <div>
            <Progress value={exportProgress.progress} className="w-full" />
            <p className="text-muted-foreground mt-1 text-sm">{exportProgress.status}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={exportProgress.isExporting}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onExport}
            disabled={
              exportProgress.isExporting ||
              !Object.values(exportDataTypes).some((v) => v)
            }
          >
            <Download className="mr-1 h-4 w-4" />
            Export as {exportFormat.toUpperCase()}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// 13. SessionsTab
// ---------------------------------------------------------------------------

export interface SessionsTabProps {
  filteredSessions: BiasAnalysisItem[]
  recentAnalyses: BiasAnalysisItem[]
  onSetBiasScoreFilter: (value: string) => void
  onSetSelectedTimeRange: (value: string) => void
}

export const SessionsTab: React.FC<SessionsTabProps> = ({
  filteredSessions,
  recentAnalyses,
  onSetBiasScoreFilter,
  onSetSelectedTimeRange,
}) => {
  return (
    <TabsContent value="sessions" className="space-y-4">
      {filteredSessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              {recentAnalyses.length === 0 ? 'No recent sessions' : 'No sessions match current filters'}
            </p>
            {recentAnalyses.length > 0 && filteredSessions.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  onSetBiasScoreFilter('all')
                  onSetSelectedTimeRange('24h')
                }}
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        filteredSessions.map((analysis: BiasAnalysisItem) => (
          <Card key={analysis['sessionId']}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold">Session {analysis['sessionId']}</h4>
                  <div className="mt-2 flex items-center space-x-4">
                    <span
                      className={`text-sm font-medium ${getBiasScoreColor(analysis.overallBiasScore)}`}
                    >
                      Bias Score: {(analysis.overallBiasScore * 100).toFixed(1)}%
                    </span>
                    <Badge
                      variant={analysis.alertLevel === 'low' ? 'secondary' : 'destructive'}
                    >
                      {analysis.alertLevel}
                    </Badge>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground text-sm">
                    {analysis.timestamp
                      ? new Date(analysis.timestamp).toLocaleString()
                      : 'Unknown time'}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    aria-label={`View details for session ${analysis['sessionId']}`}
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </TabsContent>
  )
}

// ---------------------------------------------------------------------------
// 14. RecommendationsTab
// ---------------------------------------------------------------------------

export interface RecommendationsTabProps {
  recommendations: DashboardRecommendation[]
}

export const RecommendationsTab: React.FC<RecommendationsTabProps> = ({ recommendations }) => {
  return (
    <TabsContent value="recommendations" className="space-y-4">
      {recommendations?.length > 0 ? (
        recommendations.map((rec: DashboardRecommendation) => (
          <Card key={rec.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex items-center space-x-2">
                    <Badge
                      variant={rec.priority === 'critical' ? 'destructive' : 'secondary'}
                    >
                      {rec.priority}
                    </Badge>
                    <h4 className="font-semibold">{rec.title}</h4>
                  </div>
                  <p className="text-muted-foreground mb-3 text-sm">{rec.description}</p>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label={`View details for recommendation: ${rec.title}`}
                    >
                      View Details
                    </Button>
                    <Button
                      size="sm"
                      aria-label={`Implement recommendation: ${rec.title}`}
                    >
                      Implement
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No recommendations available</p>
          </CardContent>
        </Card>
      )}
    </TabsContent>
  )
}

// ---------------------------------------------------------------------------

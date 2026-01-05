import { useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card/card'
import {
  useGenerateReportMutation,
  useReportListQuery,
} from '@/lib/hooks/journal-research'
import { cn } from '@/lib/utils'

import { Download, FileText } from 'lucide-react'

export interface ReportGeneratorProps {
  sessionId: string | null
  className?: string
}

export function ReportGenerator({ sessionId, className }: ReportGeneratorProps) {
  const [reportType, setReportType] = useState<'session_report' | 'weekly_report' | 'summary_report'>('session_report')
  const [outputFormat, setOutputFormat] = useState<'json' | 'markdown' | 'pdf'>('json')
  const [dateRange, setDateRange] = useState<{
    startDate?: string
    endDate?: string
  }>({})
  const generateMutation = useGenerateReportMutation(sessionId)
  const { data: reports, isLoading } = useReportListQuery(sessionId, {
    page: 1,
    pageSize: 10,
  })

  if (!sessionId) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-muted-foreground">
          Please select a session to generate reports
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Report Generator</h1>
        <p className="text-muted-foreground mt-1">
          Generate comprehensive reports for your research sessions
        </p>
      </div>

      {/* Report Generation Form */}
      <Card>
        <CardHeader>
          <CardTitle>Generate Report</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Report Type
              </label>
              <select
                value={reportType}
                onChange={(e) =>
                  setReportType(
                    e.target.value as
                    | 'session_report'
                    | 'weekly_report'
                    | 'summary_report',
                  )
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="session_report">Session Report</option>
                <option value="weekly_report">Weekly Report</option>
                <option value="summary_report">Summary Report</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">Format</label>
              <select
                value={outputFormat}
                onChange={(e) =>
                  setOutputFormat(e.target.value as 'json' | 'markdown' | 'pdf')
                }
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="json">JSON</option>
                <option value="markdown">Markdown</option>
                <option value="pdf">PDF</option>
              </select>
            </div>

            {(reportType === 'weekly_report' ||
              reportType === 'summary_report') && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={dateRange.startDate ?? ''}
                      onChange={(e) =>
                        setDateRange({
                          ...dateRange,
                          startDate: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={dateRange.endDate ?? ''}
                      onChange={(e) =>
                        setDateRange({
                          ...dateRange,
                          endDate: e.target.value,
                        })
                      }
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              )}

            <button
              onClick={() => {
                generateMutation.mutate({
                  reportType,
                  format: outputFormat,
                  dateRange:
                    dateRange.startDate || dateRange.endDate
                      ? {
                        startDate: dateRange.startDate
                          ? new Date(dateRange.startDate)
                          : undefined,
                        endDate: dateRange.endDate
                          ? new Date(dateRange.endDate)
                          : undefined,
                      }
                      : undefined,
                })
              }}
              disabled={generateMutation.isPending}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {generateMutation.isPending ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading reports...
            </div>
          ) : reports?.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reports generated yet. Generate your first report above.
            </div>
          ) : (
            <div className="space-y-3">
              {reports?.items.map((report) => (
                <div
                  key={report.reportId}
                  className="flex items-center justify-between rounded-md border p-4"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{report.reportId}</p>
                      <p className="text-sm text-muted-foreground">
                        {report.reportType.replace('_', ' ')} • {report.format.toUpperCase()} •{' '}
                        {format(new Date(report.generatedDate), 'PPpp')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {report.filePath && (
                      <a
                        href={report.filePath}
                        download
                        className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
                      >
                        <Download className="h-4 w-4" />
                        Download
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


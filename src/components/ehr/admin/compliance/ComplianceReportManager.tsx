import {
  Download,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
} from 'lucide-react'
import { useCallback, useState } from 'react'

import type {
  ComplianceReport,
  ExportFormat,
  FindingSeverity,
  FindingStatus,
  ReportType,
} from '../../../../lib/ehr-native/audit/reports'

const API_BASE = '/api/ehr/compliance/reports'

const REPORT_TYPES: { value: ReportType; label: string }[] = [
  { value: 'hipaa-audit', label: 'HIPAA Audit' },
  { value: 'soc2-security', label: 'SOC 2 Security' },
  { value: 'soc2-availability', label: 'SOC 2 Availability' },
  { value: 'consent-compliance', label: 'Consent Compliance' },
  { value: 'access-review', label: 'Access Review' },
]

const SEVERITY_BADGE: Record<FindingSeverity, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-blue-100 text-blue-700',
  info: 'bg-gray-100 text-gray-700',
}

const STATUS_BADGE: Record<FindingStatus, string> = {
  pass: 'bg-green-100 text-green-700',
  fail: 'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
  'not-applicable': 'bg-gray-100 text-gray-700',
}

const EXPORT_FORMATS: ExportFormat[] = ['csv', 'json', 'pdf']

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

export function ComplianceReportManager() {
  const [reportType, setReportType] = useState<ReportType>('hipaa-audit')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [report, setReport] = useState<ComplianceReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  const handleGenerate = useCallback(async () => {
    if (!periodStart || !periodEnd) {
      setError('Please select both start and end dates')
      return
    }
    if (periodStart > periodEnd) {
      setError('Start date must be before end date')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reportType,
          periodStart,
          periodEnd,
        }),
      })
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(
          `Failed to generate report (${res.status})${body ? `: ${body}` : ''}`,
        )
      }
      const data = (await res.json()) as ComplianceReport
      setReport(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to generate report',
      )
    } finally {
      setLoading(false)
    }
  }, [reportType, periodStart, periodEnd])

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      if (!report) return
      setExporting(format)
      try {
        const res = await fetch(
          `${API_BASE}/${report.id}/export?format=${format}`,
        )
        if (!res.ok) {
          throw new Error(`Failed to export report (${res.status})`)
        }
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `compliance-report-${report.id}.${format}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to export report',
        )
      } finally {
        setExporting(null)
      }
    },
    [report],
  )

  const summary = report?.summary

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Compliance Report Manager</h2>
        <p className="text-sm text-muted-foreground">
          Generate, view, and export compliance reports for audit and
          regulatory requirements.
        </p>
      </div>

      {/* Report Configuration */}
      <div className="border rounded-lg p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor="report-type"
              className="text-xs font-medium block mb-1"
            >
              Report Type
            </label>
            <select
              id="report-type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full px-2 py-1.5 border rounded-md text-sm"
              aria-label="Select report type"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="period-start"
              className="text-xs font-medium block mb-1"
            >
              Period Start
            </label>
            <input
              id="period-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="w-full px-2 py-1.5 border rounded-md text-sm"
              aria-label="Report period start date"
            />
          </div>
          <div>
            <label
              htmlFor="period-end"
              className="text-xs font-medium block mb-1"
            >
              Period End
            </label>
            <input
              id="period-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="w-full px-2 py-1.5 border rounded-md text-sm"
              aria-label="Report period end date"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Generate compliance report"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FileText className="h-3.5 w-3.5" />
            )}
            Generate Report
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && !report && (
        <div className="border rounded-lg p-4">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Generating compliance report...
            </span>
          </div>
        </div>
      )}

      {/* Report Results */}
      {report && summary && !loading && (
        <div className="space-y-4">
          {/* Report Meta */}
          <div className="border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold">{report.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Report ID: <span className="font-mono">{report.id}</span>
                  {' | '}
                  Generated: {formatDate(report.generatedAt)}
                  {' | '}
                  By: <span className="font-mono">{report.generatedBy}</span>
                  {' | '}
                  Period: {formatDate(report.periodStart)} -{' '}
                  {formatDate(report.periodEnd)}
                </p>
              </div>
              {report.chainVerification && (
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    report.chainVerification.valid
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {report.chainVerification.valid
                    ? 'Chain Verified'
                    : 'Chain Broken'}
                </span>
              )}
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-muted-foreground">
                  Compliance Score
                </span>
              </div>
              <p className="text-2xl font-bold">
                {summary.complianceScore}%
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-muted-foreground">
                  Passed
                </span>
              </div>
              <p className="text-2xl font-bold text-green-700">
                {summary.passed}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-4 w-4 text-red-600" />
                <span className="text-xs font-medium text-muted-foreground">
                  Failed
                </span>
              </div>
              <p className="text-2xl font-bold text-red-700">
                {summary.failed}
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-xs font-medium text-muted-foreground">
                  Warnings
                </span>
              </div>
              <p className="text-2xl font-bold text-yellow-700">
                {summary.warnings}
              </p>
            </div>
          </div>

          {/* Findings Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="border-b px-4 py-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Findings ({summary.totalFindings})
              </h3>
              {/* Export Buttons */}
              <div className="flex gap-1">
                {EXPORT_FORMATS.map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => void handleExport(fmt)}
                    disabled={exporting !== null}
                    className="inline-flex items-center gap-1 px-2.5 py-1 border rounded-md text-xs font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={`Export report as ${fmt.toUpperCase()}`}
                  >
                    {exporting === fmt ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm" role="table">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium">ID</th>
                    <th className="text-left py-2 px-3 font-medium">Title</th>
                    <th className="text-left py-2 px-3 font-medium">Control</th>
                    <th className="text-left py-2 px-3 font-medium">
                      Severity
                    </th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.findings.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 text-center text-muted-foreground"
                      >
                        No findings in this report
                      </td>
                    </tr>
                  )}
                  {report.findings.map((finding) => (
                    <tr
                      key={finding.id}
                      className="border-b hover:bg-gray-50"
                    >
                      <td className="py-1.5 px-3 font-mono text-xs">
                        {finding.id}
                      </td>
                      <td className="py-1.5 px-3 text-xs font-medium">
                        {finding.title}
                      </td>
                      <td className="py-1.5 px-3 font-mono text-xs">
                        {finding.controlId}
                      </td>
                      <td className="py-1.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            SEVERITY_BADGE[finding.severity]
                          }`}
                        >
                          {finding.severity}
                        </span>
                      </td>
                      <td className="py-1.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            STATUS_BADGE[finding.status]
                          }`}
                        >
                          {finding.status}
                        </span>
                      </td>
                      <td className="py-1.5 px-3 text-xs text-muted-foreground max-w-md">
                        {finding.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!report && !loading && !error && (
        <div className="border rounded-lg p-4 text-center py-8">
          <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Select a report type and date range, then click Generate Report.
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * CSV and JSON export utilities for compliance reports.
 */

import type { ComplianceReport, ExportFormat, ExportResult } from './types'

/** Escape a CSV field value. */
function escapeCsvField(value: unknown): string {
  const str = typeof value === 'string' ? value : String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Export a compliance report as CSV (findings table). */
export function exportCsv(report: ComplianceReport): ExportResult {
  const header = ['Finding ID', 'Title', 'Control ID', 'Severity', 'Status', 'Description', 'Evidence', 'Remediation']
  const rows: string[] = [header.join(',')]

  for (const finding of report.findings) {
    rows.push([
      escapeCsvField(finding.id),
      escapeCsvField(finding.title),
      escapeCsvField(finding.controlId),
      escapeCsvField(finding.severity),
      escapeCsvField(finding.status),
      escapeCsvField(finding.description),
      escapeCsvField(finding.evidence.join('; ')),
      escapeCsvField(finding.remediation ?? ''),
    ].join(','))
  }

  // Summary section
  rows.push('')
  rows.push('Summary')
  rows.push(`Total Findings,${report.summary.totalFindings}`)
  rows.push(`Passed,${report.summary.passed}`)
  rows.push(`Failed,${report.summary.failed}`)
  rows.push(`Warnings,${report.summary.warnings}`)
  rows.push(`Not Applicable,${report.summary.notApplicable}`)
  rows.push(`Compliance Score,${report.summary.complianceScore}%`)

  return {
    format: 'csv',
    content: rows.join('\n'),
    mimeType: 'text/csv',
    filename: `${report.type}-${report.periodStart}-to-${report.periodEnd}.csv`,
  }
}

/** Export a compliance report as JSON. */
export function exportJson(report: ComplianceReport): ExportResult {
  return {
    format: 'json',
    content: JSON.stringify(report, null, 2),
    mimeType: 'application/json',
    filename: `${report.type}-${report.periodStart}-to-${report.periodEnd}.json`,
  }
}

/** Export a compliance report in the specified format. */
export function exportReport(report: ComplianceReport, format: ExportFormat): ExportResult {
  switch (format) {
    case 'csv':
      return exportCsv(report)
    case 'json':
      return exportJson(report)
    case 'pdf':
      // PDF export would use a PDF library (jsPDF, puppeteer, etc.)
      // For now, we generate an HTML representation that can be printed to PDF
      return {
        format: 'pdf',
        content: generatePdfHtml(report),
        mimeType: 'text/html',
        filename: `${report.type}-${report.periodStart}-to-${report.periodEnd}.html`,
      }
    default:
      throw new Error(`Unsupported export format: ${String(format)}`)
  }
}

/** Generate an HTML representation suitable for PDF printing. */
function generatePdfHtml(report: ComplianceReport): string {
  const findingsRows = report.findings
    .map(
      (f) => `
    <tr>
      <td>${f.id}</td>
      <td>${f.title}</td>
      <td>${f.controlId}</td>
      <td class="severity-${f.severity}">${f.severity.toUpperCase()}</td>
      <td class="status-${f.status}">${f.status.toUpperCase()}</td>
      <td>${f.description}</td>
    </tr>`,
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${report.title}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 2rem; color: #1a1a1a; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    .meta { color: #666; font-size: 0.875rem; margin-bottom: 2rem; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
    .summary-card { padding: 1rem; border: 1px solid #e0e0e0; border-radius: 0.5rem; }
    .summary-card .value { font-size: 1.5rem; font-weight: 700; }
    .summary-card .label { font-size: 0.75rem; color: #666; text-transform: uppercase; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 0.5rem; text-align: left; border-bottom: 1px solid #e0e0e0; font-size: 0.875rem; }
    th { background: #f5f5f5; font-weight: 600; }
    .severity-critical { color: #dc2626; font-weight: 700; }
    .severity-high { color: #ea580c; font-weight: 600; }
    .severity-medium { color: #ca8a04; }
    .severity-low { color: #2563eb; }
    .severity-info { color: #666; }
    .status-pass { color: #16a34a; font-weight: 600; }
    .status-fail { color: #dc2626; font-weight: 700; }
    .status-warning { color: #ca8a04; }
    .status-not-applicable { color: #999; }
  </style>
</head>
<body>
  <h1>${report.title}</h1>
  <div class="meta">
    <p><strong>Report ID:</strong> ${report.id}</p>
    <p><strong>Period:</strong> ${report.periodStart} to ${report.periodEnd}</p>
    <p><strong>Generated:</strong> ${report.generatedAt} by ${report.generatedBy}</p>
    <p><strong>Organization:</strong> ${report.organization}</p>
  </div>
  <div class="summary-grid">
    <div class="summary-card">
      <div class="value">${report.summary.complianceScore}%</div>
      <div class="label">Compliance Score</div>
    </div>
    <div class="summary-card">
      <div class="value">${report.summary.passed}/${report.summary.totalFindings}</div>
      <div class="label">Findings Passed</div>
    </div>
    <div class="summary-card">
      <div class="value">${report.summary.failed}</div>
      <div class="label">Failed Findings</div>
    </div>
  </div>
  <table>
    <thead>
      <tr><th>ID</th><th>Title</th><th>Control</th><th>Severity</th><th>Status</th><th>Description</th></tr>
    </thead>
    <tbody>${findingsRows}</tbody>
  </table>
</body>
</html>`
}

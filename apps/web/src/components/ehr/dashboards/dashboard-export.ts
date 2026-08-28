/**
 * Export utilities for EHR customizable dashboards.
 *
 * CSV export is fully client-side (hand-rolled, matching the pattern in
 * `dataPortabilityService.ts`).  PDF export delegates to a server-side
 * endpoint that uses `pdfkit` (see `apps/web/src/lib/export/index.node.ts`)
 * because `pdfkit` is a Node-only dependency.
 *
 * @module dashboard-export
 */

import type { DashboardType } from './types'

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface DashboardExportData {
  dashboard: DashboardType
  title: string
  generatedAt: string
  filters: Record<string, string>
  sections: ExportSection[]
}

export interface ExportSection {
  name: string
  columns: ExportColumn[]
  rows: Record<string, string | number | null>[]
}

export interface ExportColumn {
  key: string
  label: string
}

/* ------------------------------------------------------------------ */
/* CSV export (client-side)                                            */
/* ------------------------------------------------------------------ */

const CSV_DELIMITER = ','
const CSV_NEWLINE = '\r\n'

function escapeCSV(value: string | number | null): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  // Quote if the value contains delimiter, quote, or newline
  if (
    s.includes(CSV_DELIMITER) ||
    s.includes('"') ||
    s.includes('\n') ||
    s.includes('\r')
  ) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Convert a {@link DashboardExportData} object to CSV text.
 *
 * Each section becomes a block preceded by its name header. Columns
 * are emitted in the order they appear in `section.columns`.
 */
export function dashboardToCSV(data: DashboardExportData): string {
  const lines: string[] = []

  lines.push(`# ${data.title}`)
  lines.push(`# Generated: ${data.generatedAt}`)
  lines.push(`# Dashboard: ${data.dashboard}`)
  for (const [key, val] of Object.entries(data.filters)) {
    lines.push(`# ${key}: ${val}`)
  }
  lines.push(CSV_NEWLINE)

  for (const section of data.sections) {
    lines.push(section.name)
    lines.push(
      section.columns.map((c) => escapeCSV(c.label)).join(CSV_DELIMITER),
    )
    for (const row of section.rows) {
      lines.push(
        section.columns
          .map((c) => escapeCSV(row[c.key] ?? null))
          .join(CSV_DELIMITER),
      )
    }
    lines.push(CSV_NEWLINE)
  }

  return lines.join(CSV_NEWLINE)
}

/**
 * Trigger a browser download of the CSV file with the given filename.
 */
export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Convenience: convert dashboard data to CSV and download immediately.
 */
export function exportDashboardCSV(
  data: DashboardExportData,
  filename?: string,
): void {
  const csv = dashboardToCSV(data)
  const name =
    filename ?? `${data.dashboard}-dashboard-${data.generatedAt.split('T')[0]}`
  downloadCSV(csv, name)
}

/* ------------------------------------------------------------------ */
/* PDF export (server-side via API)                                     */
/* ------------------------------------------------------------------ */

const PDF_API_URL = '/api/ehr/v1/analytics/export/pdf'

/**
 * Request a server-side PDF export of the dashboard data.
 *
 * Returns a Blob containing the PDF.  The caller is responsible for
 * triggering the download (e.g. via {@link downloadBlob}).
 */
export async function exportDashboardPDF(
  data: DashboardExportData,
  options?: { watermark?: string; encrypt?: boolean },
): Promise<Blob> {
  const res = await fetch(PDF_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: data.dashboard,
      filter: data.filters,
      title: data.title,
      options,
    }),
  })
  if (!res.ok) {
    throw new Error(`PDF export failed: ${res.status} ${res.statusText}`)
  }
  return res.blob()
}

/**
 * Trigger a browser download of a Blob with the given filename.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Convenience: request a PDF and immediately download it.
 */
export async function exportDashboardPDFAndDownload(
  data: DashboardExportData,
  filename?: string,
  options?: { watermark?: string; encrypt?: boolean },
): Promise<void> {
  const blob = await exportDashboardPDF(data, options)
  const name =
    filename ??
    `${data.dashboard}-dashboard-${data.generatedAt.split('T')[0]}.pdf`
  downloadBlob(blob, name)
}

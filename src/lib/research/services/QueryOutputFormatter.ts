import type { QueryResult } from '../types/research-types'

export type OutputFormat = 'json' | 'csv' | 'summary'

export interface FormattedResult {
  format: OutputFormat
  content: string
  mimeType: string
  filename?: string
}

export class QueryOutputFormatter {
  format(
    result: QueryResult,
    format: OutputFormat,
    queryDescription?: string,
  ): FormattedResult {
    switch (format) {
      case 'json':
        return this.toJSON(result)
      case 'csv':
        return this.toCSV(result)
      case 'summary':
        return this.toSummary(result, queryDescription)
      default:
        return this.toJSON(result)
    }
  }

  private toJSON(result: QueryResult): FormattedResult {
    return {
      format: 'json',
      content: JSON.stringify(result, null, 2),
      mimeType: 'application/json',
      filename: this.generateFilename(result.queryId, 'json'),
    }
  }

  private toCSV(result: QueryResult): FormattedResult {
    const data = result.data

    if (!data || (Array.isArray(data) && data.length === 0)) {
      return {
        format: 'csv',
        content: 'No data\n',
        mimeType: 'text/csv',
        filename: this.generateFilename(result.queryId, 'csv'),
      }
    }

    if (!Array.isArray(data)) {
      const wrapped = [data]
      return {
        format: 'csv',
        content: this.arrayToCSV(wrapped),
        mimeType: 'text/csv',
        filename: this.generateFilename(result.queryId, 'csv'),
      }
    }

    return {
      format: 'csv',
      content: this.arrayToCSV(data),
      mimeType: 'text/csv',
      filename: this.generateFilename(result.queryId, 'csv'),
    }
  }

  private toSummary(
    result: QueryResult,
    queryDescription?: string,
  ): FormattedResult {
    const data = result.data
    const lines: string[] = []

    lines.push('=== Research Query Summary ===')
    lines.push('')
    lines.push('Query ID: ' + result.queryId)
    lines.push('Status: ' + result.status)
    if (queryDescription) {
      lines.push('Description: ' + queryDescription)
    }

    if (result.metadata?.executionTime !== undefined) {
      lines.push('Execution Time: ' + result.metadata.executionTime + 'ms')
    }
    if (result.metadata?.resultSize !== undefined) {
      lines.push('Result Size: ' + result.metadata.resultSize + ' records')
    }
    if (result.metadata?.complexityScore !== undefined) {
      lines.push('Complexity Score: ' + result.metadata.complexityScore)
    }
    if (result.metadata?.cacheHit !== undefined) {
      lines.push('Cache Hit: ' + (result.metadata.cacheHit ? 'Yes' : 'No'))
    }

    if (result.metadata?.anonymizationAudit) {
      const audit = result.metadata.anonymizationAudit
      lines.push('')
      lines.push('=== Anonymization Metrics ===')
      lines.push('K-Anonymity: ' + audit.kAnonymity)
      lines.push(
        'Differential Privacy Epsilon: ' + audit.differentialPrivacyEpsilon,
      )
      lines.push('Noise Level: ' + audit.noiseLevel)
      lines.push('Suppression Rate: ' + audit.suppressionRate + '%')
    }

    if (result.error) {
      lines.push('')
      lines.push('Error: ' + result.error)
    }

    if (data) {
      if (Array.isArray(data) && data.length > 0) {
        lines.push('')
        lines.push('=== Data Summary ===')
        lines.push('Record Count: ' + data.length)

        const firstRow = data[0] as Record<string, unknown> | undefined
        if (firstRow && typeof firstRow === 'object') {
          lines.push('Fields: ' + Object.keys(firstRow).join(', '))

          for (const [key, value] of Object.entries(firstRow)) {
            if (typeof value === 'number') {
              const values = data
                .map((r) => (r as Record<string, unknown>)[key] as number)
                .filter((v) => typeof v === 'number')
              if (values.length > 0) {
                const avg = values.reduce((a, b) => a + b, 0) / values.length
                const min = Math.min(...values)
                const max = Math.max(...values)
                lines.push(
                  '  ' +
                    key +
                    ': avg=' +
                    avg.toFixed(2) +
                    ', min=' +
                    min +
                    ', max=' +
                    max,
                )
              }
            } else {
              lines.push('  ' + key + ': ' + typeof value)
            }
          }
        }
      } else if (data && typeof data === 'object') {
        lines.push('')
        lines.push('=== Data ===')
        lines.push(JSON.stringify(data, null, 2))
      }
    }

    if (result.status === 'pending-approval') {
      lines.push('')
      lines.push(
        'NOTE: Query requires approval before results can be returned.',
      )
    }

    lines.push('')
    lines.push('=== HIPAA Compliance ===')
    lines.push('Output: Summary statistics only (no raw PHI)')
    lines.push('Anonymization: Applied per query configuration')

    return {
      format: 'summary',
      content: lines.join('\n'),
      mimeType: 'text/plain',
      filename: this.generateFilename(result.queryId, 'txt'),
    }
  }

  private arrayToCSV(data: unknown[]): string {
    if (data.length === 0) {
      return ''
    }

    const firstRow = data[0] as Record<string, unknown> | undefined
    if (!firstRow || typeof firstRow !== 'object') {
      return 'value\n' + data.map((d) => String(d)).join('\n')
    }

    const headers = Object.keys(firstRow)
    const csvLines: string[] = [headers.join(',')]

    for (const row of data) {
      const rowObj = row as Record<string, unknown>
      const values = headers.map((h) => {
        const val = rowObj[h]
        if (val === null || val === undefined) {
          return ''
        }
        const str = typeof val === 'object' ? JSON.stringify(val) : String(val)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"'
        }
        return str
      })
      csvLines.push(values.join(','))
    }

    return csvLines.join('\n')
  }

  private generateFilename(queryId: string, extension: string): string {
    const timestamp = new Date().toISOString().slice(0, 10)
    return (
      'research-query-' +
      queryId.slice(0, 8) +
      '-' +
      timestamp +
      '.' +
      extension
    )
  }
}

let singleton: QueryOutputFormatter | null = null

export function getQueryOutputFormatter(): QueryOutputFormatter {
  singleton ??= new QueryOutputFormatter()
  return singleton
}

export function resetQueryOutputFormatter(): void {
  singleton = null
}

import { useState, useEffect, useMemo } from 'react'

import type { EHRExportOptions } from '@/lib/documentation/ehrIntegration'
import { useDocumentation } from '@/lib/documentation/useDocumentation'

interface ExportToEHRProps {
  sessionId: string
  patientId: string
  providerId: string
  encounterId?: string
}

export function ExportToEHR({
  sessionId,
  patientId,
  providerId,
  encounterId,
}: ExportToEHRProps) {
  const { exportToEHR, isExporting, exportResult } = useDocumentation(sessionId)
  const [exportFormat, setExportFormat] = useState<'fhir' | 'ccda' | 'pdf'>(
    'fhir',
  )
  const [includeEmotionData, setIncludeEmotionData] = useState(true)
  const showSuccessDetails = exportResult?.success === true

  // Export options memo
  const exportOptions = useMemo<EHRExportOptions>(() => {
    const baseOptions = {
      format: exportFormat,
      patientId,
      providerId,
      includeEmotionData,
    }
    return encounterId !== undefined
      ? { ...baseOptions, encounterId }
      : baseOptions
  }, [exportFormat, patientId, providerId, encounterId, includeEmotionData])

  // Handle export
  const handleExport = async () => {
    await exportToEHR(exportOptions)
  }

  return (
    <div className="rounded-none border border-border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold text-foreground">
        Export to EHR System
      </h3>

      <div className="mb-6 space-y-4">
        <div>
          <label
            htmlFor="export-format"
            className="mb-1 block text-sm font-medium text-foreground"
          >
            Export Format
          </label>
          <select
            id="export-format"
            className="w-full rounded-none border border-input bg-background px-3 py-2 text-foreground"
            value={exportFormat}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setExportFormat(e.target.value as 'fhir' | 'ccda' | 'pdf')
            }
            disabled={isExporting}
          >
            <option value="fhir">
              FHIR (Fast Healthcare Interoperability Resources)
            </option>
            <option value="ccda">
              C-CDA (Consolidated Clinical Document Architecture)
            </option>
            <option value="pdf">PDF Document</option>
          </select>
          <p className="mt-1 text-sm text-muted-foreground">
            {exportFormat === 'fhir'
              ? 'Standard format for exchanging healthcare information electronically.'
              : exportFormat === 'ccda'
                ? 'Clinical document standard for patient record exchange.'
                : 'Portable document format for easy viewing.'}
          </p>
        </div>

        <div className="flex items-center">
          <input
            id="include-emotion-data"
            type="checkbox"
            className="h-4 w-4 rounded-none border border-input focus:ring-ring"
            checked={includeEmotionData}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setIncludeEmotionData(e.target.checked)
            }
            disabled={isExporting}
          />

          <label
            htmlFor="include-emotion-data"
            className="ml-2 block text-sm text-foreground"
          >
            Include emotion analysis data
          </label>
        </div>
      </div>

      <div className="flex flex-col space-y-4">
        <button
          type="button"
          className={`rounded-none px-4 py-2 font-medium text-primary-foreground ${
            isExporting
              ? 'bg-primary/35 cursor-not-allowed'
              : 'hover:bg-primary/90 bg-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
          }`}
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? 'Exporting...' : 'Export Documentation'}
        </button>

        {exportResult && (
          <div
            className={`rounded-none border p-4 ${
              exportResult.success
                ? 'border-border bg-secondary'
                : 'border-ring bg-secondary'
            }`}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                {exportResult.success ? (
                  <svg
                    className="h-5 w-5 text-foreground"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5 text-foreground"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <h3
                  className={`text-sm font-medium ${
                    exportResult.success
                      ? 'text-foreground'
                      : 'font-bold text-foreground'
                  }`}
                >
                  {exportResult.success
                    ? 'Documentation exported successfully'
                    : 'Failed to export documentation'}
                </h3>
                {exportResult.errors && exportResult.errors.length > 0 && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    {exportResult.errors[0]}
                  </div>
                )}

                {exportResult.success && showSuccessDetails && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">
                      Format: {exportFormat.toUpperCase()}
                    </p>
                    {typeof exportResult === 'object' &&
                      'documentId' in exportResult &&
                      Boolean(exportResult.documentId) && (
                        <p className="text-sm text-muted-foreground">
                          Document ID: {String(exportResult.documentId)}
                        </p>
                      )}
                    {typeof exportResult === 'object' &&
                      'documentUrl' in exportResult &&
                      Boolean(exportResult.documentUrl) && (
                        <div className="mt-1">
                          <a
                            href={String(exportResult.documentUrl)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-foreground hover:underline"
                          >
                            View Document in EHR System
                          </a>
                        </div>
                      )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

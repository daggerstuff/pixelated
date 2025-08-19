import { useState, useEffect, useMemo } from 'react'
import { useDocumentation } from '@/lib/documentation/useDocumentation'
import type { EHRExportOptions } from '@/lib/documentation/ehrIntegration'

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
  const [showSuccessDetails, setShowSuccessDetails] = useState(false)

  // Reset success details when export result changes
  useEffect(() => {
    if (exportResult && exportResult.success) {
      setShowSuccessDetails(true)
    } else {
      setShowSuccessDetails(false)
    }
  }, [exportResult])

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
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Export to EHR System
      </h3>

      <div className="space-y-4 mb-6">
        <div>
          <label
            htmlFor="export-format"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Export Format
          </label>
          <select
            id="export-format"
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 py-2 px-3 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
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
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={includeEmotionData}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setIncludeEmotionData(e.target.checked)
            }
            disabled={isExporting}
          />

          <label
            htmlFor="include-emotion-data"
            className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
          >
            Include emotion analysis data
          </label>
        </div>
      </div>

      <div className="flex flex-col space-y-4">
        <button
          type="button"
          className={`py-2 px-4 rounded-md text-white font-medium ${
            isExporting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
          }`}
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? 'Exporting...' : 'Export Documentation'}
        </button>

        {exportResult && (
          <div
            className={`rounded-md p-4 ${
              exportResult.success
                ? 'bg-green-50 dark:bg-green-900/30'
                : 'bg-red-50 dark:bg-red-900/30'
            }`}
          >
            <div className="flex">
              <div className="flex-shrink-0">
                {exportResult.success ? (
                  <svg
                    className="h-5 w-5 text-green-400"
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
                    className="h-5 w-5 text-red-400"
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
                      ? 'text-green-800 dark:text-green-200'
                      : 'text-red-800 dark:text-red-200'
                  }`}
                >
                  {exportResult.success
                    ? 'Documentation exported successfully'
                    : 'Failed to export documentation'}
                </h3>
                {exportResult.error && (
                  <div className="mt-2 text-sm text-red-700 dark:text-red-300">
                    {exportResult.error}
                  </div>
                )}

                {exportResult.success && showSuccessDetails && (
                  <div className="mt-2">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Format: {exportFormat.toUpperCase()}
                    </p>
                   {typeof exportResult === 'object' &&
                     'documentId' in exportResult &&
                     exportResult.documentId && (
                       <p className="text-sm text-green-700 dark:text-green-300">
                         Document ID: {exportResult.documentId as string}
                       </p>
                     )}
                   {typeof exportResult === 'object' &&
                     'documentUrl' in exportResult &&
                     exportResult.documentUrl && (
                       <div className="mt-1">
                         <a
                           href={exportResult.documentUrl as string}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="text-sm font-medium text-green-600 dark:text-green-400 hover:underline"
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

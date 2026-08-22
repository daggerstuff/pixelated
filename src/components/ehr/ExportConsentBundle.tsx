import { useCallback, useState } from 'react'

interface ExportConsentBundleProps {
  patientId: string
}

interface FhirBundle {
  resourceType: 'Bundle'
  type: 'collection'
  entry: Array<{ resource: Record<string, unknown> }>
}

type ExportState = 'idle' | 'loading' | 'success' | 'error'

function getDateStamp(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/fhir+json',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function ExportConsentBundle({ patientId }: ExportConsentBundleProps) {
  const [exportState, setExportState] = useState<ExportState>('idle')

  const handleExport = useCallback(async () => {
    setExportState('loading')
    try {
      const consentResponse = await fetch(
        `/api/ehr/v1/consents?patient=${encodeURIComponent(patientId)}`,
      )
      if (!consentResponse.ok) {
        throw new Error(`Failed to fetch consents: ${consentResponse.status}`)
      }
      const consents = await consentResponse.json() as Array<{
        id: string
        provenanceId: string | null
        [key: string]: unknown
      }>

      const entries: Array<{ resource: Record<string, unknown> }> = []

      for (const consent of consents) {
        entries.push({ resource: consent })

        if (consent.provenanceId) {
          try {
            const provResponse = await fetch(
              `/api/ehr/v1/consents/${encodeURIComponent(consent.id)}/provenance`,
            )
            if (provResponse.ok) {
              const provenance = await provResponse.json() as Record<string, unknown>
              entries.push({ resource: provenance })
            }
          } catch {
            // Provenance fetch failure is non-fatal; consent is still exported
          }
        }
      }

      const bundle: FhirBundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: entries,
      }

      const filename = `consent-bundle-${patientId}-${getDateStamp()}.json`
      downloadJson(bundle, filename)
      setExportState('success')
    } catch {
      setExportState('error')
    }
  }, [patientId])

  const isLoading = exportState === 'loading'

  return (
    <div className="flex flex-col gap-2" data-testid="export-consent-bundle">
      <button
        type="button"
        onClick={handleExport}
        disabled={isLoading}
        aria-label="Export consent bundle as FHIR JSON"
        aria-busy={isLoading}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 min-h-[44px] w-full sm:w-auto"
      >
        {isLoading && (
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
            aria-hidden="true"
          />
        )}
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        {isLoading ? 'Exporting...' : 'Export Consent Bundle'}
      </button>

      <div role="status" aria-live="polite">
        {exportState === 'success' && (
          <p className="text-sm text-green-600" data-testid="export-success">
            Consent bundle exported successfully
          </p>
        )}
        {exportState === 'error' && (
          <p className="text-sm text-red-600" data-testid="export-error">
            Failed to export consent bundle. Please try again.
          </p>
        )}
      </div>
    </div>
  )
}

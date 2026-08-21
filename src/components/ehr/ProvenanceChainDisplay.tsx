import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  ShieldCheck,
  ShieldX,
  XCircle,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

const API_BASE = '/api/ehr/v1'

interface ProvenanceChainDisplayProps {
  patientId: string
  consentId?: string
}

interface ProvenanceEntry {
  id: string
  recorded: string
  agentWho: string
  agentOnBehalfOf: string | null
  activityType: string
  targetReference: string
  signatureData: string | null
  signatureFormat: string | null
  signatureWhen: string | null
  raw: Record<string, unknown>
}

interface VerifyResult {
  valid: boolean
  details: string
}

const ACTIVITY_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700 border-green-300',
  update: 'bg-blue-100 text-blue-700 border-blue-300',
  withdraw: 'bg-red-100 text-red-700 border-red-300',
  delete: 'bg-red-100 text-red-700 border-red-300',
  read: 'bg-gray-100 text-gray-700 border-gray-300',
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function getActivityType(entry: ProvenanceEntry): string {
  if (entry.activityType) return entry.activityType
  const raw = entry.raw
  const activity = raw['activity'] as
    | { coding?: Array<{ code?: string }> }
    | undefined
  const code = activity?.coding?.[0]?.code
  if (code) return code
  const target = entry.targetReference
  if (target.includes('Consent')) {
    return 'create'
  }
  return 'update'
}

export function ProvenanceChainDisplay({
  patientId,
  consentId,
}: ProvenanceChainDisplayProps) {
  const [entries, setEntries] = useState<ProvenanceEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null)

  const fetchProvenance = useCallback(async () => {
    setLoading(true)
    setError(null)
    setVerifyResult(null)
    try {
      const params = new URLSearchParams()
      params.set('patient', patientId)
      if (consentId) {
        params.set('consent', consentId)
      }
      const res = await fetch(
        `${API_BASE}/provenance?${params.toString()}`,
      )
      if (!res.ok) {
        throw new Error(`Failed to fetch provenance: ${res.status}`)
      }
      const data = (await res.json()) as ProvenanceEntry[]
      setEntries(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load provenance records',
      )
    } finally {
      setLoading(false)
    }
  }, [patientId, consentId])

  useEffect(() => {
    void fetchProvenance()
  }, [fetchProvenance])

  const handleVerifyChain = useCallback(async () => {
    if (entries.length === 0) return
    setVerifying(true)
    setVerifyResult(null)
    try {
      const targetConsentId =
        consentId ?? entries[0]?.targetReference.split('/')?.pop() ?? ''
      const res = await fetch(
        `${API_BASE}/consents/${encodeURIComponent(targetConsentId)}/verify-chain`,
        { method: 'POST' },
      )
      if (!res.ok) {
        throw new Error(`Verification failed: ${res.status}`)
      }
      const result = (await res.json()) as VerifyResult
      setVerifyResult(result)
    } catch (err) {
      setVerifyResult({
        valid: false,
        details:
          err instanceof Error ? err.message : 'Verification request failed',
      })
    } finally {
      setVerifying(false)
    }
  }, [entries, consentId])

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  const renderTimelineEntry = (entry: ProvenanceEntry, index: number) => {
    const activityType = getActivityType(entry)
    const isLast = index === entries.length - 1
    const colorClass =
      ACTIVITY_COLORS[activityType] ?? 'bg-gray-100 text-gray-700 border-gray-300'
    const isExpanded = expandedId === entry.id

    return (
      <li key={entry.id} className="relative" role="listitem">
        {/* Timeline dot and line */}
        <div className="flex gap-3">
          <div className="flex flex-col items-center">
            <div
              className={`w-3 h-3 rounded-full border-2 mt-1.5 shrink-0 ${colorClass}`}
              aria-hidden="true"
            />
            {!isLast && (
              <div
                className="w-0.5 flex-1 bg-gray-200 min-h-[2rem]"
                aria-hidden="true"
              />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 pb-4 min-w-0">
            <div
              className={`border rounded-lg p-3 ${colorClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-white">
                    {activityType}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(entry.recorded)}
                  </span>
                </div>
                <button
                  onClick={() => toggleExpand(entry.id)}
                  className="p-1 rounded hover:bg-white/50 shrink-0"
                  aria-label={
                    isExpanded
                      ? 'Collapse provenance details'
                      : 'Expand provenance details'
                  }
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="mt-2 space-y-1 text-xs">
                <div className="flex gap-2">
                  <span className="font-medium text-muted-foreground">Agent:</span>
                  <span className="font-mono break-all">
                    {entry.agentWho || '-'}
                  </span>
                </div>
                {entry.agentOnBehalfOf && (
                  <div className="flex gap-2">
                    <span className="font-medium text-muted-foreground">
                      On behalf of:
                    </span>
                    <span className="font-mono break-all">
                      {entry.agentOnBehalfOf}
                    </span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="font-medium text-muted-foreground">
                    Target:
                  </span>
                  <span className="font-mono break-all">
                    {entry.targetReference}
                  </span>
                </div>
                {entry.signatureData && (
                  <div className="flex gap-2">
                    <span className="font-medium text-muted-foreground">
                      Signature:
                    </span>
                    <span className="font-mono break-all">
                      {entry.signatureData.slice(0, 40)}...
                    </span>
                  </div>
                )}
                {entry.signatureWhen && (
                  <div className="flex gap-2">
                    <span className="font-medium text-muted-foreground">
                      Signed at:
                    </span>
                    <span>{formatDate(entry.signatureWhen)}</span>
                  </div>
                )}
              </div>

              {isExpanded && (
                <div className="mt-3 border-t pt-2">
                  <h4 className="text-xs font-semibold mb-1">
                    Full Provenance Resource
                  </h4>
                  <pre className="text-xs font-mono overflow-x-auto bg-white/50 rounded p-2 max-h-48 overflow-y-auto">
                    {JSON.stringify(entry.raw, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Provenance Chain</h2>
          <p className="text-sm text-muted-foreground">
            {consentId
              ? `Chain for consent ${consentId}`
              : `All provenance records for patient ${patientId}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleVerifyChain()}
            disabled={verifying || entries.length === 0}
            aria-label="Verify provenance chain integrity"
          >
            {verifying ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ShieldCheck className="h-3 w-3" />
            )}
            Verify Chain
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void fetchProvenance()}
            aria-label="Refresh provenance records"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Verification result */}
      {verifyResult && (
        <div
          className={`border rounded-lg p-4 flex items-start gap-3 ${
            verifyResult.valid
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }`}
          role="status"
          aria-live="polite"
        >
          {verifyResult.valid ? (
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600 shrink-0" />
          )}
          <div>
            <p
              className={`text-sm font-medium ${
                verifyResult.valid ? 'text-green-700' : 'text-red-700'
              }`}
            >
              {verifyResult.valid ? 'Chain Valid' : 'Chain Broken'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {verifyResult.details}
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">
            Loading provenance records...
          </span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="border border-red-200 bg-red-50 rounded-lg p-4">
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={() => void fetchProvenance()}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && entries.length === 0 && (
        <div className="border rounded-lg p-4 text-center py-8">
          <ShieldX className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No provenance records
          </p>
        </div>
      )}

      {/* Timeline */}
      {!loading && !error && entries.length > 0 && (
        <div className="border rounded-lg p-4">
          <ol
            className="space-y-0"
            role="list"
            aria-label="Provenance chain timeline"
          >
            {entries.map((entry, index) =>
              renderTimelineEntry(entry, index),
            )}
          </ol>
        </div>
      )}
    </div>
  )
}

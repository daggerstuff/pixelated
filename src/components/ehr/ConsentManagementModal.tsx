import { ChevronDown, ChevronRight, Loader2, RefreshCw } from 'lucide-react'
import React, { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ConfirmDialog, DialogModal } from '@/components/ui/dialog'
import type { ConsentRecord, ConsentScope, TreatmentType } from '@/lib/ehr-native/consent/types'

const API_BASE = '/api/ehr/v1'

interface ConsentManagementModalProps {
  patientId: string
  open: boolean
  onClose: () => void
  onUpdate?: () => void
}

interface ProvenanceInfo {
  id: string
  recorded: string
  agentWho: string
  signatureData: string | null
  signatureFormat: string | null
}

interface RenewalForm {
  scope: ConsentScope
  treatmentType: TreatmentType
  startDate: string
  endDate: string
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  expired: 'bg-yellow-100 text-yellow-700',
  withdrawn: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-700',
}

const SCOPE_OPTIONS: ConsentScope[] = [
  'patient-privacy',
  'treatment',
  'research',
  'data-sharing',
]

const TREATMENT_OPTIONS: TreatmentType[] = [
  'therapy',
  'psychiatry',
  'telehealth',
  'assessment',
  'general',
]

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return iso
  }
}

export function ConsentManagementModal({
  patientId,
  open,
  onClose,
  onUpdate,
}: ConsentManagementModalProps) {
  const [consents, setConsents] = useState<ConsentRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [provenanceMap, setProvenanceMap] = useState<Record<string, ProvenanceInfo>>({})
  const [showRenewForm, setShowRenewForm] = useState<string | null>(null)
  const [renewalForm, setRenewalForm] = useState<RenewalForm>({
    scope: 'treatment',
    treatmentType: 'therapy',
    startDate: '',
    endDate: '',
  })
  const [renewalError, setRenewalError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [withdrawTarget, setWithdrawTarget] = useState<ConsentRecord | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)

  const fetchConsents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `${API_BASE}/consents?patient=${encodeURIComponent(patientId)}`,
      )
      if (!res.ok) {
        throw new Error(`Failed to fetch consents: ${res.status}`)
      }
      const data = (await res.json()) as ConsentRecord[]
      setConsents(data)

      // Fetch provenance for each consent that has a provenanceId
      const provenanceEntries = await Promise.all(
        data
          .filter((c) => c.provenanceId)
          .map(async (c) => {
            try {
              const provRes = await fetch(
                `${API_BASE}/provenance/${c.provenanceId}`,
              )
              if (!provRes.ok) return null
              const prov = (await provRes.json()) as {
                recorded?: string
                agent?: Array<{ who?: { reference?: string } }>
                signature?: Array<{ data?: string; sigFormat?: string }>
              }
              return {
                consentId: c.id,
                info: {
                  id: c.provenanceId,
                  recorded: prov.recorded ?? '',
                  agentWho: prov.agent?.[0]?.who?.reference ?? '',
                  signatureData: prov.signature?.[0]?.data ?? null,
                  signatureFormat: prov.signature?.[0]?.sigFormat ?? null,
                } as ProvenanceInfo,
              }
            } catch {
              return null
            }
          }),
      )
      const map: Record<string, ProvenanceInfo> = {}
      for (const entry of provenanceEntries) {
        if (entry) {
          map[entry.consentId] = entry.info
        }
      }
      setProvenanceMap(map)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load consents')
    } finally {
      setLoading(false)
    }
  }, [patientId])

  useEffect(() => {
    if (open && patientId) {
      void fetchConsents()
    }
  }, [open, patientId, fetchConsents])

  const handleWithdraw = useCallback(async () => {
    if (!withdrawTarget) return
    setWithdrawing(true)
    try {
      const res = await fetch(
        `${API_BASE}/consents/${encodeURIComponent(withdrawTarget.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'inactive',
            provisionType: 'deny',
            withdrawnReason: 'Withdrawn via consent management modal',
          }),
        },
      )
      if (!res.ok) {
        throw new Error(`Withdrawal failed: ${res.status}`)
      }
      onUpdate?.()
      void fetchConsents()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdrawal failed')
    } finally {
      setWithdrawing(false)
      setWithdrawTarget(null)
    }
  }, [withdrawTarget, onUpdate, fetchConsents])

  const handleRenewSubmit = useCallback(
    async (consentId: string) => {
      setRenewalError(null)

      if (!renewalForm.startDate) {
        setRenewalError('Start date is required')
        return
      }
      if (renewalForm.endDate && renewalForm.endDate < renewalForm.startDate) {
        setRenewalError('End date must be after start date')
        return
      }

      setSubmitting(true)
      try {
        const res = await fetch(`${API_BASE}/consents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId,
            scope: renewalForm.scope,
            treatmentType: renewalForm.treatmentType,
            periodStart: renewalForm.startDate,
            periodEnd: renewalForm.endDate || null,
            renewingConsentId: consentId,
          }),
        })
        if (!res.ok) {
          throw new Error(`Renewal failed: ${res.status}`)
        }
        setShowRenewForm(null)
        setRenewalForm({
          scope: 'treatment',
          treatmentType: 'therapy',
          startDate: '',
          endDate: '',
        })
        onUpdate?.()
        void fetchConsents()
      } catch (err) {
        setRenewalError(
          err instanceof Error ? err.message : 'Renewal failed',
        )
      } finally {
        setSubmitting(false)
      }
    },
    [renewalForm, patientId, onUpdate, fetchConsents],
  )

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  const startRenew = useCallback((consent: ConsentRecord) => {
    setShowRenewForm(consent.id)
    setExpandedId(consent.id)
    setRenewalForm({
      scope: consent.scope,
      treatmentType: consent.treatmentType,
      startDate: '',
      endDate: '',
    })
    setRenewalError(null)
  }, [])

  const renderProvenance = (consent: ConsentRecord) => {
    const prov = provenanceMap[consent.id]
    if (!prov) {
      return (
        <p className="text-xs text-muted-foreground">
          No provenance record found
        </p>
      )
    }
    return (
      <div className="space-y-1 text-xs">
        <div className="flex gap-2">
          <span className="font-medium text-muted-foreground">Signed by:</span>
          <span className="font-mono">{prov.agentWho || '-'}</span>
        </div>
        <div className="flex gap-2">
          <span className="font-medium text-muted-foreground">Timestamp:</span>
          <span>{formatDate(prov.recorded)}</span>
        </div>
        <div className="flex gap-2">
          <span className="font-medium text-muted-foreground">Signature:</span>
          <span className="font-mono break-all">
            {prov.signatureData
              ? `${prov.signatureData.slice(0, 32)}...`
              : 'No signature data'}
          </span>
        </div>
        {prov.signatureFormat && (
          <div className="flex gap-2">
            <span className="font-medium text-muted-foreground">Format:</span>
            <span>{prov.signatureFormat}</span>
          </div>
        )}
      </div>
    )
  }

  const renderExpandedDetails = (consent: ConsentRecord) => (
    <div className="col-span-full space-y-3 border-t pt-3">
      <div>
        <h4 className="text-sm font-semibold mb-1">Provisions</h4>
        {consent.provisions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No provisions recorded</p>
        ) : (
          <ul className="space-y-1">
            {consent.provisions.map((prov, idx) => (
              <li
                key={idx}
                className="text-xs flex items-start gap-2"
              >
                <span
                  className={`px-1.5 py-0.5 rounded font-medium ${
                    prov.type === 'permit'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {prov.type}
                </span>
                <span className="font-mono">
                  {prov.code.length > 0 ? prov.code.join(', ') : 'all'}
                </span>
                {prov.period && (
                  <span className="text-muted-foreground">
                    ({formatDate(prov.period.start)} - {formatDate(prov.period.end)})
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h4 className="text-sm font-semibold mb-1">Provenance Chain</h4>
        {renderProvenance(consent)}
      </div>
      {showRenewForm === consent.id && (
        <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
          <h4 className="text-sm font-semibold">Renew Consent</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label
                htmlFor={`renew-scope-${consent.id}`}
                className="text-xs font-medium block mb-1"
              >
                Scope
              </label>
              <select
                id={`renew-scope-${consent.id}`}
                value={renewalForm.scope}
                onChange={(e) =>
                  setRenewalForm((prev) => ({
                    ...prev,
                    scope: e.target.value as ConsentScope,
                  }))
                }
                className="w-full px-2 py-1.5 border rounded-md text-sm"
              >
                {SCOPE_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor={`renew-treatment-${consent.id}`}
                className="text-xs font-medium block mb-1"
              >
                Treatment Type
              </label>
              <select
                id={`renew-treatment-${consent.id}`}
                value={renewalForm.treatmentType}
                onChange={(e) =>
                  setRenewalForm((prev) => ({
                    ...prev,
                    treatmentType: e.target.value as TreatmentType,
                  }))
                }
                className="w-full px-2 py-1.5 border rounded-md text-sm"
              >
                {TREATMENT_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor={`renew-start-${consent.id}`}
                className="text-xs font-medium block mb-1"
              >
                Start Date *
              </label>
              <input
                id={`renew-start-${consent.id}`}
                type="date"
                value={renewalForm.startDate}
                onChange={(e) =>
                  setRenewalForm((prev) => ({
                    ...prev,
                    startDate: e.target.value,
                  }))
                }
                className="w-full px-2 py-1.5 border rounded-md text-sm"
                aria-required="true"
              />
            </div>
            <div>
              <label
                htmlFor={`renew-end-${consent.id}`}
                className="text-xs font-medium block mb-1"
              >
                End Date
              </label>
              <input
                id={`renew-end-${consent.id}`}
                type="date"
                value={renewalForm.endDate}
                onChange={(e) =>
                  setRenewalForm((prev) => ({
                    ...prev,
                    endDate: e.target.value,
                  }))
                }
                className="w-full px-2 py-1.5 border rounded-md text-sm"
              />
            </div>
          </div>
          {renewalError && (
            <p className="text-xs text-red-600" role="alert">
              {renewalError}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRenewForm(null)}
              disabled={submitting}
              className="min-h-[44px] w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleRenewSubmit(consent.id)}
              disabled={submitting}
              className="min-h-[44px] w-full sm:w-auto"
            >
              {submitting && (
                <Loader2 className="h-3 w-3 animate-spin" />
              )}
              Submit Renewal
            </Button>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      <DialogModal
        isOpen={open}
        onClose={onClose}
        title="Consent Management"
        maxWidth="lg"
        aria-label="Consent management dialog"
        className="max-w-full sm:max-w-lg h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-lg"
        backdropClassName="p-0 sm:p-4"
      >
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">
              Loading consent records...
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="border border-red-200 bg-red-50 rounded-lg p-4">
            <p className="text-sm text-red-700" role="alert">
              {error}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => void fetchConsents()}
            >
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && consents.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              No consent records found for this patient.
            </p>
          </div>
        )}

        {!loading && !error && consents.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <p className="text-sm text-muted-foreground">
                {consents.length} consent record(s) for patient{' '}
                <span className="font-mono">{patientId}</span>
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void fetchConsents()}
                aria-label="Refresh consent records"
                className="min-h-[44px] w-full sm:w-auto"
              >
                <RefreshCw className="h-3 w-3" />
                Refresh
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 w-8" />
                    <th className="text-left py-2 px-2">Consent ID</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-left py-2 px-2">Scope</th>
                    <th className="text-left py-2 px-2">Period</th>
                    <th className="text-left py-2 px-2">Performer</th>
                    <th className="text-left py-2 px-2">Signed</th>
                    <th className="text-left py-2 px-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {consents.map((consent) => (
                    <React.Fragment key={consent.id}>
                      <tr className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2">
                          <button
                            onClick={() => toggleExpand(consent.id)}
                            className="p-1 rounded hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
                            aria-label={
                              expandedId === consent.id
                                ? 'Collapse details'
                                : 'Expand details'
                            }
                            aria-expanded={expandedId === consent.id}
                          >
                            {expandedId === consent.id ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">
                          {consent.id}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              STATUS_BADGE[consent.status] ??
                              'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {consent.status}
                          </span>
                        </td>
                        <td className="py-2 px-2">{consent.scope}</td>
                        <td className="py-2 px-2 text-xs">
                          {formatDate(consent.grantedAt)}
                          {' - '}
                          {formatDate(consent.expiresAt)}
                        </td>
                        <td className="py-2 px-2 font-mono text-xs">
                          {consent.performerId || '-'}
                        </td>
                        <td className="py-2 px-2 text-xs">
                          {formatDate(consent.grantedAt)}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1">
                            {consent.status === 'active' && (
                              <button
                                className="px-2 py-1 text-xs border rounded text-red-600 hover:bg-red-50 min-h-[44px]"
                                onClick={() => setWithdrawTarget(consent)}
                                aria-label={`Withdraw consent ${consent.id}`}
                              >
                                Withdraw
                              </button>
                            )}
                            <button
                              className="px-2 py-1 text-xs border rounded hover:bg-accent min-h-[44px]"
                              onClick={() => startRenew(consent)}
                              aria-label={`Renew consent ${consent.id}`}
                            >
                              Renew
                            </button>
                            <button
                              className="px-2 py-1 text-xs border rounded hover:bg-accent min-h-[44px]"
                              onClick={() => toggleExpand(consent.id)}
                              aria-label={`View details for consent ${consent.id}`}
                              aria-expanded={expandedId === consent.id}
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedId === consent.id && (
                        <tr>
                          <td colSpan={8} className="px-2 pb-2">
                            {renderExpandedDetails(consent)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogModal>

      <ConfirmDialog
        isOpen={withdrawTarget !== null}
        onClose={() => setWithdrawTarget(null)}
        onConfirm={handleWithdraw}
        title="Withdraw Consent"
        message="Are you sure you want to withdraw this consent?"
        confirmText="Withdraw"
        cancelText="Cancel"
        isDanger
        loading={withdrawing}
      >
        <p className="text-sm text-muted-foreground">
          Are you sure you want to withdraw consent{' '}
          <span className="font-mono">{withdrawTarget?.id}</span>? This action
          will mark the consent as inactive and cannot be undone.
        </p>
      </ConfirmDialog>
    </>
  )
}

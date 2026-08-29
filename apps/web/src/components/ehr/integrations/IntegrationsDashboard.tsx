/**
 * @file integrations/IntegrationsDashboard.tsx
 * @description Per-tenant integration marketplace dashboard. Fetches
 *   marketplace status, renders provider cards with connection status and
 *   feature flag toggles, and provides connect/disconnect actions.
 * @module ehr/integrations
 */

import { RefreshCw, Loader2, LayoutGrid } from 'lucide-react'
import { type FC, useCallback, useEffect, useState } from 'react'

import {
  marketplaceDashboardSchema,
  type IntegrationProvider,
  type MarketplaceDashboard,
  type MarketplaceProvider,
  type TenantProviderStatus,
} from '@/lib/ehr-native/integrations/types'

import ProviderCard from './ProviderCard'

// ---------------------------------------------------------------------------
// API response helpers
// ---------------------------------------------------------------------------

interface DashboardApiResponse {
  dashboard: MarketplaceDashboard
}

interface ProvidersApiResponse {
  providers: MarketplaceProvider[]
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// IntegrationsDashboard
// ---------------------------------------------------------------------------

export interface IntegrationsDashboardProps {
  /** Tenant ID for this dashboard */
  tenantId: string
  /** Base URL for the integrations API (default: '/api/integrations') */
  apiBaseUrl?: string
  /** Called when a provider card requests OAuth connection */
  onConnect?: (provider: IntegrationProvider) => void
  /** Called when a provider card requests disconnect */
  onDisconnect?: (provider: IntegrationProvider) => void
  /** Called when a feature flag toggle is requested */
  onToggleFeatureFlag?: (
    provider: IntegrationProvider,
    enabled: boolean,
  ) => void
}

const IntegrationsDashboard: FC<IntegrationsDashboardProps> = ({
  tenantId,
  apiBaseUrl = '/api/integrations',
  onConnect,
  onDisconnect,
  onToggleFeatureFlag,
}) => {
  const [dashboard, setDashboard] = useState<MarketplaceDashboard | null>(null)
  const [providers, setProviders] = useState<MarketplaceProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(
    null,
  )

  // --- Fetch dashboard + providers -----------------------------------------

  const fetchDashboard = useCallback(async () => {
    try {
      const [dashRes, provRes] = await Promise.all([
        fetchJson<DashboardApiResponse>(`${apiBaseUrl}/status/${tenantId}`),
        fetchJson<ProvidersApiResponse>(`${apiBaseUrl}/providers`),
      ])
      setDashboard(marketplaceDashboardSchema.parse(dashRes.dashboard))
      setProviders(provRes.providers)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load integrations',
      )
    } finally {
      setLoading(false)
    }
  }, [apiBaseUrl, tenantId])

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    await fetchDashboard()
  }, [fetchDashboard])

  useEffect(() => {
    let cancelled = false

    void (async () => {
      try {
        const [dashRes, provRes] = await Promise.all([
          fetchJson<DashboardApiResponse>(`${apiBaseUrl}/status/${tenantId}`),
          fetchJson<ProvidersApiResponse>(`${apiBaseUrl}/providers`),
        ])
        if (cancelled) return
        setDashboard(marketplaceDashboardSchema.parse(dashRes.dashboard))
        setProviders(provRes.providers)
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load integrations',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [apiBaseUrl, tenantId])

  // --- Actions --------------------------------------------------------------

  const handleConnect = useCallback(
    (provider: IntegrationProvider) => {
      if (onConnect) {
        onConnect(provider)
      } else {
        // Default: redirect to OAuth authorize endpoint
        window.location.href = `${apiBaseUrl}/oauth/${provider}/authorize?tenantId=${tenantId}`
      }
    },
    [apiBaseUrl, onConnect, tenantId],
  )

  const handleDisconnect = useCallback(
    async (provider: IntegrationProvider) => {
      setBusyProvider(provider)
      try {
        if (onDisconnect) {
          onDisconnect(provider)
        } else {
          await fetchJson(`${apiBaseUrl}/disconnect/${tenantId}/${provider}`, {
            method: 'POST',
          })
        }
        await loadDashboard()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to disconnect provider',
        )
      } finally {
        setBusyProvider(null)
      }
    },
    [apiBaseUrl, loadDashboard, onDisconnect, tenantId],
  )

  const handleToggleFeatureFlag = useCallback(
    async (provider: IntegrationProvider, enabled: boolean) => {
      setBusyProvider(provider)
      try {
        if (onToggleFeatureFlag) {
          onToggleFeatureFlag(provider, enabled)
        } else {
          await fetchJson(
            `${apiBaseUrl}/feature-flags/${tenantId}/${provider}`,
            {
              method: 'PUT',
              body: JSON.stringify({ enabled }),
            },
          )
        }
        await loadDashboard()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to toggle feature flag',
        )
      } finally {
        setBusyProvider(null)
      }
    },
    [apiBaseUrl, loadDashboard, onToggleFeatureFlag, tenantId],
  )

  // --- Helpers ---------------------------------------------------------------

  const getStatusForProvider = useCallback(
    (provider: IntegrationProvider): TenantProviderStatus | undefined =>
      dashboard?.providers.find((p) => p.provider === provider),
    [dashboard],
  )

  // --- Render ----------------------------------------------------------------

  if (loading && !dashboard) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 300,
          color: 'var(--np-muted)',
          gap: 8,
        }}
      >
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
        Loading integrations…
      </div>
    )
  }

  return (
    <div
      style={{
        background: 'var(--np-bg)',
        minHeight: '100%',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--np-line)',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LayoutGrid size={20} style={{ color: 'var(--np-muted)' }} />
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              color: 'var(--np-text)',
            }}
          >
            Integration Marketplace
          </h2>
          {dashboard && (
            <span
              style={{
                fontSize: 14,
                color: 'var(--np-muted)',
                marginLeft: 4,
              }}
            >
              {dashboard.totalConnected} of {dashboard.totalAvailable} connected
            </span>
          )}
        </div>

        <button
          onClick={() => void loadDashboard()}
          disabled={loading}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--np-line)',
            background: 'var(--np-surface)',
            color: 'var(--np-text)',
            fontSize: 14,
            cursor: loading ? 'wait' : 'pointer',
            opacity: loading ? 0.6 : 1,
          }}
          aria-label="Refresh dashboard"
        >
          {loading ? (
            <Loader2
              size={16}
              style={{ animation: 'spin 1s linear infinite' }}
            />
          ) : (
            <RefreshCw size={16} />
          )}
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            margin: '12px 16px',
            padding: '12px 16px',
            borderRadius: 8,
            background:
              'color-mix(in srgb, var(--np-danger, #dc2626) 8%, transparent)',
            color: 'var(--np-danger, #dc2626)',
            fontSize: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
          role="alert"
        >
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'inherit',
              fontSize: 16,
              padding: 4,
            }}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      )}

      {/* Provider grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
          gap: 16,
          padding: 16,
        }}
      >
        {providers.map((providerInfo) => {
          const status = getStatusForProvider(providerInfo.provider)
          return (
            <ProviderCard
              key={providerInfo.provider}
              providerInfo={providerInfo}
              status={status}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onToggleFeatureFlag={handleToggleFeatureFlag}
              busy={busyProvider === providerInfo.provider}
            />
          )
        })}
      </div>
    </div>
  )
}

export default IntegrationsDashboard

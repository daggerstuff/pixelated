/**
 * @file integrations/ProviderCard.tsx
 * @description Card component showing a single integration provider's
 *   connection status, feature flag toggle, and connect/disconnect actions.
 * @module ehr/integrations
 */

import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Plug,
  PlugUnplug,
  Loader2,
} from 'lucide-react'
import React, { type FC, useState } from 'react'

import type {
  IntegrationProvider,
  IntegrationStatus,
  MarketplaceProvider,
  TenantProviderStatus,
} from '@/lib/ehr-native/integrations/types'
import { PROVIDER_DISPLAY_NAMES } from '@/lib/ehr-native/integrations/types'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

interface StatusBadgeProps {
  status: IntegrationStatus
}

const StatusBadge: FC<StatusBadgeProps> = ({ status }) => {
  const config: Record<
    IntegrationStatus,
    { icon: React.ReactNode; color: string; label: string }
  > = {
    connected: {
      icon: <CheckCircle2 size={14} />,
      color: 'var(--np-success, #16a34a)',
      label: 'Connected',
    },
    disconnected: {
      icon: <XCircle size={14} />,
      color: 'var(--np-muted)',
      label: 'Disconnected',
    },
    error: {
      icon: <AlertCircle size={14} />,
      color: 'var(--np-danger, #dc2626)',
      label: 'Error',
    },
    pending: {
      icon: <Clock size={14} />,
      color: 'var(--np-warning, #d97706)',
      label: 'Pending',
    },
  }

  const { icon, color, label } = config[status]

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 13,
        fontWeight: 500,
        color,
        padding: '2px 10px',
        borderRadius: 12,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      {icon}
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Category badge
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  scheduling: 'Scheduling',
  video: 'Video',
  payments: 'Payments',
  communications: 'Communications',
}

interface CategoryBadgeProps {
  category: string
}

const CategoryBadge: FC<CategoryBadgeProps> = ({ category }) => (
  <span
    style={{
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: 'var(--np-muted)',
      padding: '2px 8px',
      borderRadius: 4,
      background: 'var(--np-hover, rgba(0,0,0,0.04))',
    }}
  >
    {CATEGORY_LABELS[category] ?? category}
  </span>
)

// ---------------------------------------------------------------------------
// ProviderCard
// ---------------------------------------------------------------------------

export interface ProviderCardProps {
  /** Static marketplace metadata for this provider */
  providerInfo: MarketplaceProvider
  /** Per-tenant status (optional — if absent, provider has no connection) */
  status?: TenantProviderStatus
  /** Callback to initiate OAuth connection */
  onConnect: (provider: IntegrationProvider) => void
  /** Callback to disconnect the integration */
  onDisconnect: (provider: IntegrationProvider) => void
  /** Callback to toggle the feature flag */
  onToggleFeatureFlag: (provider: IntegrationProvider, enabled: boolean) => void
  /** Whether an async action is in progress for this provider */
  busy?: boolean
}

const ProviderCard: FC<ProviderCardProps> = ({
  providerInfo,
  status,
  onConnect,
  onDisconnect,
  onToggleFeatureFlag,
  busy = false,
}) => {
  const connectionStatus: IntegrationStatus = status?.status ?? 'disconnected'
  const isConnected = connectionStatus === 'connected'
  const featureEnabled = status?.featureFlag?.enabled ?? false
  const [togglePending, setTogglePending] = useState(false)

  const handleToggle = () => {
    setTogglePending(true)
    onToggleFeatureFlag(providerInfo.provider, !featureEnabled)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 20,
        borderRadius: 12,
        border: '1px solid var(--np-line)',
        background: 'var(--np-surface)',
        minWidth: 0,
      }}
    >
      {/* Header: name + status */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--np-text)',
              }}
            >
              {providerInfo.displayName}
            </h3>
            <CategoryBadge category={providerInfo.category} />
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: 'var(--np-muted)',
              lineHeight: 1.4,
            }}
          >
            {providerInfo.description}
          </p>
        </div>
        <StatusBadge status={connectionStatus} />
      </div>

      {/* Connection info */}
      {status?.connectedAt && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--np-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Clock size={12} />
          Connected{' '}
          {new Date(status.connectedAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </div>
      )}

      {/* Last error */}
      {status?.lastError && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--np-danger, #dc2626)',
            padding: '8px 12px',
            borderRadius: 6,
            background: 'color-mix(in srgb, var(--np-danger, #dc2626) 8%, transparent)',
          }}
          role="alert"
        >
          {status.lastError}
        </div>
      )}

      {/* Last webhook */}
      {status?.lastWebhookReceivedAt && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--np-muted)',
          }}
        >
          Last webhook:{' '}
          {new Date(status.lastWebhookReceivedAt).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}

      {/* Feature flag toggle */}
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: busy || togglePending ? 'wait' : 'pointer',
          fontSize: 14,
          color: 'var(--np-text)',
          userSelect: 'none',
        }}
      >
        <input
          type="checkbox"
          checked={featureEnabled}
          onChange={handleToggle}
          disabled={busy || togglePending || !isConnected}
          style={{
            width: 16,
            height: 16,
            cursor: 'pointer',
            accentColor: 'var(--np-elevated, #3b82f6)',
          }}
          aria-label={`Toggle ${PROVIDER_DISPLAY_NAMES[providerInfo.provider]} integration`}
        />
        {togglePending ? (
          <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
        ) : null}
        <span>Enable for this tenant</span>
      </label>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {!isConnected ? (
          <button
            onClick={() => onConnect(providerInfo.provider)}
            disabled={busy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--np-line)',
              background: 'var(--np-elevated, #3b82f6)',
              color: 'white',
              fontSize: 14,
              fontWeight: 500,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Plug size={16} />}
            Connect
          </button>
        ) : (
          <button
            onClick={() => onDisconnect(providerInfo.provider)}
            disabled={busy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid var(--np-line)',
              background: 'var(--np-surface)',
              color: 'var(--np-danger, #dc2626)',
              fontSize: 14,
              fontWeight: 500,
              cursor: busy ? 'wait' : 'pointer',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <PlugUnplug size={16} />}
            Disconnect
          </button>
        )}
      </div>
    </div>
  )
}

export default ProviderCard

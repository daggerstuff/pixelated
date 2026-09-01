/**
 * @file MetricCard.tsx
 * @description Displays a single metric value with optional delta indicator.
 */

import { ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { type FC, useMemo } from 'react'

export interface MetricCardProps {
  /** Current value */
  value: number | string
  /** Label shown above the value */
  label: string
  /** Previous value for delta calculation (optional) */
  previousValue?: number
  /** Unit suffix (e.g. '%', '$', 'min') */
  unit?: string
  /** Whether a lower value is better (affects delta color) */
  lowerIsBetter?: boolean
  /** Number of decimal places for numeric formatting */
  decimals?: number
  /** Optional icon node */
  icon?: React.ReactNode
  /** Optional subtext shown below the value */
  subtext?: string
}

export const MetricCard: FC<MetricCardProps> = function MetricCard({
  value,
  label,
  previousValue,
  unit = '',
  lowerIsBetter = false,
  decimals = 0,
  icon,
  subtext,
}) {
  const { delta, deltaPct, isPositive } = useMemo(() => {
    if (previousValue === undefined || typeof value !== 'number') {
      return { delta: undefined, deltaPct: undefined, isPositive: false }
    }
    const d = value - previousValue
    const pct = previousValue !== 0 ? (d / Math.abs(previousValue)) * 100 : 0
    const positive = d > 0
    return { delta: d, deltaPct: pct, isPositive: positive }
  }, [value, previousValue])

  const displayValue =
    typeof value === 'number'
      ? value.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : value

  const deltaColor = useMemo(() => {
    if (delta === undefined || delta === 0) return 'var(--np-muted)'
    if (lowerIsBetter) {
      return delta > 0 ? 'var(--np-danger)' : 'var(--np-success)'
    }
    return delta > 0 ? 'var(--np-success)' : 'var(--np-danger)'
  }, [delta, lowerIsBetter])

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        height: '100%',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.75rem',
          color: 'var(--np-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: 'var(--np-text)',
          lineHeight: 1.1,
        }}
      >
        {displayValue}
        {unit && (
          <span
            style={{ fontSize: '1rem', fontWeight: 500, marginLeft: '4px' }}
          >
            {unit}
          </span>
        )}
      </div>
      {subtext && (
        <div style={{ fontSize: '0.75rem', color: 'var(--np-muted)' }}>
          {subtext}
        </div>
      )}
      {deltaPct !== undefined && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.8rem',
            fontWeight: 500,
            color: deltaColor,
          }}
        >
          {delta > 0 ? (
            <ArrowUp size={14} />
          ) : delta < 0 ? (
            <ArrowDown size={14} />
          ) : (
            <Minus size={14} />
          )}
          {Math.abs(deltaPct).toFixed(1)}% vs last period
        </div>
      )}
    </div>
  )
}

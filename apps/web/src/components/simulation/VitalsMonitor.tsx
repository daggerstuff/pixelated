import { useEffect, useRef } from 'react'

import type { ScenarioEvent, Vitals } from '@/hooks/useScenarioEvents'

interface VitalsMonitorProps {
  event: ScenarioEvent | null
  status: string
  onReconnect?: () => void
}

const HEART_RATE_HIGH = 120
const OXY_LOW = 90

function isSpike(vitals: Vitals): boolean {
  return (
    (vitals.heart_rate !== undefined && vitals.heart_rate > HEART_RATE_HIGH) ||
    (vitals.oxygen_saturation !== undefined &&
      vitals.oxygen_saturation < OXY_LOW)
  )
}

export function VitalsMonitor({
  event,
  status,
  onReconnect,
}: VitalsMonitorProps) {
  const vitals = event?.updated_vitals ?? {}
  const spiked = isSpike(vitals)

  let alertMessage: string | null = null
  if (spiked) {
    const parts: string[] = []
    if (
      vitals.heart_rate !== undefined &&
      vitals.heart_rate > HEART_RATE_HIGH
    ) {
      parts.push(`heart rate ${vitals.heart_rate}`)
    }
    if (
      vitals.oxygen_saturation !== undefined &&
      vitals.oxygen_saturation < OXY_LOW
    ) {
      parts.push(`SpO2 ${vitals.oxygen_saturation}%`)
    }
    alertMessage = `Vital spike: ${parts.join(', ')}`
  }

  const lastPlayedRef = useRef<ScenarioEvent | null>(null)
  useEffect(() => {
    if (!spiked || event === null || event === lastPlayedRef.current) {
      return
    }
    lastPlayedRef.current = event
    try {
      const Ctor = window.AudioContext
      if (!Ctor) return
      const ctx = new Ctor()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.value = 0.05
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.2)
      osc.onended = () => {
        osc.disconnect()
        gain.disconnect()
      }
    } catch {
      // Audio unavailable (e.g. no user gesture yet) — visual alert only
    }
  }, [event, spiked])

  const statusLabel =
    status === 'connected'
      ? 'Live'
      : status === 'reconnecting'
        ? 'Reconnecting…'
        : status === 'connecting'
          ? 'Connecting…'
          : 'Offline'

  const connected = status === 'connected'

  return (
    <div
      className={`rounded-md border p-4 transition-colors ${
        spiked
          ? 'bg-destructive/10 border-destructive'
          : 'border-border bg-card'
      }`}
      role="region"
      aria-label="Patient vitals monitor"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Vitals Monitor
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connected ? 'bg-green-500' : 'bg-yellow-500'
            } ${status === 'reconnecting' ? 'animate-pulse' : ''}`}
            aria-hidden="true"
          />
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {statusLabel}
          </span>
          {!connected && onReconnect ? (
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 text-xs text-foreground hover:bg-secondary"
              onClick={onReconnect}
            >
              Retry
            </button>
          ) : null}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded border border-border bg-background p-2">
          <dt className="text-xs text-muted-foreground">Heart rate</dt>
          <dd
            className={`text-lg font-semibold tabular-nums ${
              vitals.heart_rate !== undefined &&
              vitals.heart_rate > HEART_RATE_HIGH
                ? 'text-destructive'
                : 'text-foreground'
            }`}
          >
            {vitals.heart_rate === undefined
              ? '--'
              : `${vitals.heart_rate} bpm`}
          </dd>
        </div>
        <div className="rounded border border-border bg-background p-2">
          <dt className="text-xs text-muted-foreground">SpO2</dt>
          <dd
            className={`text-lg font-semibold tabular-nums ${
              vitals.oxygen_saturation !== undefined &&
              vitals.oxygen_saturation < OXY_LOW
                ? 'text-destructive'
                : 'text-foreground'
            }`}
          >
            {vitals.oxygen_saturation === undefined
              ? '--'
              : `${vitals.oxygen_saturation}%`}
          </dd>
        </div>
        <div className="rounded border border-border bg-background p-2">
          <dt className="text-xs text-muted-foreground">Blood pressure</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">
            {vitals.blood_pressure_systolic !== undefined &&
            vitals.blood_pressure_diastolic !== undefined
              ? `${vitals.blood_pressure_systolic}/${vitals.blood_pressure_diastolic}`
              : '--'}
          </dd>
        </div>
        <div className="rounded border border-border bg-background p-2">
          <dt className="text-xs text-muted-foreground">Respiratory rate</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">
            {vitals.respiratory_rate === undefined
              ? '--'
              : `${vitals.respiratory_rate}/min`}
          </dd>
        </div>
      </dl>

      <div className="mt-3 min-h-5" aria-live="assertive">
        {alertMessage ? (
          <p className="text-xs font-medium text-destructive">{alertMessage}</p>
        ) : null}
      </div>
    </div>
  )
}

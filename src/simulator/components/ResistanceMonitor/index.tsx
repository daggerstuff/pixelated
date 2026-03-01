/**
 * ResistanceMonitor — PIX-147: Live X-Ray Resistance Monitor
 *
 * Consumes real-time ``gestalt_update`` WebSocket events from the
 * Gestalt Fusion Engine and renders a live defense state gauge with:
 *
 *   • Animated semicircular gauge (canvas) — defense confidence
 *   • Color-coded crisis alert strip — none / elevated / high / acute
 *   • Defense maturity progress bar
 *   • Plutchik emotion mosaic (8-bar mini histogram)
 *   • Behavioral prediction text (AI-generated)
 *   • Breakthrough score indicator
 *   • WebSocket status badge with manual reconnect
 *
 * PRIVACY: All data is ephemeral — the component holds no state beyond
 * the current session render cycle. Zero data is persisted anywhere.
 *
 * @see useGestaltWebSocket
 * @see GestaltClient (src/lib/services/ai/GestaltClient.ts)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type {
  CrisisLevel,
  GestaltUpdatePayload,
} from '../../hooks/useGestaltWebSocket'
import { useGestaltWebSocket } from '../../hooks/useGestaltWebSocket'

import styles from './ResistanceMonitor.module.css'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLUTCHIK_ORDER = [
  'joy',
  'trust',
  'fear',
  'surprise',
  'sadness',
  'disgust',
  'anger',
  'anticipation',
] as const

/** Colour for each Plutchik emotion — Wheel-based palette. */
const PLUTCHIK_COLORS: Record<string, string> = {
  joy: '#facc15',
  trust: '#4ade80',
  fear: '#a78bfa',
  surprise: '#38bdf8',
  sadness: '#60a5fa',
  disgust: '#c084fc',
  anger: '#f87171',
  anticipation: '#fb923c',
}

const GAUGE_WIDTH = 260
const GAUGE_HEIGHT = 130

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Semicircular canvas gauge showing defense confidence [0–1]. */
function DefenseGauge({
  confidence,
  defenseName,
}: {
  confidence: number
  defenseName: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [displayValue, setDisplayValue] = useState(confidence)
  const value = Math.max(0, Math.min(1, confidence))

  // Smoothly interpolate towards the target confidence value
  useEffect(() => {
    let frameId: number
    const startTime = Date.now()
    const duration = 800 // ms
    const startValue = displayValue

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const nextValue = startValue + (value - startValue) * eased

      setDisplayValue(nextValue)

      if (progress < 1) {
        frameId = requestAnimationFrame(animate)
      }
    }

    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [value])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio ?? 1
    canvas.width = GAUGE_WIDTH * dpr
    canvas.height = GAUGE_HEIGHT * dpr
    ctx.scale(dpr, dpr)

    ctx.clearRect(0, 0, GAUGE_WIDTH, GAUGE_HEIGHT)

    const cx = GAUGE_WIDTH / 2
    const cy = GAUGE_HEIGHT * 0.9
    const r = GAUGE_WIDTH * 0.38
    const currentVal = Math.max(0, Math.min(1, displayValue))

    // Track
    ctx.beginPath()
    ctx.arc(cx, cy, r, Math.PI, 0, false)
    ctx.lineWidth = 12
    ctx.strokeStyle = 'rgba(255,255,255,0.07)'
    ctx.lineCap = 'round'
    ctx.stroke()

    // Value arc — gradient red → amber → green
    const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy)
    grad.addColorStop(0, '#22c55e')
    grad.addColorStop(0.5, '#f59e0b')
    grad.addColorStop(1, '#ef4444')

    ctx.beginPath()
    ctx.arc(cx, cy, r, Math.PI, Math.PI + currentVal * Math.PI, false)
    ctx.lineWidth = 12
    ctx.strokeStyle = grad
    ctx.lineCap = 'round'
    ctx.stroke()

    // Needle
    const needleAngle = Math.PI + currentVal * Math.PI
    const nx = cx + r * 0.88 * Math.cos(needleAngle)
    const ny = cy + r * 0.88 * Math.sin(needleAngle)

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(nx, ny)
    ctx.lineWidth = 3
    ctx.strokeStyle = '#f1f5f9'
    ctx.lineCap = 'round'
    ctx.stroke()

    // Centre cap
    ctx.beginPath()
    ctx.arc(cx, cy, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#f1f5f9'
    ctx.fill()

    // Percentage text
    ctx.font = `bold ${14 * dpr}px Inter, system-ui, sans-serif`
    ctx.fillStyle = '#f1f5f9'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.scale(1 / dpr, 1 / dpr)
    ctx.fillText(`${Math.round(currentVal * 100)}%`, cx * dpr, (cy - 4) * dpr)
  }, [displayValue, confidence, defenseName])

  return (
    <div className={styles.gaugeWrap}>
      <span className={styles.gaugeLabel}>Defense Confidence</span>
      <canvas
        ref={canvasRef}
        width={GAUGE_WIDTH}
        height={GAUGE_HEIGHT}
        className={styles.gaugeCanvas}
        style={{ width: GAUGE_WIDTH, height: GAUGE_HEIGHT }}
        aria-label={`Defense confidence ${Math.round(confidence * 100)}% — ${defenseName}`}
        role='img'
      />
      <div className={styles.gaugeFooter}>
        <span>Low</span>
        <span style={{ fontWeight: 700, color: '#cbd5e1' }}>{defenseName}</span>
        <span>High</span>
      </div>
    </div>
  )
}

/** Color for the crisis strip root class. */
function crisisStripClass(level: CrisisLevel): string {
  switch (level) {
    case 'acute':
      return styles.crisisStripAcute
    case 'high':
      return styles.crisisStripHigh
    case 'elevated':
      return styles.crisisStripElevated
    default:
      return styles.crisisStripNone
  }
}

/** Accessible emoji icon + label for the current crisis level. */
function CrisisIcon({ level }: { level: CrisisLevel }) {
  const map: Record<CrisisLevel, { icon: string; label: string }> = {
    none: { icon: '🟢', label: 'No crisis detected' },
    elevated: { icon: '🟡', label: 'Elevated defensiveness' },
    high: { icon: '🔴', label: 'High-risk pattern' },
    acute: { icon: '🚨', label: 'ACUTE — Immediate de-escalation required' },
  }
  const { icon, label } = map[level]
  return (
    <span className={styles.crisisIcon} aria-label={label} role='img'>
      {icon}
    </span>
  )
}

/** Maturity fill colour based on value thresholds. */
function maturityFillClass(maturity: number): string {
  if (maturity >= 0.71) return styles.maturityHigh
  if (maturity >= 0.43) return styles.maturityMid
  return styles.maturityLow
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ResistanceMonitorProps {
  /**
   * Full WebSocket URL for gestalt_update events.
   * Defaults to ws://localhost:8001/ws/gestalt.
   */
  wsUrl?: string
  /** Simulation session identifier passed to the server on connect. */
  sessionId: string
  /** Optional CSS class name for the root panel. */
  className?: string
  /**
   * Called whenever a new gestalt_update arrives so parent containers
   * can react to defense state changes (e.g. trigger adaptive prompts).
   */
  onGestaltUpdate?: (payload: GestaltUpdatePayload) => void
}

// ---------------------------------------------------------------------------
// ResistanceMonitor
// ---------------------------------------------------------------------------

export function ResistanceMonitor({
  wsUrl = 'ws://localhost:8001/ws/gestalt',
  sessionId,
  className,
  onGestaltUpdate,
}: ResistanceMonitorProps) {
  // Connection + live state from the WebSocket hook.
  const { connectionStatus, latestPayload, error, reconnectCount, reconnect } =
    useGestaltWebSocket({
      url: wsUrl,
      sessionId,
      onUpdate: onGestaltUpdate,
      reconnectDelayMs: 3_000,
      maxReconnectAttempts: 5,
    })

  // Timestamp of the most recent update (rendered as "last seen" label).
  const [lastUpdateTime, setLastUpdateTime] = useState<number | null>(null)

  useEffect(() => {
    if (latestPayload) setLastUpdateTime(Date.now())
  }, [latestPayload])

  // Keep formattedLastSeen ticking without causing re-renders on every tick.
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5_000)
    return () => clearInterval(id)
  }, [])

  const formattedLastSeen = useMemo(() => {
    if (!lastUpdateTime) return '—'
    const diff = Math.round((Date.now() - lastUpdateTime) / 1_000)
    if (diff < 5) return 'just now'
    if (diff < 60) return `${diff}s ago`
    return `${Math.round(diff / 60)}m ago`
  }, [lastUpdateTime, tick])

  // Human-readable status dot class.
  const dotClass = useCallback((status: typeof connectionStatus) => {
    switch (status) {
      case 'connected':
        return styles.statusDotConnected
      case 'connecting':
      case 'reconnecting':
        return styles.statusDotConnecting
      case 'error':
        return styles.statusDotError
      default:
        return styles.statusDotIdle
    }
  }, [])

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const payload = latestPayload

  const maturityPct =
    payload?.defense_maturity != null
      ? Math.round(payload.defense_maturity * 100)
      : null

  const renderStatusBar = () => (
    <div className={styles.statusBar}>
      <span className={styles.statusLabel}>
        <span
          className={`${styles.statusDot} ${dotClass(connectionStatus)}`}
          role='status'
          aria-label={connectionStatus}
        />
        Gestalt Engine
        {reconnectCount > 0 && (
          <span style={{ color: '#f59e0b' }}> (retry {reconnectCount}/5)</span>
        )}
      </span>

      <span style={{ color: '#64748b' }}>
        {lastUpdateTime ? `Updated ${formattedLastSeen}` : 'No data yet'}
      </span>

      <div className={styles.statusActions}>
        {(connectionStatus === 'disconnected' ||
          connectionStatus === 'error') && (
          <button
            className={styles.reconnectBtn}
            onClick={reconnect}
            type='button'
            aria-label='Reconnect to Gestalt Engine'
          >
            Reconnect
          </button>
        )}
      </div>
    </div>
  )

  const renderCrisisStrip = () => {
    const level: CrisisLevel = payload?.crisis_level ?? 'none'
    const labels: Record<CrisisLevel, string> = {
      none: 'No crisis signals detected',
      elevated: 'Elevated defensiveness — use reflective listening',
      high: 'High-risk pattern — slow pace and validate',
      acute: 'ACUTE DISTRESS — De-escalate immediately',
    }
    return (
      <div
        className={`${styles.crisisStrip} ${crisisStripClass(level)}`}
        role='alert'
        aria-live={level === 'acute' ? 'assertive' : 'polite'}
      >
        <CrisisIcon level={level} />
        <span>{labels[level]}</span>
      </div>
    )
  }

  const renderEmptyState = () => (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon} aria-hidden='true'>
        📡
      </span>
      <p className={styles.emptyText}>
        {connectionStatus === 'connecting' ||
        connectionStatus === 'reconnecting'
          ? 'Connecting to Gestalt Engine…'
          : error
            ? `Connection error: ${error}`
            : 'Awaiting first gestalt_update event.'}
      </p>
    </div>
  )

  const renderGaugeCell = () => (
    <DefenseGauge
      confidence={payload?.defense_confidence ?? 0}
      defenseName={payload?.defense_label_name ?? '—'}
    />
  )

  const renderMetrics = () => (
    <div className={styles.body}>
      {/* Defense label */}
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Defense Mechanism</span>
        <span className={styles.cellValue}>
          {payload?.defense_label_name ?? '—'}
        </span>
        <span className={styles.cellSubValue}>
          Label #{payload?.defense_label ?? '—'}
        </span>
      </div>

      {/* Dominant emotion */}
      <div className={styles.cell}>
        <span className={styles.cellLabel}>Dominant Emotion</span>
        <span
          className={styles.cellValue}
          style={{
            color:
              PLUTCHIK_COLORS[payload?.dominant_emotion ?? ''] ?? '#f1f5f9',
            textTransform: 'capitalize',
          }}
        >
          {payload?.dominant_emotion ?? '—'}
        </span>
        <span className={styles.cellSubValue}>
          Intensity{' '}
          {payload != null
            ? `${Math.round(payload.dominant_emotion_intensity * 100)}%`
            : '—'}
        </span>
      </div>
    </div>
  )

  const renderMaturityBar = () => (
    <div className={styles.maturityWrap}>
      <div className={styles.maturityHeader}>
        <span className={styles.cellLabel}>Defense Maturity</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8' }}>
          {maturityPct != null ? `${maturityPct}%` : 'N/A'}
        </span>
      </div>
      <div
        className={styles.maturityBarTrack}
        role='progressbar'
        aria-valuenow={maturityPct ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label='Defense maturity score'
      >
        <div
          className={`${styles.maturityBarFill} ${
            maturityPct != null
              ? maturityFillClass(maturityPct / 100)
              : styles.maturityLow
          }`}
          style={{ width: `${maturityPct ?? 0}%` }}
        />
      </div>
    </div>
  )

  const renderEmotionMosaic = () => {
    const scores = payload?.plutchik_scores ?? {}
    const dominant = payload?.dominant_emotion

    return (
      <div
        className={styles.emotionGrid}
        role='group'
        aria-label='Plutchik emotion scores'
      >
        {PLUTCHIK_ORDER.map((emotion) => {
          const score = scores[emotion] ?? 0
          const pct = Math.round(score * 100)
          const color = PLUTCHIK_COLORS[emotion] ?? '#6366f1'
          const isDominant = emotion === dominant

          return (
            <div
              key={emotion}
              className={styles.emotionChip}
              aria-selected={isDominant}
              title={`${emotion}: ${pct}%`}
            >
              <div className={styles.emotionBar}>
                <div
                  className={styles.emotionBarFill}
                  style={{
                    height: `${pct}%`,
                    background: color,
                    opacity: isDominant ? 1 : 0.6,
                  }}
                />
              </div>
              <span className={styles.emotionName}>{emotion}</span>
              <span className={styles.emotionScore}>{pct}%</span>
            </div>
          )
        })}
      </div>
    )
  }

  const renderPrediction = () => {
    const isAcute = payload?.crisis_level === 'acute'
    return (
      <div className={styles.predictionWrap}>
        <span className={styles.cellLabel}>Behavioral Prediction</span>
        <p
          className={`${styles.predictionText} ${
            isAcute ? styles.predictionTextAcute : ''
          }`}
        >
          {payload?.behavioral_prediction ??
            'Awaiting Gestalt Fusion Engine analysis…'}
        </p>
      </div>
    )
  }

  const renderBreakthrough = () => {
    const score = payload?.breakthrough_score ?? 0
    const pct = Math.round(score * 100)
    return (
      <div className={styles.breakthroughWrap}>
        <span className={styles.breakthroughLabel}>Breakthrough</span>
        <div
          className={`${styles.breakthroughBarTrack} ${
            score > 0.7 ? styles.breakthroughHigh : ''
          }`}
          role='progressbar'
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label='Breakthrough score'
        >
          <div
            className={`${styles.breakthroughBarFill} ${
              score > 0.7 ? styles.breakthroughHigh : ''
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className={styles.breakthroughScore}>{pct}%</span>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Root render
  // ---------------------------------------------------------------------------

  const isAcute = payload?.crisis_level === 'acute'
  const panelClass = [styles.panel, isAcute ? styles.panelAcute : '', className]
    .filter(Boolean)
    .join(' ')

  return (
    <section
      className={panelClass}
      aria-label='Resistance Monitor — Live Gestalt Defense State'
    >
      {renderStatusBar()}
      {renderCrisisStrip()}

      {payload == null ? (
        renderEmptyState()
      ) : (
        <>
          {renderGaugeCell()}
          {renderMetrics()}
          {renderMaturityBar()}
          {renderEmotionMosaic()}
          {renderPrediction()}
          {renderBreakthrough()}
        </>
      )}
    </section>
  )
}

export default ResistanceMonitor

interface BreakGlassIndicatorProps {
  active: boolean
  reason?: string
  timestamp?: string
}

function formatTimestamp(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleString()
  } catch {
    return timestamp
  }
}

export function BreakGlassIndicator({
  active,
  reason,
  timestamp,
}: BreakGlassIndicatorProps) {
  if (!active) {
    return null
  }

  const tooltipParts: string[] = []
  if (reason) {
    tooltipParts.push(`Reason: ${reason}`)
  }
  if (timestamp) {
    tooltipParts.push(`Activated: ${formatTimestamp(timestamp)}`)
  }
  const tooltipText = tooltipParts.join(' — ')

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="break-glass-indicator"
      title={tooltipText || undefined}
      className="inline-flex items-center gap-2 rounded-full bg-red-100 border border-red-300 px-3 py-1 min-h-[44px] flex-wrap"
    >
      <span
        className="relative flex h-3 w-3 shrink-0"
        aria-hidden="true"
      >
        <span
          className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"
          style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
        />
        <span
          className="relative inline-flex h-3 w-3 rounded-full bg-red-500"
        />
      </span>
      <span className="text-xs font-semibold text-red-700 uppercase tracking-wide break-words">
        Break-Glass Access Active
      </span>
      {reason && (
        <span className="text-xs text-red-600 sr-only">
          {tooltipText}
        </span>
      )}
    </div>
  )
}

import pc from 'picocolors'

/**
 * Smart formatter that detects response shape and renders accordingly.
 *
 * Shape detection (in priority order):
 * 1. Review findings → grouped by severity (🔴 high, 🟡 medium, 🟢 low)
 * 2. Scores → bar chart / sparkline
 * 3. Health checks → ✅/❌ table
 * 4. Async task → queued message
 * 5. Lists of objects → numbered with key fields
 * 6. Errors → clear message + remediation hint
 * 7. Fallback → indented key-value
 */

export interface FormatOptions {
  /** Compact mode: single-line summary. */
  compact?: boolean
  /** Disable color output. */
  noColor?: boolean
}

const SEVERITY_ICONS: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
  critical: '🔴',
  warning: '🟡',
  info: '🟢',
}

const SEVERITY_RANK: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  warning: 2,
  low: 3,
  info: 4,
}

interface Finding {
  severity: string
  message: string
  path?: string
}

interface ScoreData {
  score?: number
  avg_score?: number
  dimensions?: Record<string, number>
  notes?: string
}

interface HealthCheck {
  name: string
  ok: boolean
  detail?: string
}

interface HealthData {
  status?: string
  checks: HealthCheck[]
}

interface TaskData {
  task_id: string
  status?: string
}

interface ErrorData {
  error?: string
  hint?: string
  available?: string[]
}

/**
 * Format an agent response based on its shape.
 */
export function formatAgentResponse(data: unknown, opts: FormatOptions = {}): string {
  if (opts.compact) {
    return formatCompact(data)
  }

  // Detect response shape and narrow type
  const findings = asReviewFindings(data)
  if (findings) {
    return formatReviewFindings(findings)
  }

  const score = asScoreResponse(data)
  if (score) {
    return formatScoreResponse(score)
  }

  const health = asHealthCheckResponse(data)
  if (health) {
    return formatHealthCheckResponse(health)
  }

  const task = asAsyncTaskResponse(data)
  if (task) {
    return formatAsyncTask(task)
  }

  const err = asErrorResponse(data)
  if (err) {
    return formatErrorResponse(err)
  }

  const list = asListOfObjects(data)
  if (list) {
    return formatListOfObjects(list)
  }

  // Fallback: structured key-value
  return formatDataInner(data, 0)
}

// ── Shape detectors (type guards) ────────────────────

function asReviewFindings(data: unknown): Finding[] | null {
  if (!Array.isArray(data) || data.length === 0) return null
  const result: Finding[] = []
  for (const item of data) {
    if (typeof item !== 'object' || item === null) return null
    const obj = item as Record<string, unknown>
    if (typeof obj['severity'] !== 'string' || typeof obj['message'] !== 'string') return null
    result.push({
      severity: obj['severity'],
      message: obj['message'],
      path: typeof obj['path'] === 'string' ? obj['path'] : undefined,
    })
  }
  return result
}

function asScoreResponse(data: unknown): ScoreData | null {
  if (typeof data !== 'object' || data === null) return null
  const obj = data as Record<string, unknown>
  if (!('score' in obj) && !('avg_score' in obj) && !('dimensions' in obj)) return null
  if ('findings' in obj) return null

  const result: ScoreData = {}
  if (typeof obj['score'] === 'number') result.score = obj['score']
  if (typeof obj['avg_score'] === 'number') result.avg_score = obj['avg_score']
  if (typeof obj['notes'] === 'string') result.notes = obj['notes']
  if (typeof obj['dimensions'] === 'object' && obj['dimensions'] !== null) {
    const dims: Record<string, number> = {}
    for (const [k, v] of Object.entries(obj['dimensions'] as Record<string, unknown>)) {
      if (typeof v === 'number') dims[k] = v
    }
    result.dimensions = dims
  }
  return result
}

function asHealthCheckResponse(data: unknown): HealthData | null {
  if (typeof data !== 'object' || data === null) return null
  const obj = data as Record<string, unknown>
  if (!Array.isArray(obj['checks'])) return null

  const checks: HealthCheck[] = []
  for (const item of obj['checks']) {
    if (typeof item !== 'object' || item === null) return null
    const c = item as Record<string, unknown>
    if (typeof c['ok'] !== 'boolean') return null
    checks.push({
      name: typeof c['name'] === 'string' ? c['name'] : 'unknown',
      ok: c['ok'],
      detail: typeof c['detail'] === 'string' ? c['detail'] : undefined,
    })
  }

  return {
    status: typeof obj['status'] === 'string' ? obj['status'] : undefined,
    checks,
  }
}

function asAsyncTaskResponse(data: unknown): TaskData | null {
  if (typeof data !== 'object' || data === null) return null
  const obj = data as Record<string, unknown>
  if (typeof obj['task_id'] !== 'string') return null
  // Only treat as async task if status indicates queuing — not a completed sync response
  // that happens to include a task_id field.
  const status = obj['status']
  if (status === 'ok' || status === 'complete' || status === 'completed' || status === 'success') {
    return null
  }
  if (typeof status === 'string') {
    return {
      task_id: obj['task_id'],
      status,
    }
  }
  // No status field at all — treat as async task
  if (status === undefined) {
    return {
      task_id: obj['task_id'],
      status: undefined,
    }
  }
  return null
}

function asErrorResponse(data: unknown): ErrorData | null {
  if (typeof data !== 'object' || data === null) return null
  const obj = data as Record<string, unknown>
  if (!('error' in obj) && !('available' in obj)) {
    if (!('ok' in obj && obj['ok'] === false)) return null
  }
  return {
    error: typeof obj['error'] === 'string' ? obj['error'] : undefined,
    hint: typeof obj['hint'] === 'string' ? obj['hint'] : undefined,
    available: Array.isArray(obj['available'])
      ? (obj['available'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : undefined,
  }
}

function asListOfObjects(data: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(data) || data.length === 0) return null
  // Only treat as list of objects if items are objects AND not findings (no severity field)
  const result: Record<string, unknown>[] = []
  for (const item of data) {
    if (typeof item !== 'object' || item === null) return null
    const obj = item as Record<string, unknown>
    if ('severity' in obj && 'message' in obj) return null // findings handled separately
    result.push(obj)
  }
  return result
}

// ── Formatters ───────────────────────────────────────

function formatReviewFindings(data: Finding[]): string {
  const lines: string[] = []
  lines.push(pc.bold('Findings:'))

  // Group by severity
  const grouped = new Map<string, Finding[]>()
  for (const f of data) {
    const sev = f.severity.toLowerCase()
    if (!grouped.has(sev)) grouped.set(sev, [])
    grouped.get(sev)!.push(f)
  }

  // Sort severities by rank (most severe first)
  const sortedSeverities = [...grouped.keys()].sort(
    (a, b) => (SEVERITY_RANK[a] ?? 99) - (SEVERITY_RANK[b] ?? 99),
  )

  for (const sev of sortedSeverities) {
    const findings = grouped.get(sev)!
    const icon = SEVERITY_ICONS[sev] ?? '⚪'
    for (const f of findings) {
      const pathStr = f.path ? pc.gray(` (${f.path})`) : ''
      lines.push(`  ${icon} ${f.message}${pathStr}`)
    }
  }

  lines.push('')
  lines.push(`  ${data.length} finding(s) — ${grouped.size} severity level(s)`)
  return lines.join('\n')
}

function formatScoreResponse(data: ScoreData): string {
  const lines: string[] = []
  lines.push(pc.bold('Score:'))

  if (data.score !== undefined) {
    lines.push(renderBar(data.score, 5))
  }

  if (data.avg_score !== undefined) {
    lines.push(`  average: ${renderBar(data.avg_score, 5)}`)
  }

  if (data.dimensions && Object.keys(data.dimensions).length > 0) {
    lines.push('')
    lines.push('  Dimensions:')
    for (const [key, val] of Object.entries(data.dimensions)) {
      lines.push(`    ${key.padEnd(16)} ${renderBar(val, 5)}`)
    }
  }

  if (data.notes) {
    lines.push('')
    lines.push(`  ${pc.gray(data.notes)}`)
  }

  return lines.join('\n')
}

function formatHealthCheckResponse(data: HealthData): string {
  const lines: string[] = []
  const overallOk = data.checks.every((c) => c.ok)
  const icon = overallOk ? pc.green('✓') : pc.red('✗')
  lines.push(pc.bold(`Health: ${icon} ${data.status ?? (overallOk ? 'healthy' : 'degraded')}`))
  lines.push('')

  for (const check of data.checks) {
    const checkIcon = check.ok ? pc.green('✓') : pc.red('✗')
    const detail = check.detail ? pc.gray(` — ${check.detail}`) : ''
    lines.push(`  ${checkIcon} ${check.name}${detail}`)
  }

  return lines.join('\n')
}

function formatAsyncTask(data: TaskData): string {
  return [
    pc.bold('Task queued:'),
    `  id:     ${data.task_id}`,
    `  status: ${data.status ?? 'unknown'}`,
  ].join('\n')
}

function formatErrorResponse(data: ErrorData): string {
  const lines: string[] = []
  lines.push(pc.red(pc.bold('Error:')))
  lines.push(`  ${data.error ?? 'unknown error'}`)

  if (data.hint) {
    lines.push('')
    lines.push(pc.gray(`  hint: ${data.hint}`))
  }

  if (data.available && data.available.length > 0) {
    lines.push('')
    lines.push('  Available:')
    for (const item of data.available) {
      lines.push(`    - ${item}`)
    }
  }

  return lines.join('\n')
}

function formatListOfObjects(data: Record<string, unknown>[]): string {
  const lines: string[] = []
  lines.push(pc.bold(`Results (${data.length}):`))
  lines.push('')

  data.forEach((item, idx) => {
    lines.push(`  ${idx + 1}. ${formatObjectBrief(item)}`)
  })

  return lines.join('\n')
}

function formatCompact(data: unknown): string {
  if (data === null || data === undefined) return '(empty)'
  if (typeof data === 'string') return data
  if (typeof data === 'number' || typeof data === 'boolean') return String(data ?? 'unknown')

  if (Array.isArray(data)) {
    return `${data.length} item(s)`
  }

  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length === 0) return '(empty)'

    const parts: string[] = []
    if ('status' in obj) parts.push(`status=${obj['status']}`)
    if ('score' in obj) parts.push(`score=${obj['score']}`)
    if ('risk' in obj) parts.push(`risk=${obj['risk']}`)
    if ('task_id' in obj) parts.push(`task=${(obj['task_id'] as string).slice(0, 8)}...`)
    if ('error' in obj) parts.push(`error="${obj['error']}"`)
    if (parts.length === 0) parts.push(`${keys.length} field(s)`)
    return parts.join('  ')
  }

  return String(data ?? 'unknown')
}

// ── Helpers ──────────────────────────────────────────

function renderBar(value: number, max: number, width: number = 10): string {
  const clamped = Math.max(0, Math.min(value, max))
  const filled = Math.round((clamped / max) * width)
  const empty = width - filled

  const bar = '█'.repeat(filled) + '░'.repeat(empty)
  const label = `${value}/${max}`

  const ratio = clamped / max
  let coloredBar: string
  if (ratio >= 0.7) {
    coloredBar = pc.green(bar)
  } else if (ratio >= 0.4) {
    coloredBar = pc.yellow(bar)
  } else {
    coloredBar = pc.red(bar)
  }

  return `${coloredBar}  ${label}`
}

function formatObjectBrief(obj: Record<string, unknown>): string {
  const parts: string[] = []
  const priority = ['name', 'id', 'score', 'status', 'trainee', 'session_id', 'reason', 'type']
  for (const key of priority) {
    if (key in obj && obj[key] !== undefined) {
      parts.push(`${key}=${obj[key]}`)
    }
  }

  if (parts.length === 0) {
    const keys = Object.keys(obj).slice(0, 3)
    for (const key of keys) {
      parts.push(`${key}=${obj[key]}`)
    }
  }

  return parts.join('  ')
}

function formatDataInner(data: unknown, indent: number): string {
  const pad = '  '.repeat(indent)
  if (data === null) return `${pad}null`
  if (typeof data === 'string') return `${pad}${data}`
  if (typeof data === 'number') return `${pad}${String(data)}`
  if (typeof data === 'boolean') return `${pad}${String(data)}`
  if (Array.isArray(data)) {
    if (data.length === 0) return `${pad}[]`
    return data.map((item) => formatDataInner(item, indent)).join('\n')
  }
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length === 0) return `${pad}{}`
    return keys
      .map((key) => {
        const val = obj[key]
        if (val === null) return `${pad}${key}: null`
        if (typeof val === 'string') return `${pad}${key}: ${val}`
        if (typeof val === 'number') return `${pad}${key}: ${String(val)}`
        if (typeof val === 'boolean') return `${pad}${key}: ${String(val)}`
        return `${pad}${key}:\n${formatDataInner(val, indent + 1)}`
      })
      .join('\n')
  }
  return `${pad}${String(data)}`
}

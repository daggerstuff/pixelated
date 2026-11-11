/**
 * Pilot excluded-surface gate. Enabled by `PILOT_EXCLUDED_SURFACE=1`; unset or
 * any other value leaves it inert. Measurement and scope:
 * planning/pilot-readiness-2026-11-04/evidence/l09-excluded-tools-release.md
 */

export const EXCLUDED_SURFACE_PREFIXES = [
  '/api/ehr',
  '/api/portal',
  '/api/fhir',
  '/portal',
] as const

export const EXCLUDED_SURFACE_FLAG = 'PILOT_EXCLUDED_SURFACE'

export interface ExcludedApiRefusal {
  status: number
  headers: Record<string, string>
  body: string
}

export interface FlagSources {
  processEnv?: Record<string, string | undefined> | undefined
  buildEnv?: Record<string, unknown> | undefined
  runtimeEnv?: Record<string, unknown> | undefined
}

export function normalizePathname(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, '/')
  const trimmed = collapsed.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export function isExcludedSurface(pathname: string): boolean {
  const normalized = normalizePathname(pathname)
  return EXCLUDED_SURFACE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  )
}

export function isExcludedSurfaceEnabled(flag: unknown): boolean {
  if (typeof flag !== 'string') {
    return false
  }
  const value = flag.trim().toLowerCase()
  return value === '1' || value === 'true'
}

export function resolveExcludedSurfaceFlag(sources: FlagSources): boolean {
  const candidates = [
    sources.processEnv?.[EXCLUDED_SURFACE_FLAG],
    sources.buildEnv?.[EXCLUDED_SURFACE_FLAG],
    sources.runtimeEnv?.[EXCLUDED_SURFACE_FLAG],
  ]
  return candidates.some((candidate) => isExcludedSurfaceEnabled(candidate))
}

export function readRuntimeEnv(
  locals: unknown,
): Record<string, unknown> | undefined {
  if (!locals || typeof locals !== 'object') {
    return undefined
  }
  try {
    const runtime = (locals as { runtime?: { env?: Record<string, unknown> } })
      .runtime
    const env = runtime?.env
    return env && typeof env === 'object' ? env : undefined
  } catch {
    return undefined
  }
}

export function excludedApiRefusal(
  pathname: string,
): ExcludedApiRefusal | null {
  const normalized = normalizePathname(pathname)
  if (!normalized.startsWith('/api/') || !isExcludedSurface(normalized)) {
    return null
  }
  return {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'not_found',
      message: 'This surface is excluded from the pilot release.',
    }),
  }
}

import type { APIRoute } from 'astro'

import { Sentry } from '../../../../../../config/instrument.mjs'

type ProbeMode = 'message' | 'error'

const resolveSentryDsn = () =>
  process.env['SENTRY_DSN'] ??
  process.env['PUBLIC_SENTRY_DSN'] ??
  process.env['SENTRY_PUBLIC_DSN'] ??
  process.env['VITE_SENTRY_DSN']

const resolveSentryRelease = () =>
  process.env['SENTRY_RELEASE'] ??
  process.env['PUBLIC_SENTRY_RELEASE'] ??
  process.env['PUBLIC_APP_VERSION'] ??
  process.env['VERCEL_GIT_COMMIT_SHA'] ??
  process.env['RENDER_GIT_COMMIT'] ??
  process.env['NETLIFY_COMMIT_REF'] ??
  process.env['RAILWAY_GIT_COMMIT_SHA'] ??
  process.env['GITHUB_SHA'] ??
  process.env['CI_COMMIT_SHA'] ??
  process.env['npm_package_version']

// On Cloudflare Workers process.env['NODE_ENV'] may be unset, so also rely
// on Astro's build-time PROD flag to detect production.
// Guard import.meta.env access: it can be undefined in some SSR/preview runtimes.
const isProductionRuntime = () =>
  import.meta.env?.PROD === true || process.env['NODE_ENV'] === 'production'

// Treat empty or whitespace-only values as absent so fallbacks still apply.
const nonEmpty = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

const hasValidProbeToken = (request: Request) => {
  const requiredToken =
    nonEmpty(process.env['SENTRY_DIAGNOSTIC_TOKEN']) ??
    nonEmpty(process.env['SENTRY_TEST_TOKEN'])

  if (!isProductionRuntime()) {
    // Outside production the probe is open unless a token is configured.
    if (!requiredToken) {
      return true
    }
  } else if (!requiredToken) {
    // Fail closed: never expose the probe in production without a token.
    return false
  }

  const providedToken =
    nonEmpty(request.headers.get('x-sentry-probe-token')) ??
    nonEmpty(request.headers.get('authorization')?.replace(/^Bearer\s+/i, ''))

  return Boolean(providedToken) && providedToken === requiredToken
}

const redactDsn = (dsn?: string): string | null =>
  dsn ? `${dsn.slice(0, 10)}...${dsn.slice(-8)}` : null

const emitProbeEvent = (mode: ProbeMode, message: string) => {
  let eventId: unknown
  Sentry.withScope((scope: any) => {
    // Mark probe events so they group separately and can be excluded from
    // alerting on real application errors.
    scope?.setTag?.('probe', 'true')
    scope?.setTag?.('probe.mode', mode)
    scope?.setFingerprint?.(['sentry-probe', mode])
    scope?.setExtra?.('probe.release', resolveSentryRelease() ?? null)
    eventId =
      mode === 'error'
        ? Sentry.captureException(new Error(message))
        : // Diagnostic health check, not an application failure.
          Sentry.captureMessage(message, 'info')
  })

  return typeof eventId === 'string' ? eventId : undefined
}

const readProbeBody = async (
  request: Request,
): Promise<Record<string, unknown>> => {
  if (!request.body) {
    return {}
  }
  const text = await request.text()
  if (!text) {
    return {}
  }
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>
    }
  } catch {
    return { raw: text }
  }
  return {}
}

const runProbe = async (request: Request): Promise<Response> => {
  if (!hasValidProbeToken(request)) {
    return new Response(
      JSON.stringify({
        status: 'forbidden',
        message: 'Missing or invalid Sentry probe token.',
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  const dsn = resolveSentryDsn()
  if (!dsn) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Sentry DSN is not configured.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }

  const body = await readProbeBody(request)
  const url = new URL(request.url)
  const mode = (body['mode'] as ProbeMode) || url.searchParams.get('mode')
  const eventMessage =
    ((body['message'] as string) || url.searchParams.get('message')) ??
    'Sentry server probe event'

  const eventId = emitProbeEvent(
    mode === 'error' ? 'error' : 'message',
    eventMessage,
  )

  return new Response(
    JSON.stringify({
      status: 'ok',
      mode: mode === 'error' ? 'error' : 'message',
      eventId,
      dsn: redactDsn(dsn),
      release: resolveSentryRelease() ?? null,
      nodeEnv: process.env['NODE_ENV'] ?? 'unknown',
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    },
  )
}

export const GET: APIRoute = async ({ request }) => runProbe(request)
export const POST: APIRoute = async ({ request }) => runProbe(request)

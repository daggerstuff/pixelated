import type { APIRoute } from 'astro'

import { OpenAITrainingBackend } from '../../../../lib/ai/training/backends/OpenAITrainingBackend'
import { getDefaultJobStore } from '../../../../lib/ai/training/job-store'
import type { JobStore } from '../../../../lib/ai/training/job-store'
import type {
  FineTuningJob,
  FineTuningStatus,
} from '../../../../lib/ai/training/types'
import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'

const trainingLogger = createBuildSafeLogger('training-webhook')

/**
 * Async webhook receiver for fine-tuning job status updates. Currently
 * accepts only OpenAI's `fine_tuning.job.*` events but the registry pattern
 * makes adding HuggingFace / Local easy when their webhook contracts land.
 *
 * Auth: webhook signature verification via the OpenAI webhook secret. No
 * session/JWT — OpenAI will never carry a pixelated JWT. In a future where
 * internal routes want to call this for testing, a `?secret=` query param is
 * NOT supported (intentionally — never put a secret in a URL).
 *
 * Persistence: status updates are written back to the active JobStore,
 * via `getDefaultJobStore()` unless one has been registered on the orchestrator.
 */
export const POST: APIRoute = async ({ request }) => {
  if (!request) {
    return new Response(JSON.stringify({ error: 'Missing request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Read raw body once — needed for signature verification.
  const rawBody = await request.text()
  const signature = request.headers.get('webhook-signature')
  const eventType = request.headers.get('webhook-event') ?? 'unknown'

  // Webhook secret arrives via env (PIX-3932 acceptance criterion).
  const secret = process.env['OPENAI_FT_WEBHOOK_SECRET']
  if (!secret) {
    trainingLogger.error(
      'OPENAI_FT_WEBHOOK_SECRET not configured; rejecting inbound webhook',
    )
    return new Response(JSON.stringify({ error: 'webhook not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const verifier = new OpenAITrainingBackend({
    apiKey: 'webhook-verifier',
    webhookSecret: secret,
  })
  if (!verifier.verifyWebhookSignature(rawBody, signature)) {
    trainingLogger.warn('Webhook signature verification failed', { eventType })
    return new Response(JSON.stringify({ error: 'invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let payload: WebhookPayload
  try {
    payload = JSON.parse(rawBody) as WebhookPayload
  } catch {
    return new Response(JSON.stringify({ error: 'invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const store = getDefaultJobStore()
  const remoteId = payload.data?.id ?? payload.id
  const freshStatus = statusFromOpenAI(payload)
  const patch = {
    ...(payload.data?.model ? { model: payload.data.model } : {}),
    ...(payload.data?.fine_tuned_model
      ? { fineTunedModel: payload.data.fine_tuned_model }
      : {}),
    ...(payload.data?.error?.message
      ? { error: payload.data.error.message }
      : {}),
  }

  const updated = await reconcileStatus(store, remoteId, freshStatus, patch)
  const status = updated?.status ?? freshStatus

  if (!updated) {
    trainingLogger.warn('Webhook for unknown job', { id: remoteId })
    return new Response(JSON.stringify({ accepted: true, known: false }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  trainingLogger.info('Webhook applied', { id: remoteId, status })
  return new Response(JSON.stringify({ accepted: true, status }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Minimal shape of the OpenAI Standard Webhooks payload. */
interface WebhookPayload {
  /** Top-level id is always the fine-tuning job id (OpenAI's remote id). */
  id: string
  /**
   * Event type string, e.g. `fine_tuning.job.succeeded`, `fine_tuning.job.failed`.
   * This is the canonical status source for Standard Webhooks.
   */
  event: string
  /** Container for the job data — all job fields live here. */
  data: {
    id: string
    status?: string
    model?: string
    fine_tuned_model?: string
    error?: { message?: string }
  }
  /** ISO-8601 timestamp of the event. */
  create_time?: string
}

function statusFromOpenAI(event: WebhookPayload): FineTuningStatus | null {
  const t = event.event ?? ''
  if (t.endsWith('.succeeded')) return 'succeeded'
  if (t.endsWith('.failed')) return 'failed'
  if (t.endsWith('.cancelled') || t.endsWith('.canceled')) return 'cancelled'
  if (t.endsWith('.running')) return 'running'
  if (t.endsWith('.queued') || t.endsWith('.validating_files')) return 'queued'
  // OpenAI added a new status we don't know — return null to preserve existing state
  return null
}

/** Fetch the current status from store so unknown events don't regress state. */
async function reconcileStatus(
  store: JobStore,
  remoteId: string,
  fresh: FineTuningStatus | null,
  patch: Partial<FineTuningJob>,
): Promise<FineTuningJob | null> {
  const existing = await store.getByRemoteId(remoteId)
  if (!existing) return null

  // If we couldn't determine the status from the event, preserve existing status
  const statusToUse = fresh ?? existing.status

  // If we have a fresh status and it's running but existing is already terminal,
  // preserve the known terminal state to prevent regression
  const isTerminal = (status: FineTuningStatus) =>
    status === 'succeeded' || status === 'failed' || status === 'cancelled'

  if (fresh === 'running' && isTerminal(existing.status)) {
    return store.updateStatus(existing.id, existing.status, {
      ...patch,
      updatedAt: new Date(),
    })
  }

  // Otherwise, update with the fresh status and apply the patch
  return store.updateStatus(existing.id, statusToUse, {
    ...patch,
    updatedAt: new Date(),
  })
}

import type { APIRoute } from 'astro'

import { createBuildSafeLogger } from '../../../../lib/logging/build-safe-logger'
import { OpenAITrainingBackend } from '../../../../lib/ai/training/backends/OpenAITrainingBackend'
import { getDefaultJobStore } from '../../../../lib/ai/training/job-store'
import type { FineTuningStatus } from '../../../../lib/ai/training/types'

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
    return new Response(
      JSON.stringify({ error: 'webhook not configured' }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      },
    )
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
  const updated = await store.updateStatus(
    payload.id,
    statusFromOpenAI(payload.status),
    {
      remoteId: payload.id,
      model: payload.model,
      fineTunedModel: payload.fine_tuned_model,
      error: payload.error?.message,
    },
  )

  if (!updated) {
    trainingLogger.warn('Webhook for unknown job', { id: payload.id })
    // 202 to avoid OpenAI retries — we don't want to surface unknown-job
    // 4xx back to the backend.
    return new Response(JSON.stringify({ accepted: true, known: false }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  trainingLogger.info('Webhook applied', {
    id: payload.id,
    status: payload.status,
  })
  return new Response(JSON.stringify({ accepted: true, status: updated.status }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Minimal shape of the OpenAI fine-tuning webhook payload. */
interface WebhookPayload {
  id: string;
  status?: string;
  model?: string;
  fine_tuned_model?: string;
  error?: { message?: string };
}

function statusFromOpenAI(rawStatus: string | undefined): FineTuningStatus {
  switch (rawStatus) {
    case 'validating_files':
    case 'queued':
      return 'queued'
    case 'running':
      return 'running'
    case 'succeeded':
      return 'succeeded'
    case 'failed':
      return 'failed'
    case 'cancelled':
    case 'canceled':
      return 'cancelled'
    case undefined:
      // No status field in payload — fall through with running as sentinel.
      return 'running'
    default:
      // Unknown / unrecognised status — keep current state but persist.
      return 'running'
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MonitoringService } from '../service'
import type { MonitoringConfig } from '../config'

type AlertService = {
  triggerAlert: (
    type: string,
    data: { message: string; error?: unknown; level: 'error' | 'warning' },
  ) => Promise<void>
  config: MonitoringConfig
}

const webhookUrl = 'https://hooks.example.com/services/test'

function asAlertService(service: MonitoringService): AlertService {
  return service as unknown as AlertService
}

describe('MonitoringService Slack webhook retry', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn())
    const service = asAlertService(MonitoringService.getInstance())
    service.config = {
      ...service.config,
      alerts: { enableAlerts: true, slackWebhookUrl: webhookUrl },
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  const runWithBackoff = async (run: () => Promise<void>) => {
    const task = run()
    // flush interval not involved; cover retry backoff (1s + 2s) with margin
    for (let i = 0; i < 6; i++) {
      await vi.advanceTimersByTimeAsync(2_000)
    }
    await task
  }

  it('retries transient webhook failures and delivers the alert', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock
      .mockRejectedValueOnce(new Error('network unreachable'))
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockResolvedValue(new Response('ok', { status: 200 }))

    const service = asAlertService(MonitoringService.getInstance())

    await runWithBackoff(() =>
      service.triggerAlert('error', { message: 'test alert', level: 'error' }),
    )

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(webhookUrl)
  })

  it('logs and continues when retries exhaust — no unhandled rejection', async () => {
    const fetchMock = vi.mocked(globalThis.fetch)
    fetchMock.mockRejectedValue(new Error('webhook down'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const service = asAlertService(MonitoringService.getInstance())

    await expect(
      runWithBackoff(() =>
        service.triggerAlert('performance', {
          message: 'slow load',
          level: 'warning',
        }),
      ),
    ).resolves.toBeUndefined()

    // 3 attempts, failure logged, caller unaffected
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(errorSpy).toHaveBeenCalled()
  })
})

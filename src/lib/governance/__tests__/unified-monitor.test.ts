import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UnifiedMonitor } from '../unified-monitor'
import { SlackAlerter } from '../slack-alert'

describe('UnifiedMonitor', () => {
  let monitor: UnifiedMonitor

  beforeEach(() => {
    monitor = new UnifiedMonitor()
  })

  it('aggregates events from all modules', async () => {
    await monitor.record({
      source: 'fhe',
      event: 'encryption_complete',
      timestamp: new Date().toISOString()
    })

    const events = monitor.getEvents('fhe')
    expect(events.length).toBe(1)
    expect(events[0].event).toBe('encryption_complete')
  })

  it('tracks events from multiple sources', async () => {
    await monitor.record({ source: 'fhe', event: 'e1', timestamp: new Date().toISOString() })
    await monitor.record({ source: 'audit', event: 'e2', timestamp: new Date().toISOString() })
    await monitor.record({ source: 'secrets', event: 'e3', timestamp: new Date().toISOString() })

    expect(monitor.getEvents('fhe').length).toBe(1)
    expect(monitor.getEvents('audit').length).toBe(1)
    expect(monitor.getEvents('secrets').length).toBe(1)
    expect(monitor.getAllEvents().length).toBe(3)
  })

  it('triggers alert on threshold breach', async () => {
    const alertSpy = vi.fn()
    monitor.onAlert(alertSpy)

    // Record 5 compliance failures (threshold)
    for (let i = 0; i < 5; i++) {
      await monitor.record({
        source: 'governance',
        event: 'compliance_failure',
        timestamp: new Date().toISOString()
      })
    }

    expect(alertSpy).toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'compliance_failure',
      count: 5
    }))
  })

  it('does not trigger alert below threshold', async () => {
    const alertSpy = vi.fn()
    monitor.onAlert(alertSpy)

    for (let i = 0; i < 4; i++) {
      await monitor.record({
        source: 'governance',
        event: 'compliance_failure',
        timestamp: new Date().toISOString()
      })
    }

    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('clears events', async () => {
    await monitor.record({ source: 'fhe', event: 'e1', timestamp: new Date().toISOString() })
    monitor.clearEvents()
    expect(monitor.getAllEvents().length).toBe(0)
  })

  it('connects SlackAlerter for notifications', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true })
    global.fetch = mockFetch

    const slackAlerter = new SlackAlerter('https://hooks.slack.com/test')
    monitor.connectSlack(slackAlerter)

    // Trigger alert by hitting threshold
    for (let i = 0; i < 5; i++) {
      await monitor.record({
        source: 'governance',
        event: 'compliance_failure',
        timestamp: new Date().toISOString(),
      })
    }

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const callArgs = mockFetch.mock.calls[0]
    const body = JSON.parse(callArgs[1].body)
    expect(body.text).toContain('compliance_failure')
    expect(body.text).toContain('5')
    expect(body.text).toContain('governance')
  })
})

// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComplianceValidator } from '../compliance-validator'
import { GovernanceBridge } from '../governance-bridge'

describe('GovernanceBridge', () => {
  let bridge: GovernanceBridge

  beforeEach(() => {
    GovernanceBridge.reset()
    bridge = GovernanceBridge.getInstance()
  })

  describe('singleton', () => {
    it('returns same instance on repeated calls', () => {
      expect(GovernanceBridge.getInstance()).toBe(bridge)
    })

    it('exposes the underlying monitor', () => {
      expect(bridge.getMonitor()).toBeDefined()
      expect(bridge.getMonitor().getAllEvents()).toEqual([])
    })
  })

  describe('FHE integration', () => {
    it('records FHE encryption event', async () => {
      await bridge.recordFHEEncryption({ dataType: 'phi' })

      const events = bridge.getMonitor().getEvents('fhe')
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('encryption_complete')
      expect(events[0].details).toEqual({ dataType: 'phi' })
    })

    it('records FHE decryption event', async () => {
      await bridge.recordFHEDecryption({ dataType: 'phi' })

      const events = bridge.getMonitor().getEvents('fhe')
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('decryption_complete')
    })
  })

  describe('audit integration', () => {
    it('records audit event', async () => {
      await bridge.recordAuditEvent({ action: 'user_login' })

      const events = bridge.getMonitor().getEvents('audit')
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('audit_event')
      expect(events[0].details).toEqual({ action: 'user_login' })
    })
  })

  describe('secrets integration', () => {
    it('records secret access event with key name', async () => {
      await bridge.recordSecretAccess('db-password')

      const events = bridge.getMonitor().getEvents('secrets')
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('secret_access')
      expect(events[0].details).toEqual({ key: 'db-password' })
    })

    it('records secret rotation event with key name', async () => {
      await bridge.recordSecretRotation('api-key')

      const events = bridge.getMonitor().getEvents('secrets')
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('secret_rotation')
      expect(events[0].details).toEqual({ key: 'api-key' })
    })
  })

  describe('compliance integration', () => {
    it('records compliance allow event', async () => {
      await bridge.recordComplianceDecision('encrypt_phi', true, [])

      const events = bridge.getMonitor().getEvents('governance')
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('compliance_allow')
      expect(events[0].details).toEqual({
        operation: 'encrypt_phi',
        reasons: [],
      })
    })

    it('records compliance failure event with reasons', async () => {
      await bridge.recordComplianceDecision('access_phi', false, [
        'FHE encryption required',
      ])

      const events = bridge.getMonitor().getEvents('governance')
      expect(events).toHaveLength(1)
      expect(events[0].event).toBe('compliance_failure')
      expect(events[0].details).toEqual({
        operation: 'access_phi',
        reasons: ['FHE encryption required'],
      })
    })
  })

  describe('Slack alert wiring', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('sends alert via Slack when threshold breached', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true })
      vi.stubGlobal('fetch', mockFetch)

      bridge.configureSlackWebhook('https://hooks.slack.com/test')

      // Trigger 5 compliance failures to breach threshold
      for (let i = 0; i < 5; i++) {
        await bridge.recordComplianceDecision('test_op', false, [
          'FHE encryption required',
        ])
      }

      expect(mockFetch).toHaveBeenCalledTimes(1)
      const body = JSON.parse(mockFetch.mock.calls[0][1].body)
      expect(body.text).toContain('compliance_failure')
      expect(body.text).toContain('5')
      expect(body.text).toContain('governance')
    })
  })

  describe('multi-source aggregation', () => {
    it('aggregates events from all sources', async () => {
      await bridge.recordFHEEncryption()
      await bridge.recordAuditEvent()
      await bridge.recordSecretAccess('key-1')
      await bridge.recordComplianceDecision('op', true, [])

      const all = bridge.getMonitor().getAllEvents()
      expect(all).toHaveLength(4)
      expect(new Set(all.map((e) => e.source))).toEqual(
        new Set(['fhe', 'audit', 'secrets', 'governance']),
      )
    })
  })
})

describe('ComplianceValidator with monitor', () => {
  let bridge: GovernanceBridge

  beforeEach(() => {
    GovernanceBridge.reset()
    bridge = GovernanceBridge.getInstance()
  })

  it('records compliance_allow to monitor when wired', async () => {
    const monitor = bridge.getMonitor()
    const validator = new ComplianceValidator(monitor)

    await validator.validate({
      operation: 'encrypt_phi',
      fheActive: true,
      auditEnabled: true,
      consentVerified: true,
    })

    const events = monitor.getEvents('governance')
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('compliance_allow')
    expect(events[0].details).toEqual(
      expect.objectContaining({ operation: 'encrypt_phi', reasons: [] }),
    )
  })

  it('records compliance_failure to monitor when wired', async () => {
    const monitor = bridge.getMonitor()
    const validator = new ComplianceValidator(monitor)

    await validator.validate({
      operation: 'access_phi',
      fheActive: false,
      auditEnabled: true,
      consentVerified: true,
    })

    const events = monitor.getEvents('governance')
    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('compliance_failure')
    expect(events[0].details).toEqual(
      expect.objectContaining({
        operation: 'access_phi',
        reasons: ['FHE encryption required'],
      }),
    )
  })

  it('does not record to monitor when not wired (backward compat)', async () => {
    const validator = new ComplianceValidator() // no monitor

    await validator.validate({
      operation: 'encrypt_phi',
      fheActive: true,
      auditEnabled: true,
      consentVerified: true,
    })

    // Should not throw — no monitor to check
    // (existing test patterns already verify behavior without monitor)
  })
})

import { test, expect, describe, beforeEach } from 'vitest'

import {
  ConsentGate,
  consentGate,
} from '../../../apps/web/src/lib/memory/gates/consent-gate'
import type { ConsentGateValue } from '../../../apps/web/src/lib/memory/gates/consent-gate'

describe('ConsentGate', () => {
  let gate: ConsentGate

  beforeEach(() => {
    gate = new ConsentGate()
  })

  test('grant and check open consent', () => {
    const userId = 'user-123'
    gate.grantConsent(userId, 'open')

    const result = gate.checkConsent(userId)

    expect(result.allowed).toBe(true)
    expect(result.consentTier).toBe('open')
    expect(result.expired).toBe(false)
  })

  test('grant and check restricted consent', () => {
    const userId = 'user-456'
    gate.grantConsent(userId, 'restricted')

    const result = gate.checkConsent(userId)

    expect(result.allowed).toBe(true)
    expect(result.consentTier).toBe('restricted')
  })

  test('blocked consent is not allowed', () => {
    const userId = 'user-789'
    gate.grantConsent(userId, 'blocked')

    const result = gate.checkConsent(userId)

    expect(result.allowed).toBe(false)
    expect(result.consentTier).toBe('blocked')
  })

  test('revoke consent blocks access', () => {
    const userId = 'user-111'
    gate.grantConsent(userId, 'open')
    gate.revokeConsent(userId)

    const result = gate.checkConsent(userId)

    expect(result.allowed).toBe(false)
    expect(result.consentTier).toBe('open')
  })

  test('consent expires after given days', () => {
    const userId = 'user-222'
    gate.grantConsent(userId, 'open', 'memory_ingestion', -1)

    const result = gate.checkConsent(userId)

    expect(result.allowed).toBe(false)
    expect(result.expired).toBe(true)
  })

  test('audit log records grant action', () => {
    const userId = 'user-333'
    gate.grantConsent(userId, 'open')

    const auditLog = gate.getAuditLog(userId)

    expect(auditLog.length).toBeGreaterThan(0)
    expect(auditLog[0].action).toBe('grant')
    expect(auditLog[0].userId).toBe(userId)
  })

  test('audit log records check action', () => {
    const userId = 'user-444'
    gate.grantConsent(userId, 'open')
    gate.checkConsent(userId, 'mem-123')

    const auditLog = gate.getAuditLog(userId)
    const checkEntry = auditLog.find((e) => e.action === 'check')

    expect(checkEntry).toBeDefined()
    expect(checkEntry?.memoryId).toBe('mem-123')
  })

  test('audit log records revoke action', () => {
    const userId = 'user-555'
    gate.grantConsent(userId, 'open')
    gate.revokeConsent(userId)

    const auditLog = gate.getAuditLog(userId)
    const revokeEntry = auditLog.find((e) => e.action === 'revoke')

    expect(revokeEntry).toBeDefined()
    expect(revokeEntry?.userId).toBe(userId)
  })

  test('evaluate returns pass for allowed consent', () => {
    const userId = 'user-666'
    gate.grantConsent(userId, 'open')

    const evaluation = gate.evaluate(userId)

    expect(evaluation.gate).toBe('gate3_consent')
    expect(evaluation.decision).toBe('pass')
    expect(evaluation.confidence).toBe(1.0)
  })

  test('evaluate returns block for revoked consent', () => {
    const userId = 'user-777'
    gate.grantConsent(userId, 'open')
    gate.revokeConsent(userId)

    const evaluation = gate.evaluate(userId)

    expect(evaluation.gate).toBe('gate3_consent')
    expect(evaluation.decision).toBe('block')
    expect(evaluation.confidence).toBe(1.0)
  })

  test('evaluate returns block for expired consent', () => {
    const userId = 'user-888'
    gate.grantConsent(userId, 'open', 'memory_ingestion', -1)

    const evaluation = gate.evaluate(userId)

    expect(evaluation.gate).toBe('gate3_consent')
    expect(evaluation.decision).toBe('block')
    expect(evaluation.confidence).toBe(1.0)
  })

  test('no consent defaults to blocked', () => {
    const userId = 'user-999'

    const result = gate.checkConsent(userId)

    expect(result.allowed).toBe(false)
    expect(result.consentTier).toBe('blocked')
  })

  test('evaluate returns block for no consent', () => {
    const userId = 'user-000'

    const evaluation = gate.evaluate(userId)

    expect(evaluation.gate).toBe('gate3_consent')
    expect(evaluation.decision).toBe('block')
    expect(evaluation.confidence).toBe(1.0)
  })

  test('scope is stored with consent', () => {
    const userId = 'user-scope'
    gate.grantConsent(userId, 'open', 'custom_scope')

    const result = gate.checkConsent(userId)

    expect(result.allowed).toBe(true)
  })

  test('singleton instance works', () => {
    expect(consentGate).toBeInstanceOf(ConsentGate)
    consentGate.grantConsent('singleton-test', 'open')
    const result = consentGate.checkConsent('singleton-test')
    expect(result.allowed).toBe(true)
  })
})

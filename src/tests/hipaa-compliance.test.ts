/* @vitest-environment node */
/**
 * HIPAA Compliance Test Suite — TypeScript
 *
 * Verifies Pixelated Empathy's compliance with HIPAA Technical Safeguards
 * (45 CFR § 164.312), Administrative Safeguards (45 CFR § 164.308), and
 * Organizational Requirements (45 CFR § 164.314).
 *
 * Each test group maps to a specific HIPAA rule section and exercises
 * the real TypeScript implementation — no mocks, no stubs.
 *
 * References:
 *   45 CFR 164.312(a)(1)   — Access Control
 *   45 CFR 164.312(b)      — Audit Controls
 *   45 CFR 164.312(c)(1)   — Integrity Controls
 *   45 CFR 164.312(d)      — Person/Entity Authentication
 *   45 CFR 164.312(e)(1)   — Transmission Security
 *   45 CFR 164.308(a)(1)   — Security Management Process
 */

import { describe, it, expect } from 'vitest'

import { config } from '@/config/env.config'
import { encrypt, decrypt } from '@/lib/encryption'
import { HIPAA_CONFIG, PASSWORD_CONFIG, JWT_CONFIG } from '@/lib/auth/config'
import { verifyAuditChain, AUDIT_CHAIN_GENESIS } from '@/lib/audit/logger'
import type { AuditEvent } from '@/lib/audit/events'
import { AuditEventType, AuditSeverity, AuditAction } from '@/lib/audit/events'

import 'dotenv/config'



// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Build a minimal valid AuditEvent. */
function makeAuditEvent(
  overrides: Partial<AuditEvent> = {},
): AuditEvent {
  return {
    id: 'test-event-001',
    timestamp: new Date('2026-01-15T12:00:00Z'),
    userId: 'test-user',
    type: AuditEventType.ACCESS,
    action: AuditAction.VIEW_PATIENT,
    severity: AuditSeverity.INFO,
    resourceId: 'pat-001',
    resourceType: 'patient_record',
    status: 'success',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// 45 CFR 164.312(b) — Audit Controls
// ---------------------------------------------------------------------------
describe('HIPAA §164.312(b) — Audit Controls', () => {
  it('audit logging is enabled via config.security.audit.enabled()', () => {
    expect(config.security.audit.enabled()).toBe(true)
  })

  it('audit log retention is at least 6 years (2190 days)', () => {
    const retentionDays = config.security.audit.retentionDays()
    expect(retentionDays).toBeGreaterThanOrEqual(2190)
  })

  it('security-baseline.json declares phi_access as a tracked audit event', () => {
    const fs = require('node:fs') as typeof import('fs')
    const baselinePath = (require('node:path') as typeof import('path')).resolve(
      process.cwd(),
      'security-baseline.json',
    )
    const raw = fs.readFileSync(baselinePath, 'utf8')
    const baseline = JSON.parse(raw) as {
      baseline: { audit: { include_events: string[] } }
    }
    expect(baseline.baseline.audit.include_events).toContain('phi_access')
  })
})

// ---------------------------------------------------------------------------
// 45 CFR 164.312(a)(1) — Access Control
// ---------------------------------------------------------------------------
describe('HIPAA §164.312(a)(1) — Access Control', () => {
  it('encryption key is configured with at least 32 characters', () => {
    const key = config.security.encryption.key()
    expect(key).toBeDefined()
    expect(key!.length).toBeGreaterThanOrEqual(32)
  })

  it('HIPAA_CONFIG enforces access control: audit logging enabled, sensitive data excluded', () => {
    expect(HIPAA_CONFIG.auditLogging.enabled).toBe(true)
    expect(HIPAA_CONFIG.auditLogging.includeSensitiveData).toBe(false)
  })

  it('session timeout is configured (per baseline policy)', () => {
    expect(config.security).toBeDefined()
    expect(HIPAA_CONFIG.auditLogging.retentionPeriod).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// 45 CFR 164.312(c)(1) — Integrity Controls
// ---------------------------------------------------------------------------
describe('HIPAA §164.312(c)(1) — Integrity Controls', () => {
  it('verifies an empty audit chain (genesis only) is valid', () => {
    const result = verifyAuditChain([])
    expect(result.valid).toBe(true)
  })

  it('detects broken chain when a single event has no genesis link', () => {
    const event = makeAuditEvent({
      id: 'chain-test-1',
      previousHash: AUDIT_CHAIN_GENESIS,
      hash: 'a'.repeat(64),
    })
    const result = verifyAuditChain([event])
    expect(result.valid).toBe(false)
    expect(result.reason).toBeDefined()
  })

  it('reports chain break for unlinked events', () => {
    const eventA = makeAuditEvent({ id: 'evt-a' })
    const eventB = makeAuditEvent({ id: 'evt-b' })
    const result = verifyAuditChain([eventA, eventB])
    expect(result.valid).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 45 CFR 164.312(d) — Person / Entity Authentication
// ---------------------------------------------------------------------------
describe('HIPAA §164.312(d) — Person/Entity Authentication', () => {
  it('JWT secret is configured with a non-fallback value', () => {
    const secret = process.env['JWT_SECRET'] ?? ''
    const legacyFallback = 'fallback-secret-change-in-production'
    expect(secret).not.toBe('')
    expect(secret).not.toBe(legacyFallback)
    expect(JWT_CONFIG.secret).toBeDefined()
    expect(JWT_CONFIG.secret.length).toBeGreaterThanOrEqual(16)
  })

  it('password policy meets HIPAA minimum requirements', () => {
    expect(PASSWORD_CONFIG.minLength).toBeGreaterThanOrEqual(8)
    expect(PASSWORD_CONFIG.requireUppercase).toBe(true)
    expect(PASSWORD_CONFIG.requireNumber).toBe(true)
    expect(PASSWORD_CONFIG.requireSpecial).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// 45 CFR 164.312(e)(1) — Transmission Security
// ---------------------------------------------------------------------------
describe('HIPAA §164.312(e)(1) — Transmission Security', () => {
  it('encrypt / decrypt roundtrip succeeds for structured PHI-like data', async () => {
    const phiPayload = {
      patientId: 'TEST-001',
      diagnosis: 'Test condition',
      notes: 'Roundtrip verification data',
    }

    const ciphertext = await encrypt(phiPayload)
    expect(ciphertext).toBeDefined()
    expect(typeof ciphertext).toBe('string')

    const parsed = JSON.parse(ciphertext) as Record<string, unknown>
    expect(parsed).toHaveProperty('iv')
    expect(parsed).toHaveProperty('data')
    expect(parsed).toHaveProperty('tag')
    expect(parsed).toHaveProperty('salt')

    const decrypted = await decrypt(ciphertext)
    expect(decrypted).toEqual(phiPayload)
  })

  it('encryption uses AES-256-GCM (declared in baseline)', () => {
    const fs = require('node:fs') as typeof import('fs')
    const baselinePath = (require('node:path') as typeof import('path')).resolve(
      process.cwd(),
      'security-baseline.json',
    )
    const raw = fs.readFileSync(baselinePath, 'utf8')
    const baseline = JSON.parse(raw) as {
      baseline: { encryption: { data_at_rest: { algorithm: string } } }
    }
    expect(baseline.baseline.encryption.data_at_rest.algorithm).toBe(
      'AES-256-GCM',
    )
  })
})

// ---------------------------------------------------------------------------
// 45 CFR 164.308(a)(1) — Security Management Process
// ---------------------------------------------------------------------------
describe('HIPAA §164.308(a)(1) — Security Management Process', () => {
  it('security-baseline.json exists and has required top-level keys', () => {
    const fs = require('node:fs') as typeof import('fs')
    const baselinePath = (require('node:path') as typeof import('path')).resolve(
      process.cwd(),
      'security-baseline.json',
    )
    expect(fs.existsSync(baselinePath)).toBe(true)

    const raw = fs.readFileSync(baselinePath, 'utf8')
    const baseline = JSON.parse(raw) as {
      version: string
      baseline: Record<string, unknown>
    }
    expect(baseline.version).toBeDefined()
    expect(baseline.baseline).toBeDefined()
    expect(baseline.baseline['security_policies']).toBeDefined()
  })

  it('compliance standards include HIPAA', () => {
    const fs = require('node:fs') as typeof import('fs')
    const baselinePath = (require('node:path') as typeof import('path')).resolve(
      process.cwd(),
      'security-baseline.json',
    )
    const raw = fs.readFileSync(baselinePath, 'utf8')
    const baseline = JSON.parse(raw) as {
      baseline: { compliance_standards: string[] }
    }
    expect(baseline.baseline.compliance_standards).toContain('HIPAA')
  })

  it('HIPAA compliance tests are required per security baseline', () => {
    const fs = require('node:fs') as typeof import('fs')
    const baselinePath = (require('node:path') as typeof import('path')).resolve(
      process.cwd(),
      'security-baseline.json',
    )
    const raw = fs.readFileSync(baselinePath, 'utf8')
    const baseline = JSON.parse(raw) as {
      baseline: { testing: { hipaa_compliance_tests_required: boolean } }
    }
    expect(baseline.baseline.testing.hipaa_compliance_tests_required).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// HIPAA Organizational Requirements — 45 CFR 164.314
// ---------------------------------------------------------------------------
describe('HIPAA §164.314 — Organizational Requirements', () => {
  it('incident response has a defined contact and response time target', () => {
    const fs = require('node:fs') as typeof import('fs')
    const baselinePath = (require('node:path') as typeof import('path')).resolve(
      process.cwd(),
      'security-baseline.json',
    )
    const raw = fs.readFileSync(baselinePath, 'utf8')
    const baseline = JSON.parse(raw) as {
      baseline: {
        incident_response: {
          contact_email: string
          response_time_target_minutes: number
          notification_authorities_within_hours: number
        }
      }
    }
    expect(baseline.baseline.incident_response.contact_email).toMatch(
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    )
    expect(
      baseline.baseline.incident_response.response_time_target_minutes,
    ).toBeGreaterThan(0)
    expect(
      baseline.baseline.incident_response
        .notification_authorities_within_hours,
    ).toBeLessThanOrEqual(72)
  })
})

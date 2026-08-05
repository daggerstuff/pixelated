// @vitest-environment node
/**
 * Validates that security-baseline.json meets the minimum policy invariants
 * declared for the platform (the source of truth for security controls).
 * This loads the real JSON and asserts declared minimums rather than trusting
 * a hardcoded mock dict.
 */
import * as fs from 'node:fs'
import * as path from 'node:path'

import { describe, it, expect } from 'vitest'

interface Baseline {
  baseline: {
    security_policies: {
      enforce_mfa: boolean
      audit_logging: boolean
      authentication: {
        session_timeout_seconds: number
        max_login_attempts: number
        password_min_length: number
        account_lockout_minutes: number
      }
      rate_limiting: { enabled: boolean; max_requests_per_minute: number }
    }
    compliance_standards: string[]
    encryption: {
      data_at_rest: { algorithm: string }
      data_in_transit: { protocol: string }
      fhe_enabled: boolean
    }
    vulnerability_scanning: { sast_tools: string[] }
    testing: {
      security_unit_tests_required: boolean
      hipaa_compliance_tests_required: boolean
    }
    incident_response: { response_time_target_minutes: number }
  }
}

function loadBaseline(): Baseline {
  const baselinePath = path.join(process.cwd(), 'security-baseline.json')
  expect(fs.existsSync(baselinePath)).toBe(true)
  const raw = fs.readFileSync(baselinePath, 'utf8')
  return JSON.parse(raw) as Baseline
}

describe('security-baseline.json policy invariants', () => {
  const baseline = loadBaseline()
  const auth = baseline.baseline.security_policies.authentication
  const enc = baseline.baseline.encryption

  it('enforces MFA and audit logging', () => {
    expect(baseline.baseline.security_policies.enforce_mfa).toBe(true)
    expect(baseline.baseline.security_policies.audit_logging).toBe(true)
  })

  it('requires a password policy of at least 12 characters', () => {
    expect(auth.password_min_length).toBeGreaterThanOrEqual(12)
  })

  it('limits login attempts to at most 10', () => {
    expect(auth.max_login_attempts).toBeLessThanOrEqual(10)
  })

  it('enforces a session timeout of at most 3600 seconds', () => {
    expect(auth.session_timeout_seconds).toBeLessThanOrEqual(3600)
  })

  it('uses AES-256-GCM for data at rest', () => {
    expect(enc.data_at_rest.algorithm).toBe('AES-256-GCM')
  })

  it('uses TLS 1.2 or 1.3 for data in transit', () => {
    expect(enc.data_in_transit.protocol).toMatch(/^TLS 1\.(2|3)$/)
  })

  it('enables fully homomorphic encryption (FHE)', () => {
    expect(enc.fhe_enabled).toBe(true)
  })

  it('declares at least 2 SAST tools', () => {
    expect(
      baseline.baseline.vulnerability_scanning.sast_tools.length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('includes HIPAA and GDPR in compliance standards', () => {
    const standards = baseline.baseline.compliance_standards.map((s) =>
      s.toUpperCase(),
    )
    expect(standards).toContain('HIPAA')
    expect(standards).toContain('GDPR')
  })

  it('requires security and HIPAA compliance unit tests', () => {
    expect(baseline.baseline.testing.security_unit_tests_required).toBe(true)
    expect(baseline.baseline.testing.hipaa_compliance_tests_required).toBe(true)
  })

  it('targets an incident response time of at most 60 minutes', () => {
    expect(
      baseline.baseline.incident_response.response_time_target_minutes,
    ).toBeLessThanOrEqual(60)
  })
})

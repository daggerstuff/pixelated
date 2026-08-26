/**
 * PIX-511: Consent Gate — TypeScript mirror of ai/memory/gates/consent_gate.py
 */

export type ConsentGateValue = 'open' | 'restricted' | 'blocked'

export interface ConsentRecord {
  userId: string
  consentType: ConsentGateValue
  grantedAt: string
  expiresAt: string | null
  scope: string
  revoked: boolean
  revokedAt: string | null
}

export interface ConsentAuditEntry {
  timestamp: string
  userId: string
  action: 'check' | 'grant' | 'revoke' | 'expire'
  memoryId: string | null
  result: string
  details: string
}

export interface ConsentGateResult {
  allowed: boolean
  consentTier: ConsentGateValue
  reason: string
  expired: boolean
  auditEntry: ConsentAuditEntry
}

export interface ConsentGateEvaluation {
  gate: string
  decision: 'pass' | 'block' | 'escalate'
  reason: string
  confidence: number
}

const GATE_NAME = 'gate3_consent'
const DEFAULT_CONSENT_SCOPE = 'memory_ingestion'

export class ConsentGate {
  private readonly _consentStore: Map<string, ConsentRecord> = new Map()
  private readonly _auditLog: ConsentAuditEntry[] = []

  grantConsent(
    userId: string,
    consentType: ConsentGateValue,
    scope: string = DEFAULT_CONSENT_SCOPE,
    expiresInDays?: number,
  ): ConsentRecord {
    const now = new Date()
    const expiresAt =
      typeof expiresInDays === 'number'
        ? new Date(
            now.getTime() + expiresInDays * 24 * 60 * 60 * 1000,
          ).toISOString()
        : null

    const record: ConsentRecord = {
      userId,
      consentType,
      grantedAt: now.toISOString(),
      expiresAt,
      scope,
      revoked: false,
      revokedAt: null,
    }

    this._consentStore.set(userId, record)
    this.recordAudit({
      userId,
      action: 'grant',
      memoryId: null,
      result: consentType,
      details: `Consent granted for scope '${scope}'`,
    })

    return record
  }

  revokeConsent(userId: string): void {
    const record = this._consentStore.get(userId)

    if (!record) {
      this.recordAudit({
        userId,
        action: 'revoke',
        memoryId: null,
        result: 'blocked',
        details: 'No consent record found to revoke',
      })
      return
    }

    record.revoked = true
    record.revokedAt = new Date().toISOString()
    this.recordAudit({
      userId,
      action: 'revoke',
      memoryId: null,
      result: 'revoked',
      details: `Consent revoked for scope '${record.scope}'`,
    })
  }

  checkConsent(userId: string, memoryId?: string): ConsentGateResult {
    const record = this._consentStore.get(userId)
    const auditMemoryId = memoryId ?? null

    if (!record) {
      return this.buildResult(
        userId,
        auditMemoryId,
        false,
        'blocked',
        'No consent record found',
        false,
      )
    }

    if (record.revoked) {
      return this.buildResult(
        userId,
        auditMemoryId,
        false,
        record.consentType,
        'Consent has been revoked',
        false,
      )
    }

    const expired = this.isExpired(record)
    if (expired) {
      const expireEntry = this.recordAudit({
        userId,
        action: 'expire',
        memoryId: auditMemoryId,
        result: 'blocked',
        details: 'Consent expiration observed during check',
      })
      const result = this.buildResult(
        userId,
        auditMemoryId,
        false,
        record.consentType,
        'Consent has expired',
        true,
      )
      result.auditEntry.details = `${result.auditEntry.details}; expiration_audit=${expireEntry.timestamp}`
      return result
    }

    if (record.consentType === 'open') {
      return this.buildResult(
        userId,
        auditMemoryId,
        true,
        record.consentType,
        'Consent granted',
        false,
      )
    }

    if (record.consentType === 'restricted') {
      return this.buildResult(
        userId,
        auditMemoryId,
        true,
        record.consentType,
        'Consent granted with restrictions',
        false,
      )
    }

    return this.buildResult(
      userId,
      auditMemoryId,
      false,
      'blocked',
      'Consent tier is blocked',
      false,
    )
  }

  evaluate(userId: string, memoryId?: string): ConsentGateEvaluation {
    const result = this.checkConsent(userId, memoryId)

    if (!result.allowed) {
      return {
        gate: GATE_NAME,
        decision: 'block',
        reason: result.reason,
        confidence: 1.0,
      }
    }

    return {
      gate: GATE_NAME,
      decision: 'pass',
      reason:
        result.consentTier === 'restricted'
          ? 'Consent granted with restrictions'
          : 'Consent granted',
      confidence: 1.0,
    }
  }

  getAuditLog(userId?: string): ConsentAuditEntry[] {
    const entries = userId
      ? this._auditLog.filter((entry) => entry.userId === userId)
      : this._auditLog

    return entries.map((entry) => ({ ...entry }))
  }

  isExpired(record: ConsentRecord): boolean {
    if (record.expiresAt === null) return false

    const expiresAt = Date.parse(record.expiresAt)
    return Number.isFinite(expiresAt) && expiresAt <= Date.now()
  }

  private buildResult(
    userId: string,
    memoryId: string | null,
    allowed: boolean,
    consentTier: ConsentGateValue,
    reason: string,
    expired: boolean,
  ): ConsentGateResult {
    const auditEntry = this.recordAudit({
      userId,
      action: 'check',
      memoryId,
      result: allowed ? 'pass' : 'blocked',
      details: reason,
    })

    return {
      allowed,
      consentTier,
      reason,
      expired,
      auditEntry,
    }
  }

  private recordAudit(
    entry: Omit<ConsentAuditEntry, 'timestamp'>,
  ): ConsentAuditEntry {
    const auditEntry: ConsentAuditEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
    }
    this._auditLog.push(auditEntry)
    return auditEntry
  }
}

export const consentGate = new ConsentGate()

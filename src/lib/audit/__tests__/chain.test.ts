import { describe, expect, it, vi } from 'vitest'

// Mirror logger.test.ts mocks so importing the module never touches a real DB.
const mocks = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  uuid: vi.fn(() => 'audit-event-1'),
  scanContent: vi.fn(() => ({ redactedContent: null })),
}))

vi.mock('uuid', () => ({ v4: mocks.uuid }))
vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: vi.fn(() => ({
    info: mocks.info,
    warn: mocks.warn,
    error: mocks.error,
    debug: mocks.debug,
  })),
}))
vi.mock('../../security/dlp', () => ({
  dlpService: { scanContent: mocks.scanContent },
}))

import { AuditLogger, chainPayload, computeChainHash, verifyAuditChain } from '../logger'
import { AuditEventType, AuditSeverity } from '../events'
import type { AuditEvent } from '../events'

const GENESIS = '0'.repeat(64)

function makeEvent(overrides: Partial<AuditEvent> = {}): AuditEvent {
  return {
    id: 'e1',
    timestamp: new Date('2024-01-01T00:00:00.000Z'),
    userId: 'u1',
    type: AuditEventType.SYSTEM,
    action: 'test',
    severity: AuditSeverity.INFO,
    status: 'success',
    ...overrides,
  }
}

describe('computeChainHash', () => {
  it('is deterministic for identical inputs', () => {
    const p = { a: 1, b: 'x' }
    expect(computeChainHash('abc', p)).toBe(computeChainHash('abc', p))
  })

  it('differs when previousHash differs', () => {
    const p = { a: 1 }
    expect(computeChainHash('a', p)).not.toBe(computeChainHash('b', p))
  })

  it('differs when payload differs', () => {
    expect(computeChainHash('a', { a: 1 })).not.toBe(
      computeChainHash('a', { a: 2 }),
    )
  })

  it('produces a 64-char hex SHA-256 digest', () => {
    expect(computeChainHash('a', { a: 1 })).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('verifyAuditChain', () => {
  it('validates a well-formed chain', () => {
    const e1 = makeEvent({ id: 'e1' })
    const e2 = makeEvent({ id: 'e2' })
    const h1 = computeChainHash(GENESIS, chainPayload(e1))
    const h2 = computeChainHash(h1, chainPayload(e2))
    const events = [
      { ...e1, previousHash: GENESIS, hash: h1 },
      { ...e2, previousHash: h1, hash: h2 },
    ] as unknown as AuditEvent[]

    expect(verifyAuditChain(events).valid).toBe(true)
  })

  it('detects a tampered event payload', () => {
    const e1 = makeEvent({ id: 'e1' })
    const e2 = makeEvent({ id: 'e2' })
    const h1 = computeChainHash(GENESIS, chainPayload(e1))
    const h2 = computeChainHash(h1, chainPayload(e2))
    const events = [
      { ...e1, previousHash: GENESIS, hash: h1 },
      { ...e2, previousHash: h1, hash: h2, metadata: { tampered: true } },
    ] as unknown as AuditEvent[]

    const res = verifyAuditChain(events)
    expect(res.valid).toBe(false)
    expect(res.brokenAtId).toBe('e2')
    expect(res.reason).toBe('hash mismatch')
  })

  it('detects a broken previousHash link', () => {
    const e1 = makeEvent({ id: 'e1' })
    const e2 = makeEvent({ id: 'e2' })
    const h1 = computeChainHash(GENESIS, chainPayload(e1))
    const h2 = computeChainHash(h1, chainPayload(e2))
    const events = [
      { ...e1, previousHash: GENESIS, hash: h1 },
      { ...e2, previousHash: 'WRONG', hash: h2 },
    ] as unknown as AuditEvent[]

    const res = verifyAuditChain(events)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('previousHash mismatch')
  })

  it('detects a missing hash', () => {
    const events = [makeEvent({ id: 'e1' })]
    const res = verifyAuditChain(events)
    expect(res.valid).toBe(false)
    expect(res.reason).toBe('missing hash')
  })
})

describe('AuditLogger persistence builds a hash chain', () => {
  function makeFakeDb() {
    const store: AuditEvent[] = []
    let cursorSeq = 0
    let cursorHash = GENESIS
    
    const collection = (name: string) => {
      if (name === 'chain_audit_cursor') {
        return {
          findOneAndUpdate: async () => {
            const prevSeq = cursorSeq
            const prevHash = cursorHash
            cursorSeq += 1
            return { seq: prevSeq, hash: prevHash }
          },
        }
      }
      return {
        find: () => ({
          sort: () => ({
            limit: () => ({
              toArray: async () =>
                store.length ? [store[store.length - 1]] : [],
            }),
          }),
        }),
        insertOne: async (doc: AuditEvent) => {
          store.push(doc)
          if (doc.hash) {
            cursorHash = doc.hash
          }
          return { insertedId: (doc as { _id?: unknown })._id }
        },
      }
    }
    return { collection, store }
  }

  it('links each persisted event to the previous event hash', async () => {
    const db = makeFakeDb()
    const auditLogger = AuditLogger.getInstance()
    const ensureSpy = vi
      .spyOn(auditLogger as unknown as { ensureConnected: () => Promise<unknown> }, 'ensureConnected')
      .mockResolvedValue(db)

    await (auditLogger as unknown as { persistEventWithRetry: (e: AuditEvent) => Promise<void> }).persistEventWithRetry(
      makeEvent({ id: 'e1' }),
    )
    await (auditLogger as unknown as { persistEventWithRetry: (e: AuditEvent) => Promise<void> }).persistEventWithRetry(
      makeEvent({ id: 'e2' }),
    )

    expect(db.store).toHaveLength(2)
    expect(db.store[0].previousHash).toBe(GENESIS)
    expect(typeof db.store[0].hash).toBe('string')
    expect(db.store[1].previousHash).toBe(db.store[0].hash)
    expect(db.store[1].hash).not.toBe(db.store[0].hash)
    expect(verifyAuditChain(db.store).valid).toBe(true)

    ensureSpy.mockRestore()
  })
})

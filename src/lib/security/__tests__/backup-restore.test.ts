import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock mongoose before importing the module under test
const mockBulkWrite = vi.fn()
const mockExists = vi.fn()
const mockModelNames = vi.fn()
const mockModel = vi.fn()

vi.mock('mongoose', () => {
  const conn = {
    readyState: 1,
    modelNames: mockModelNames,
    model: mockModel,
  }
  return {
    default: { connection: conn, model: mockModel },
    connection: conn,
  }
})

// Mock audit logging
vi.mock('../../audit', () => ({
  logAuditEvent: vi.fn(),
  AuditEventType: { SECURITY: 'security' },
}))

// Mock browser detection
vi.mock('../../browser/is-browser', () => ({
  isBrowser: false,
}))

// Mock DLP
vi.mock('../dlp', () => ({
  dlpService: { scan: vi.fn().mockResolvedValue([]) },
}))

// Mock logging
vi.mock('../../logging/build-safe-logger', () => ({
  createBuildSafeLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

import { BackupSecurityManager } from '../backup/index'
import { BackupType } from '../backup/backup-types'

function makeTestBackupData(
  models: Record<string, Record<string, unknown>[]>,
): Uint8Array {
  const payload = {
    timestamp: new Date().toISOString(),
    type: BackupType.FULL,
    data: models,
  }
  return new TextEncoder().encode(JSON.stringify(payload))
}

function makeMockModel() {
  return {
    bulkWrite: mockBulkWrite,
    exists: mockExists,
    schema: { paths: { updatedAt: true } },
    find: vi.fn(),
    lean: vi.fn(),
    cursor: vi.fn(),
  }
}

describe('BackupSecurityManager.restoreData', () => {
  let manager: BackupSecurityManager

  beforeEach(() => {
    vi.clearAllMocks()

    // Reset singleton
    ;(BackupSecurityManager as any).instance = undefined
    manager = BackupSecurityManager.getInstance({
      encryptionKey: 'a'.repeat(64),
    })

    // Default mocks
    mockModelNames.mockReturnValue(['User'])
    mockModel.mockReturnValue(makeMockModel())
    mockBulkWrite.mockResolvedValue({
      upsertedCount: 1,
      modifiedCount: 0,
      writeErrors: [],
    })
    mockExists.mockResolvedValue(true)
  })

  it('restores documents via bulkWrite with upsert', async () => {
    const docs = [{ _id: 'user1', name: 'Alice' }]
    const data = makeTestBackupData({ User: docs })

    const result = await (manager as any).restoreData(data)

    expect(mockBulkWrite).toHaveBeenCalledOnce()
    const ops = mockBulkWrite.mock.calls[0][0]
    expect(ops).toHaveLength(1)
    expect(ops[0].updateOne.filter).toEqual({ _id: 'user1' })
    expect(ops[0].updateOne.update.$set).toEqual(docs[0])
    expect(ops[0].updateOne.upsert).toBe(true)

    expect(result.documentsRestored).toBe(1)
    expect(result.modelsProcessed).toBe(1)
  })

  it('handles multiple models', async () => {
    mockModelNames.mockReturnValue(['User', 'Session'])
    mockModel.mockReturnValue(makeMockModel())
    mockBulkWrite
      .mockResolvedValueOnce({
        upsertedCount: 2,
        modifiedCount: 0,
        writeErrors: [],
      })
      .mockResolvedValueOnce({
        upsertedCount: 1,
        modifiedCount: 1,
        writeErrors: [],
      })

    const data = makeTestBackupData({
      User: [{ _id: 'u1' }, { _id: 'u2' }],
      Session: [{ _id: 's1' }],
    })

    const result = await (manager as any).restoreData(data)

    expect(result.documentsRestored).toBe(4)
    expect(result.modelsProcessed).toBe(2)
  })

  it('skips unknown models gracefully', async () => {
    mockModelNames.mockReturnValue(['User'])
    mockModel.mockImplementation((name: string) => {
      if (name === 'User') return makeMockModel()
      throw new Error('Model not found')
    })

    const data = makeTestBackupData({
      User: [{ _id: 'u1' }],
      DeletedModel: [{ _id: 'd1' }],
    })

    const result = await (manager as any).restoreData(data)

    expect(result.modelsProcessed).toBe(2)
    expect(result.models['User'].restored).toBe(1)
    expect(result.models['DeletedModel'].restored).toBe(0)
  })

  it('handles empty document arrays', async () => {
    const data = makeTestBackupData({ User: [] })

    const result = await (manager as any).restoreData(data)

    expect(mockBulkWrite).not.toHaveBeenCalled()
    expect(result.modelsProcessed).toBe(1)
    expect(result.models['User']).toEqual({ restored: 0, errors: 0 })
    expect(result.documentsRestored).toBe(0)
  })

  it('throws on invalid backup format (missing data field)', async () => {
    const badData = new TextEncoder().encode(
      JSON.stringify({ timestamp: '2025-01-01', type: 'FULL' }),
    )

    await expect((manager as any).restoreData(badData)).rejects.toThrow(
      'missing "data" field',
    )
  })

  it('throws on invalid JSON', async () => {
    const badData = new TextEncoder().encode('not json at all')

    await expect((manager as any).restoreData(badData)).rejects.toThrow(
      'Data restoration failed',
    )
  })

  it('performs integrity verification after restore', async () => {
    const docs = [{ _id: 'user1', name: 'Alice' }]
    const data = makeTestBackupData({ User: docs })

    await (manager as any).restoreData(data)

    expect(mockExists).toHaveBeenCalledWith({ _id: 'user1' })
  })

  it('throws when integrity verification fails', async () => {
    mockExists.mockResolvedValue(null)

    const data = makeTestBackupData({ User: [{ _id: 'user1' }] })

    await expect((manager as any).restoreData(data)).rejects.toThrow(
      'Integrity',
    )
  })

  it('throws when Mongoose connection is not ready', async () => {
    const mongoose = (await import('mongoose')).default ?? (await import('mongoose'))
    ;(mongoose as any).connection.readyState = 0

    const data = makeTestBackupData({ User: [{ _id: 'u1' }] })

    await expect((manager as any).restoreData(data)).rejects.toThrow(
      'connection is not ready',
    )

    ;(mongoose as any).connection.readyState = 1
  })
})

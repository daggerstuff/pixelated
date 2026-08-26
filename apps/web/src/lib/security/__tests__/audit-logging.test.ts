import { describe, it, expect, beforeEach } from 'vitest'

import { AuditLoggingService } from '../audit.logging'
import type { AuditLogEntry } from '../audit.logging'

describe('AuditLoggingService', () => {
  let service: AuditLoggingService

  beforeEach(() => {
    // Use includePII: true so userId is stored unhashed for predictable queries
    service = new AuditLoggingService({
      logLevel: 'info',
      includeTimestamp: true,
      includePII: true,
      redactFields: ['password', 'token'],
    })
  })

  async function seedEntries(): Promise<void> {
    await service.logEvent({
      eventType: 'auth',
      action: 'login',
      userId: 'user-1',
      resourceType: 'session',
      resourceId: 'sess-1',
      status: 'success',
      details: {},
      metadata: {},
    })
    await service.logEvent({
      eventType: 'data',
      action: 'read',
      userId: 'user-2',
      resourceType: 'record',
      resourceId: 'rec-1',
      status: 'success',
      details: {},
      metadata: {},
    })
    await service.logEvent({
      eventType: 'auth',
      action: 'login',
      userId: 'user-1',
      resourceType: 'session',
      resourceId: 'sess-2',
      status: 'failure',
      details: {},
      metadata: {},
    })
  }

  describe('queryLogs', () => {
    it('returns all logs when no filters provided', async () => {
      await seedEntries()
      const results = await service.queryLogs({})
      expect(results).toHaveLength(3)
    })

    it('filters by eventType', async () => {
      await seedEntries()
      const results = await service.queryLogs({ eventType: 'auth' })
      expect(results).toHaveLength(2)
      expect(results.every((r) => r.eventType === 'auth')).toBe(true)
    })

    it('filters by userId', async () => {
      await seedEntries()
      const results = await service.queryLogs({ userId: 'user-1' })
      expect(results).toHaveLength(2)
      expect(results.every((r) => r.userId === 'user-1')).toBe(true)
    })

    it('filters by status', async () => {
      await seedEntries()
      const results = await service.queryLogs({ status: 'failure' })
      expect(results).toHaveLength(1)
      expect(results[0].status).toBe('failure')
    })

    it('filters by action', async () => {
      await seedEntries()
      const results = await service.queryLogs({ action: 'login' })
      expect(results).toHaveLength(2)
    })

    it('filters by startDate', async () => {
      await seedEntries()
      const future = new Date(Date.now() + 60_000)
      const results = await service.queryLogs({ startDate: future })
      expect(results).toHaveLength(0)
    })

    it('filters by endDate', async () => {
      await seedEntries()
      const past = new Date(Date.now() - 60_000)
      const results = await service.queryLogs({ endDate: past })
      expect(results).toHaveLength(0)
    })

    it('combines multiple filters', async () => {
      await seedEntries()
      const results = await service.queryLogs({
        eventType: 'auth',
        userId: 'user-1',
        status: 'success',
      })
      expect(results).toHaveLength(1)
      expect(results[0].action).toBe('login')
      expect(results[0].status).toBe('success')
    })

    it('returns empty array when no matches', async () => {
      await seedEntries()
      const results = await service.queryLogs({ userId: 'nonexistent' })
      expect(results).toHaveLength(0)
    })
  })

  describe('exportLogs', () => {
    it('exports to JSON format', async () => {
      await seedEntries()
      const json = await service.exportLogs('json')
      const parsed = JSON.parse(json) as AuditLogEntry[]
      expect(parsed).toHaveLength(3)
      expect(parsed[0].action).toBeDefined()
    })

    it('exports to CSV format with headers', async () => {
      await seedEntries()
      const csv = await service.exportLogs('csv')
      const lines = csv.split('\n')
      expect(lines[0]).toBe(
        'timestamp,eventType,userId,action,status,resourceType,resourceId',
      )
      expect(lines).toHaveLength(4) // header + 3 data rows
    })

    it('applies filters during export', async () => {
      await seedEntries()
      const csv = await service.exportLogs('csv', { eventType: 'data' })
      const lines = csv.split('\n')
      expect(lines).toHaveLength(2) // header + 1 data row
      expect(lines[1]).toContain('data')
    })

    it('handles empty results in export', async () => {
      const json = await service.exportLogs('json')
      expect(JSON.parse(json)).toHaveLength(0)

      const csv = await service.exportLogs('csv')
      expect(csv.split('\n')).toHaveLength(1) // just the header
    })

    it('escapes commas and quotes in CSV', async () => {
      await service.logEvent({
        eventType: 'test,event',
        action: 'action"quoted',
        userId: 'user-1',
        status: 'success',
        details: {},
        metadata: {},
      })
      const csv = await service.exportLogs('csv')
      const dataLine = csv.split('\n')[1]
      expect(dataLine).toContain('"test,event"')
      expect(dataLine).toContain('"action""quoted"')
    })
  })

  describe('storeLogEntry integration', () => {
    it('stores entries from log() method', async () => {
      await service.log({
        action: 'create',
        resource: 'user',
        resourceId: 'u-1',
        userId: 'admin',
        details: { password: 'secret' },
      })
      const results = await service.queryLogs({})
      expect(results).toHaveLength(1)
      expect(results[0].action).toBe('create')
      expect(results[0].details['password']).toBe('[REDACTED]')
    })
  })
})

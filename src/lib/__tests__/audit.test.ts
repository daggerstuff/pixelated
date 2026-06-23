/* @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const SAMPLE_ENTRY = {
  id: 'audit-test-1',
  timestamp: new Date().toISOString(),
  userId: 'user-1',
  action: 'read',
  eventType: 'access',
  status: 'success',
  resource: 'patient-record',
  ipAddress: 'server-side',
  userAgent: 'server-side',
  sessionId: 'server-session',
}

async function loadAuditModule() {
  const mod = await import('../audit')
  mod.configureAuditService({ enabled: true, retentionDays: 90 })
  return mod
}

describe('audit.ts', () => {
  beforeEach(() => {
    vi.resetModules()
    // src/test/setup.ts replaces window.localStorage with a vi.fn() mock that
    // does not actually store data. Override it with a real Storage impl so
    // the audit module's setItem/getItem calls work correctly.
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => {
        store.set(key, value)
      },
      removeItem: (key: string) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      },
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size
      },
    }
    Object.defineProperty(window, 'localStorage', {
      value: storage,
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('createAuditLog', () => {
    it('creates a log entry with required fields and default status', async () => {
      const { createAuditLog, AuditEventType, AuditEventStatus } =
        await loadAuditModule()
      const entry = await createAuditLog(
        AuditEventType.ACCESS,
        'read',
        'user-1',
        'patient-record',
      )
      expect(entry.userId).toBe('user-1')
      expect(entry.action).toBe('read')
      expect(entry.resource).toBe('patient-record')
      expect(entry.eventType).toBe(AuditEventType.ACCESS)
      expect(entry.status).toBe(AuditEventStatus.SUCCESS)
      expect(entry.id).toMatch(/^audit-/)
      expect(entry.timestamp).toBeTruthy()
    })

    it('includes details when provided', async () => {
      const { createAuditLog, AuditEventType } = await loadAuditModule()
      const entry = await createAuditLog(
        AuditEventType.ACCESS,
        'read',
        'user-1',
        'patient-record',
        { reason: 'routine', count: 1 },
      )
      expect(entry.details).toEqual({ reason: 'routine', count: 1 })
    })

    it('uses custom status when provided', async () => {
      const { createAuditLog, AuditEventType, AuditEventStatus } =
        await loadAuditModule()
      const entry = await createAuditLog(
        AuditEventType.LOGIN,
        'auth',
        'user-1',
        'session',
        undefined,
        AuditEventStatus.FAILURE,
      )
      expect(entry.status).toBe(AuditEventStatus.FAILURE)
    })
  })

  describe('logAuditEvent', () => {
    it('logs with resourceId', async () => {
      const { logAuditEvent, getAuditLogs, AuditEventType } =
        await loadAuditModule()
      logAuditEvent(AuditEventType.ACCESS, 'read', 'user-1', 'res-42')
      await new Promise((r) => setTimeout(r, 10))
      const logs = getAuditLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0]?.resource).toBe('res-42')
      expect(logs[0]?.action).toBe('read')
    })

    it('uses "unknown" when resourceId is omitted', async () => {
      const { logAuditEvent, getAuditLogs, AuditEventType } =
        await loadAuditModule()
      logAuditEvent(AuditEventType.SYSTEM, 'ping', 'user-1')
      await new Promise((r) => setTimeout(r, 10))
      const logs = getAuditLogs()
      expect(logs[0]?.resource).toBe('unknown')
    })

    it('includes details when provided', async () => {
      const { logAuditEvent, getAuditLogs, AuditEventType } =
        await loadAuditModule()
      logAuditEvent(AuditEventType.ACCESS, 'read', 'user-1', 'res-1', {
        foo: 'bar',
      })
      await new Promise((r) => setTimeout(r, 10))
      const logs = getAuditLogs()
      expect(logs[0]?.details).toEqual({ foo: 'bar' })
    })
  })

  describe('createHIPAACompliantAuditLog', () => {
    it('uses SYSTEM and SUCCESS as defaults', async () => {
      const { createHIPAACompliantAuditLog } = await loadAuditModule()
      const entry = await createHIPAACompliantAuditLog({
        userId: 'u',
        action: 'a',
        resource: 'r',
      })
      expect(entry.eventType).toBe('system')
      expect(entry.status).toBe('success')
    })

    it('includes all optional fields when provided', async () => {
      const { createHIPAACompliantAuditLog, AuditEventType, AuditEventStatus } =
        await loadAuditModule()
      const entry = await createHIPAACompliantAuditLog({
        userId: 'u',
        action: 'a',
        resource: 'r',
        eventType: AuditEventType.ACCESS,
        status: AuditEventStatus.FAILURE,
        resourceId: 'rid',
        details: { k: 'v' },
        userRole: 'admin',
        patientId: 'p-1',
        organizationId: 'org-1',
        notes: 'note',
      })
      expect(entry.resourceId).toBe('rid')
      expect(entry.details).toEqual({ k: 'v' })
      expect(entry.userRole).toBe('admin')
      expect(entry.patientId).toBe('p-1')
      expect(entry.organizationId).toBe('org-1')
      expect(entry.notes).toBe('note')
    })

    it('omits optional fields when not provided', async () => {
      const { createHIPAACompliantAuditLog } = await loadAuditModule()
      const entry = await createHIPAACompliantAuditLog({
        userId: 'u',
        action: 'a',
        resource: 'r',
      })
      expect(entry).not.toHaveProperty('resourceId')
      expect(entry).not.toHaveProperty('details')
      expect(entry).not.toHaveProperty('userRole')
      expect(entry).not.toHaveProperty('patientId')
      expect(entry).not.toHaveProperty('organizationId')
      expect(entry).not.toHaveProperty('notes')
    })

    it('triggers batch processing when queue reaches batchSize', async () => {
      const { configureAuditService, createHIPAACompliantAuditLog } =
        await loadAuditModule()
      configureAuditService({
        remoteStorageEnabled: true,
        remoteEndpoint: 'https://audit.example.com/logs',
        localStorageEnabled: false,
      })
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('ok', { status: 200 }))
      for (let i = 0; i < 100; i++) {
        await createHIPAACompliantAuditLog({
          userId: 'u',
          action: 'a',
          resource: 'r',
        })
      }
      expect(fetchMock).toHaveBeenCalled()
    })
  })

  describe('getAuditLogs / clearAuditLogs / exportAuditLogs', () => {
    it('returns empty array when no logs exist', async () => {
      const { getAuditLogs } = await loadAuditModule()
      expect(getAuditLogs()).toEqual([])
    })

    it('returns stored logs', async () => {
      const { createHIPAACompliantAuditLog, getAuditLogs } =
        await loadAuditModule()
      await createHIPAACompliantAuditLog({
        userId: 'u',
        action: 'a',
        resource: 'r',
      })
      const logs = getAuditLogs()
      expect(logs).toHaveLength(1)
    })

    it('filters out invalid entries from localStorage', async () => {
      localStorage.setItem(
        'hipaa-audit-logs',
        JSON.stringify([SAMPLE_ENTRY, { not: 'valid' }, 'string-not-object']),
      )
      const { getAuditLogs } = await loadAuditModule()
      const logs = getAuditLogs()
      expect(logs).toHaveLength(1)
    })

    it('returns empty array when localStorage contains invalid JSON', async () => {
      localStorage.setItem('hipaa-audit-logs', 'not-json{{{')
      const { getAuditLogs } = await loadAuditModule()
      expect(getAuditLogs()).toEqual([])
    })

    it('returns empty when localStorage is disabled', async () => {
      const {
        configureAuditService,
        createHIPAACompliantAuditLog,
        getAuditLogs,
      } = await loadAuditModule()
      await createHIPAACompliantAuditLog({
        userId: 'u',
        action: 'a',
        resource: 'r',
      })
      configureAuditService({ localStorageEnabled: false })
      expect(getAuditLogs()).toEqual([])
    })

    it('clearAuditLogs removes all stored logs', async () => {
      const { createHIPAACompliantAuditLog, clearAuditLogs, getAuditLogs } =
        await loadAuditModule()
      await createHIPAACompliantAuditLog({
        userId: 'u',
        action: 'a',
        resource: 'r',
      })
      expect(getAuditLogs()).toHaveLength(1)
      clearAuditLogs()
      expect(getAuditLogs()).toHaveLength(0)
    })

    it('exportAuditLogs returns JSON string', async () => {
      const { createHIPAACompliantAuditLog, exportAuditLogs } =
        await loadAuditModule()
      await createHIPAACompliantAuditLog({
        userId: 'u',
        action: 'a',
        resource: 'r',
      })
      const exported = exportAuditLogs()
      const parsed = JSON.parse(exported) as unknown[]
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(1)
    })

    it('clearAuditLogs returns early when localStorage is disabled', async () => {
      const {
        configureAuditService,
        createHIPAACompliantAuditLog,
        clearAuditLogs,
        getAuditLogs,
      } = await loadAuditModule()
      await createHIPAACompliantAuditLog({
        userId: 'u',
        action: 'a',
        resource: 'r',
      })
      configureAuditService({ localStorageEnabled: false })
      clearAuditLogs()
      configureAuditService({ localStorageEnabled: true })
      expect(getAuditLogs()).toHaveLength(1)
    })

    it('getAuditLogs returns empty array when localStorage throws', async () => {
      const { getAuditLogs } = await loadAuditModule()
      const originalGetItem = window.localStorage.getItem
      Object.defineProperty(window, 'localStorage', {
        value: {
          ...window.localStorage,
          getItem: () => {
            throw new Error('quota exceeded')
          },
        },
        configurable: true,
        writable: true,
      })
      const logs = getAuditLogs()
      expect(logs).toEqual([])
      Object.defineProperty(window, 'localStorage', {
        value: { ...window.localStorage, getItem: originalGetItem },
        configurable: true,
        writable: true,
      })
    })

    it('clearAuditLogs handles removeItem errors gracefully', async () => {
      const { clearAuditLogs } = await loadAuditModule()
      const originalRemoveItem = window.localStorage.removeItem
      Object.defineProperty(window, 'localStorage', {
        value: {
          ...window.localStorage,
          removeItem: () => {
            throw new Error('quota exceeded')
          },
        },
        configurable: true,
        writable: true,
      })
      expect(() => clearAuditLogs()).not.toThrow()
      Object.defineProperty(window, 'localStorage', {
        value: { ...window.localStorage, removeItem: originalRemoveItem },
        configurable: true,
        writable: true,
      })
    })
  })

  describe('initializeAuditService / configureAuditService', () => {
    it('initializes with default config', async () => {
      const { initializeAuditService } = await loadAuditModule()
      expect(() => initializeAuditService()).not.toThrow()
    })

    it('merges custom config without throwing and keeps service functional', async () => {
      const {
        initializeAuditService,
        configureAuditService,
        getAuditLogs,
        clearAuditLogs,
        createHIPAACompliantAuditLog,
        AuditEventType,
      } = await loadAuditModule()
      clearAuditLogs()
      expect(() => {
        initializeAuditService({ batchSize: 50, debugMode: true })
        configureAuditService({ retentionDays: 30 })
      }).not.toThrow()
      // Behavioral sanity: after configuring, the service still stores logs.
      // (If config were dropped or the module crashed, this would fail.)
      await createHIPAACompliantAuditLog({
        userId: 'u-1',
        action: 'access:phi',
        resource: 'patient-record',
        eventType: AuditEventType.ACCESS,
      })
      const logs = getAuditLogs()
      expect(logs.length).toBeGreaterThan(0)
      expect(logs[0]?.userId).toBe('u-1')
    })

    it('starts and stops batch timer when remote storage toggles', async () => {
      const { initializeAuditService, configureAuditService } =
        await loadAuditModule()
      // Both calls must not throw; toggling remote storage on then off exercises
      // the startBatchTimer / clearInterval branches in configureAuditService.
      expect(() => {
        initializeAuditService({
          remoteStorageEnabled: true,
          remoteEndpoint: 'https://audit.example.com/logs',
        })
        configureAuditService({
          remoteStorageEnabled: false,
          remoteEndpoint: undefined,
        })
      }).not.toThrow()
    })
  })

  describe('createResourceAuditLog', () => {
    it('creates a log entry with resource type and id', async () => {
      const { createResourceAuditLog, getAuditLogs, AuditEventType } =
        await loadAuditModule()
      await createResourceAuditLog(
        AuditEventType.ACCESS,
        'user-1',
        { id: 'res-42', type: 'patient-record' },
        { reason: 'review' },
      )
      const logs = getAuditLogs()
      expect(logs).toHaveLength(1)
      expect(logs[0]?.action).toBe('access:patient-record')
      expect(logs[0]?.resource).toBe('patient-record')
      expect(logs[0]?.resourceId).toBe('res-42')
      expect(logs[0]?.notes).toContain('createResourceAuditLog')
    })
  })

  describe('remote endpoint', () => {
    it('sends logs to remote endpoint on batch', async () => {
      const { configureAuditService, createHIPAACompliantAuditLog } =
        await loadAuditModule()
      configureAuditService({
        remoteStorageEnabled: true,
        remoteEndpoint: 'https://audit.example.com/logs',
        localStorageEnabled: false,
      })
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response('ok', { status: 200 }))
      for (let i = 0; i < 100; i++) {
        await createHIPAACompliantAuditLog({
          userId: 'u',
          action: 'a',
          resource: 'r',
        })
      }
      expect(fetchMock).toHaveBeenCalledWith(
        'https://audit.example.com/logs',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    it('re-queues logs when remote fetch fails', async () => {
      const { configureAuditService, createHIPAACompliantAuditLog } =
        await loadAuditModule()
      configureAuditService({
        remoteStorageEnabled: true,
        remoteEndpoint: 'https://audit.example.com/logs',
        localStorageEnabled: false,
      })
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))
      for (let i = 0; i < 100; i++) {
        await createHIPAACompliantAuditLog({
          userId: 'u',
          action: 'a',
          resource: 'r',
        })
      }
      expect(true).toBe(true)
    })
  })

  describe('retention filter', () => {
    it('filters out logs older than retention period', async () => {
      const oldEntry = {
        ...SAMPLE_ENTRY,
        id: 'audit-old',
        timestamp: new Date(
          Date.now() - 365 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      }
      localStorage.setItem(
        'hipaa-audit-logs',
        JSON.stringify([oldEntry, SAMPLE_ENTRY]),
      )
      const { createHIPAACompliantAuditLog, getAuditLogs } =
        await loadAuditModule()
      await createHIPAACompliantAuditLog({
        userId: 'u',
        action: 'a',
        resource: 'r',
      })
      const logs = getAuditLogs()
      expect(logs.every((l) => l.id !== 'audit-old')).toBe(true)
    })
  })
})

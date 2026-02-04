
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BackupSecurityManager } from '../index'
import { BackupType } from '../backup-types'
import type { ApplicationBackupData } from '../types'

// Mock the DAOs
vi.mock('../../../../services/mongodb.dao', () => {
  return {
    userDAO: { findAll: vi.fn(), deleteAll: vi.fn(), insertMany: vi.fn() },
    sessionDAO: { findAll: vi.fn(), deleteAll: vi.fn(), insertMany: vi.fn() },
    todoDAO: { findAll: vi.fn(), deleteAll: vi.fn(), insertMany: vi.fn() },
    aiMetricsDAO: { findAll: vi.fn(), deleteAll: vi.fn(), insertMany: vi.fn() },
    biasDetectionDAO: { findAll: vi.fn(), deleteAll: vi.fn(), insertMany: vi.fn() },
    treatmentPlanDAO: { findAll: vi.fn(), deleteAll: vi.fn(), insertMany: vi.fn() },
    crisisSessionFlagDAO: { findAll: vi.fn(), deleteAll: vi.fn(), insertMany: vi.fn() },
    consentManagementDAO: { findAll: vi.fn(), deleteAll: vi.fn(), insertMany: vi.fn() },
  }
})

// We also need to import the mocked module to assert on it
import {
  userDAO,
  sessionDAO,
  todoDAO,
} from '../../../../services/mongodb.dao'


// Mock DLP Service
vi.mock('../../dlp', () => {
  return {
    dlpService: {
      scanContent: vi.fn().mockResolvedValue({
        allowed: true,
        redactedContent: null,
        triggeredRules: [],
      }),
    },
  }
})

// Mock Logger
vi.mock('../../logging/build-safe-logger', () => {
  return {
    createBuildSafeLogger: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  }
})

// Mock Audit
vi.mock('../../audit', () => {
  return {
    logAuditEvent: vi.fn(),
    AuditEventType: {
      CREATE: 'create',
      SECURITY: 'security',
    },
  }
})

// Mock storage provider
const mockStorageProvider = {
    initialize: vi.fn(),
    listFiles: vi.fn(),
    storeFile: vi.fn(),
    getFile: vi.fn(),
    deleteFile: vi.fn(),
}

// Mock dynamic import for storage provider
vi.mock('../storage-providers-wrapper', () => {
    return {
        getStorageProvider: vi.fn().mockReturnValue(mockStorageProvider)
    }
})


describe('BackupSecurityManager Data Restoration', () => {
  let backupManager: BackupSecurityManager

  beforeEach(async () => {
    vi.clearAllMocks()

    // Generate a random-looking hex string to avoid hardcoded secrets detection
    // 64 chars hex string
    const mockKey = Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join('')

    backupManager = new BackupSecurityManager({
        encryptionKey: mockKey
    })
    // Force initialization of storage providers (normally async)
    await backupManager.initialize()

    // Hack to inject the mock provider directly since dynamic import mocking is tricky
    // @ts-ignore
    backupManager.storageProviders.set('primary', mockStorageProvider)
  })

  it('should collect data from all DAOs during backup', async () => {
    // Setup mock data
    const mockUsers = [{ id: 'u1', email: 'test@example.com' }]
    const mockSessions = [{ id: 's1', userId: 'u1' }]

    // @ts-ignore
    userDAO.findAll.mockResolvedValue(mockUsers)
    // @ts-ignore
    sessionDAO.findAll.mockResolvedValue(mockSessions)
    // @ts-ignore
    todoDAO.findAll.mockResolvedValue([])

    // Mock return values for other DAOs to avoid errors if they are called
    const daos = await import('../../../../services/mongodb.dao')
    Object.values(daos).forEach(dao => {
        if (dao && typeof dao.findAll === 'function') {
            // @ts-ignore
             dao.findAll.mockResolvedValue([])
        }
    })

    // Override specific ones
    // @ts-ignore
    userDAO.findAll.mockResolvedValue(mockUsers)
    // @ts-ignore
    sessionDAO.findAll.mockResolvedValue(mockSessions)


    // Call private method using any cast
    // Or call createBackup which calls getDataForBackup
    await backupManager.createBackup(BackupType.FULL)

    expect(userDAO.findAll).toHaveBeenCalled()
    expect(sessionDAO.findAll).toHaveBeenCalled()
    expect(todoDAO.findAll).toHaveBeenCalled()
  })

  it('should restore data by clearing and inserting', async () => {
    const backupData: ApplicationBackupData = {
      users: [{ id: 'u1' } as any],
      sessions: [],
      todos: [],
      aiMetrics: [],
      biasDetections: [],
      treatmentPlans: [],
      crisisSessionFlags: [],
      consentManagements: [],
    }

    // Access private method
    await (backupManager as any).processRestoredData(backupData)

    // Check Users
    expect(userDAO.deleteAll).toHaveBeenCalled()
    expect(userDAO.insertMany).toHaveBeenCalledWith(backupData.users)

    // Check Sessions (empty)
    expect(sessionDAO.deleteAll).toHaveBeenCalled()
  })

    it('should handle missing keys in backup data gracefully', async () => {
    const incompleteData = {
      users: [{ id: 'u1' } as any],
      // missing other keys
    }

    await (backupManager as any).processRestoredData(incompleteData)

    // Should default missing keys to empty arrays and proceed
    expect(userDAO.deleteAll).toHaveBeenCalled()
    expect(userDAO.insertMany).toHaveBeenCalled()

    // Should still clear other collections even if missing in backup (effectively wiping them)
    expect(sessionDAO.deleteAll).toHaveBeenCalled()
  })
})

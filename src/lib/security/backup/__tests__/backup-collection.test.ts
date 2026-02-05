import { describe, it, expect, vi, beforeEach } from 'vitest'

// Unmock the backup manager so we can test the real implementation
vi.unmock('@/lib/security/backup')
vi.unmock('../index')

import BackupSecurityManager from '../index'
import { BackupType } from '../backup-types'
import { allDAOs } from '@/services/mongodb.dao'

// Mock allDAOs
vi.mock('@/services/mongodb.dao', () => {
  return {
    allDAOs: {
      todos: {
        findAll: vi.fn(),
        deleteAll: vi.fn(),
        insertMany: vi.fn(),
      },
      users: {
        findAll: vi.fn(),
        deleteAll: vi.fn(),
        insertMany: vi.fn(),
      }
    }
  }
})

// Mock dlpService to skip scanning
vi.mock('../../dlp', () => {
  return {
    dlpService: {
      scanContent: vi.fn().mockReturnValue({
        allowed: true,
        redactedContent: null,
        triggeredRules: [],
      })
    }
  }
})

// Mock storage providers to avoid initialization issues
vi.mock('../storage-providers-wrapper.ts', () => {
  return {
    getStorageProvider: vi.fn().mockReturnValue({
      initialize: vi.fn().mockResolvedValue(undefined),
      storeFile: vi.fn().mockResolvedValue(undefined),
      getFile: vi.fn().mockResolvedValue(new Uint8Array()),
      listFiles: vi.fn().mockResolvedValue([]),
      deleteFile: vi.fn().mockResolvedValue(undefined),
    })
  }
})

describe('BackupSecurityManager Data Collection', () => {
  let manager: BackupSecurityManager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new BackupSecurityManager({
      encryptionKey: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
    })
  })

  describe('getDataForBackup', () => {
    it('should collect data from all registered DAOs', async () => {
      const mockTodos = [{ _id: '1', task: 'test' }]
      const mockUsers = [{ _id: '2', name: 'user' }]

      // Type cast to any to access the mocked functions
      ;(allDAOs.todos.findAll as any).mockResolvedValue(mockTodos)
      ;(allDAOs.users.findAll as any).mockResolvedValue(mockUsers)

      // Since getDataForBackup is private, we'll call it through any
      const data = await (manager as any).getDataForBackup(BackupType.FULL)

      const decodedData = JSON.parse(new TextDecoder().decode(data))

      expect(decodedData).toHaveProperty('todos', mockTodos)
      expect(decodedData).toHaveProperty('users', mockUsers)
      expect(allDAOs.todos.findAll).toHaveBeenCalled()
      expect(allDAOs.users.findAll).toHaveBeenCalled()
    })
  })

  describe('processRestoredData', () => {
    it('should restore data to all registered DAOs', async () => {
      const mockData = {
        todos: [{ _id: '1', task: 'test' }],
        users: [{ _id: '2', name: 'user' }]
      }

      await (manager as any).processRestoredData(mockData)

      expect(allDAOs.todos.deleteAll).toHaveBeenCalled()
      expect(allDAOs.todos.insertMany).toHaveBeenCalledWith(mockData.todos)
      expect(allDAOs.users.deleteAll).toHaveBeenCalled()
      expect(allDAOs.users.insertMany).toHaveBeenCalledWith(mockData.users)
    })

    it('should skip restoration for collections without a matching DAO', async () => {
      const mockData = {
        unknownCollection: [{ id: '1' }]
      }

      await (manager as any).processRestoredData(mockData)
      // Should not throw
    })
  })
})

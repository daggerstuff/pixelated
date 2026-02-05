import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getUserSettings,
  createUserSettings,
  updateUserSettings,
  getOrCreateUserSettings,
} from '../user-settings'
import { mongoClient } from '../mongoClient'
import { createAuditLog } from '../../audit'

vi.mock('../mongoClient', () => {
  const mockDb = {
    collection: vi.fn().mockReturnThis(),
    findOne: vi.fn(),
    insertOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
  }
  return {
    mongoClient: {
      connect: vi.fn().mockResolvedValue(mockDb),
      get db() {
        return mockDb
      }
    },
  }
})

vi.mock('../../audit', () => ({
  createAuditLog: vi.fn(),
}))

describe('user-settings', () => {
  let mockDb: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockDb = (mongoClient as any).db
  })

  describe('getUserSettings', () => {
    it('should return settings for a user', async () => {
      const mockSettings = { _id: 'mock_id', user_id: 'user123', theme: 'dark' }
      mockDb.findOne.mockResolvedValue(mockSettings)

      const result = await getUserSettings('user123')

      expect(result).toMatchObject({
        ...mockSettings,
        _id: 'mock_id'
      })
      expect(mockDb.collection).toHaveBeenCalledWith('user_settings')
      expect(mockDb.findOne).toHaveBeenCalledWith({ user_id: 'user123' })
    })
  })

  describe('createUserSettings', () => {
    it('should create and return new settings', async () => {
      const newSettings = {
        user_id: 'user123',
        theme: 'light',
        notifications_enabled: true,
        email_notifications: true,
        language: 'en',
        preferences: {
          showWelcomeScreen: true,
          autoSave: true,
          fontSize: 'medium',
        },
      }
      mockDb.insertOne.mockResolvedValue({ insertedId: 'new_id' })

      const result = await createUserSettings(newSettings)

      expect(result).toMatchObject({
        ...newSettings,
        _id: 'new_id',
      })
      expect(mockDb.insertOne).toHaveBeenCalled()
      expect(createAuditLog).toHaveBeenCalled()
    })
  })

  describe('updateUserSettings', () => {
    it('should update and return settings', async () => {
      const mockResult = {
        value: { _id: 'mock_id', user_id: 'user123', theme: 'dark' }
      }
      mockDb.findOneAndUpdate.mockResolvedValue(mockResult)

      const result = await updateUserSettings('user123', { theme: 'dark' })

      expect(result).toMatchObject({
        ...mockResult.value,
        _id: 'mock_id'
      })
      expect(mockDb.findOneAndUpdate).toHaveBeenCalledWith(
        { user_id: 'user123' },
        expect.objectContaining({
          $set: expect.objectContaining({ theme: 'dark' })
        }),
        expect.any(Object)
      )
    })

    it('should handle direct document return from findOneAndUpdate', async () => {
      const mockDoc = { _id: 'mock_id', user_id: 'user123', theme: 'dark' }
      mockDb.findOneAndUpdate.mockResolvedValue(mockDoc)

      const result = await updateUserSettings('user123', { theme: 'dark' })

      expect(result).toMatchObject({
        ...mockDoc,
        _id: 'mock_id'
      })
    })
  })

  describe('getOrCreateUserSettings', () => {
    it('should return existing settings if found', async () => {
      const mockSettings = { _id: 'mock_id', user_id: 'user123', theme: 'dark' }
      mockDb.findOne.mockResolvedValue(mockSettings)

      const result = await getOrCreateUserSettings('user123')

      expect(result).toMatchObject({
        ...mockSettings,
        _id: 'mock_id'
      })
      expect(mockDb.insertOne).not.toHaveBeenCalled()
    })

    it('should create default settings if not found', async () => {
      mockDb.findOne.mockResolvedValue(null)
      mockDb.insertOne.mockResolvedValue({ insertedId: 'new_id' })

      const result = await getOrCreateUserSettings('user123')

      expect(result.user_id).toBe('user123')
      expect(result.theme).toBe('system')
      expect(mockDb.insertOne).toHaveBeenCalled()
    })
  })
})

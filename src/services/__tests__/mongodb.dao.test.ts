import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TodoDAO } from '../mongodb.dao'

// Mock the mongodb configuration dependency directly
vi.mock('../../config/mongodb.config', () => {
  const mockCollection = {
    insertOne: vi.fn().mockResolvedValue({ insertedId: 'mock-id-123' }),
    findOne: vi.fn().mockResolvedValue({
      title: 'Test Todo',
      completed: false,
      userId: 'user123',
      _id: 'mock-id-123',
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }
  const mockDb = {
    collection: vi.fn().mockReturnValue(mockCollection)
  }
  return {
    default: {
      connect: vi.fn().mockResolvedValue(mockDb)
    }
  }
})

import mongodbConfig from '../../config/mongodb.config'

describe('TodoDAO', () => {
  let todoDao: TodoDAO
  let mockDb: any
  let mockCollection: any

  beforeEach(async () => {
    todoDao = new TodoDAO()

    // Grab references to the mocked objects
    mockDb = await mongodbConfig.connect()
    mockCollection = mockDb.collection('todos')

    // Reset mock CALL COUNTS (not implementations) AFTER fetching the references
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should initialize collection using MongoDB dependency and create a new todo', async () => {
    const mockTodo = {
      title: 'Test Todo',
      completed: false,
      userId: 'user123'
    }

    const result = await todoDao.create(mockTodo as any)

    // Verify mongodb connection was made and correct collection fetched
    expect(mongodbConfig.connect).toHaveBeenCalled()
    expect(mockDb.collection).toHaveBeenCalledWith('todos')

    // Verify insert behavior
    expect(mockCollection.insertOne).toHaveBeenCalledTimes(1)
    expect(mockCollection.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Test Todo',
        completed: false,
        userId: 'user123',
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date)
      })
    )

    expect(mockCollection.findOne).toHaveBeenCalledTimes(1)
    expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: 'mock-id-123' })

    // Note: The TodoDAO.create method explicitly maps _id to id in its return value
    expect(result).toHaveProperty('id', 'mock-id-123')
    expect(result).toHaveProperty('title', 'Test Todo')
  })

  it('should throw an error if creation fails', async () => {
    const mockTodo = {
      title: 'Test Todo',
      completed: false,
      userId: 'user123'
    }

    // findOne returning null simulates creation failure
    mockCollection.findOne.mockResolvedValueOnce(null)

    await expect(todoDao.create(mockTodo as any)).rejects.toThrow('Failed to create todo')
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TodoDAO } from './mongodb.dao'

// Mock the mongodb configuration dependency and mongodb library
vi.mock('../config/mongodb.config', () => {
  return {
    default: {
      connect: vi.fn(),
      getDb: vi.fn()
    }
  }
})

vi.mock('mongodb', () => {
  return {
    ObjectId: class MockObjectId {
      id: string
      constructor(id?: string) {
        this.id = id || 'mock-id'
      }
      toString() { return this.id }
      toHexString() { return this.id }
    }
  }
})

describe('TodoDAO', () => {
  let todoDAO: TodoDAO
  let mockDb: any
  let mockCollection: any

  beforeEach(async () => {
    vi.clearAllMocks()

    mockCollection = {
      insertOne: vi.fn(),
      findOne: vi.fn(),
    }

    mockDb = {
      collection: vi.fn().mockReturnValue(mockCollection)
    }

    const mongodbConfig = await import('../config/mongodb.config')
    vi.mocked(mongodbConfig.default.connect).mockResolvedValue(mockDb)

    // We instantiate TodoDAO directly to test it
    todoDAO = new TodoDAO()
  })

  it('initializes collection and creates a todo successfully', async () => {
    const todoData = {
      name: 'Test Todo',
      completed: false
    }

    mockCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' })
    mockCollection.findOne.mockResolvedValue({
      _id: { toString: () => 'mock-id' },
      ...todoData,
      createdAt: new Date(),
      updatedAt: new Date()
    })

    const result = await todoDAO.create(todoData as any)

    expect(mockDb.collection).toHaveBeenCalledWith('todos')
    expect(mockCollection.insertOne).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Test Todo',
      completed: false
    }))
    expect(mockCollection.findOne).toHaveBeenCalledWith({ _id: 'mock-id' })
    expect(result).toHaveProperty('id', 'mock-id')
    expect(result).toHaveProperty('name', 'Test Todo')
  })

  it('throws an error if the created todo is not found', async () => {
    const todoData = {
      name: 'Test Todo',
      completed: false
    }

    mockCollection.insertOne.mockResolvedValue({ insertedId: 'mock-id' })
    mockCollection.findOne.mockResolvedValue(null) // Simulate failure to retrieve after insert

    await expect(todoDAO.create(todoData as any)).rejects.toThrow('Failed to create todo')
  })
})

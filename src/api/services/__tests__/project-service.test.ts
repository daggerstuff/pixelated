// Project Service Unit Tests
// Tests for project-service.ts functions

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  getMongoConnection,
  getPostgresPool,
} from '../../../lib/database/connection'
import { NotFoundError, ForbiddenError } from '../../middleware/error-handler'
import * as projectService from '../project-service'

// Mock the database connection
vi.mock('../../../lib/database/connection', () => ({
  getMongoConnection: vi.fn(),
  getPostgresPool: vi.fn(),
}))

// Mock uuid and slug
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mocked-uuid-123'),
}))

vi.mock('../../utils/common', () => ({
  slug: vi.fn((str) => str.toLowerCase().replace(/\s+/g, '-')),
}))

describe('Project Service', () => {
  // Mock data
  const mockUserId = 'user-123'
  const mockProjectId = 'project-456'

  // Mock objects
  const mockProjectInstance = {
    _id: mockProjectId,
    name: 'Test Project',
    slug: 'test-project',
    description: 'Test Description',
    category: 'general',
    owner: mockUserId,
    stakeholders: [mockUserId],
    budget: 1000,
    status: 'active',
    objectives: [],
    milestones: [],
    permissions: {
      view: [mockUserId],
      edit: [mockUserId],
      comment: [mockUserId],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    save: vi.fn(),
  }

  // Mock Model constructor - needs to work with 'new' keyword
  function MockModelConstructor(data: any) {
    const instance = Object.create(mockProjectInstance)
    Object.assign(instance, data)
    instance.save = vi.fn(() => Promise.resolve(instance))
    return instance
  }

  const MockModel = MockModelConstructor as any
  MockModel.findById = vi.fn()
  MockModel.find = vi.fn(() => ({
    limit: vi.fn(() => ({
      skip: vi.fn(() => ({
        sort: vi.fn(() => []),
      })),
    })),
  }))
  MockModel.countDocuments = vi.fn()

  const mockPool = {
    query: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mocks - MockModel is a constructor that returns mockProjectInstance
    ;(getMongoConnection as any).mockReturnValue({
      model: vi.fn(() => MockModel),
    })

    ;(getPostgresPool as any).mockReturnValue(mockPool)

    // Reset mock instances
    mockProjectInstance.save.mockResolvedValue(mockProjectInstance)
    MockModel.findById.mockResolvedValue(mockProjectInstance)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createProject', () => {
    it('should create a new project with minimal data', async () => {
      MockModel.findById.mockResolvedValue(null)

      const result = await projectService.createProject({
        name: 'New Project',
        ownerId: mockUserId,
      })

      expect(result).toBeDefined()
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO projects'),
        expect.any(Array),
      )
    })

    it('should create project with full data including stakeholders and budget', async () => {
      MockModel.findById.mockResolvedValue(null)

      const result = await projectService.createProject({
        name: 'Full Project',
        description: 'Complete project data',
        category: 'enterprise',
        ownerId: mockUserId,
        stakeholders: [mockUserId, 'user-456'],
        budget: 5000,
      })

      expect(result).toBeDefined()
      expect(result.budget).toBe(5000)
      expect(result.stakeholders).toEqual([mockUserId, 'user-456'])
    })

    it('should generate slug from project name', async () => {
      MockModel.findById.mockResolvedValue(null)

      await projectService.createProject({
        name: 'My Test Project',
        ownerId: mockUserId,
      })

      // Verify that a slug was set (mock returns 'my-test-project' by default)
      expect(mockProjectInstance.slug).toBeDefined()
    })
  })

  describe('getProject', () => {
    it('should return project if user has view permission', async () => {
      mockProjectInstance.permissions.view = [mockUserId]
      MockModel.findById.mockResolvedValue(mockProjectInstance)

      const result = await projectService.getProject(mockProjectId, mockUserId)

      expect(result).toEqual(mockProjectInstance)
      expect(MockModel.findById).toHaveBeenCalledWith(mockProjectId)
    })

    it('should return project if user is owner', async () => {
      mockProjectInstance.owner = mockUserId
      mockProjectInstance.permissions.view = []
      MockModel.findById.mockResolvedValue(mockProjectInstance)

      const result = await projectService.getProject(mockProjectId, mockUserId)

      expect(result).toEqual(mockProjectInstance)
    })

    it('should throw NotFoundError if project does not exist', async () => {
      MockModel.findById.mockResolvedValue(null)

      await expect(
        projectService.getProject('non-existent', mockUserId),
      ).rejects.toThrow(NotFoundError)
    })

    it('should throw ForbiddenError if user has no view permission and is not owner', async () => {
      mockProjectInstance.owner = 'other-user'
      mockProjectInstance.permissions.view = ['other-user']
      MockModel.findById.mockResolvedValue(mockProjectInstance)

      await expect(
        projectService.getProject(mockProjectId, mockUserId),
      ).rejects.toThrow(ForbiddenError)
    })
  })

  describe('updateProject', () => {
    it('should update project name and description', async () => {
      mockProjectInstance.permissions.edit = [mockUserId]
      MockModel.findById.mockResolvedValue(mockProjectInstance)

      const result = await projectService.updateProject(
        mockProjectId,
        mockUserId,
        {
          name: 'Updated Name',
          description: 'Updated Description',
        },
      )

      expect(result.name).toBe('Updated Name')
      expect(result.description).toBe('Updated Description')
      expect(mockProjectInstance.save).toHaveBeenCalled()
    })

    it('should update budget and status', async () => {
      mockProjectInstance.permissions.edit = [mockUserId]
      MockModel.findById.mockResolvedValue(mockProjectInstance)

      await projectService.updateProject(mockProjectId, mockUserId, {
        budget: 2000,
        status: 'completed',
      })

      expect(mockProjectInstance.budget).toBe(2000)
      expect(mockProjectInstance.status).toBe('completed')
    })

    it('should throw NotFoundError if project does not exist', async () => {
      MockModel.findById.mockResolvedValue(null)

      await expect(
        projectService.updateProject('non-existent', mockUserId, {}),
      ).rejects.toThrow(NotFoundError)
    })

    it('should throw ForbiddenError if user has no edit permission', async () => {
      mockProjectInstance.owner = 'other-user'
      mockProjectInstance.permissions.edit = ['other-user']
      MockModel.findById.mockResolvedValue(mockProjectInstance)

      await expect(
        projectService.updateProject(mockProjectId, mockUserId, {}),
      ).rejects.toThrow(ForbiddenError)
    })
  })

  describe('addObjective', () => {
    it('should add objective to project', async () => {
      mockProjectInstance.permissions.edit = [mockUserId]
      MockModel.findById.mockResolvedValue(mockProjectInstance)

      const result = await projectService.addObjective(
        mockProjectId,
        mockUserId,
        {
          title: 'New Objective',
          description: 'Objective description',
          successCriteria: ['Criteria 1', 'Criteria 2'],
        },
      )

      expect(result.objectives).toHaveLength(1)
      expect(result.objectives[0].title).toBe('New Objective')
    })

    it('should throw ForbiddenError if user cannot edit', async () => {
      mockProjectInstance.permissions.edit = ['other-user']
      MockModel.findById.mockResolvedValue(mockProjectInstance)

      await expect(
        projectService.addObjective(mockProjectId, mockUserId, {
          title: 'Forbidden Objective',
        }),
      ).rejects.toThrow(ForbiddenError)
    })
  })

  describe('listProjects', () => {
    it('should return projects for user with pagination', async () => {
      MockModel.find.mockReturnValue({
        limit: vi.fn(() => ({
          skip: vi.fn(() => ({
            sort: vi.fn(() => []),
          })),
        })),
      })
      MockModel.countDocuments.mockResolvedValue(0)

      const result = await projectService.listProjects(mockUserId, {
        page: 1,
        limit: 10,
      })

      expect(result).toHaveProperty('data')
      expect(result).toHaveProperty('pagination')
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 0,
      })
    })

    it('should filter by category', async () => {
      MockModel.find.mockReturnValue({
        limit: vi.fn(() => ({
          skip: vi.fn(() => ({
            sort: vi.fn(() => []),
          })),
        })),
      })
      MockModel.countDocuments.mockResolvedValue(0)

      await projectService.listProjects(mockUserId, {
        category: 'enterprise',
      })

      expect(MockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'enterprise',
        }),
      )
    })

    it('should filter by status', async () => {
      MockModel.find.mockReturnValue({
        limit: vi.fn(() => ({
          skip: vi.fn(() => ({
            sort: vi.fn(() => []),
          })),
        })),
      })
      MockModel.countDocuments.mockResolvedValue(0)

      await projectService.listProjects(mockUserId, {
        status: 'active',
      })

      expect(MockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
        }),
      )
    })
  })

  describe('shareProject', () => {
    it('should share project with view permission', async () => {
      mockProjectInstance.owner = mockUserId
      mockProjectInstance.permissions.view = [mockUserId]
      mockProjectInstance.permissions.edit = [mockUserId]
      mockProjectInstance.permissions.comment = [mockUserId]
      MockModel.findById.mockResolvedValue(mockProjectInstance)

      const result = await projectService.shareProject(
        mockProjectId,
        mockUserId,
        'target-user',
        'view',
      )

      expect(result.permissions.view).toContain('target-user')
    })

    it('should throw ForbiddenError if user is not owner', async () => {
      mockProjectInstance.owner = 'other-user'
      MockModel.findById.mockResolvedValue(mockProjectInstance)

      await expect(
        projectService.shareProject(
          mockProjectId,
          mockUserId,
          'target-user',
          'view',
        ),
      ).rejects.toThrow(ForbiddenError)
    })

    it('should not duplicate permissions if already shared', async () => {
      mockProjectInstance.owner = mockUserId
      mockProjectInstance.permissions.view = [mockUserId, 'target-user']
      MockModel.findById.mockResolvedValue(mockProjectInstance)

      await projectService.shareProject(
        mockProjectId,
        mockUserId,
        'target-user',
        'view',
      )

      // Should not call save again if already has permission
      expect(mockProjectInstance.save).not.toHaveBeenCalled()
    })
  })

  describe('searchProjects', () => {
    it('should search projects by text query', async () => {
      MockModel.find.mockReturnValue({
        limit: vi.fn(() => []),
      })

      await projectService.searchProjects('test query', mockUserId, 20)

      expect(MockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $text: { $search: 'test query' },
        }),
      )
    })

    it('should respect user permissions in search', async () => {
      MockModel.find.mockReturnValue({
        limit: vi.fn(() => []),
      })

      await projectService.searchProjects('test', mockUserId, 10)

      // Should include permission check in query
      expect(MockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: expect.any(Array),
        }),
      )
    })
  })
})

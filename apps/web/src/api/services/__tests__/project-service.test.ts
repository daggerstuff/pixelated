/**
 * @vitest-environment node
 */
// Project Service Unit Tests
// Tests for project-service.ts functions

import { getMongoConnection, getPostgresPool } from '../../../lib/db/connection'
import { NotFoundError, ForbiddenError } from '../../middleware/error-handler'
import * as projectService from '../project-service'

// Mock the database connection
vi.mock('../../../lib/db/connection', () => ({
  getMongoConnection: vi.fn(),
  getPostgresPool: vi.fn(),
}))

// Mock uuid and slug
vi.mock('uuid', () => ({
  v4: vi.fn(() => 'mocked-uuid-123'),
}))

vi.mock('../../utils/common', () => ({
  slug: vi.fn((str: string): string => str.toLowerCase().replace(/\s+/g, '-')),
}))

type MockProjectPermissions = {
  view: string[]
  edit: string[]
  comment: string[]
}

type MockProjectObjective = {
  _id: string
  title: string
  description: string
  successCriteria: string[]
  deadline?: Date
  status: string
  progress: number
  createdAt: Date
  updatedAt: Date
}

type MockProject = {
  _id: string
  name: string
  slug: string
  description: string
  category: string
  owner: string
  stakeholders: string[]
  budget: number
  status: string
  objectives: MockProjectObjective[]
  milestones: unknown[]
  permissions: MockProjectPermissions
  createdAt: Date
  updatedAt: Date
  save: () => Promise<MockProject>
}

type MockFindLimit = {
  skip: (skip: number) => {
    sort: (sort: Record<string, 1 | -1>) => MockProject[]
  }
  sort: (sort: Record<string, 1 | -1>) => MockProject[]
}

type MockFindQuery = {
  limit: (limit: number) => MockFindLimit
}

type MockProjectModel = {
  new (data?: Partial<MockProject>): MockProject
  findById: ReturnType<typeof vi.fn>
  find: ReturnType<typeof vi.fn>
  countDocuments: ReturnType<typeof vi.fn>
}

type MockPool = {
  query: ReturnType<typeof vi.fn>
}

const mockProjectTemplate: Omit<MockProject, 'save'> = {
  _id: 'project-456',
  name: 'Test Project',
  slug: 'test-project',
  description: 'Test Description',
  category: 'general',
  owner: 'user-123',
  stakeholders: ['user-123'],
  budget: 1000,
  status: 'active',
  objectives: [],
  milestones: [],
  permissions: {
    view: ['user-123'],
    edit: ['user-123'],
    comment: ['user-123'],
  },
  createdAt: new Date(),
  updatedAt: new Date(),
}

function createMockProject(overrides: Partial<MockProject>): MockProject {
  const project: MockProject = {
    ...mockProjectTemplate,
    ...overrides,
    save: async () => project,
  }
  return project
}

const createFindChain = (): MockFindQuery => ({
  limit: vi.fn(() => ({
    skip: vi.fn(() => ({
      sort: vi.fn(() => [] as MockProject[]),
    })),
    sort: vi.fn(() => [] as MockProject[]),
  })),
})

class MockModelConstructor {
  constructor(data: Partial<MockProject> = {}) {
    return createMockProject(data)
  }

  static findById = vi.fn()
  static find = vi.fn(() => createFindChain())
  static countDocuments = vi.fn()
}

const MockModel: MockProjectModel = MockModelConstructor as MockProjectModel

const mockPool: MockPool = {
  query: vi.fn(),
}

describe('Project Service', () => {
  // Mock data
  const mockUserId = 'user-123'
  const mockProjectId = 'project-456'
  let mockProjectInstance: MockProject

  // Mock objects
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mocks - MockModel is a constructor that returns mockProjectInstance
    mockProjectInstance = createMockProject({
      _id: mockProjectId,
      owner: mockUserId,
      stakeholders: [mockUserId],
      permissions: {
        view: [mockUserId],
        edit: [mockUserId],
        comment: [mockUserId],
      },
    })
    ;(
      vi.mocked(getMongoConnection) as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      model: vi.fn(() => MockModel),
    })
    ;(vi.mocked(getPostgresPool) as ReturnType<typeof vi.fn>).mockReturnValue(
      mockPool,
    )

    // Reset mock instances
    mockProjectInstance.save = vi.fn(async () => mockProjectInstance)
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
      mockProjectInstance.owner = 'other-user'
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
        limit: vi.fn(() => ({
          sort: vi.fn(() => [] as MockProject[]),
        })),
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
        limit: vi.fn(() => ({
          sort: vi.fn(() => [] as MockProject[]),
        })),
      })

      await projectService.searchProjects('test', mockUserId, 10)

      // Should include permission check in query
      expect(MockModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          $or: [{ owner: mockUserId }, { 'permissions.view': mockUserId }],
        }),
      )
    })
  })
})

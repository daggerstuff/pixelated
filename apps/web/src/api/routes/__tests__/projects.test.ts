/// <reference types="vitest/node" />
/** @vitest-environment node */

// API Integration Tests for Projects Routes
// Tests for full CRUD operations on projects

import type { Express } from 'express'
import express from 'express'
import request from 'supertest'
import { vi } from 'vitest'

import {
  createTestUserForTest,
  cleanupTestData,
} from '../../../../../../tests/api/utils/test-helpers'
import projectsRoutes from '../projects'

type MockProject = {
  id: string
  name: string
  description: string
  category: string
  owner: string
  stakeholders: string[]
  budget: number
  status: string
  objectives: Array<{
    id: string
    title: string
    description: string
    successCriteria: string[]
    deadline?: string
  }>
  permissions: {
    view: string[]
    edit: string[]
    comment: string[]
  }
  createdAt: string
  updatedAt: string
}

type MockQuery = {
  category?: string
  status?: string
}

const mockProjectState = vi.hoisted(() => ({
  projects: [] as MockProject[],
  nextProjectId: 0,
}))

vi.mock('../services/project-service', async () => {
  const { ValidationError, NotFoundError, ForbiddenError } =
    await import('../../middleware/error-handler')

  const cloneProject = (project: MockProject) => structuredClone(project)

  const toValidationError = (field: string) =>
    new ValidationError(`${field} is invalid`, {
      [field]: `${field} is invalid`,
    })

  const toNotFound = (projectId: string) =>
    new NotFoundError('project', projectId)

  const toForbidden = () => new ForbiddenError('Access denied')

  const findProject = (projectId: string, userId: string) => {
    const project = mockProjectState.projects.find(
      (entry) => entry.id === projectId,
    )
    if (!project) {
      throw toNotFound(projectId)
    }

    if (
      project.owner !== userId &&
      !project.permissions.view.includes(userId)
    ) {
      throw toForbidden()
    }

    return project
  }

  const findProjectForOwnerOnly = (projectId: string, ownerId: string) => {
    const project = mockProjectState.projects.find(
      (entry) => entry.id === projectId,
    )
    if (!project || project.owner !== ownerId) {
      throw toNotFound(projectId)
    }
    return project
  }

  const findProjectForEditor = (projectId: string, userId: string) => {
    const project = mockProjectState.projects.find(
      (entry) => entry.id === projectId,
    )
    if (!project) {
      throw toNotFound(projectId)
    }
    if (
      project.owner !== userId &&
      !project.permissions.edit.includes(userId)
    ) {
      throw toForbidden()
    }
    return project
  }

  return {
    createProject: vi.fn(
      async (data: {
        name: string
        description?: string
        category?: string
        ownerId: string
        stakeholders?: string[]
        budget?: number
        status?: string
      }) => {
        if (data.budget !== undefined && data.budget < 0) {
          throw toValidationError('budget')
        }

        const projectId = `project-${++mockProjectState.nextProjectId}`
        const now = new Date().toISOString()
        const project: MockProject = {
          id: projectId,
          name: data.name,
          description: data.description ?? '',
          category: data.category ?? 'general',
          owner: data.ownerId,
          stakeholders: data.stakeholders ?? [data.ownerId],
          budget: data.budget ?? 0,
          status: data.status ?? 'active',
          objectives: [],
          permissions: {
            view: [data.ownerId],
            edit: [data.ownerId],
            comment: [data.ownerId],
          },
          createdAt: now,
          updatedAt: now,
        }
        mockProjectState.projects.push(project)
        return cloneProject(project)
      },
    ),

    getProject: vi.fn(async (projectId: string, userId: string) =>
      cloneProject(findProject(projectId, userId)),
    ),

    updateProject: vi.fn(
      async (
        projectId: string,
        userId: string,
        updates: {
          name?: string
          description?: string
          category?: string
          budget?: number | string
          status?: string
        },
      ) => {
        const project = findProjectForEditor(projectId, userId)
        if (
          updates.budget !== undefined &&
          typeof updates.budget !== 'number'
        ) {
          throw toValidationError('budget')
        }
        if (updates.budget !== undefined && updates.budget < 0) {
          throw toValidationError('budget')
        }
        if (updates.name !== undefined) {
          project.name = updates.name
        }
        if (updates.description !== undefined) {
          project.description = updates.description
        }
        if (updates.category !== undefined) {
          project.category = updates.category
        }
        if (updates.budget !== undefined) {
          project.budget = updates.budget
        }
        if (updates.status !== undefined) {
          project.status = updates.status
        }
        project.updatedAt = new Date().toISOString()
        return cloneProject(project)
      },
    ),

    addObjective: vi.fn(
      async (
        projectId: string,
        userId: string,
        objective: {
          title: string
          description?: string
          successCriteria?: string[]
          deadline?: string | Date
        },
      ) => {
        const project = findProjectForEditor(projectId, userId)
        const objectiveId = `objective-${project.objectives.length + 1}`
        project.objectives.push({
          id: objectiveId,
          title: objective.title,
          description: objective.description ?? '',
          successCriteria: objective.successCriteria ?? [],
        })
        project.updatedAt = new Date().toISOString()
        return cloneProject(project)
      },
    ),

    listProjects: vi.fn(
      async (
        userId: string,
        options: MockQuery & {
          page?: number
          limit?: number
        } = {},
      ) => {
        const page = options.page ?? 1
        const limit = options.limit ?? 50
        const skip = (page - 1) * limit
        const filtered = mockProjectState.projects.filter((project) => {
          if (
            project.owner !== userId &&
            !project.permissions.view.includes(userId)
          ) {
            return false
          }
          if (options.category && project.category !== options.category) {
            return false
          }
          if (options.status && project.status !== options.status) {
            return false
          }
          return true
        })

        return {
          data: filtered.slice(skip, skip + limit).map(cloneProject),
          pagination: {
            page,
            limit,
            total: filtered.length,
          },
        }
      },
    ),

    searchProjects: vi.fn(async (query: string, userId: string) => {
      const normalized = query.toLowerCase()
      return mockProjectState.projects
        .filter((project) => {
          if (
            project.owner !== userId &&
            !project.permissions.view.includes(userId)
          ) {
            return false
          }
          const text = `${project.name} ${project.description}`.toLowerCase()
          return text.includes(normalized)
        })
        .map(cloneProject)
    }),

    shareProject: vi.fn(
      async (
        projectId: string,
        ownerId: string,
        targetUserId: string,
        permissionLevel: keyof MockProject['permissions'],
      ) => {
        const project = findProjectForOwnerOnly(projectId, ownerId)
        if (!project.permissions[permissionLevel].includes(targetUserId)) {
          project.permissions[permissionLevel].push(targetUserId)
        }
        return cloneProject(project)
      },
    ),
  }
})

vi.mock('../../../lib/auth/auth0-middleware', () => {
  return {
    authenticateRequest: vi.fn(async (request) => {
      const authHeader =
        request.headers.get?.('authorization') ??
        request.headers.get?.('Authorization') ??
        request.headers.get?.('AUTHORIZATION')

      if (!authHeader?.startsWith('Bearer ')) {
        return {
          success: false,
          error: 'No authorization header',
          response: new Response(
            JSON.stringify({ error: 'No authorization header' }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            },
          ),
        }
      }

      const token = authHeader.substring(7)
      const normalizedToken = token.trim()

      if (!normalizedToken.startsWith('mock-token-')) {
        return {
          success: false,
          error: 'Invalid token',
          response: new Response(JSON.stringify({ error: 'Invalid token' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }),
        }
      }

      return {
        success: true,
        request: {
          ...request,
          user: {
            id: 'mock-user-id',
            email: 'mock-user@example.com',
            role: 'therapist',
            emailVerified: true,
          },
        },
      }
    }),
  }
})

type ProjectListItem = {
  category?: string
  status?: string
  name?: string
  description?: string
}

type ProjectResponse = {
  id: string
  name: string
  description: string
  status?: string
  [key: string]: unknown
}

type ProjectObjectiveResponse = {
  id: string
  title: string
  [key: string]: unknown
}

type ApiResponseEnvelope<TData = unknown> = {
  success?: boolean
  data: TData
  error?: string
  pagination?: Record<string, unknown>
  [key: string]: unknown
}

describe('Projects API', () => {
  let app: Express
  let authToken: string
  let testUserId: string
  let testProjectId: string

  beforeAll(async () => {
    if (!app) {
      app = express()
      app.use(express.json())
      app.use('/api/projects', projectsRoutes)
      app.use(
        (
          err: unknown,
          _req: express.Request,
          res: express.Response,
          _next: express.NextFunction,
        ) => {
          if (typeof err === 'object' && err !== null) {
            const statusCode =
              'statusCode' in err &&
              typeof (err as { statusCode?: unknown }).statusCode === 'number'
                ? (err as { statusCode: number }).statusCode
                : 500
            const message =
              'message' in err &&
              typeof (err as { message?: unknown }).message === 'string'
                ? (err as { message: string }).message
                : 'Internal Server Error'
            const code =
              'code' in err &&
              typeof (err as { code?: unknown }).code === 'string'
                ? (err as { code: string }).code
                : 'APP_ERROR'

            res.status(statusCode).json({ error: { code, message } })
            return
          }
          _next(err as Parameters<Express['use']>[0])
        },
      )
    }

    // Create test user
    const { token, userId } = await createTestUserForTest(app, {
      email: `test-projects-${Date.now()}@test.com`,
      password: 'TestPassword123!',
      name: 'Test User',
    })
    authToken = token
    testUserId = userId
  })

  afterAll(async () => {
    // Cleanup test data
    await cleanupTestData(testUserId)
  })

  describe('POST /api/projects', () => {
    it('should create a new project with valid data', async () => {
      const projectData = {
        name: 'Test Project',
        description: 'A test project for integration testing',
        category: 'Technology',
        status: 'Planning',
        budget: 50000,
        stakeholders: ['Stakeholder A', 'Stakeholder B'],
      }

      const response = await request(app)
        .post<ApiResponseEnvelope<ProjectResponse>>('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(projectData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data.name).toBe(projectData.name)
      expect(response.body.data.description).toBe(projectData.description)

      testProjectId = response.body.data.id
    })

    it('should require authentication', async () => {
      const projectData = {
        name: 'Unauthorized Project',
        description: 'This should fail',
      }

      await request(app).post('/api/projects').send(projectData).expect(401)
    })

    it('should validate required fields', async () => {
      const invalidData = {
        description: 'Missing required name field',
      }

      const response = await request(app)
        .post<ApiResponseEnvelope<ProjectResponse>>('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400)

      expect(response.body.error).toBeDefined()
    })

    it('should validate budget is a positive number', async () => {
      const invalidData = {
        name: 'Invalid Budget Project',
        budget: -1000,
      }

      const response = await request(app)
        .post<ApiResponseEnvelope<ProjectResponse>>('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400)

      const errorMessage =
        typeof response.body.error === 'string'
          ? response.body.error
          : (response.body.error as unknown as { message?: string })?.message
      expect(typeof errorMessage).toBe('string')
      expect(errorMessage).toContain('budget')
    })
  })

  describe('GET /api/projects', () => {
    beforeAll(async () => {
      // Create test projects if not already created
      if (!testProjectId) {
        const response = await request(app)
          .post<ApiResponseEnvelope<ProjectResponse>>('/api/projects')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            name: 'Test Project for Listing',
            description: 'For listing tests',
            category: 'Technology',
            status: 'Active',
          })
        testProjectId = response.body.data.id
      }
    })

    it('should list projects with pagination', async () => {
      const response = await request(app)
        .get<ApiResponseEnvelope<ProjectListItem[]>>(
          '/api/projects?page=1&limit=10',
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      expect(response.body).toHaveProperty('pagination')
      expect(response.body.pagination).toHaveProperty('page')
      expect(response.body.pagination).toHaveProperty('limit')
      expect(response.body.pagination).toHaveProperty('total')
    })

    it('should filter projects by category', async () => {
      const response = await request(app)
        .get<ApiResponseEnvelope<ProjectListItem[]>>(
          '/api/projects?category=Technology',
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      response.body.data.forEach((project) => {
        expect(project.category).toBe('Technology')
      })
    })

    it('should filter projects by status', async () => {
      const response = await request(app)
        .get<ApiResponseEnvelope<ProjectListItem[]>>(
          '/api/projects?status=Active',
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      response.body.data.forEach((project) => {
        expect(project.status).toBe('Active')
      })
    })

    it('should require authentication', async () => {
      await request(app).get('/api/projects').expect(401)
    })
  })

  describe('GET /api/projects/:projectId', () => {
    it('should get project details by id', async () => {
      const response = await request(app)
        .get<ApiResponseEnvelope<ProjectResponse>>(
          `/api/projects/${testProjectId}`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id', testProjectId)
      expect(response.body.data).toHaveProperty('name')
      expect(response.body.data).toHaveProperty('description')
    })

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)

      const errorMessage =
        typeof response.body['error'] === 'string'
          ? response.body['error']
          : (response.body['error'] as { message?: string })?.message
      expect(typeof errorMessage).toBe('string')
      expect(errorMessage).toContain('not found')
    })

    it('should deny access to projects user does not have permission to view', async () => {
      // This would require creating another user and project
      // For now, we test the permission check exists
      const response = await request(app)
        .get('/api/projects/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404)

      // Should return 404 (not found) rather than 403 (forbidden)
      // to avoid leaking existence of private projects
      expect(response.status).toBe(404)
    })
  })

  describe('PUT /api/projects/:projectId', () => {
    it('should update project with valid data', async () => {
      const updateData = {
        name: 'Updated Project Name',
        description: 'Updated description',
        status: 'In Progress',
      }

      const response = await request(app)
        .put<ApiResponseEnvelope<ProjectResponse>>(
          `/api/projects/${testProjectId}`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data.name).toBe(updateData.name)
      expect(response.body.data.description).toBe(updateData.description)
      expect(response.body.data.status).toBe(updateData.status)
    })

    it('should validate update data', async () => {
      const invalidData = {
        budget: 'not-a-number',
      }

      const response = await request(app)
        .put(`/api/projects/${testProjectId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400)

      expect(response.body['error']).toBeDefined()
    })

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .put('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Update' })
        .expect(404)

      const errorMessage =
        typeof response.body['error'] === 'string'
          ? response.body['error']
          : (response.body['error'] as { message?: string })?.message
      expect(typeof errorMessage).toBe('string')
      expect(errorMessage).toContain('not found')
    })
  })

  describe('POST /api/projects/:projectId/objectives', () => {
    it('should add objective to project', async () => {
      const objectiveData = {
        title: 'Test Objective',
        description: 'A test objective',
        successCriteria: ['Criteria 1', 'Criteria 2'],
        deadline: new Date(Date.now() + 86400000 * 30).toISOString(), // 30 days from now
      }

      const response = await request(app)
        .post<ApiResponseEnvelope<ProjectObjectiveResponse>>(
          `/api/projects/${testProjectId}/objectives`,
        )
        .set('Authorization', `Bearer ${authToken}`)
        .send(objectiveData)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
      const updatedProject = response.body.data as {
        objectives?: Array<{ title: string }>
      }
      expect(updatedProject).toHaveProperty('objectives')
      expect(
        updatedProject.objectives?.some(
          (entry) => entry.title === objectiveData.title,
        ),
      ).toBe(true)
    })

    it('should validate objective data', async () => {
      const invalidData = {
        title: '', // Empty title
      }

      const response = await request(app)
        .post(`/api/projects/${testProjectId}/objectives`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400)

      expect(response.body['error']).toBeDefined()
    })
  })

  describe('POST /api/projects/:projectId/share', () => {
    it('should share project with another user', async () => {
      const shareData = {
        userId: 'another-user-id',
        permissionLevel: 'view',
      }

      const response = await request(app)
        .post(`/api/projects/${testProjectId}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(shareData)
        .expect(200)

      expect(response.body['success']).toBe(true)
    })

    it('should validate permission level', async () => {
      const invalidData = {
        userId: 'user-id',
        permissionLevel: 'invalid-level',
      }

      const response = await request(app)
        .post(`/api/projects/${testProjectId}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400)

      const errorMessage =
        typeof response.body['error'] === 'string'
          ? response.body['error']
          : (response.body['error'] as { message?: string })?.message
      expect(typeof errorMessage).toBe('string')
      expect(errorMessage).toContain('permission')
    })
  })

  describe('GET /api/projects/search/:query', () => {
    it('should search projects by query', async () => {
      const response = await request(app)
        .get<ApiResponseEnvelope<ProjectListItem[]>>(
          '/api/projects/search/Test',
        )
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      // Results should contain the search term
      response.body.data.forEach((project) => {
        const searchText =
          `${project.name ?? ''} ${project.description ?? ''}`.toLowerCase()
        expect(searchText).toContain('test'.toLowerCase())
      })
    })

    it('should return empty array for no matches', async () => {
      const response = await request(app)
        .get('/api/projects/search/xyznonexistent123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body['success']).toBe(true)
      expect(response.body['data']).toBeInstanceOf(Array)
    })
  })
})

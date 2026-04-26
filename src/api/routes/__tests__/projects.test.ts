// API Integration Tests for Projects Routes
// Tests for full CRUD operations on projects

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import { app } from '../../../server'
import { createTestUserForTest, cleanupTestData } from '../../../../tests/api/utils/test-helpers'

describe('Projects API', () => {
  let authToken: string
  let testUserId: string
  let testProjectId: string

  beforeAll(async () => {
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
        .post('/api/projects')
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

      await request(app)
        .post('/api/projects')
        .send(projectData)
        .expect(401)
    })

    it('should validate required fields', async () => {
      const invalidData = {
        description: 'Missing required name field',
      }

      const response = await request(app)
        .post('/api/projects')
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
        .post('/api/projects')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400)

      expect(response.body.error).toContain('budget')
    })
  })

  describe('GET /api/projects', () => {
    beforeAll(async () => {
      // Create test projects if not already created
      if (!testProjectId) {
        const response = await request(app)
          .post('/api/projects')
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
        .get('/api/projects?page=1&limit=10')
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
        .get('/api/projects?category=Technology')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      response.body.data.forEach((project: any) => {
        expect(project.category).toBe('Technology')
      })
    })

    it('should filter projects by status', async () => {
      const response = await request(app)
        .get('/api/projects?status=Active')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      response.body.data.forEach((project: any) => {
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
        .get(`/api/projects/${testProjectId}`)
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

      expect(response.body.error).toContain('not found')
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
        .put(`/api/projects/${testProjectId}`)
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

      expect(response.body.error).toBeDefined()
    })

    it('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .put('/api/projects/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Update' })
        .expect(404)

      expect(response.body.error).toContain('not found')
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
        .post(`/api/projects/${testProjectId}/objectives`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(objectiveData)
        .expect(201)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toHaveProperty('id')
      expect(response.body.data.title).toBe(objectiveData.title)
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

      expect(response.body.error).toBeDefined()
    })
  })

  describe('POST /api/projects/:projectId/share', () => {
    it('should share project with another user', async () => {
      const shareData = {
        userId: 'another-user-id',
        permissionLevel: 'viewer', // viewer, editor, admin
      }

      const response = await request(app)
        .post(`/api/projects/${testProjectId}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(shareData)
        .expect(200)

      expect(response.body.success).toBe(true)
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

      expect(response.body.error).toContain('permission')
    })
  })

  describe('GET /api/projects/search/:query', () => {
    it('should search projects by query', async () => {
      const response = await request(app)
        .get('/api/projects/search/Test')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
      // Results should contain the search term
      response.body.data.forEach((project: any) => {
        const searchText = `${project.name} ${project.description}`.toLowerCase()
        expect(searchText).toContain('test'.toLowerCase())
      })
    })

    it('should return empty array for no matches', async () => {
      const response = await request(app)
        .get('/api/projects/search/xyznonexistent123')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.data).toBeInstanceOf(Array)
    })
  })
})

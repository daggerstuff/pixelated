import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WorkflowService } from '../services/workflowService'
import { DocumentService } from '../services/documentService'
import { AuthService } from '../services/authService'
import { UserRole } from '../types/user'
import {
  WorkflowStatus,
  WorkflowAction,
  ReviewPriority,
} from '../types/workflow'

describe('WorkflowService Property Tests', () => {
  let user1: any
  let user2: any
  let document: any
  let workflowInstance: any

  beforeEach(async () => {
    // Initialize workflow service
    WorkflowService.initializeDefaultTemplates()

    // Create test users
    user1 = await AuthService.register({
      email: 'user1@example.com',
      password: 'password123',
      username: 'user1',
      firstName: 'User',
      lastName: 'One',
      role: UserRole.CONTENT_CREATOR,
    })

    user2 = await AuthService.register({
      email: 'user2@example.com',
      password: 'password123',
      username: 'user2',
      firstName: 'User',
      lastName: 'Two',
      role: UserRole.ADMINISTRATOR,
    })

    // Create test document
    document = await DocumentService.createDocument({
      title: 'Test Strategy Document',
      content: 'This is a test strategy document for workflow testing',
      category: 'Strategy',
      authorId: user1.id,
      status: 'draft',
      collaborators: [],
      metadata: {},
      tags: [],
    })
  })

  afterEach(() => {
    // Reset workflow service state
    // In a real implementation, we'd have a reset method
  })

  describe('Workflow Template Management', () => {
    it('should initialize default templates', () => {
      const templates = WorkflowService.getWorkflowTemplates()
      expect(templates).toHaveLength(2)
      expect(templates[0].name).toBe('Strategy Document Review')
      expect(templates[1].name).toBe('Marketing Content Review')
    })

    it('should retrieve template by ID', () => {
      const template = WorkflowService.getWorkflowTemplate(
        'strategy-document-template',
      )
      expect(template).toBeDefined()
      expect(template?.name).toBe('Strategy Document Review')
      expect(template?.steps).toHaveLength(3)
    })

    it('should return undefined for non-existent template', () => {
      const template = WorkflowService.getWorkflowTemplate('non-existent')
      expect(template).toBeUndefined()
    })
  })

  describe('Workflow Instance Creation', () => {
    it('should create workflow instance for valid document', async () => {
      const instance = await WorkflowService.createWorkflowInstance(
        document.id,
        'strategy-document-template',
        user1.id,
        ReviewPriority.HIGH,
      )

      expect(instance).toBeDefined()
      expect(instance.documentId).toBe(document.id)
      expect(instance.workflowTemplateId).toBe('strategy-document-template')
      expect(instance.status).toBe(WorkflowStatus.DRAFT)
      expect(instance.currentStep).toBe(0)
      expect(instance.priority).toBe(ReviewPriority.HIGH)
    })

    it('should throw error for non-existent template', async () => {
      await expect(
        WorkflowService.createWorkflowInstance(
          document.id,
          'non-existent-template',
          user1.id,
        ),
      ).rejects.toThrow('Workflow template not found')
    })

    it('should throw error for non-existent document', async () => {
      await expect(
        WorkflowService.createWorkflowInstance(
          'non-existent-document',
          'strategy-document-template',
          user1.id,
        ),
      ).rejects.toThrow('Document not found')
    })

    it('should throw error for mismatched document category', async () => {
      const marketingDoc = await DocumentService.createDocument({
        title: 'Marketing Document',
        content: 'Marketing content',
        category: 'Marketing',
        authorId: user1.id,
        status: 'draft',
        collaborators: [],
        metadata: {},
        tags: [],
      })

      await expect(
        WorkflowService.createWorkflowInstance(
          marketingDoc.id,
          'strategy-document-template',
          user1.id,
        ),
      ).rejects.toThrow('Document category does not match workflow template')
    })
  })

  describe('Document Submission for Review', () => {
    beforeEach(async () => {
      workflowInstance = await WorkflowService.createWorkflowInstance(
        document.id,
        'strategy-document-template',
        user1.id,
      )
    })

    it('should submit document for review', async () => {
      const submitted = await WorkflowService.submitForReview(
        workflowInstance.id,
        user1.id,
        'Ready for review',
      )

      expect(submitted.status).toBe(WorkflowStatus.IN_REVIEW)
      expect(submitted.currentStep).toBe(1)
      expect(submitted.comments).toHaveLength(1)
      expect(submitted.comments[0].content).toBe('Ready for review')
    })

    it('should throw error when submitting non-draft document', async () => {
      await WorkflowService.submitForReview(workflowInstance.id, user1.id)

      await expect(
        WorkflowService.submitForReview(workflowInstance.id, user1.id),
      ).rejects.toThrow('Document is not in draft status')
    })
  })

  describe('Workflow Action Processing', () => {
    beforeEach(async () => {
      workflowInstance = await WorkflowService.createWorkflowInstance(
        document.id,
        'strategy-document-template',
        user1.id,
      )
      await WorkflowService.submitForReview(workflowInstance.id, user1.id)
    })

    it('should process approval action', async () => {
      const approved = await WorkflowService.processAction(
        workflowInstance.id,
        user2.id,
        WorkflowAction.APPROVE,
        'Looks good to proceed',
      )

      expect(approved.currentStep).toBe(2)
      expect(approved.approvals).toHaveLength(1)
      expect(approved.approvals[0].action).toBe(WorkflowAction.APPROVE)
    })

    it('should complete workflow after final approval', async () => {
      // First approval
      await WorkflowService.processAction(
        workflowInstance.id,
        user2.id,
        WorkflowAction.APPROVE,
      )

      // Second approval
      await WorkflowService.processAction(
        workflowInstance.id,
        user2.id,
        WorkflowAction.APPROVE,
      )

      // Final approval
      const completed = await WorkflowService.processAction(
        workflowInstance.id,
        user2.id,
        WorkflowAction.APPROVE,
      )

      expect(completed.status).toBe(WorkflowStatus.APPROVED)
      expect(completed.completedAt).toBeDefined()
    })

    it('should process rejection action', async () => {
      const rejected = await WorkflowService.processAction(
        workflowInstance.id,
        user2.id,
        WorkflowAction.REJECT,
        'Needs significant revisions',
      )

      expect(rejected.status).toBe(WorkflowStatus.REJECTED)
      expect(rejected.completedAt).toBeDefined()
    })

    it('should process change request action', async () => {
      const changeRequested = await WorkflowService.processAction(
        workflowInstance.id,
        user2.id,
        WorkflowAction.REQUEST_CHANGES,
        'Please add more market analysis',
      )

      expect(changeRequested.status).toBe(WorkflowStatus.DRAFT)
      expect(changeRequested.currentStep).toBe(0)
    })

    it('should add comment action', async () => {
      const commented = await WorkflowService.processAction(
        workflowInstance.id,
        user2.id,
        WorkflowAction.ADD_COMMENT,
        'Consider adding more data on competitors',
      )

      expect(commented.comments).toHaveLength(2) // 1 from submit + 1 from comment
      expect(commented.comments[1].content).toBe(
        'Consider adding more data on competitors',
      )
    })
  })

  describe('Comment Management', () => {
    beforeEach(async () => {
      workflowInstance = await WorkflowService.createWorkflowInstance(
        document.id,
        'strategy-document-template',
        user1.id,
      )
    })

    it('should add comment to workflow', async () => {
      const comment = await WorkflowService.addComment(
        workflowInstance.id,
        user1.id,
        'Initial thoughts on the document',
        1,
        false,
        ['attachment1.pdf'],
        ['user2'],
      )

      expect(comment).toBeDefined()
      expect(comment.content).toBe('Initial thoughts on the document')
      expect(comment.step).toBe(1)
      expect(comment.isPrivate).toBe(false)
      expect(comment.attachments).toEqual(['attachment1.pdf'])
      expect(comment.mentions).toEqual(['user2'])
    })

    it('should retrieve comments for workflow', () => {
      const comments = WorkflowService.getCommentsForWorkflow(
        workflowInstance.id,
      )
      expect(comments).toBeInstanceOf(Array)
    })
  })

  describe('Workflow Search and Analytics', () => {
    beforeEach(async () => {
      workflowInstance = await WorkflowService.createWorkflowInstance(
        document.id,
        'strategy-document-template',
        user1.id,
        ReviewPriority.HIGH,
      )
    })

    it('should search workflow instances by document ID', () => {
      const instances = WorkflowService.searchWorkflowInstances({
        documentId: document.id,
      })

      expect(instances).toHaveLength(1)
      expect(instances[0].documentId).toBe(document.id)
    })

    it('should search workflow instances by status', () => {
      const instances = WorkflowService.searchWorkflowInstances({
        status: WorkflowStatus.DRAFT,
      })

      expect(instances).toHaveLength(1)
      expect(instances[0].status).toBe(WorkflowStatus.DRAFT)
    })

    it('should search workflow instances by priority', () => {
      const instances = WorkflowService.searchWorkflowInstances({
        priority: ReviewPriority.HIGH,
      })

      expect(instances).toHaveLength(1)
      expect(instances[0].priority).toBe(ReviewPriority.HIGH)
    })

    it('should return workflow analytics', () => {
      const analytics = WorkflowService.getWorkflowAnalytics()

      expect(analytics).toBeDefined()
      expect(analytics.totalWorkflows).toBeGreaterThan(0)
      expect(analytics.activeWorkflows).toBeDefined()
      expect(analytics.completedWorkflows).toBeDefined()
      expect(analytics.averageReviewTime).toBeDefined()
      expect(analytics.approvalRate).toBeDefined()
      expect(analytics.rejectionRate).toBeDefined()
      expect(analytics.mostActiveReviewers).toBeInstanceOf(Array)
    })
  })

  describe('Approval Management', () => {
    beforeEach(async () => {
      workflowInstance = await WorkflowService.createWorkflowInstance(
        document.id,
        'strategy-document-template',
        user1.id,
      )
      await WorkflowService.submitForReview(workflowInstance.id, user1.id)
    })

    it('should retrieve approvals for workflow', async () => {
      await WorkflowService.processAction(
        workflowInstance.id,
        user2.id,
        WorkflowAction.APPROVE,
        'Approved for next step',
      )

      const approvals = WorkflowService.getApprovalsForWorkflow(
        workflowInstance.id,
      )
      expect(approvals).toHaveLength(1)
      expect(approvals[0].action).toBe(WorkflowAction.APPROVE)
      expect(approvals[0].comment).toBe('Approved for next step')
    })
  })

  describe('Overdue Workflow Detection', () => {
    it('should identify overdue workflows', async () => {
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000) // 1 day ago

      const overdueInstance = await WorkflowService.createWorkflowInstance(
        document.id,
        'strategy-document-template',
        user1.id,
        ReviewPriority.HIGH,
        pastDate,
      )

      await WorkflowService.submitForReview(overdueInstance.id, user1.id)

      const overdue = WorkflowService.getOverdueWorkflows()
      expect(overdue).toBeInstanceOf(Array)
    })
  })

  describe('Workflow Instance Retrieval', () => {
    beforeEach(async () => {
      workflowInstance = await WorkflowService.createWorkflowInstance(
        document.id,
        'strategy-document-template',
        user1.id,
      )
    })

    it('should retrieve workflow instance by ID', () => {
      const retrieved = WorkflowService.getWorkflowInstance(workflowInstance.id)
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(workflowInstance.id)
    })

    it('should return undefined for non-existent instance', () => {
      const retrieved = WorkflowService.getWorkflowInstance('non-existent')
      expect(retrieved).toBeUndefined()
    })

    it('should retrieve workflow instances for document', () => {
      const instances = WorkflowService.getWorkflowInstancesForDocument(
        document.id,
      )
      expect(instances).toHaveLength(1)
      expect(instances[0].documentId).toBe(document.id)
    })
  })
})

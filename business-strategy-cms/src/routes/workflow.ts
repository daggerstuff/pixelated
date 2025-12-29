import { Router } from 'express'
import { WorkflowService } from '../services/workflowService'
import { authenticateToken } from '../middleware/auth'
import { requireRole } from '../middleware/rbac'
import { UserRole } from '../types/user'
import { WorkflowAction, ReviewPriority } from '../types/workflow'

const router = Router()

// Get all workflow templates
router.get('/templates', authenticateToken, async (req, res) => {
  try {
    const templates = WorkflowService.getWorkflowTemplates()
    res.json(templates)
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch workflow templates' })
  }
})

// Get workflow template by ID
router.get('/templates/:id', authenticateToken, async (req, res) => {
  try {
    const template = WorkflowService.getWorkflowTemplate(req.params.id)
    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }
    res.json(template)
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch workflow template' })
  }
})

// Create workflow instance for document
router.post('/instances', authenticateToken, async (req, res) => {
  try {
    const { documentId, workflowTemplateId, priority, dueDate, metadata } =
      req.body

    if (!documentId || !workflowTemplateId) {
      return res
        .status(400)
        .json({ error: 'Document ID and workflow template ID are required' })
    }

    const instance = await WorkflowService.createWorkflowInstance(
      documentId,
      workflowTemplateId,
      req.user.id,
      priority || ReviewPriority.MEDIUM,
      dueDate ? new Date(dueDate) : undefined,
      metadata || {},
    )

    res.status(201).json(instance)
  } catch (_error) {
    res.status(400).json({ error: _error.message })
  }
})

// Get workflow instances for document
router.get(
  '/instances/document/:documentId',
  authenticateToken,
  async (req, res) => {
    try {
      const instances = WorkflowService.getWorkflowInstancesForDocument(
        req.params.documentId,
      )
      res.json(instances)
    } catch (_error) {
      res.status(500).json({ error: 'Failed to fetch workflow instances' })
    }
  },
)

// Get workflow instance by ID
router.get('/instances/:id', authenticateToken, async (req, res) => {
  try {
    const instance = WorkflowService.getWorkflowInstance(req.params.id)
    if (!instance) {
      return res.status(404).json({ error: 'Workflow instance not found' })
    }
    res.json(instance)
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch workflow instance' })
  }
})

// Search workflow instances
router.get('/instances', authenticateToken, async (req, res) => {
  try {
    const filters = {
      documentId: req.query.documentId as string,
      status: req.query.status as string,
      assignedTo: req.query.assignedTo as string,
      createdBy: req.query.createdBy as string,
      priority: req.query.priority as string,
      dueBefore: req.query.dueBefore
        ? new Date(req.query.dueBefore as string)
        : undefined,
      dueAfter: req.query.dueAfter
        ? new Date(req.query.dueAfter as string)
        : undefined,
      category: req.query.category as string,
    }

    const instances = WorkflowService.searchWorkflowInstances(filters)
    res.json(instances)
  } catch (_error) {
    res.status(500).json({ error: 'Failed to search workflow instances' })
  }
})

// Submit document for review
router.post('/instances/:id/submit', authenticateToken, async (req, res) => {
  try {
    const { comment } = req.body
    const instance = await WorkflowService.submitForReview(
      req.params.id,
      req.user.id,
      comment,
    )
    res.json(instance)
  } catch (_error) {
    res.status(400).json({ error: _error.message })
  }
})

// Process workflow action
router.post('/instances/:id/action', authenticateToken, async (req, res) => {
  try {
    const { action, comment } = req.body

    if (!action) {
      return res.status(400).json({ error: 'Action is required' })
    }

    const instance = await WorkflowService.processAction(
      req.params.id,
      req.user.id,
      action as WorkflowAction,
      comment,
    )
    res.json(instance)
  } catch (_error) {
    res.status(400).json({ error: _error.message })
  }
})

// Add comment to workflow
router.post('/instances/:id/comments', authenticateToken, async (req, res) => {
  try {
    const { content, step, isPrivate, attachments, mentions } = req.body

    if (!content || step === undefined) {
      return res.status(400).json({ error: 'Content and step are required' })
    }

    const comment = await WorkflowService.addComment(
      req.params.id,
      req.user.id,
      content,
      step,
      isPrivate || false,
      attachments,
      mentions,
    )

    res.status(201).json(comment)
  } catch (_error) {
    res.status(400).json({ error: _error.message })
  }
})

// Get comments for workflow
router.get('/instances/:id/comments', authenticateToken, async (req, res) => {
  try {
    const comments = WorkflowService.getCommentsForWorkflow(req.params.id)
    res.json(comments)
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch comments' })
  }
})

// Get approvals for workflow
router.get('/instances/:id/approvals', authenticateToken, async (req, res) => {
  try {
    const approvals = WorkflowService.getApprovalsForWorkflow(req.params.id)
    res.json(approvals)
  } catch (_error) {
    res.status(500).json({ error: 'Failed to fetch approvals' })
  }
})

// Get workflow analytics
router.get(
  '/analytics',
  authenticateToken,
  requireRole([UserRole.ADMINISTRATOR]),
  async (req, res) => {
    try {
      const analytics = WorkflowService.getWorkflowAnalytics()
      res.json(analytics)
    } catch (_error) {
      res.status(500).json({ error: 'Failed to fetch analytics' })
    }
  },
)

// Get overdue workflows
router.get(
  '/overdue',
  authenticateToken,
  requireRole([UserRole.ADMINISTRATOR]),
  async (req, res) => {
    try {
      const overdue = WorkflowService.getOverdueWorkflows()
      res.json(overdue)
    } catch (_error) {
      res.status(500).json({ error: 'Failed to fetch overdue workflows' })
    }
  },
)

export default router

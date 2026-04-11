import { Router, type Response } from 'express'
import { type ParamsDictionary } from 'express-serve-static-core'
import type { ParsedQs } from 'qs'

import {
  AuthenticatedRequest,
  authenticateToken,
  requireRole,
} from '../middleware/auth'
import { WorkflowService } from '../services/workflowService'
import { UserRole } from '../types/user'
import {
  ReviewPriority,
  WorkflowAction,
  WorkflowSearchFilters,
  WorkflowStatus,
} from '../types/workflow'

type WorkflowCreateBody = {
  documentId?: unknown
  workflowTemplateId?: unknown
  priority?: unknown
  dueDate?: unknown
  metadata?: unknown
}

type WorkflowSubmitBody = {
  comment?: unknown
}

type WorkflowActionBody = {
  action?: unknown
  comment?: unknown
}

type WorkflowCommentBody = {
  content?: unknown
  step?: unknown
  isPrivate?: unknown
  attachments?: unknown
  mentions?: unknown
}

type WorkflowSearchQuery = {
  documentId?: unknown
  status?: unknown
  assignedTo?: unknown
  createdBy?: unknown
  priority?: unknown
  dueBefore?: unknown
  dueAfter?: unknown
  category?: unknown
}

const router: import('express-serve-static-core').Router = Router()

const toString = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
  }
  return undefined
}

const toSingleQueryValue = (value: unknown): string | undefined => {
  if (typeof value === 'string') {
    return toString(value)
  }
  if (Array.isArray(value)) {
    return toString(value[0])
  }
  return undefined
}

const toDate = (value: unknown): Date | undefined => {
  const stringValue = toString(value)
  if (!stringValue) {
    return undefined
  }
  const date = new Date(stringValue)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  const stringValue = toString(value)
  if (!stringValue) {
    return undefined
  }
  const numberValue = Number(stringValue)
  return Number.isFinite(numberValue) ? numberValue : undefined
}

const toBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value
  }
  const stringValue = toString(value)?.toLowerCase()
  if (stringValue === 'true' || stringValue === '1' || stringValue === 'yes') {
    return true
  }
  if (stringValue === 'false' || stringValue === '0' || stringValue === 'no') {
    return false
  }
  return undefined
}

const toStringArray = (value: unknown): string[] | undefined => {
  if (Array.isArray(value)) {
    if (!value.every((entry): entry is string => typeof entry === 'string')) {
      return undefined
    }
    return value
  }
  const stringValue = toString(value)
  return stringValue ? [stringValue] : undefined
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const toWorkflowStatus = (value: unknown): WorkflowStatus | undefined => {
  const stringValue = toString(value)?.toLowerCase()
  return stringValue && Object.values(WorkflowStatus).includes(stringValue as WorkflowStatus)
    ? (stringValue as WorkflowStatus)
    : undefined
}

const toWorkflowPriority = (value: unknown): ReviewPriority | undefined => {
  const stringValue = toString(value)?.toLowerCase()
  return stringValue && Object.values(ReviewPriority).includes(stringValue as ReviewPriority)
    ? (stringValue as ReviewPriority)
    : undefined
}

const toWorkflowAction = (value: unknown): WorkflowAction | undefined => {
  const stringValue = toString(value)?.toLowerCase()
  return stringValue && Object.values(WorkflowAction).includes(stringValue as WorkflowAction)
    ? (stringValue as WorkflowAction)
    : undefined
}

const getAuthenticatedUserId = (req: AuthenticatedRequest): string | undefined => {
  const userId = req.user?.userId
  return typeof userId === 'string' && userId.length > 0 ? userId : undefined
}

// Get all workflow templates
router.get('/templates', authenticateToken, async (_req: unknown, res: Response) => {
  void _req
  try {
    const templates = WorkflowService.getWorkflowTemplates()
    return res.json(templates)
  } catch {
    return res.status(500).json({ error: 'Failed to fetch workflow templates' })
  }
})

// Get workflow template by ID
router.get('/templates/:id', authenticateToken, async (
  req: AuthenticatedRequest<ParamsDictionary>,
  res: Response,
) => {
  try {
    const templateId = toString(req.params.id)
    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' })
    }
    const template = WorkflowService.getWorkflowTemplate(templateId)
    if (!template) {
      return res.status(404).json({ error: 'Template not found' })
    }
    return res.json(template)
  } catch {
    return res.status(500).json({ error: 'Failed to fetch workflow template' })
  }
})

// Create workflow instance for document
router.post('/instances', authenticateToken, async (
  req: AuthenticatedRequest<ParamsDictionary, unknown, WorkflowCreateBody>,
  res: Response,
) => {
  try {
    const documentId = toString(req.body.documentId)
    const workflowTemplateId = toString(req.body.workflowTemplateId)
    if (!documentId || !workflowTemplateId) {
      return res
        .status(400)
        .json({ error: 'Document ID and workflow template ID are required' })
    }

    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const priority = toWorkflowPriority(req.body.priority) ?? ReviewPriority.MEDIUM
    const dueDate = toDate(req.body.dueDate)
    const metadata =
      isRecord(req.body.metadata) ? req.body.metadata : (req.body.metadata === undefined ? {} : {})

    const instance = await WorkflowService.createWorkflowInstance(
      documentId,
      workflowTemplateId,
      userId,
      priority,
      dueDate,
      metadata,
    )

    return res.status(201).json(instance)
  } catch (_error: unknown) {
    const message = _error instanceof Error ? _error.message : 'Unknown error'
    return res.status(400).json({ error: message })
  }
})

// Get workflow instances for document
router.get(
  '/instances/document/:documentId',
  authenticateToken,
  async (
    req: AuthenticatedRequest<ParamsDictionary>,
    res: Response,
  ) => {
    try {
      const documentId = toString(req.params.documentId)
      if (!documentId) {
        return res.status(400).json({ error: 'Document ID is required' })
      }
      const instances = WorkflowService.getWorkflowInstancesForDocument(documentId)
      return res.json(instances)
    } catch {
      return res.status(500).json({ error: 'Failed to fetch workflow instances' })
    }
  },
)

// Get workflow instance by ID
router.get('/instances/:id', authenticateToken, async (
  req: AuthenticatedRequest<ParamsDictionary>,
  res: Response,
) => {
  try {
    const instanceId = toString(req.params.id)
    if (!instanceId) {
      return res.status(400).json({ error: 'Workflow instance ID is required' })
    }
    const instance = WorkflowService.getWorkflowInstance(instanceId)
    if (!instance) {
      return res.status(404).json({ error: 'Workflow instance not found' })
    }
    return res.json(instance)
  } catch {
    return res.status(500).json({ error: 'Failed to fetch workflow instance' })
  }
})

// Search workflow instances
router.get('/instances', authenticateToken, async (
  req: AuthenticatedRequest<ParamsDictionary, unknown, unknown, WorkflowSearchQuery>,
  res: Response,
) => {
  try {
    const filters: WorkflowSearchFilters = {}
    const query = req.query

    const documentId = toSingleQueryValue(query.documentId)
    if (documentId) {
      filters.documentId = documentId
    }

    const status = toWorkflowStatus(query.status)
    if (status) {
      filters.status = status
    }

    const assignedTo = toSingleQueryValue(query.assignedTo)
    if (assignedTo) {
      filters.assignedTo = assignedTo
    }

    const createdBy = toSingleQueryValue(query.createdBy)
    if (createdBy) {
      filters.createdBy = createdBy
    }

    const priority = toWorkflowPriority(query.priority)
    if (priority) {
      filters.priority = priority
    }

    const dueBefore = toDate(query.dueBefore)
    if (dueBefore) {
      filters.dueBefore = dueBefore
    }

    const dueAfter = toDate(query.dueAfter)
    if (dueAfter) {
      filters.dueAfter = dueAfter
    }

    const category = toSingleQueryValue(query.category)
    if (category) {
      filters.category = category
    }

    const instances = WorkflowService.searchWorkflowInstances(filters)
    return res.json(instances)
  } catch {
    return res.status(500).json({ error: 'Failed to search workflow instances' })
  }
})

// Submit document for review
router.post('/instances/:id/submit', authenticateToken, async (
  req: AuthenticatedRequest<
    ParamsDictionary,
    unknown,
    WorkflowSubmitBody,
    ParsedQs
  >,
  res: Response,
) => {
  try {
    const instanceId = toString(req.params.id)
    if (!instanceId) {
      return res.status(400).json({ error: 'Workflow instance ID is required' })
    }

    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const comment = toString(req.body.comment)
    const instance = await WorkflowService.submitForReview(instanceId, userId, comment)
    return res.json(instance)
  } catch (_error: unknown) {
    const message = _error instanceof Error ? _error.message : 'Unknown error'
    return res.status(400).json({ error: message })
  }
})

// Process workflow action
router.post('/instances/:id/action', authenticateToken, async (
  req: AuthenticatedRequest<
    ParamsDictionary,
    unknown,
    WorkflowActionBody,
    ParsedQs
  >,
  res: Response,
) => {
  try {
    const instanceId = toString(req.params.id)
    if (!instanceId) {
      return res.status(400).json({ error: 'Workflow instance ID is required' })
    }

    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const action = toWorkflowAction(req.body.action)
    if (!action) {
      return res.status(400).json({ error: 'Action is required' })
    }

    const comment = toString(req.body.comment)
    const instance = await WorkflowService.processAction(
      instanceId,
      userId,
      action,
      comment,
    )
    return res.json(instance)
  } catch (_error: unknown) {
    const message = _error instanceof Error ? _error.message : 'Unknown error'
    return res.status(400).json({ error: message })
  }
})

// Add comment to workflow
router.post('/instances/:id/comments', authenticateToken, async (
  req: AuthenticatedRequest<
    ParamsDictionary,
    unknown,
    WorkflowCommentBody,
    ParsedQs
  >,
  res: Response,
) => {
  try {
    const instanceId = toString(req.params.id)
    if (!instanceId) {
      return res.status(400).json({ error: 'Workflow instance ID is required' })
    }

    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const content = toString(req.body.content)
    const step = toNumber(req.body.step)
    if (!content || step === undefined) {
      return res.status(400).json({ error: 'Content and step are required' })
    }

    const isPrivate = toBoolean(req.body.isPrivate) ?? false
    const attachments = toStringArray(req.body.attachments)
    const mentions = toStringArray(req.body.mentions)

    const comment = await WorkflowService.addComment(
      instanceId,
      userId,
      content,
      step,
      isPrivate,
      attachments,
      mentions,
    )
    return res.status(201).json(comment)
  } catch (_error: unknown) {
    const message = _error instanceof Error ? _error.message : 'Unknown error'
    return res.status(400).json({ error: message })
  }
})

// Get comments for workflow
router.get('/instances/:id/comments', authenticateToken, async (
  req: AuthenticatedRequest<ParamsDictionary>,
  res: Response,
) => {
  try {
    const instanceId = toString(req.params.id)
    if (!instanceId) {
      return res.status(400).json({ error: 'Workflow instance ID is required' })
    }
    const comments = WorkflowService.getCommentsForWorkflow(instanceId)
    return res.json(comments)
  } catch {
    return res.status(500).json({ error: 'Failed to fetch comments' })
  }
})

// Get approvals for workflow
router.get('/instances/:id/approvals', authenticateToken, async (
  req: AuthenticatedRequest<ParamsDictionary>,
  res: Response,
) => {
  try {
    const instanceId = toString(req.params.id)
    if (!instanceId) {
      return res.status(400).json({ error: 'Workflow instance ID is required' })
    }
    const approvals = WorkflowService.getApprovalsForWorkflow(instanceId)
    return res.json(approvals)
  } catch {
    return res.status(500).json({ error: 'Failed to fetch approvals' })
  }
})

// Get workflow analytics
router.get(
  '/analytics',
  authenticateToken,
  requireRole([UserRole.ADMINISTRATOR]),
  async (_req: unknown, res: Response) => {
    void _req
    try {
      const analytics = WorkflowService.getWorkflowAnalytics()
      return res.json(analytics)
    } catch {
      return res.status(500).json({ error: 'Failed to fetch analytics' })
    }
  },
)

// Get overdue workflows
router.get(
  '/overdue',
  authenticateToken,
  requireRole([UserRole.ADMINISTRATOR]),
  async (_req: unknown, res: Response) => {
    void _req
    try {
      const overdue = WorkflowService.getOverdueWorkflows()
      return res.json(overdue)
    } catch {
      return res.status(500).json({ error: 'Failed to fetch overdue workflows' })
    }
  },
)

export default router

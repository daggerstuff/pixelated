import { v4 as uuid } from 'uuid'

import { slug } from '@/utils/common'

// Strategic Plans Service Layer
import {
  getMongoConnection,
  getPostgresPool,
} from '../../lib/database/connection'
import { NotFoundError, ForbiddenError } from '../middleware/error-handler'

/**
 * Create a new strategic plan
 */
export async function createStrategicPlan(data: {
  title: string
  description?: string
  ownerId: string
  objectives?: any[]
  keyResults?: any[]
  budget?: number
  timeline?: { startDate: Date; endDate: Date }
}) {
  const StrategicPlanModel = getMongoConnection().model('StrategicPlan')
  const pool = getPostgresPool()

  const planId = uuid()
  const planSlug = slug(data.title)

  const plan = new StrategicPlanModel({
    _id: planId,
    title: data.title,
    slug: planSlug,
    description: data.description || '',
    owner: data.ownerId,
    status: 'draft',
    objectives: data.objectives || [],
    keyResults: data.keyResults || [],
    budget: data.budget || 0,
    timeline: data.timeline || {
      startDate: new Date(),
      endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
    kpis: [],
    approvals: [],
    riskManagement: [],
    permissions: {
      view: [data.ownerId],
      edit: [data.ownerId],
      comment: [data.ownerId],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  await plan.save()

  // Record in PostgreSQL
  await pool.query(
    `INSERT INTO strategic_plans (id, title, slug, owner_id, status, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [planId, data.title, planSlug, data.ownerId, 'draft'],
  )

  return plan
}

/**
 * Get strategic plan by ID
 */
export async function getStrategicPlan(planId: string, userId: string) {
  const StrategicPlanModel = getMongoConnection().model('StrategicPlan')

  const plan = await StrategicPlanModel.findById(planId)

  if (!plan) {
    throw new NotFoundError('strategic plan', planId)
  }

  // Check permissions
  if (!plan.permissions.view.includes(userId) && plan.owner !== userId) {
    throw new ForbiddenError('Cannot access this plan')
  }

  return plan
}

/**
 * Update strategic plan
 */
export async function updateStrategicPlan(
  planId: string,
  userId: string,
  updates: Partial<any>,
) {
  const StrategicPlanModel = getMongoConnection().model('StrategicPlan')

  const plan = await StrategicPlanModel.findById(planId)

  if (!plan) {
    throw new NotFoundError('strategic plan', planId)
  }

  // Check edit permission
  if (!plan.permissions.edit.includes(userId) && plan.owner !== userId) {
    throw new ForbiddenError('Cannot edit this plan')
  }

  Object.keys(updates).forEach((key) => {
    if (key !== '_id' && key !== 'owner' && key !== 'createdAt') {
      ;(plan as any)[key] = updates[key]
    }
  })

  plan.updatedAt = new Date()
  await plan.save()

  return plan
}

/**
 * Add KPI to strategic plan
 */
export async function addKPI(
  planId: string,
  userId: string,
  kpi: {
    name: string
    target: number
    current?: number
    unit?: string
    owner?: string
    deadline?: Date
  },
) {
  const StrategicPlanModel = getMongoConnection().model('StrategicPlan')

  const plan = await StrategicPlanModel.findById(planId)

  if (!plan) {
    throw new NotFoundError('strategic plan', planId)
  }

  // Check edit permission
  if (!plan.permissions.edit.includes(userId) && plan.owner !== userId) {
    throw new ForbiddenError('Cannot edit this plan')
  }

  const kpiId = uuid()

  plan.kpis.push({
    _id: kpiId,
    name: kpi.name,
    target: kpi.target,
    current: kpi.current || 0,
    unit: kpi.unit || '',
    owner: kpi.owner || userId,
    deadline: kpi.deadline,
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  plan.updatedAt = new Date()
  await plan.save()

  return plan
}

/**
 * Submit plan for approval
 */
export async function submitForApproval(
  planId: string,
  userId: string,
  approvers: string[],
) {
  const StrategicPlanModel = getMongoConnection().model('StrategicPlan')
  const pool = getPostgresPool()

  const plan = await StrategicPlanModel.findById(planId)

  if (!plan) {
    throw new NotFoundError('strategic plan', planId)
  }

  // Check ownership
  if (plan.owner !== userId) {
    throw new ForbiddenError('Only plan owner can submit for approval')
  }

  // Create approval request in PostgreSQL
  const approvalRequestId = uuid()

  await pool.query(
    `INSERT INTO approval_requests (id, resource_type, resource_id, requested_by, status, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [approvalRequestId, 'strategic_plan', planId, userId, 'pending'],
  )

  // Create approval steps for each approver
  for (const approverId of approvers) {
    const stepId = uuid()

    await pool.query(
      `INSERT INTO approval_steps (id, approval_request_id, approver_id, status, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [stepId, approvalRequestId, approverId, 'pending'],
    )
  }

  plan.status = 'pending_approval'
  plan.updatedAt = new Date()
  await plan.save()

  return plan
}

/**
 * List strategic plans
 */
export async function listStrategicPlans(
  userId: string,
  options: {
    page?: number
    limit?: number
    status?: string
  } = {},
) {
  const StrategicPlanModel = getMongoConnection().model('StrategicPlan')
  const page = options.page || 1
  const limit = options.limit || 50

  let query: any = {
    $or: [{ owner: userId }, { 'permissions.view': userId }],
  }

  if (options.status) {
    query.status = options.status
  }

  const plans = await StrategicPlanModel.find(query)
    .limit(limit)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 })

  const total = await StrategicPlanModel.countDocuments(query)

  return {
    data: plans,
    pagination: { page, limit, total },
  }
}

/**
 * Share strategic plan
 */
export async function shareStrategicPlan(
  planId: string,
  ownerId: string,
  targetUserId: string,
  permissionLevel: 'view' | 'edit' | 'comment',
) {
  const StrategicPlanModel = getMongoConnection().model('StrategicPlan')

  const plan = await StrategicPlanModel.findById(planId)

  if (!plan) {
    throw new NotFoundError('strategic plan', planId)
  }

  // Check ownership
  if (plan.owner !== ownerId) {
    throw new ForbiddenError('Only plan owner can share')
  }

  // Add to appropriate permission array
  const permissionKey = permissionLevel
  if (!plan.permissions[permissionKey].includes(targetUserId)) {
    plan.permissions[permissionKey].push(targetUserId)
    await plan.save()
  }

  return plan
}

/**
 * Delete strategic plan
 */
export async function deleteStrategicPlan(planId: string, userId: string) {
  const StrategicPlanModel = getMongoConnection().model('StrategicPlan')
  const pool = getPostgresPool()

  const plan = await StrategicPlanModel.findById(planId)

  if (!plan) {
    throw new NotFoundError('strategic plan', planId)
  }

  // Check edit permission
  if (!plan.permissions.edit.includes(userId) && plan.owner !== userId) {
    throw new ForbiddenError('Cannot delete this plan')
  }

  await StrategicPlanModel.findByIdAndDelete(planId)
  await pool.query('DELETE FROM strategic_plans WHERE id = $1', [planId])

  return { success: true }
}

/**
 * Align project/OKR to strategic plan
 */
export async function alignProjectToPlan(data: {
  planId: string
  projectId?: string
  okrId?: string
  userId: string
}) {
  const StrategicPlanModel = getMongoConnection().model('StrategicPlan')

  const plan = await StrategicPlanModel.findById(data.planId)

  if (!plan) {
    throw new NotFoundError('strategic plan', data.planId)
  }

  // Check edit permission
  if (
    !plan.permissions.edit.includes(data.userId) &&
    plan.owner !== data.userId
  ) {
    throw new ForbiddenError('Cannot align to this plan')
  }

  if (data.projectId) {
    plan.objectives.push({
      _id: uuid(),
      title: `Project: ${data.projectId}`,
      description: 'Aligned project',
      progress: 0,
      status: 'not_started',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  if (data.okrId) {
    plan.keyResults.push({
      _id: uuid(),
      title: `OKR: ${data.okrId}`,
      targetValue: 100,
      currentValue: 0,
      unit: '%',
      deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      status: 'at_risk',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
  }

  plan.updatedAt = new Date()
  await plan.save()

  return plan
}

/**
 * Update strategic plan status
 */
export async function updatePlanStatus(data: {
  planId: string
  status: string
  reason?: string
  userId: string
}) {
  const StrategicPlanModel = getMongoConnection().model('StrategicPlan')
  const pool = getPostgresPool()

  const plan = await StrategicPlanModel.findById(data.planId)

  if (!plan) {
    throw new NotFoundError('strategic plan', data.planId)
  }

  // Check edit permission
  if (
    !plan.permissions.edit.includes(data.userId) &&
    plan.owner !== data.userId
  ) {
    throw new ForbiddenError('Cannot update status of this plan')
  }

  plan.status = data.status
  plan.updatedAt = new Date()
  await plan.save()

  // Update PostgreSQL
  await pool.query(
    `UPDATE strategic_plans SET status = $1, updated_at = NOW() WHERE id = $2`,
    [data.status, data.planId],
  )

  return plan
}

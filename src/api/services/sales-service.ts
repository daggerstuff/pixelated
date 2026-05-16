import { v4 as uuid } from 'uuid'

// Sales Opportunities Service Layer
import {
  getMongoConnection,
  getPostgresPool,
} from '../../lib/database/connection'
import { slug } from '../../utils/common'
import { NotFoundError, ForbiddenError } from '../middleware/error-handler'

type SalesOpportunityPermissions = {
  view: string[]
  edit: string[]
  comment: string[]
}

type SalesOpportunity = {
  _id?: string
  opportunityId: string
  title: string
  slug: string
  description: string
  account?: string
  accountName?: string
  owner: string
  amount: number
  probability: number
  stage: string
  closeDate?: Date
  value: number
  status: string
  activity: unknown[]
  contacts: SalesOpportunityContact[]
  competitors: unknown[]
  permissions: SalesOpportunityPermissions
  expectedCloseDate?: Date
  currency?: string
  createdAt: Date
  updatedAt: Date
  save: () => Promise<SalesOpportunity>
}

type SalesOpportunityModelData = Omit<SalesOpportunity, 'save'>
type SalesOpportunityQuery = Record<string, unknown>
type SalesOpportunityQueryChain = {
  limit: (limit: number) => SalesOpportunityQueryChain
  skip: (count: number) => SalesOpportunityQueryChain
  sort: (sort: { createdAt: -1 | 1 }) => Promise<SalesOpportunity[]>
}
type SalesOpportunityModel = {
  new (data: SalesOpportunityModelData): SalesOpportunity
  findById(id: string): Promise<SalesOpportunity | null>
  find(query: SalesOpportunityQuery): SalesOpportunityQueryChain
  countDocuments(query: SalesOpportunityQuery): Promise<number>
  findByIdAndDelete(id: string): Promise<SalesOpportunity | null>
}

type SalesOpportunityContact = {
  _id?: string
  name: string
  email?: string
  phone?: string
  title?: string
  department?: string
  role?: string
  lastContact?: Date
  createdAt?: Date
}

function getSalesOpportunityModel(): SalesOpportunityModel {
  return getMongoConnection().model<SalesOpportunityModelData, SalesOpportunityModel>(
    'SalesOpportunity',
  )
}

/**
 * Create a new sales opportunity
 */
export async function createSalesOpportunity(data: {
  title: string
  description?: string
  ownerId: string
  accountName?: string
  amount?: number
  probability?: number
  stage?: string
  closeDate?: Date
}) {
  const SalesOpportunityModel = getSalesOpportunityModel()
  const pool = getPostgresPool()

  const opportunityId = uuid()
  const opportunitySlug = slug(data.title)

  const opportunity = new SalesOpportunityModel({
    opportunityId,
    title: data.title,
    slug: opportunitySlug,
    description: data.description ?? '',
    account: data.accountName ?? '',
    owner: data.ownerId,
    status: 'active',
    accountName: data.accountName ?? '',
    amount: data.amount ?? 0,
    probability: data.probability ?? 0.5,
    stage: data.stage ?? 'qualification',
    value: data.amount ?? 0,
    closeDate:
      data.closeDate ?? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    activity: [],
    contacts: [],
    competitors: [],
    permissions: {
      view: [data.ownerId],
      edit: [data.ownerId],
      comment: [data.ownerId],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  })

  await opportunity.save()

  // Record in PostgreSQL
  await pool.query(
    `INSERT INTO sales_opportunities (id, title, slug, owner_id, stage, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [
      opportunityId,
      data.title,
      opportunitySlug,
      data.ownerId,
      data.stage ?? 'qualification',
      'active',
    ],
  )

  return opportunity
}

/**
 * Get sales opportunity
 */
export async function getSalesOpportunity(
  opportunityId: string,
  userId: string,
) {
  const SalesOpportunityModel = getSalesOpportunityModel()

  const opportunity = await SalesOpportunityModel.findById(opportunityId)

  if (!opportunity) {
    throw new NotFoundError('sales opportunity', opportunityId)
  }

  // Check permissions
  if (
    !opportunity.permissions.view.includes(userId) &&
    opportunity.owner !== userId
  ) {
    throw new ForbiddenError('Cannot access this opportunity')
  }

  return opportunity
}

/**
 * Update sales opportunity stage
 */
export async function updateStage(
  opportunityId: string,
  userId: string,
  newStage: string,
) {
  const SalesOpportunityModel = getSalesOpportunityModel()
  const pool = getPostgresPool()

  const opportunity = await SalesOpportunityModel.findById(opportunityId)

  if (!opportunity) {
    throw new NotFoundError('sales opportunity', opportunityId)
  }

  // Check edit permission
  if (
    !opportunity.permissions.edit.includes(userId) &&
    opportunity.owner !== userId
  ) {
    throw new ForbiddenError('Cannot edit this opportunity')
  }

  const oldStage = opportunity.stage
  opportunity.stage = newStage
  opportunity.updatedAt = new Date()
  await opportunity.save()

  // Log activity
  const activityId = uuid()
  opportunity.activity.push({
    _id: activityId,
    type: 'stage_change',
    description: `Moved from ${oldStage} to ${newStage}`,
    createdBy: userId,
    createdAt: new Date(),
  })

  await opportunity.save()

  // Update PostgreSQL
  await pool.query(
    `UPDATE sales_opportunities SET stage = $1, updated_at = NOW() WHERE id = $2`,
    [newStage, opportunityId],
  )

  return opportunity
}

/**
 * Update sales opportunity
 */
export async function updateSalesOpportunity(
  opportunityId: string,
  userId: string,
  data: {
    title?: string
    value?: number
    stage?: string
    contacts?: SalesOpportunityContact[]
    expectedCloseDate?: Date
    probability?: number
    status?: string
  },
) {
  const SalesOpportunityModel = getSalesOpportunityModel()

  const opportunity = await SalesOpportunityModel.findById(opportunityId)

  if (!opportunity) {
    throw new NotFoundError('sales opportunity', opportunityId)
  }

  // Check edit permission
  if (
    !opportunity.permissions.edit.includes(userId) &&
    opportunity.owner !== userId
  ) {
    throw new ForbiddenError('Cannot edit this opportunity')
  }

  if (data.title) opportunity.title = data.title
  if (data.value !== undefined) opportunity.amount = data.value
  if (data.stage) opportunity.stage = data.stage
  if (data.contacts) opportunity.contacts = data.contacts
  if (data.expectedCloseDate) opportunity.closeDate = data.expectedCloseDate
  if (data.probability !== undefined) opportunity.probability = data.probability
  if (data.status) opportunity.status = data.status

  opportunity.updatedAt = new Date()
  await opportunity.save()

  return opportunity
}

/**
 * Delete sales opportunity
 */
export async function deleteSalesOpportunity(
  opportunityId: string,
  userId: string,
) {
  const SalesOpportunityModel = getSalesOpportunityModel()
  const pool = getPostgresPool()

  const opportunity = await SalesOpportunityModel.findById(opportunityId)

  if (!opportunity) {
    throw new NotFoundError('sales opportunity', opportunityId)
  }

  // Check edit permission
  if (
    !opportunity.permissions.edit.includes(userId) &&
    opportunity.owner !== userId
  ) {
    throw new ForbiddenError('Cannot delete this opportunity')
  }

  await SalesOpportunityModel.findByIdAndDelete(opportunityId)
  await pool.query('DELETE FROM sales_opportunities WHERE id = $1', [
    opportunityId,
  ])

  return { success: true }
}

/**
 * Add activity to sales opportunity
 */
export async function addActivity(
  opportunityId: string,
  userId: string,
  activity: {
    type: 'call' | 'email' | 'meeting' | 'note'
    description: string
    metadata?: Record<string, unknown>
  },
) {
  const SalesOpportunityModel = getSalesOpportunityModel()

  const opportunity = await SalesOpportunityModel.findById(opportunityId)

  if (!opportunity) {
    throw new NotFoundError('sales opportunity', opportunityId)
  }

  // Check edit permission
  if (
    !opportunity.permissions.edit.includes(userId) &&
    opportunity.owner !== userId
  ) {
    throw new ForbiddenError('Cannot edit this opportunity')
  }

  const activityId = uuid()

  opportunity.activity.push({
    _id: activityId,
    type: activity.type,
    description: activity.description,
    metadata: activity.metadata ?? {},
    createdBy: userId,
    createdAt: new Date(),
  })

  opportunity.updatedAt = new Date()
  await opportunity.save()

  return opportunity
}

/**
 * Add contact to sales opportunity
 */
export async function addContact(
  opportunityId: string,
  userId: string,
  contact: {
    name: string
    email?: string
    phone?: string
    role?: string
  },
) {
  const SalesOpportunityModel = getSalesOpportunityModel()

  const opportunity = await SalesOpportunityModel.findById(opportunityId)

  if (!opportunity) {
    throw new NotFoundError('sales opportunity', opportunityId)
  }

  // Check edit permission
  if (
    !opportunity.permissions.edit.includes(userId) &&
    opportunity.owner !== userId
  ) {
    throw new ForbiddenError('Cannot edit this opportunity')
  }

  const contactId = uuid()

  opportunity.contacts.push({
    _id: contactId,
    name: contact.name,
    email: contact.email ?? '',
    phone: contact.phone ?? '',
    role: contact.role ?? '',
    createdAt: new Date(),
  })

  opportunity.updatedAt = new Date()
  await opportunity.save()

  return opportunity
}

/**
 * List sales opportunities
 */
export async function listSalesOpportunities(
  userId: string,
  options: {
    page?: number
    limit?: number
    stage?: string
    status?: string
  } = {},
) {
  const SalesOpportunityModel = getSalesOpportunityModel()
  const page = options.page ?? 1
  const limit = options.limit ?? 50

  const query: Record<string, unknown> = {
    $or: [{ owner: userId }, { 'permissions.view': userId }],
  }

  if (options.stage) {
    query.stage = options.stage
  }

  if (options.status) {
    query.status = options.status
  }

  const opportunities = await SalesOpportunityModel.find(query)
    .limit(limit)
    .skip((page - 1) * limit)
    .sort({ createdAt: -1 })

  const total = await SalesOpportunityModel.countDocuments(query)

  return {
    data: opportunities,
    pagination: { page, limit, total },
  }
}

/**
 * Calculate sales forecast
 */
export async function calculateForecast(userId: string) {
  const SalesOpportunityModel = getSalesOpportunityModel()

  const opportunities = await SalesOpportunityModel.find({
    $or: [{ owner: userId }, { 'permissions.view': userId }],
  }).sort({ createdAt: -1 })

  let totalForecast = 0
  let weightedForecast = 0
  let opportunityCount = 0

  opportunities.forEach((opp) => {
    if (opp.status === 'active') {
      opportunityCount++
      totalForecast += opp.amount
      weightedForecast += opp.amount * opp.probability
    }
  })

  return {
    totalForecast,
    weightedForecast,
    opportunityCount,
    averageDealSize:
      opportunityCount > 0 ? totalForecast / opportunityCount : 0,
  }
}

/**
 * Share sales opportunity
 */
export async function shareSalesOpportunity(
  opportunityId: string,
  ownerId: string,
  targetUserId: string,
  permissionLevel: 'view' | 'edit' | 'comment',
) {
  const SalesOpportunityModel = getSalesOpportunityModel()

  const opportunity = await SalesOpportunityModel.findById(opportunityId)

  if (!opportunity) {
    throw new NotFoundError('sales opportunity', opportunityId)
  }

  // Check ownership
  if (opportunity.owner !== ownerId) {
    throw new ForbiddenError('Only opportunity owner can share')
  }

  // Add to appropriate permission array
  const permissionKey = permissionLevel
  if (!opportunity.permissions[permissionKey].includes(targetUserId)) {
    opportunity.permissions[permissionKey].push(targetUserId)
    await opportunity.save()
  }

  return opportunity
}

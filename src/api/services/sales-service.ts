// Sales Opportunities Service Layer
import { getMongoConnection, getPostgresPool } from '../../lib/database/connection'
import { NotFoundError, ForbiddenError } from '../middleware/error-handler'
import { v4 as uuid } from 'uuid'
import { slug } from '@/utils/common'

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
    const SalesOpportunityModel = getMongoConnection().model('SalesOpportunity')
    const pool = getPostgresPool()

    const opportunityId = uuid()
    const opportunitySlug = slug(data.title)

    const opportunity = new SalesOpportunityModel({
        _id: opportunityId,
        title: data.title,
        slug: opportunitySlug,
        description: data.description || '',
        owner: data.ownerId,
        status: 'active',
        accountName: data.accountName || '',
        amount: data.amount || 0,
        probability: data.probability || 0.5,
        stage: data.stage || 'qualification',
        closeDate: data.closeDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        activity: [],
        contacts: [],
        competitors: [],
        permissions: {
            view: [data.ownerId],
            edit: [data.ownerId],
            comment: [data.ownerId]
        },
        createdAt: new Date(),
        updatedAt: new Date()
    })

    await opportunity.save()

    // Record in PostgreSQL
    await pool.query(
        `INSERT INTO sales_opportunities (id, title, slug, owner_id, stage, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [opportunityId, data.title, opportunitySlug, data.ownerId, data.stage || 'qualification', 'active']
    )

    return opportunity
}

/**
 * Get sales opportunity
 */
export async function getSalesOpportunity(opportunityId: string, userId: string) {
    const SalesOpportunityModel = getMongoConnection().model('SalesOpportunity')

    const opportunity = await SalesOpportunityModel.findById(opportunityId)

    if (!opportunity) {
        throw new NotFoundError('sales opportunity', opportunityId)
    }

    // Check permissions
    if (!opportunity.permissions.view.includes(userId) && opportunity.owner !== userId) {
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
    newStage: string
) {
    const SalesOpportunityModel = getMongoConnection().model('SalesOpportunity')
    const pool = getPostgresPool()

    const opportunity = await SalesOpportunityModel.findById(opportunityId)

    if (!opportunity) {
        throw new NotFoundError('sales opportunity', opportunityId)
    }

    // Check edit permission
    if (!opportunity.permissions.edit.includes(userId) && opportunity.owner !== userId) {
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
        createdAt: new Date()
    })

    await opportunity.save()

    // Update PostgreSQL
    await pool.query(
        `UPDATE sales_opportunities SET stage = $1, updated_at = NOW() WHERE id = $2`,
        [newStage, opportunityId]
    )

    return opportunity
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
        metadata?: any
    }
) {
    const SalesOpportunityModel = getMongoConnection().model('SalesOpportunity')

    const opportunity = await SalesOpportunityModel.findById(opportunityId)

    if (!opportunity) {
        throw new NotFoundError('sales opportunity', opportunityId)
    }

    // Check edit permission
    if (!opportunity.permissions.edit.includes(userId) && opportunity.owner !== userId) {
        throw new ForbiddenError('Cannot edit this opportunity')
    }

    const activityId = uuid()

    opportunity.activity.push({
        _id: activityId,
        type: activity.type,
        description: activity.description,
        metadata: activity.metadata || {},
        createdBy: userId,
        createdAt: new Date()
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
    }
) {
    const SalesOpportunityModel = getMongoConnection().model('SalesOpportunity')

    const opportunity = await SalesOpportunityModel.findById(opportunityId)

    if (!opportunity) {
        throw new NotFoundError('sales opportunity', opportunityId)
    }

    // Check edit permission
    if (!opportunity.permissions.edit.includes(userId) && opportunity.owner !== userId) {
        throw new ForbiddenError('Cannot edit this opportunity')
    }

    const contactId = uuid()

    opportunity.contacts.push({
        _id: contactId,
        name: contact.name,
        email: contact.email || '',
        phone: contact.phone || '',
        role: contact.role || '',
        createdAt: new Date()
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
    } = {}
) {
    const SalesOpportunityModel = getMongoConnection().model('SalesOpportunity')
    const page = options.page || 1
    const limit = options.limit || 50

    let query: any = {
        $or: [
            { owner: userId },
            { 'permissions.view': userId }
        ]
    }

    if (options.stage) {
        query.stage = options.stage
    }

    if (options.status) {
        query.status = options.status
    }

    const opportunities = await SalesOpportunityModel
        .find(query)
        .limit(limit)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 })

    const total = await SalesOpportunityModel.countDocuments(query)

    return {
        data: opportunities,
        pagination: { page, limit, total }
    }
}

/**
 * Calculate sales forecast
 */
export async function calculateForecast(userId: string) {
    const SalesOpportunityModel = getMongoConnection().model('SalesOpportunity')

    const opportunities = await SalesOpportunityModel.find({
        $or: [
            { owner: userId },
            { 'permissions.view': userId }
        ]
    })

    let totalForecast = 0
    let weightedForecast = 0
    let opportunityCount = 0

    opportunities.forEach((opp: any) => {
        if (opp.status === 'active') {
            opportunityCount++
            totalForecast += opp.amount || 0
            weightedForecast += (opp.amount || 0) * (opp.probability || 0.5)
        }
    })

    return {
        totalForecast,
        weightedForecast,
        opportunityCount,
        averageDealSize: opportunityCount > 0 ? totalForecast / opportunityCount : 0
    }
}

/**
 * Share sales opportunity
 */
export async function shareSalesOpportunity(
    opportunityId: string,
    ownerId: string,
    targetUserId: string,
    permissionLevel: 'view' | 'edit' | 'comment'
) {
    const SalesOpportunityModel = getMongoConnection().model('SalesOpportunity')

    const opportunity = await SalesOpportunityModel.findById(opportunityId)

    if (!opportunity) {
        throw new NotFoundError('sales opportunity', opportunityId)
    }

    // Check ownership
    if (opportunity.owner !== ownerId) {
        throw new ForbiddenError('Only opportunity owner can share')
    }

    // Add to appropriate permission array
    const permissionKey = permissionLevel as 'view' | 'edit' | 'comment'
    if (!opportunity.permissions[permissionKey].includes(targetUserId)) {
        opportunity.permissions[permissionKey].push(targetUserId)
        await opportunity.save()
    }

    return opportunity
}

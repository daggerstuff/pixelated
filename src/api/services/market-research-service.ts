// Market Research Service Layer
import { getMongoConnection, getPostgresPool } from '../../lib/database/connection'
import { NotFoundError, ForbiddenError } from '../middleware/error-handler'
import { v4 as uuid } from 'uuid'
import { slug } from '@/utils/common'

/**
 * Create a new market research document
 */
export async function createMarketResearch(data: {
    title: string
    description?: string
    ownerId: string
    targetMarkets?: string[]
    researchType?: string
    timeline?: { startDate: Date; endDate: Date }
}) {
    const MarketResearchModel = getMongoConnection().model('MarketResearch')
    const pool = getPostgresPool()

    const researchId = uuid()
    const researchSlug = slug(data.title)

    const research = new MarketResearchModel({
        _id: researchId,
        title: data.title,
        slug: researchSlug,
        description: data.description || '',
        owner: data.ownerId,
        status: 'active',
        researchType: data.researchType || 'market_analysis',
        targetMarkets: data.targetMarkets || [],
        findings: [],
        competitiveAnalysis: [],
        recommendations: [],
        timeline: data.timeline || {
            startDate: new Date(),
            endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
        },
        permissions: {
            view: [data.ownerId],
            edit: [data.ownerId],
            comment: [data.ownerId]
        },
        createdAt: new Date(),
        updatedAt: new Date()
    })

    await research.save()

    // Record in PostgreSQL
    await pool.query(
        `INSERT INTO market_research (id, title, slug, owner_id, status, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
        [researchId, data.title, researchSlug, data.ownerId, 'active']
    )

    return research
}

/**
 * Get market research document
 */
export async function getMarketResearch(researchId: string, userId: string) {
    const MarketResearchModel = getMongoConnection().model('MarketResearch')

    const research = await MarketResearchModel.findById(researchId)

    if (!research) {
        throw new NotFoundError('market research', researchId)
    }

    // Check permissions
    if (!research.permissions.view.includes(userId) && research.owner !== userId) {
        throw new ForbiddenError('Cannot access this research')
    }

    return research
}

/**
 * Add finding to market research
 */
export async function addFinding(
    researchId: string,
    userId: string,
    finding: {
        title: string
        description?: string
        impactLevel?: 'high' | 'medium' | 'low'
        supportingData?: any
        source?: string
    }
) {
    const MarketResearchModel = getMongoConnection().model('MarketResearch')

    const research = await MarketResearchModel.findById(researchId)

    if (!research) {
        throw new NotFoundError('market research', researchId)
    }

    // Check edit permission
    if (!research.permissions.edit.includes(userId) && research.owner !== userId) {
        throw new ForbiddenError('Cannot edit this research')
    }

    const findingId = uuid()

    research.findings.push({
        _id: findingId,
        title: finding.title,
        description: finding.description || '',
        impactLevel: finding.impactLevel || 'medium',
        supportingData: finding.supportingData || {},
        source: finding.source || '',
        createdAt: new Date(),
        updatedAt: new Date()
    })

    research.updatedAt = new Date()
    await research.save()

    return research
}

/**
 * Add competitive analysis
 */
export async function addCompetitiveAnalysis(
    researchId: string,
    userId: string,
    analysis: {
        competitorName: string
        strengths?: string[]
        weaknesses?: string[]
        opportunities?: string[]
        threats?: string[]
        marketShare?: number
    }
) {
    const MarketResearchModel = getMongoConnection().model('MarketResearch')

    const research = await MarketResearchModel.findById(researchId)

    if (!research) {
        throw new NotFoundError('market research', researchId)
    }

    // Check edit permission
    if (!research.permissions.edit.includes(userId) && research.owner !== userId) {
        throw new ForbiddenError('Cannot edit this research')
    }

    const analysisId = uuid()

    research.competitiveAnalysis.push({
        _id: analysisId,
        competitorName: analysis.competitorName,
        strengths: analysis.strengths || [],
        weaknesses: analysis.weaknesses || [],
        opportunities: analysis.opportunities || [],
        threats: analysis.threats || [],
        marketShare: analysis.marketShare || 0,
        createdAt: new Date(),
        updatedAt: new Date()
    })

    research.updatedAt = new Date()
    await research.save()

    return research
}

/**
 * Add recommendation
 */
export async function addRecommendation(
    researchId: string,
    userId: string,
    recommendation: {
        title: string
        description?: string
        priority?: 'high' | 'medium' | 'low'
        expectedImpact?: string
    }
) {
    const MarketResearchModel = getMongoConnection().model('MarketResearch')

    const research = await MarketResearchModel.findById(researchId)

    if (!research) {
        throw new NotFoundError('market research', researchId)
    }

    // Check edit permission
    if (!research.permissions.edit.includes(userId) && research.owner !== userId) {
        throw new ForbiddenError('Cannot edit this research')
    }

    const recommendationId = uuid()

    research.recommendations.push({
        _id: recommendationId,
        title: recommendation.title,
        description: recommendation.description || '',
        priority: recommendation.priority || 'medium',
        expectedImpact: recommendation.expectedImpact || '',
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
    })

    research.updatedAt = new Date()
    await research.save()

    return research
}

/**
 * List market research documents
 */
export async function listMarketResearch(
    userId: string,
    options: {
        page?: number
        limit?: number
        researchType?: string
        status?: string
    } = {}
) {
    const MarketResearchModel = getMongoConnection().model('MarketResearch')
    const page = options.page || 1
    const limit = options.limit || 50

    let query: any = {
        $or: [
            { owner: userId },
            { 'permissions.view': userId }
        ]
    }

    if (options.researchType) {
        query.researchType = options.researchType
    }

    if (options.status) {
        query.status = options.status
    }

    const research = await MarketResearchModel
        .find(query)
        .limit(limit)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 })

    const total = await MarketResearchModel.countDocuments(query)

    return {
        data: research,
        pagination: { page, limit, total }
    }
}

/**
 * Search market research
 */
export async function searchMarketResearch(
    query: string,
    userId: string,
    limit: number = 50
) {
    const MarketResearchModel = getMongoConnection().model('MarketResearch')

    return await MarketResearchModel
        .find({
            $text: { $search: query },
            $or: [
                { owner: userId },
                { 'permissions.view': userId }
            ]
        })
        .limit(limit);
}

/**
 * Share market research
 */
export async function shareMarketResearch(
    researchId: string,
    ownerId: string,
    targetUserId: string,
    permissionLevel: 'view' | 'edit' | 'comment'
) {
    const MarketResearchModel = getMongoConnection().model('MarketResearch')

    const research = await MarketResearchModel.findById(researchId)

    if (!research) {
        throw new NotFoundError('market research', researchId)
    }

    // Check ownership
    if (research.owner !== ownerId) {
        throw new ForbiddenError('Only research owner can share')
    }

    // Add to appropriate permission array
    const permissionKey = permissionLevel as 'view' | 'edit' | 'comment'
    if (!research.permissions[permissionKey].includes(targetUserId)) {
        research.permissions[permissionKey].push(targetUserId)
        await research.save()
    }

    return research
}

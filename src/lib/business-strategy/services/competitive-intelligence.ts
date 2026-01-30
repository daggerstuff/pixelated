/**
 * Competitive Intelligence Service
 * 
 * Provides functionality for competitor tracking, SWOT analysis,
 * and market positioning.
 */

import type { CompetitorProfile, CompetitorActivity, MarketPosition } from '../types/competitive-intelligence'
import type { UserId } from '../types/common'
import { BaseService } from './base-service'

export class CompetitiveIntelligenceService extends BaseService {
    private readonly collectionName: string

    constructor() {
        super()
        this.collectionName = this.db.mongodb.collections.competitors
    }

    /**
     * Get all competitors
     */
    async getCompetitors(): Promise<CompetitorProfile[]> {
        try {
            return await this.db.mongodb.database
                .collection<CompetitorProfile>(this.collectionName)
                .find()
                .toArray()
        } catch (error) {
            return this.handleError(error, 'getCompetitors')
        }
    }

    /**
     * Add or update a competitor
     */
    async updateCompetitor(userId: UserId, competitor: Partial<CompetitorProfile>): Promise<void> {
        await this.validatePermissions(userId, 'competitor', 'update')

        const id = competitor.id || this.generateId()
        const update = {
            ...competitor,
            id,
            lastUpdated: new Date(),
            updatedBy: userId
        }

        try {
            await this.db.mongodb.database.collection(this.collectionName).updateOne(
                { id },
                { $set: update },
                { upsert: true }
            )

            await this.logAudit({
                userId,
                action: 'update',
                entityType: 'competitor',
                entityId: id,
                result: 'success'
            })
        } catch (error) {
            return this.handleError(error, 'updateCompetitor')
        }
    }
}

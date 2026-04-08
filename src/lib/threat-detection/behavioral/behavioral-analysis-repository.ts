import {
  IMongoClient,
  IRedisClient,
} from '../threat-hunting/types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('behavioral-analysis-repository')

/**
 * Handles all MongoDB and Redis persistence for behavioral analysis.
 */
export class BehavioralAnalysisRepository {
  constructor(
    private mongoClient: IMongoClient,
    private redis: IRedisClient,
  ) {}

  async storeProfile(userId: string, profile: any): Promise<void> {
    try {
      const db = this.mongoClient.db('behavioral_analysis')
      await db.collection('user_profiles').updateOne(
        { userId },
        { $set: profile, $setOnInsert: { createdAt: new Date() } },
        { upsert: true }
      )
      
      // Cache in Redis
      await this.redis.set(`profile:${userId}`, JSON.stringify(profile), 'EX', 14400);
    } catch (error: unknown) {
      logger.error('Failed to store profile', { error, userId })
      throw error
    }
  }

  async getProfile(userId: string): Promise<any | null> {
    try {
      const cached = await this.redis.get(`profile:${userId}`)
      if (cached) return JSON.parse(cached)

      const db = this.mongoClient.db('behavioral_analysis')
      const profile = await db.collection('user_profiles').findOne({ userId })

      // Cache the result from MongoDB in Redis
      if (profile) {
        await this.redis.set(`profile:${userId}`, JSON.stringify(profile), 'EX', 14400)
      }

      return profile
    } catch (error: unknown) {
      logger.error('Failed to get profile', { error, userId })
      return null
    }
  }

  async storeEvents(events: any[]): Promise<void> {
    try {
      const db = this.mongoClient.db('behavioral_analysis')
      await db.collection('events').insertMany(events)
    } catch (error: unknown) {
      logger.error('Failed to store events', { error, count: events.length })
      throw error
    }
  }

  async getRecentEvents(userId: string, limit: number = 100, timeframe?: string): Promise<any[]> {
    try {
      const db = this.mongoClient.db('behavioral_analysis')
      const query: any = { userId }

      // Apply timeframe filter if provided
      if (timeframe) {
        const now = new Date()
        const startTime = new Date(now.getTime() - this.parseTimeframe(timeframe))
        query.timestamp = { $gte: startTime }
      }

      return await db.collection('events')
        .find(query)
        .sort({ timestamp: -1 })
        .limit(limit)
        .toArray()
    } catch (error: unknown) {
      logger.error('Failed to get recent events', { error, userId })
      return []
    }
  }

  private parseTimeframe(timeframe: string): number {
    // Parse timeframe format like "1h", "24h", "7d" and return milliseconds
    const match = timeframe.match(/^(\d+)([hdm])$/)
    if (!match) return 0

    const value = parseInt(match[1], 10)
    const unit = match[2]

    switch (unit) {
      case 'm': return value * 60 * 1000 // minutes
      case 'h': return value * 60 * 60 * 1000 // hours
      case 'd': return value * 24 * 60 * 60 * 1000 // days
      default: return 0
    }
  }
}

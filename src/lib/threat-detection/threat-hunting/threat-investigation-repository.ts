import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import { IMongoClient, IRedisClient, Investigation } from './types'

const logger = createBuildSafeLogger('threat-investigation-repository')

/**
 * Handles all MongoDB and Redis persistence for threat investigations.
 * Resolves P4.5 (Coupling) and P4.4 (Decomposition).
 */
export class ThreatInvestigationRepository {
  constructor(
    private mongoClient: IMongoClient,
    private redis: IRedisClient,
  ) {}

  async store(investigation: Investigation): Promise<void> {
    try {
      const db = this.mongoClient.db('threat_detection')
      await db.collection('investigations').insertOne(investigation)

      // Also cache in Redis for rapid lookup
      await this.redis.set(
        `investigation:${investigation.investigationId}`,
        JSON.stringify(investigation),
        'EX',
        3600 * 24, // 24-hour cache
      )
    } catch (error: unknown) {
      logger.error('Failed to store investigation', {
        error,
        investigationId: investigation.investigationId,
      })
      throw error
    }
  }

  async update(investigation: Investigation): Promise<void> {
    try {
      const db = this.mongoClient.db('threat_detection')
      await db
        .collection('investigations')
        .updateOne(
          { investigationId: investigation.investigationId },
          { $set: investigation },
        )

      // Update cache
      await this.redis.set(
        `investigation:${investigation.investigationId}`,
        JSON.stringify(investigation),
        'EX',
        3600 * 24,
      )
    } catch (error: unknown) {
      logger.error('Failed to update investigation', {
        error,
        investigationId: investigation.investigationId,
      })
      throw error
    }
  }

  async findById(investigationId: string): Promise<Investigation | null> {
    try {
      // Check Redis first
      const cached = await this.redis.get(`investigation:${investigationId}`)
      if (cached) {
        return JSON.parse(cached) as Investigation
      }

      const db = this.mongoClient.db('threat_detection')
      return (await db
        .collection('investigations')
        .findOne({ investigationId })) as Investigation | null
    } catch (error: unknown) {
      logger.error('Failed to find investigation', { error, investigationId })
      return null
    }
  }

  async find(
    filter: Record<string, any> = {},
    limit: number = 100,
  ): Promise<Investigation[]> {
    try {
      const db = this.mongoClient.db('threat_detection')
      return (await db
        .collection('investigations')
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray()) as Investigation[]
    } catch (error: unknown) {
      logger.error('Failed to query investigations', { error, filter })
      return []
    }
  }

  async deleteFromActive(investigationId: string): Promise<void> {
    await this.redis.lrem('investigations:active', 0, investigationId)
  }

  async addToActive(investigationId: string): Promise<void> {
    await this.redis.lpush('investigations:active', investigationId)
  }

  async getActiveIds(): Promise<string[]> {
    return (await this.redis.lrange('investigations:active', 0, -1)) || []
  }

  async getByIds(ids: string[]): Promise<Investigation[]> {
    if (ids.length === 0) return []
    const keys = ids.map((id) => `investigation:${id}`)
    const results = await this.redis.mget(keys)
    return results
      .filter((r): r is string => r !== null)
      .map((r) => JSON.parse(r) as Investigation)
  }
}

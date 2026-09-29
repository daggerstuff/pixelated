import type { DimensionalEmotion } from '../ai/emotions/dimensionalTypes'
import mongoClient from '../db/mongoClient'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
const logger = createBuildSafeLogger('emotionsRepository')

// Interface for dimensional emotion query parameters
export interface DimensionalEmotionsQuery {
  clientId: string
  startDate?: Date
  endDate?: Date
  limit?: number
}

// Emotions repository interface
export interface EmotionsRepository {
  getDimensionalEmotions(
    query: DimensionalEmotionsQuery,
  ): Promise<DimensionalEmotion[]>
}

// Implementation of the emotions repository
class EmotionsRepositoryImpl implements EmotionsRepository {
  async getDimensionalEmotions(
    query: DimensionalEmotionsQuery,
  ): Promise<DimensionalEmotion[]> {
    logger.info(`Querying emotions for client: ${query.clientId}`)

    const mongoQuery: Record<string, unknown> = { client_id: query.clientId }
    if (query.startDate || query.endDate) {
      const timestampQuery: Record<string, Date> = {}
      if (query.startDate) timestampQuery['$gte'] = query.startDate
      if (query.endDate) timestampQuery['$lte'] = query.endDate
      mongoQuery['timestamp'] = timestampQuery
    }

    let cursor = mongoClient.db
      .collection<DimensionalEmotion>('emotion_records')
      .find(mongoQuery)
      .sort({ timestamp: -1 })

    if (query.limit) {
      cursor = cursor.limit(query.limit)
    }

    const docs = await cursor.toArray()
    return docs.map(({ _id: _ignored, ...emotion }) => ({
      ...emotion,
      timestamp: new Date(emotion.timestamp),
    }))
  }
}

// Singleton instance
let repository: EmotionsRepository | null = null

/**
 * Get the emotions repository instance
 * @returns EmotionsRepository instance
 */
export function getEmotionsRepository(): EmotionsRepository {
  repository ??= new EmotionsRepositoryImpl()
  return repository
}

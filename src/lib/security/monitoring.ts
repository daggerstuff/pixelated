import { createBuildSafeLogger } from '../logging/build-safe-logger'
import { mongoClient } from '../db/mongoClient'
import { validateQuery } from 'mongodb-query-validator'
import { sanitize } from 'mongo-sanitize'

const logger = createBuildSafeLogger('default')

const allowedProperties = ['userId', 'type']
const allowedCharacters = /^[a-zA-Z0-9_-]+$/

const validateInput = (input: string, property: string) => {
  if (!allowedProperties.includes(property)) {
    throw new Error(`Invalid property: ${property}`)
  }
  if (!allowedCharacters.test(input)) {
    throw new Error(`Invalid input: ${input}`)
  }
}

export class SecurityMonitoringService {
  // ...

  public async getUserSecurityEvents(userId: string, limit: number = 100, skip: number = 0): Promise<SecurityEvent[]> {
    try {
      validateInput(userId, 'userId')
      const db = mongoClient.db
      const sanitizedUserId = sanitize(userId)
      const query = { userId: sanitizedUserId }
      validateQuery(query)
      const events = await db
        .collection<SecurityEvent>('security_events')
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray()
      return events
    } catch (error) {
      logger.error('Failed to get user security events', { error: error instanceof Error ? error.message : String(error), userId, })
      return []
    }
  }

  public async getSecurityEventsByType(type: SecurityEventType, limit: number = 100, skip: number = 0): Promise<SecurityEvent[]> {
    try {
      validateInput(type, 'type')
      const db = mongoClient.db
      const sanitizedType = sanitize(type)
      const query = { type: sanitizedType }
      validateQuery(query)
      const events = await db
        .collection<SecurityEvent>('security_events')
        .find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .toArray()
      return events
    } catch (error) {
      logger.error('Failed to get security events by type', { error: error instanceof Error ? error.message : String(error), type, })
      return []
    }
  }

  // ...
}
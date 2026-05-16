import type { Db, MongoClient } from 'mongodb'
import { ObjectId, MongoClient as MongoConstructor } from 'mongodb'

import { mongoClient as sharedMongoClient } from '../db/mongoClient'
import type { GovernancePolicy } from './types'

const GOVERNANCE_DB_NAME = 'governance'
const POLICIES_COLLECTION = 'policies'

/**
 * PolicyStore provides persistent storage for governance policies using MongoDB.
 * Supports save (with upsert) and retrieve operations for policy documents.
 */
export class PolicyStore {
  private db: Db | null = null
  private client: MongoClient | null = null

  /**
   * Initialize the connection to MongoDB
   * @param mongoUri - MongoDB connection URI (optional, uses default if not provided)
   */
  async initialize(mongoUri?: string): Promise<void> {
    // If URI provided, create dedicated connection (for testing)
    if (mongoUri) {
      // Close existing connection if active to prevent leaks
      if (this.client) {
        await this.client.close()
      }
      this.client = new MongoConstructor(mongoUri)
      await this.client.connect()
      this.db = this.client.db(GOVERNANCE_DB_NAME)
    } else {
      // Use shared mongoClient singleton (production)
      await sharedMongoClient.connect()
      this.client = sharedMongoClient
      this.db = sharedMongoClient.db
    }
  }

  /**
   * Save a policy to MongoDB (upsert - update or insert)
   * @param policy - The policy to save
   */
  async savePolicy(policy: GovernancePolicy): Promise<void> {
    if (!this.db) {
      throw new Error('PolicyStore not initialized. Call initialize() first.')
    }

    const collection = this.db.collection<
      Pick<GovernancePolicy, 'version' | 'rules'> & { _id: string }
    >(POLICIES_COLLECTION)

    // Upsert: update if exists, insert if doesn't
    await collection.replaceOne(
      { _id: policy.id },
      {
        _id: policy.id,
        version: policy.version,
        rules: policy.rules,
      } as any,
      { upsert: true },
    )
  }

  /**
   * Retrieve a policy by id
   * @param policyId - The policy id to retrieve
   * @returns The policy if found, null otherwise
   */
  async getPolicy(policyId: string): Promise<GovernancePolicy | null> {
    if (!this.db) {
      throw new Error('PolicyStore not initialized. Call initialize() first.')
    }

    const collection = this.db.collection(POLICIES_COLLECTION)
    const doc = await collection.findOne({ _id: policyId } as any)

    // Convert MongoDB ID to id field for return
    if (doc) {
      const { _id, ...rest } = doc as any
      return {
        id: typeof _id === 'string' ? _id : (_id as ObjectId)?.toString(),
        ...rest,
      } as GovernancePolicy
    }

    return null
  }

  /**
   * Disconnect from MongoDB
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
    this.db = null
  }
}

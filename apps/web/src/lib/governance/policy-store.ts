import type { Db, MongoClient } from 'mongodb'
import { ObjectId, MongoClient as MongoConstructor } from 'mongodb'

import { mongoClient as sharedMongoClient } from '../db/mongoClient'
import type { GovernancePolicy } from './types'

const GOVERNANCE_DB_NAME = 'governance'
const POLICIES_COLLECTION = 'policies'
const POLICY_VERSIONS_COLLECTION = 'policy_versions'

export class PolicyStore {
  private db: Db | null = null
  private client: MongoClient | null = null

  async initialize(mongoUri?: string): Promise<void> {
    if (mongoUri) {
      if (this.client) {
        await this.client.close()
      }
      this.client = new MongoConstructor(mongoUri)
      await this.client.connect()
      this.db = this.client.db(GOVERNANCE_DB_NAME)
    } else {
      await sharedMongoClient.connect()
      this.client = sharedMongoClient as unknown as MongoClient
      this.db = sharedMongoClient.db
    }
  }

  async savePolicy(policy: GovernancePolicy): Promise<void> {
    if (!this.db) {
      throw new Error('PolicyStore not initialized. Call initialize() first.')
    }

    const collection = this.db.collection<
      Pick<GovernancePolicy, 'version' | 'rules'> & { _id: string }
    >(POLICIES_COLLECTION)

    const existing = await collection.findOne({ _id: policy.id })
    const previousVersion = existing?.version ?? null

    await collection.replaceOne(
      { _id: policy.id },
      {
        _id: policy.id,
        version: policy.version,
        rules: policy.rules,
      } as Record<string, unknown>,
      { upsert: true },
    )

    const versionsCollection = this.db.collection(POLICY_VERSIONS_COLLECTION)
    await versionsCollection.insertOne({
      policyId: policy.id,
      version: policy.version,
      previousVersion,
      rules: policy.rules,
      savedAt: new Date().toISOString(),
    })
  }

  async getPolicy(policyId: string): Promise<GovernancePolicy | null> {
    if (!this.db) {
      throw new Error('PolicyStore not initialized. Call initialize() first.')
    }

    const collection = this.db.collection(POLICIES_COLLECTION)
    const doc = await collection.findOne({ _id: policyId } as Record<string, unknown>)

    if (doc) {
      const { _id, ...rest } = doc
      return {
        id: typeof _id === 'string' ? _id : _id?.toString(),
        ...rest,
      } as GovernancePolicy
    }

    return null
  }

  async getPolicyHistory(policyId: string): Promise<
    Array<{
      version: string
      previousVersion: string | null
      rules: GovernancePolicy['rules']
      savedAt: string
    }>
  > {
    if (!this.db) {
      throw new Error('PolicyStore not initialized. Call initialize() first.')
    }

    const versionsCollection = this.db.collection(POLICY_VERSIONS_COLLECTION)
    const docs = await versionsCollection
      .find({ policyId })
      .sort({ savedAt: -1 })
      .toArray()

    return docs.map((doc: any) => ({
      version: doc.version,
      previousVersion: doc.previousVersion,
      rules: doc.rules,
      savedAt: doc.savedAt,
    }))
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close()
      this.client = null
    }
    this.db = null
  }
}

// Use type-only imports so we can reference Collection/ObjectId/Db as types without pulling runtime mongodb
import type {
  Collection as MongoCollection,
  ObjectId as MongoObjectId,
  Db,
} from 'mongodb'

// Runtime shape of our MongoDB wrapper (from src/config/mongodb.config.ts)
type MongoRuntime = {
  connect: () => Promise<Db>
  getDb: () => Db
  client?: unknown
}

class MockObjectId {
  public id: string
  constructor(id?: string) {
    this.id = id || 'mock-object-id'
  }
  toString() {
    return this.id
  }
  toHexString() {
    return this.id
  }
}

// Use conditional imports to prevent MongoDB from being bundled on client side
let mongodb: MongoRuntime | null = null
let ObjectId: typeof MongoObjectId | typeof MockObjectId | null = null

let serverDepsPromise: Promise<void> | null = null

async function initializeDependencies() {
  if (serverDepsPromise) {
    return serverDepsPromise
  }
  if (typeof window === 'undefined') {
    serverDepsPromise = (async () => {
      try {
        const mod = await import('../config/mongodb.config')
        mongodb = mod.default as unknown as MongoRuntime
        const mongodbLib = await import('mongodb')
        ObjectId = mongodbLib.ObjectId
      } catch {
        mongodb = null
        ObjectId = MockObjectId
      }
    })()
  } else {
    mongodb = null
    ObjectId = MockObjectId
    serverDepsPromise = Promise.resolve()
  }
  return serverDepsPromise
}
import type {
  AIMetrics,
  BiasDetection,
  ConsentManagement,
  CrisisSessionFlag,
  Todo,
  TreatmentPlan,
  DataExport,
} from '../types/mongodb.types'

export class DataExportDAO {
  private async getCollection(): Promise<MongoCollection<DataExport>> {
    await initializeDependencies()
    if (!mongodb) {
      throw new Error('MongoDB client not initialized')
    }
    const db = await mongodb.connect()
    return db.collection<DataExport>('data_exports')
  }

  async create(
    exportRequest: Omit<DataExport, '_id'>,
  ): Promise<DataExport> {
    const collection = await this.getCollection()
    // Ensure files is initialized
    const data = { ...exportRequest, files: exportRequest.files || [] }
    const result = await collection.insertOne(data)
    const created = await collection.findOne({ _id: result.insertedId })

    if (!created) {
      throw new Error('Failed to create data export')
    }

    // Don't overwrite UUID 'id' with MongoDB _id
    return created
  }

  async findById(id: string): Promise<DataExport | null> {
    const collection = await this.getCollection()
    // Query by custom 'id' field (UUID) used in the service
    const request = await collection.findOne({ id: id } as any)

    // Don't overwrite UUID 'id' with MongoDB _id
    return request
  }

  async findByPatientId(patientId: string): Promise<DataExport[]> {
    const collection = await this.getCollection()
    const requests = await collection
      .find({ patientId: patientId } as any)
      .sort({ createdAt: -1 })
      .toArray()

    // Don't overwrite UUID 'id' with MongoDB _id
    return requests
  }

  async findAll(filter: any = {}): Promise<DataExport[]> {
    const collection = await this.getCollection()
    const requests = await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray()

    // Don't overwrite UUID 'id' with MongoDB _id
    return requests
  }

  async update(
    id: string,
    updates: Partial<DataExport>,
  ): Promise<DataExport | null> {
    const collection = await this.getCollection()

    // remove _id if present in updates to avoid immutable field error
    const { _id, ...safeUpdates } = updates

    const result = await collection.findOneAndUpdate(
      { id: id } as any,
      { $set: safeUpdates },
      { returnDocument: 'after' },
    )

    // Don't overwrite UUID 'id' with MongoDB _id
    return result
  }

  async addFile(exportId: string, file: any): Promise<void> {
    const collection = await this.getCollection()
    await collection.updateOne({ id: exportId } as any, {
      $push: { files: file } as any,
    })
  }
}

export class TodoDAO {
  private async getCollection(): Promise<MongoCollection<Todo>> {
    await initializeDependencies()
    if (!mongodb) {
      throw new Error('MongoDB client not initialized')
    }
    const db = await mongodb.connect()
    return db.collection<Todo>('todos')
  }

  async create(
    todo: Omit<Todo, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<Todo> {
    const collection = await this.getCollection()
    const newTodo: Omit<Todo, '_id'> = {
      ...todo,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await collection.insertOne(newTodo)
    const createdTodo = await collection.findOne({ _id: result.insertedId })

    if (!createdTodo) {
      throw new Error('Failed to create todo')
    }

    return { ...createdTodo, id: createdTodo._id?.toString() }
  }

  async findAll(userId?: string): Promise<Todo[]> {
    const collection = await this.getCollection()
    const filter = userId ? { userId: new ObjectId!(userId) } : {}
    const todos = await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray()

    return todos.map((todo) => ({ ...todo, id: todo._id?.toString() }))
  }

  async findById(id: string): Promise<Todo | null> {
    const collection = await this.getCollection()
    const todo = await collection.findOne({ _id: new ObjectId!(id) })

    return todo ? { ...todo, id: todo._id?.toString() } : null
  }

  async update(id: string, updates: Partial<Todo>): Promise<Todo | null> {
    const collection = await this.getCollection()
    const { _id, id: _, ...safeUpdates } = updates

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId!(id) },
      { $set: { ...safeUpdates, updatedAt: new Date() } },
      { returnDocument: 'after' },
    )

    return result ? { ...result, id: result._id?.toString() } : null
  }

  async delete(id: string): Promise<boolean> {
    const collection = await this.getCollection()
    const result = await collection.deleteOne({ _id: new ObjectId!(id) })

    return result.deletedCount > 0
  }
}

export class AIMetricsDAO {
  private async getCollection(): Promise<MongoCollection<AIMetrics>> {
    console.log('Initializing dependencies for AI Metrics DAO...')
    await initializeDependencies()
    console.log(
      'Dependencies initialized. MongoDB client status:',
      mongodb ? 'defined' : 'undefined',
    )
    if (!mongodb) {
      console.error('MongoDB client not initialized in AI Metrics DAO')
      throw new Error('MongoDB client not initialized')
    }
    console.log('Attempting to connect to MongoDB for AI Metrics...')
    const db = await mongodb.connect()
    console.log('MongoDB connected successfully for AI Metrics DAO')
    return db.collection<AIMetrics>('ai_metrics')
  }

  async create(metrics: Omit<AIMetrics, '_id'>): Promise<AIMetrics> {
    const collection = await this.getCollection()
    const result = await collection.insertOne(metrics)
    const createdMetrics = await collection.findOne({ _id: result.insertedId })

    if (!createdMetrics) {
      throw new Error('Failed to create AI metrics')
    }

    return { ...createdMetrics, id: createdMetrics._id?.toString() }
  }

  async findByUserId(userId: string, limit = 100): Promise<AIMetrics[]> {
    const collection = await this.getCollection()
    const metrics = await collection
      .find({ userId: new ObjectId!(userId) })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()

    return metrics.map((metric) => ({ ...metric, id: metric._id?.toString() }))
  }

  async getUsageStats(
    userId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{
    totalRequests: number
    totalTokens: number
    averageResponseTime: number
  }> {
    const collection = await this.getCollection()
    const pipeline = [
      {
        $match: {
          userId: new ObjectId!(userId),
          timestamp: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalTokens: { $sum: '$tokensUsed' },
          averageResponseTime: { $avg: '$responseTime' },
        },
      },
    ]

    const result = await collection.aggregate(pipeline).toArray()
    const stats = result[0] as
      | {
          totalRequests: number
          totalTokens: number
          averageResponseTime: number
        }
      | undefined

    return stats || { totalRequests: 0, totalTokens: 0, averageResponseTime: 0 }
  }
}

export class BiasDetectionDAO {
  private async getCollection(): Promise<MongoCollection<BiasDetection>> {
    await initializeDependencies()
    if (!mongodb) {
      // Defensive: initialization failed, do not call connect()
      throw new Error(
        'MongoDB dependency is null: initialization failed or misconfigured. Did not attempt mongodb.connect().',
      )
    }
    const db = await mongodb.connect()
    return db.collection<BiasDetection>('bias_detection')
  }

  async create(detection: Omit<BiasDetection, '_id'>): Promise<BiasDetection> {
    const collection = await this.getCollection()
    const result = await collection.insertOne(detection)
    const createdDetection = await collection.findOne({
      _id: result.insertedId,
    })

    if (!createdDetection) {
      throw new Error('Failed to create bias detection')
    }

    return { ...createdDetection, id: createdDetection._id?.toString() }
  }

  async findByUserId(userId: string, limit = 50): Promise<BiasDetection[]> {
    const collection = await this.getCollection()
    const detections = await collection
      .find({ userId: new ObjectId!(userId) })
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()

    return detections.map((detection) => ({
      ...detection,
      id: detection._id?.toString(),
    }))
  }
}

export class TreatmentPlanDAO {
  private async getCollection(): Promise<MongoCollection<TreatmentPlan>> {
    await initializeDependencies()
    if (!mongodb) {
      throw new Error('MongoDB client not initialized')
    }
    const db = await mongodb.connect()
    return db.collection<TreatmentPlan>('treatment_plans')
  }

  async create(
    plan: Omit<TreatmentPlan, '_id' | 'createdAt' | 'updatedAt'>,
  ): Promise<TreatmentPlan> {
    const collection = await this.getCollection()
    const newPlan: Omit<TreatmentPlan, '_id'> = {
      ...plan,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await collection.insertOne(newPlan)
    const createdPlan = await collection.findOne({ _id: result.insertedId })

    if (!createdPlan) {
      throw new Error('Failed to create treatment plan')
    }

    return { ...createdPlan, id: createdPlan._id?.toString() }
  }

  async findByUserId(userId: string): Promise<TreatmentPlan[]> {
    const collection = await this.getCollection()
    const plans = await collection
      .find({ userId: new ObjectId!(userId) })
      .sort({ createdAt: -1 })
      .toArray()

    return plans.map((plan) => ({ ...plan, id: plan._id?.toString() }))
  }

  async findByTherapistId(therapistId: string): Promise<TreatmentPlan[]> {
    const collection = await this.getCollection()
    const plans = await collection
      .find({ therapistId: new ObjectId!(therapistId) })
      .sort({ createdAt: -1 })
      .toArray()

    return plans.map((plan) => ({ ...plan, id: plan._id?.toString() }))
  }

  async update(
    id: string,
    updates: Partial<TreatmentPlan>,
  ): Promise<TreatmentPlan | null> {
    const collection = await this.getCollection()
    const { _id, id: _, ...safeUpdates } = updates

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId!(id) },
      { $set: { ...safeUpdates, updatedAt: new Date() } },
      { returnDocument: 'after' },
    )

    return result ? { ...result, id: result._id?.toString() } : null
  }
}

export class CrisisSessionFlagDAO {
  private async getCollection(): Promise<MongoCollection<CrisisSessionFlag>> {
    await initializeDependencies()
    if (!mongodb) {
      throw new Error('MongoDB client not initialized')
    }
    const db = await mongodb.connect()
    return db.collection<CrisisSessionFlag>('crisis_session_flags')
  }

  async create(
    flag: Omit<CrisisSessionFlag, '_id' | 'createdAt'>,
  ): Promise<CrisisSessionFlag> {
    const collection = await this.getCollection()
    const newFlag: Omit<CrisisSessionFlag, '_id'> = {
      ...flag,
      createdAt: new Date(),
    }

    const result = await collection.insertOne(newFlag)
    const createdFlag = await collection.findOne({ _id: result.insertedId })

    if (!createdFlag) {
      throw new Error('Failed to create crisis session flag')
    }

    return { ...createdFlag, id: createdFlag._id?.toString() }
  }

  async findActiveFlags(userId?: string): Promise<CrisisSessionFlag[]> {
    const collection = await this.getCollection()
    const filter: { resolved: boolean; userId?: MongoObjectId } = {
      resolved: false,
    }
    if (userId) {
      filter.userId = new ObjectId!(userId) as any
    }

    const flags = await collection
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray()

    return flags.map((flag) => ({ ...flag, id: flag._id?.toString() }))
  }

  async resolveFlag(
    id: string,
    resolvedBy: string,
  ): Promise<CrisisSessionFlag | null> {
    const collection = await this.getCollection()

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId!(id) },
      {
        $set: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: new ObjectId!(resolvedBy),
        },
      },
      { returnDocument: 'after' },
    )

    return result ? { ...result, id: result._id?.toString() } : null
  }
}

export class ConsentManagementDAO {
  private async getCollection(): Promise<MongoCollection<ConsentManagement>> {
    await initializeDependencies()
    if (!mongodb) {
      throw new Error('MongoDB client not initialized (null or undefined)')
    }
    const db = await mongodb.connect()
    return db.collection<ConsentManagement>('consent_management')
  }

  async create(
    consent: Omit<ConsentManagement, '_id'>,
  ): Promise<ConsentManagement> {
    const collection = await this.getCollection()
    const result = await collection.insertOne(consent)
    const createdConsent = await collection.findOne({ _id: result.insertedId })

    if (!createdConsent) {
      throw new Error('Failed to create consent record')
    }

    return { ...createdConsent, id: createdConsent._id?.toString() }
  }

  async findByUserId(userId: string): Promise<ConsentManagement[]> {
    const collection = await this.getCollection()
    const consents = await collection
      .find({ userId: new ObjectId!(userId) })
      .sort({ grantedAt: -1 })
      .toArray()

    return consents.map((consent) => ({
      ...consent,
      id: consent._id?.toString(),
    }))
  }

  async updateConsent(
    userId: string,
    consentType: string,
    granted: boolean,
    ipAddress?: string,
  ): Promise<ConsentManagement> {
    const collection = await this.getCollection()

    const updateData: Partial<ConsentManagement> = {
      granted,
      version: '1.0', // You might want to make this dynamic
      ipAddress,
    }

    if (granted) {
      updateData.grantedAt = new Date()
      updateData.revokedAt = undefined
    } else {
      updateData.revokedAt = new Date()
    }

    const result = await collection.findOneAndUpdate(
      { userId: new ObjectId!(userId), consentType },
      { $set: updateData },
      { upsert: true, returnDocument: 'after' },
    )

    if (!result) {
      throw new Error('Failed to update consent')
    }

    return { ...result, id: result._id?.toString() }
  }
}

// Export instances for use throughout the application
export const todoDAO = new TodoDAO()
export const aiMetricsDAO = new AIMetricsDAO()
export const biasDetectionDAO = new BiasDetectionDAO()
export const treatmentPlanDAO = new TreatmentPlanDAO()
export const crisisSessionFlagDAO = new CrisisSessionFlagDAO()
export const consentManagementDAO = new ConsentManagementDAO()
export const dataExportDAO = new DataExportDAO()

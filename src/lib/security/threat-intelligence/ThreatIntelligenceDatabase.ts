/**
 * Threat Intelligence Database
 * STIX/TAXII compliant threat intelligence storage and management
 * Integrates with Pixelated's MongoDB/Redis infrastructure
 */

import { EventEmitter } from 'events'
import { MongoClient, Db, Collection, ObjectId } from 'mongodb'
import { Redis } from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../../logger'

import { auditLog } from '../audit-logging'
import { encrypt, decrypt } from '../encryption'

// STIX 2.1 Types
export interface STIXObject {
  type: string
  id: string
  created: string
  modified: string
  spec_version?: string
  [key: string]: any
}

export interface STIXIndicator extends STIXObject {
  type: 'indicator'
  pattern: string
  labels: string[]
  valid_from: string
  valid_until?: string
  kill_chain_phases?: KillChainPhase[]
}

export interface STIXMalware extends STIXObject {
  type: 'malware'
  name: string
  labels: string[]
  is_family?: boolean
  aliases?: string[]
  kill_chain_phases?: KillChainPhase[]
}

export interface STIXThreatActor extends STIXObject {
  type: 'threat-actor'
  name: string
  labels: string[]
  aliases?: string[]
  roles?: string[]
  goals?: string[]
  sophistication?: string
  resource_level?: string
  primary_motivation?: string
}

export interface STIXAttackPattern extends STIXObject {
  type: 'attack-pattern'
  name: string
  kill_chain_phases?: KillChainPhase[]
}

export interface STIXVulnerability extends STIXObject {
  type: 'vulnerability'
  name: string
  description?: string
}

export interface KillChainPhase {
  kill_chain_name: string
  phase_name: string
}

// TAXII Types
export interface TAXIICollection {
  id: string
  title: string
  description: string
  can_read: boolean
  can_write: boolean
  media_types: string[]
  created: string
  modified: string
}

export interface TAXIIManifestEntry {
  id: string
  date_added: string
  version: string
  media_type: string
}

// Database Types
export interface ThreatIntelligenceDatabaseConfig {
  mongodb: {
    url: string
    database: string
  }
  redis: {
    url: string
    password?: string
  }
  stix: {
    spec_version: string
    default_labels: string[]
    kill_chain_phases: KillChainPhase[]
  }
  taxii: {
    enabled: boolean
    api_root: string
    max_page_size: number
    collections: TAXIICollection[]
  }
  encryption: {
    enabled: boolean
    key: string
  }
  retention: {
    enabled: boolean
    default_ttl: number // seconds
    stix_types: Record<string, number>
  }
  performance: {
    cache_ttl: number
    batch_size: number
    indexing_interval: number
  }
}

export interface DatabaseThreatIntelligence {
  _id?: ObjectId
  stix_id: string
  type: string
  stix_object: STIXObject
  encrypted_data?: string
  metadata: {
    source: string
    confidence: number
    reliability: string
    collection_id?: string
    tags: string[]
    processed: boolean
    validated: boolean
  }
  created_at: Date
  updated_at: Date
  expires_at?: Date
}

export interface DatabaseCollection {
  _id?: ObjectId
  collection_id: string
  title: string
  description: string
  stix_types: string[]
  can_read: boolean
  can_write: boolean
  media_types: string[]
  created_at: Date
  updated_at: Date
}

export class ThreatIntelligenceDatabase extends EventEmitter {
  private mongoClient: MongoClient
  private db: Db
  private stixCollection: Collection<DatabaseThreatIntelligence>
  private collectionsCollection: Collection<DatabaseCollection>
  private manifestCollection: Collection<TAXIIManifestEntry>
  private redis: Redis
  private isInitialized = false
  private indexingInterval: NodeJS.Timeout | null = null

  constructor(private config: ThreatIntelligenceDatabaseConfig) {
    super()
    this.setMaxListeners(0)
  }

  /**
   * Initialize the threat intelligence database
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Threat Intelligence Database')

      // Initialize MongoDB connection
      this.mongoClient = new MongoClient(this.config.mongodb.url)
      await this.mongoClient.connect()
      this.db = this.mongoClient.db(this.config.mongodb.database)

      // Initialize collections
      this.stixCollection =
        this.db.collection<DatabaseThreatIntelligence>('stix_objects')
      this.collectionsCollection =
        this.db.collection<DatabaseCollection>('taxii_collections')
      this.manifestCollection =
        this.db.collection<TAXIIManifestEntry>('taxii_manifest')

      // Create indexes for performance
      await this.createIndexes()

      // Initialize Redis connection
      this.redis = new Redis(this.config.redis.url, {
        password: this.config.redis.password,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
      })

      // Initialize TAXII collections if enabled
      if (this.config.taxii.enabled) {
        await this.initializeTAXIICollections()
      }

      // Start background indexing
      this.startIndexingService()

      this.isInitialized = true
      logger.info('Threat Intelligence Database initialized successfully')

      this.emit('initialized', { timestamp: new Date() })
    } catch (error) {
      logger.error('Failed to initialize Threat Intelligence Database', {
        error: error.message,
      })
      throw new Error(
        `Failed to initialize threat intelligence database: ${error.message}`,
        { cause: error },
      )
    }
  }

  /**
   * Create database indexes for optimal performance
   */
  private async createIndexes(): Promise<void> {
    try {
      await Promise.all([
        // STIX objects indexes
        this.stixCollection.createIndex({ stix_id: 1 }, { unique: true }),
        this.stixCollection.createIndex({ type: 1 }),
        this.stixCollection.createIndex({ 'stix_object.created': -1 }),
        this.stixCollection.createIndex({ 'stix_object.modified': -1 }),
        this.stixCollection.createIndex({ 'metadata.collection_id': 1 }),
        this.stixCollection.createIndex({ 'metadata.processed': 1 }),
        this.stixCollection.createIndex({ 'metadata.validated': 1 }),
        this.stixCollection.createIndex(
          { expires_at: 1 },
          { expireAfterSeconds: 0 },
        ),

        // Collections indexes
        this.collectionsCollection.createIndex(
          { collection_id: 1 },
          { unique: true },
        ),
        this.collectionsCollection.createIndex({
          title: 'text',
          description: 'text',
        }),

        // Manifest indexes
        this.manifestCollection.createIndex({ id: 1 }),
        this.manifestCollection.createIndex({ date_added: -1 }),
      ])

      logger.info('Database indexes created successfully')
    } catch (error) {
      logger.error('Failed to create database indexes', {
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Initialize TAXII collections
   */
  private async initializeTAXIICollections(): Promise<void> {
    try {
      for (const collection of this.config.taxii.collections) {
        const existing = await this.collectionsCollection.findOne({
          collection_id: collection.id,
        })

        if (!existing) {
          await this.collectionsCollection.insertOne({
            collection_id: collection.id,
            title: collection.title,
            description: collection.description,
            stix_types: [
              'indicator',
              'malware',
              'threat-actor',
              'attack-pattern',
              'vulnerability',
            ],
            can_read: collection.can_read,
            can_write: collection.can_write,
            media_types: collection.media_types,
            created_at: new Date(),
            updated_at: new Date(),
          })

          logger.info('TAXII collection created', {
            collection_id: collection.id,
          })
        }
      }
    } catch (error) {
      logger.error('Failed to initialize TAXII collections', {
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Store STIX object in database
   */
  async storeSTIXObject(
    stixObject: STIXObject,
    metadata: {
      source: string
      confidence: number
      reliability: string
      collection_id?: string
      tags?: string[]
    },
  ): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Threat intelligence database not initialized')
    }

    try {
      // Validate STIX object
      this.validateSTIXObject(stixObject)

      // Check cache first
      const cacheKey = `stix:${stixObject.id}`
      const cached = await this.redis.get(cacheKey)
      if (cached) {
        logger.debug('STIX object found in cache', { stix_id: stixObject.id })
        return stixObject.id
      }

      // Prepare data for storage
      let dataToStore: DatabaseThreatIntelligence = {
        stix_id: stixObject.id,
        type: stixObject.type,
        stix_object: stixObject,
        metadata: {
          source: metadata.source,
          confidence: metadata.confidence,
          reliability: metadata.reliability,
          collection_id: metadata.collection_id,
          tags: metadata.tags || [],
          processed: false,
          validated: false,
        },
        created_at: new Date(),
        updated_at: new Date(),
      }

      // Encrypt sensitive data if enabled
      if (this.config.encryption.enabled) {
        const encryptedData = await encrypt(
          JSON.stringify(stixObject),
          this.config.encryption.key,
        )
        dataToStore = {
          ...dataToStore,
          stix_object: { encrypted: true } as any,
          encrypted_data: encryptedData,
        }
      }

      // Calculate expiration date
      const ttl =
        this.config.retention.stix_types[stixObject.type] ||
        this.config.retention.default_ttl
      if (this.config.retention.enabled && ttl > 0) {
        dataToStore.expires_at = new Date(Date.now() + ttl * 1000)
      }

      // Store in database
      await this.stixCollection.replaceOne(
        { stix_id: stixObject.id },
        dataToStore,
        { upsert: true },
      )

      // Update TAXII manifest
      if (this.config.taxii.enabled && metadata.collection_id) {
        await this.updateTAXIIManifest(stixObject.id, metadata.collection_id)
      }

      // Cache the result
      await this.redis.setex(
        cacheKey,
        this.config.performance.cache_ttl,
        JSON.stringify({ stix_id: stixObject.id, cached: true }),
      )

      // Audit log
      await auditLog({
        action: 'stix_object_stored',
        resource: `stix:${stixObject.id}`,
        details: {
          type: stixObject.type,
          source: metadata.source,
          confidence: metadata.confidence,
        },
        userId: 'system',
        ip: 'internal',
      })

      logger.info('STIX object stored successfully', {
        stix_id: stixObject.id,
        type: stixObject.type,
      })

      this.emit('stix:stored', {
        stix_id: stixObject.id,
        type: stixObject.type,
      })

      return stixObject.id
    } catch (error) {
      logger.error('Failed to store STIX object', {
        error: error.message,
        stix_id: stixObject.id,
      })
      throw error
    }
  }

  /**
   * Validate STIX object
   */
  private validateSTIXObject(stixObject: STIXObject): void {
    const requiredFields = ['type', 'id', 'created', 'modified']

    for (const field of requiredFields) {
      if (!stixObject[field]) {
        throw new Error(`Missing required STIX field: ${field}`)
      }
    }

    // Validate ID format
    if (!stixObject.id.includes('--')) {
      throw new Error('Invalid STIX ID format')
    }

    // Validate timestamp format
    try {
      new Date(stixObject.created)
      new Date(stixObject.modified)
    } catch (error) {
      throw new Error('Invalid STIX timestamp format', { cause: error })
    }

    // Type-specific validation
    switch (stixObject.type) {
      case 'indicator':
        this.validateIndicator(stixObject as STIXIndicator)
        break
      case 'malware':
        this.validateMalware(stixObject as STIXMalware)
        break
      case 'threat-actor':
        this.validateThreatActor(stixObject as STIXThreatActor)
        break
      case 'attack-pattern':
        this.validateAttackPattern(stixObject as STIXAttackPattern)
        break
      case 'vulnerability':
        this.validateVulnerability(stixObject as STIXVulnerability)
        break
    }
  }

  /**
   * Validate STIX Indicator
   */
  private validateIndicator(indicator: STIXIndicator): void {
    if (!indicator.pattern) {
      throw new Error('STIX Indicator missing required field: pattern')
    }
    if (!indicator.labels || indicator.labels.length === 0) {
      throw new Error('STIX Indicator missing required field: labels')
    }
  }

  /**
   * Validate STIX Malware
   */
  private validateMalware(malware: STIXMalware): void {
    if (!malware.name) {
      throw new Error('STIX Malware missing required field: name')
    }
    if (!malware.labels || malware.labels.length === 0) {
      throw new Error('STIX Malware missing required field: labels')
    }
  }

  /**
   * Validate STIX Threat Actor
   */
  private validateThreatActor(threatActor: STIXThreatActor): void {
    if (!threatActor.name) {
      throw new Error('STIX Threat Actor missing required field: name')
    }
    if (!threatActor.labels || threatActor.labels.length === 0) {
      throw new Error('STIX Threat Actor missing required field: labels')
    }
  }

  /**
   * Validate STIX Attack Pattern
   */
  private validateAttackPattern(attackPattern: STIXAttackPattern): void {
    if (!attackPattern.name) {
      throw new Error('STIX Attack Pattern missing required field: name')
    }
  }

  /**
   * Validate STIX Vulnerability
   */
  private validateVulnerability(vulnerability: STIXVulnerability): void {
    if (!vulnerability.name) {
      throw new Error('STIX Vulnerability missing required field: name')
    }
  }

  /**
   * Get STIX object by ID
   */
  async getSTIXObject(stixId: string): Promise<STIXObject | null> {
    try {
      const result = await this.stixCollection.findOne({ stix_id: stixId })

      if (!result) {
        return null
      }

      // Decrypt if necessary
      if (result.encrypted_data && this.config.encryption.enabled) {
        const decryptedData = await decrypt(
          result.encrypted_data,
          this.config.encryption.key,
        )
        return JSON.parse(decryptedData)
      }

      return result.stix_object
    } catch (error) {
      logger.error('Failed to get STIX object', {
        error: error.message,
        stix_id: stixId,
      })
      throw error
    }
  }

  /**
   * Query STIX objects
   */
  async querySTIXObjects(query: {
    type?: string
    collection_id?: string
    source?: string
    tags?: string[]
    start_date?: Date
    end_date?: Date
    validated?: boolean
    processed?: boolean
    limit?: number
    offset?: number
  }): Promise<{ objects: STIXObject[]; total: number }> {
    try {
      const filter: any = {}

      if (query.type) filter.type = query.type
      if (query.collection_id)
        filter['metadata.collection_id'] = query.collection_id
      if (query.source) filter['metadata.source'] = query.source
      if (query.validated !== undefined)
        filter['metadata.validated'] = query.validated
      if (query.processed !== undefined)
        filter['metadata.processed'] = query.processed

      if (query.tags && query.tags.length > 0) {
        filter['metadata.tags'] = { $in: query.tags }
      }

      if (query.start_date || query.end_date) {
        filter['stix_object.created'] = {}
        if (query.start_date)
          filter['stix_object.created'].$gte = query.start_date.toISOString()
        if (query.end_date)
          filter['stix_object.created'].$lte = query.end_date.toISOString()
      }

      const [objects, total] = await Promise.all([
        this.stixCollection
          .find(filter)
          .sort({ 'stix_object.created': -1 })
          .skip(query.offset || 0)
          .limit(query.limit || 100)
          .toArray(),
        this.stixCollection.countDocuments(filter),
      ])

      // Decrypt and return objects
      const decryptedObjects = objects.map((obj) => {
        if (obj.encrypted_data && this.config.encryption.enabled) {
          return JSON.parse(
            decrypt(obj.encrypted_data, this.config.encryption.key),
          )
        }
        return obj.stix_object
      })

      return {
        objects: decryptedObjects,
        total,
      }
    } catch (error) {
      logger.error('Failed to query STIX objects', {
        error: error.message,
        query,
      })
      throw error
    }
  }

  /**
   * TAXII API Methods
   */

  /**
   * Get TAXII collections
   */
  async getTAXIICollections(): Promise<TAXIICollection[]> {
    try {
      const collections = await this.collectionsCollection.find().toArray()
      return collections.map((coll) => ({
        id: coll.collection_id,
        title: coll.title,
        description: coll.description,
        can_read: coll.can_read,
        can_write: coll.can_write,
        media_types: coll.media_types,
        created: coll.created_at.toISOString(),
        modified: coll.updated_at.toISOString(),
      }))
    } catch (error) {
      logger.error('Failed to get TAXII collections', { error: error.message })
      throw error
    }
  }

  /**
   * Get TAXII collection by ID
   */
  async getTAXIICollection(
    collectionId: string,
  ): Promise<TAXIICollection | null> {
    try {
      const collection = await this.collectionsCollection.findOne({
        collection_id: collectionId,
      })

      if (!collection) {
        return null
      }

      return {
        id: collection.collection_id,
        title: collection.title,
        description: collection.description,
        can_read: collection.can_read,
        can_write: collection.can_write,
        media_types: collection.media_types,
        created: collection.created_at.toISOString(),
        modified: collection.updated_at.toISOString(),
      }
    } catch (error) {
      logger.error('Failed to get TAXII collection', {
        error: error.message,
        collectionId,
      })
      throw error
    }
  }

  /**
   * Get TAXII manifest for collection
   */
  async getTAXIIManifest(
    collectionId: string,
    limit: number = 100,
  ): Promise<TAXIIManifestEntry[]> {
    try {
      return await this.manifestCollection
        .find({ collection_id: collectionId })
        .sort({ date_added: -1 })
        .limit(limit)
        .toArray()
    } catch (error) {
      logger.error('Failed to get TAXII manifest', {
        error: error.message,
        collectionId,
      })
      throw error
    }
  }

  /**
   * Get objects from TAXII collection
   */
  async getTAXIIObjects(
    collectionId: string,
    options: {
      limit?: number
      offset?: number
      added_after?: Date
      match_type?: string
      match_id?: string
    } = {},
  ): Promise<{ objects: STIXObject[]; more: boolean }> {
    try {
      const filter: any = { 'metadata.collection_id': collectionId }

      if (options.added_after) {
        filter.created_at = { $gte: options.added_after }
      }

      if (options.match_type) {
        filter.type = options.match_type
      }

      if (options.match_id) {
        filter.stix_id = options.match_id
      }

      const limit = Math.min(
        options.limit || 100,
        this.config.taxii.max_page_size,
      )
      const offset = options.offset || 0

      const [objects, _total] = await Promise.all([
        this.stixCollection
          .find(filter)
          .sort({ created_at: -1 })
          .skip(offset)
          .limit(limit + 1) // Get one extra to check if there are more
          .toArray(),
        this.stixCollection.countDocuments(filter),
      ])

      const hasMore = objects.length > limit
      if (hasMore) {
        objects.pop() // Remove the extra object
      }

      // Decrypt and return objects
      const decryptedObjects = objects.map((obj) => {
        if (obj.encrypted_data && this.config.encryption.enabled) {
          return JSON.parse(
            decrypt(obj.encrypted_data, this.config.encryption.key),
          )
        }
        return obj.stix_object
      })

      return {
        objects: decryptedObjects,
        more: hasMore,
      }
    } catch (error) {
      logger.error('Failed to get TAXII objects', {
        error: error.message,
        collectionId,
      })
      throw error
    }
  }

  /**
   * Update TAXII manifest
   */
  private async updateTAXIIManifest(
    stixId: string,
    collectionId: string,
  ): Promise<void> {
    try {
      await this.manifestCollection.replaceOne(
        { id: stixId, collection_id: collectionId },
        {
          id: stixId,
          collection_id: collectionId,
          date_added: new Date().toISOString(),
          version: new Date().toISOString(),
          media_type: 'application/stix+json;version=2.1',
        },
        { upsert: true },
      )
    } catch (error) {
      logger.error('Failed to update TAXII manifest', {
        error: error.message,
        stixId,
        collectionId,
      })
      throw error
    }
  }

  /**
   * Validate STIX object
   */
  async validateSTIXObjectData(stixId: string): Promise<{
    valid: boolean
    errors: string[]
    warnings: string[]
  }> {
    try {
      const obj = await this.stixCollection.findOne({ stix_id: stixId })

      if (!obj) {
        return {
          valid: false,
          errors: ['STIX object not found'],
          warnings: [],
        }
      }

      // Get the actual STIX object
      let stixObject = obj.stix_object
      if (obj.encrypted_data && this.config.encryption.enabled) {
        const decryptedData = await decrypt(
          obj.encrypted_data,
          this.config.encryption.key,
        )
        stixObject = JSON.parse(decryptedData)
      }

      const errors: string[] = []
      const warnings: string[] = []

      // Perform validation
      try {
        this.validateSTIXObject(stixObject)
      } catch (error: any) {
        errors.push(error.message)
      }

      // Additional validation rules
      if (
        stixObject.spec_version &&
        stixObject.spec_version !== this.config.stix.spec_version
      ) {
        warnings.push(
          `STIX spec version mismatch: ${stixObject.spec_version} vs ${this.config.stix.spec_version}`,
        )
      }

      // Update validation status
      await this.stixCollection.updateOne(
        { stix_id: stixId },
        { $set: { 'metadata.validated': errors.length === 0 } },
      )

      return {
        valid: errors.length === 0,
        errors,
        warnings,
      }
    } catch (error) {
      logger.error('Failed to validate STIX object', {
        error: error.message,
        stixId,
      })
      throw error
    }
  }

  /**
   * Process STIX object (enrichment, normalization, etc.)
   */
  async processSTIXObject(stixId: string): Promise<{
    processed: boolean
    enrichments: string[]
    normalized: boolean
  }> {
    try {
      const obj = await this.stixCollection.findOne({ stix_id: stixId })

      if (!obj) {
        throw new Error('STIX object not found')
      }

      // Get the actual STIX object
      let stixObject = obj.stix_object
      if (obj.encrypted_data && this.config.encryption.enabled) {
        const decryptedData = await decrypt(
          obj.encrypted_data,
          this.config.encryption.key,
        )
        stixObject = JSON.parse(decryptedData)
      }

      const enrichments: string[] = []
      let normalized = false

      // Perform processing based on type
      switch (stixObject.type) {
        case 'indicator': {
          const indicatorResult = await this.processIndicator(
            stixObject as STIXIndicator,
          )
          enrichments.push(...indicatorResult.enrichments)
          normalized = indicatorResult.normalized
          break
        }
        case 'malware': {
          const malwareResult = await this.processMalware(
            stixObject as STIXMalware,
          )
          enrichments.push(...malwareResult.enrichments)
          normalized = malwareResult.normalized
          break
        }
      }

      // Update processed data
      let updatedData = stixObject
      if (this.config.encryption.enabled && obj.encrypted_data) {
        const encryptedData = await encrypt(
          JSON.stringify(updatedData),
          this.config.encryption.key,
        )
        await this.stixCollection.updateOne(
          { stix_id: stixId },
          {
            $set: {
              'encrypted_data': encryptedData,
              'metadata.processed': true,
              'updated_at': new Date(),
            },
          },
        )
      } else {
        await this.stixCollection.updateOne(
          { stix_id: stixId },
          {
            $set: {
              'stix_object': updatedData,
              'metadata.processed': true,
              'updated_at': new Date(),
            },
          },
        )
      }

      logger.info('STIX object processed successfully', {
        stix_id: stixId,
        enrichments: enrichments.length,
        normalized,
      })

      return {
        processed: true,
        enrichments,
        normalized,
      }
    } catch (error) {
      logger.error('Failed to process STIX object', {
        error: error.message,
        stixId,
      })
      throw error
    }
  }

  /**
   * Process STIX Indicator
   */
  private async processIndicator(indicator: STIXIndicator): Promise<{
    enrichments: string[]
    normalized: boolean
  }> {
    const enrichments: string[] = []

    try {
      // Normalize pattern format
      if (indicator.pattern) {
        indicator.pattern = this.normalizeIndicatorPattern(indicator.pattern)
        enrichments.push('pattern_normalized')
      }

      // Add default labels if missing
      if (!indicator.labels || indicator.labels.length === 0) {
        indicator.labels = this.config.stix.default_labels
        enrichments.push('default_labels_added')
      }

      // Validate kill chain phases
      if (indicator.kill_chain_phases) {
        indicator.kill_chain_phases = indicator.kill_chain_phases.filter(
          (phase) => this.isValidKillChainPhase(phase),
        )
        enrichments.push('kill_chain_phases_validated')
      }

      return {
        enrichments,
        normalized: true,
      }
    } catch (error) {
      logger.error('Failed to process indicator', { error: error.message })
      throw error
    }
  }

  /**
   * Process STIX Malware
   */
  private async processMalware(malware: STIXMalware): Promise<{
    enrichments: string[]
    normalized: boolean
  }> {
    const enrichments: string[] = []

    try {
      // Normalize name
      malware.name = malware.name.trim().toLowerCase()
      enrichments.push('name_normalized')

      // Add default labels if missing
      if (!malware.labels || malware.labels.length === 0) {
        malware.labels = ['malicious-activity']
        enrichments.push('default_labels_added')
      }

      // Validate kill chain phases
      if (malware.kill_chain_phases) {
        malware.kill_chain_phases = malware.kill_chain_phases.filter((phase) =>
          this.isValidKillChainPhase(phase),
        )
        enrichments.push('kill_chain_phases_validated')
      }

      return {
        enrichments,
        normalized: true,
      }
    } catch (error) {
      logger.error('Failed to process malware', { error: error.message })
      throw error
    }
  }

  /**
   * Normalize indicator pattern
   */
  private normalizeIndicatorPattern(pattern: string): string {
    // Basic normalization - remove extra whitespace and standardize format
    return pattern.replace(/\s+/g, ' ').trim().toLowerCase()
  }

  /**
   * Validate kill chain phase
   */
  private isValidKillChainPhase(phase: KillChainPhase): boolean {
    return this.config.stix.kill_chain_phases.some(
      (validPhase) =>
        validPhase.kill_chain_name === phase.kill_chain_name &&
        validPhase.phase_name === phase.phase_name,
    )
  }

  /**
   * Start indexing service
   */
  private startIndexingService(): void {
    this.indexingInterval = setInterval(async () => {
      await this.performIndexing()
    }, this.config.performance.indexing_interval)
  }

  /**
   * Perform database indexing
   */
  private async performIndexing(): Promise<void> {
    try {
      logger.info('Starting database indexing')

      // Index unprocessed objects
      const unprocessedCount = await this.stixCollection.countDocuments({
        'metadata.processed': false,
      })

      if (unprocessedCount > 0) {
        logger.info(`Indexing ${unprocessedCount} unprocessed objects`)

        const unprocessed = await this.stixCollection
          .find({ 'metadata.processed': false })
          .limit(this.config.performance.batch_size)
          .toArray()

        for (const obj of unprocessed) {
          try {
            await this.processSTIXObject(obj.stix_id)
          } catch (error) {
            logger.error('Failed to process object during indexing', {
              error: error.message,
              stix_id: obj.stix_id,
            })
          }
        }
      }

      // Clean up expired objects
      if (this.config.retention.enabled) {
        const expiredCount = await this.stixCollection.countDocuments({
          expires_at: { $lt: new Date() },
        })

        if (expiredCount > 0) {
          logger.info(`Cleaning up ${expiredCount} expired objects`)

          const result = await this.stixCollection.deleteMany({
            expires_at: { $lt: new Date() },
          })

          logger.info(`Cleaned up ${result.deletedCount} expired objects`)
        }
      }

      logger.info('Database indexing completed')
    } catch (error) {
      logger.error('Failed to perform indexing', { error: error.message })
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    total_objects: number
    by_type: Record<string, number>
    collections: number
    processed_percentage: number
    validated_percentage: number
  }> {
    try {
      const [
        totalObjects,
        byType,
        collections,
        processedCount,
        validatedCount,
      ] = await Promise.all([
        this.stixCollection.countDocuments(),
        this.stixCollection
          .aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }])
          .toArray(),
        this.collectionsCollection.countDocuments(),
        this.stixCollection.countDocuments({ 'metadata.processed': true }),
        this.stixCollection.countDocuments({ 'metadata.validated': true }),
      ])

      const byTypeMap = byType.reduce(
        (acc, item) => {
          acc[item._id] = item.count
          return acc
        },
        {} as Record<string, number>,
      )

      return {
        total_objects: totalObjects,
        by_type: byTypeMap,
        collections,
        processed_percentage:
          totalObjects > 0 ? (processedCount / totalObjects) * 100 : 0,
        validated_percentage:
          totalObjects > 0 ? (validatedCount / totalObjects) * 100 : 0,
      }
    } catch (error) {
      logger.error('Failed to get database statistics', {
        error: error.message,
      })
      throw error
    }
  }

  /**
   * Export STIX objects
   */
  async exportSTIXObjects(query: {
    types?: string[]
    collections?: string[]
    start_date?: Date
    end_date?: Date
    format?: 'json' | 'xml'
  }): Promise<string> {
    try {
      const filter: any = {}

      if (query.types && query.types.length > 0) {
        filter.type = { $in: query.types }
      }

      if (query.collections && query.collections.length > 0) {
        filter['metadata.collection_id'] = { $in: query.collections }
      }

      if (query.start_date || query.end_date) {
        filter['stix_object.created'] = {}
        if (query.start_date)
          filter['stix_object.created'].$gte = query.start_date.toISOString()
        if (query.end_date)
          filter['stix_object.created'].$lte = query.end_date.toISOString()
      }

      const objects = await this.stixCollection.find(filter).toArray()

      // Decrypt objects
      const decryptedObjects = objects.map((obj) => {
        if (obj.encrypted_data && this.config.encryption.enabled) {
          return JSON.parse(
            decrypt(obj.encrypted_data, this.config.encryption.key),
          )
        }
        return obj.stix_object
      })

      // Create STIX bundle
      const bundle = {
        type: 'bundle',
        id: `bundle--${uuidv4()}`,
        spec_version: this.config.stix.spec_version,
        objects: decryptedObjects,
      }

      return JSON.stringify(bundle, null, 2)
    } catch (error) {
      logger.error('Failed to export STIX objects', { error: error.message })
      throw error
    }
  }

  /**
   * Import STIX objects
   */
  async importSTIXObjects(
    stixData: string,
    metadata: {
      source: string
      confidence: number
      reliability: string
      collection_id?: string
    },
  ): Promise<{ imported: number; errors: string[] }> {
    try {
      const bundle = JSON.parse(stixData)

      if (bundle.type !== 'bundle') {
        throw new Error('Invalid STIX bundle format')
      }

      const objects = bundle.objects || []
      let imported = 0
      const errors: string[] = []

      for (const obj of objects) {
        try {
          await this.storeSTIXObject(obj, metadata)
          imported++
        } catch (error: any) {
          errors.push(`Failed to import ${obj.id}: ${error.message}`)
        }
      }

      logger.info('STIX import completed', { imported, errors: errors.length })

      return { imported, errors }
    } catch (error) {
      logger.error('Failed to import STIX objects', { error: error.message })
      throw error
    }
  }

  /**
   * Shutdown the database
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down Threat Intelligence Database')

      if (this.indexingInterval) {
        clearInterval(this.indexingInterval)
      }

      await this.redis.quit()
      await this.mongoClient.close()

      this.isInitialized = false
      this.emit('shutdown', { timestamp: new Date() })

      logger.info('Threat Intelligence Database shutdown completed')
    } catch (error) {
      logger.error('Error during shutdown', { error: error.message })
      throw error
    }
  }

  /**
   * Get initialization status
   */
  get isReady(): boolean {
    return this.isInitialized
  }

  /**
   * Get configuration
   */
  get config(): ThreatIntelligenceDatabaseConfig {
    return this.config
  }
}

export default ThreatIntelligenceDatabase

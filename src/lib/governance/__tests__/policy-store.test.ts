import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PolicyStore } from '../policy-store'
import { MongoMemoryServer } from 'mongodb-memory-server'

describe('PolicyStore', () => {
  let policyStore: PolicyStore
  let mongod: MongoMemoryServer
  let mongoUri: string

  beforeEach(async () => {
    // Setup in-memory MongoDB
    mongod = await MongoMemoryServer.create()
    mongoUri = mongod.getUri()
  })

  afterEach(async () => {
    // Clean up
    await policyStore?.disconnect?.()
    await mongod?.stop()
  })

  describe('initialize', () => {
    it('connects to MongoDB using the provided URI', async () => {
      policyStore = new PolicyStore()
      await policyStore.initialize(mongoUri)
      // If we got here without error, connection succeeded
      expect(policyStore).toBeDefined()
    })
  })

  describe('savePolicy', () => {
    beforeEach(async () => {
      mongod = await MongoMemoryServer.create()
      mongoUri = mongod.getUri()
      policyStore = new PolicyStore()
      await policyStore.initialize(mongoUri)
    })

    afterEach(async () => {
      await policyStore?.disconnect?.()
      await mongod?.stop()
    })

    it('stores a policy in MongoDB', async () => {
      const policy = {
        id: 'test-policy',
        version: '1.0.0',
        rules: [
          {
            id: 'rule-1',
            action: 'encrypt' as const,
            conditions: [
              {
                field: 'dataClassification',
                operator: 'equals' as const,
                value: 'confidential',
              },
            ],
            required: ['fhe_encryption' as const],
          },
        ],
      }

      await policyStore.savePolicy(policy)

      // Verify by retrieving
      const retrieved = await policyStore.getPolicy('test-policy')
      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe('test-policy')
      expect(retrieved?.version).toBe('1.0.0')
    })

    it('updates policy if it already exists (upsert)', async () => {
      const policy1 = {
        id: 'test-policy',
        version: '1.0.0',
        rules: [
          {
            id: 'rule-1',
            action: 'encrypt' as const,
            conditions: [
              {
                field: 'dataClassification',
                operator: 'equals' as const,
                value: 'confidential',
              },
            ],
            required: ['fhe_encryption' as const],
          },
        ],
      }

      const policy2 = {
        id: 'test-policy',
        version: '2.0.0',
        rules: [
          {
            id: 'rule-2',
            action: 'access' as const,
            conditions: [
              {
                field: 'dataClassification',
                operator: 'equals' as const,
                value: 'public',
              },
            ],
            required: ['audit_logged' as const],
          },
        ],
      }

      // Save initial policy
      await policyStore.savePolicy(policy1)
      let retrieved = await policyStore.getPolicy('test-policy')
      expect(retrieved?.version).toBe('1.0.0')

      // Update with new version
      await policyStore.savePolicy(policy2)
      retrieved = await policyStore.getPolicy('test-policy')
      expect(retrieved?.version).toBe('2.0.0')
      expect(retrieved?.rules[0].id).toBe('rule-2')
    })
  })

  describe('getPolicy', () => {
    beforeEach(async () => {
      mongod = await MongoMemoryServer.create()
      mongoUri = mongod.getUri()
      policyStore = new PolicyStore()
      await policyStore.initialize(mongoUri)
    })

    afterEach(async () => {
      await policyStore?.disconnect?.()
      await mongod?.stop()
    })

    it('retrieves a policy by id', async () => {
      const policy = {
        id: 'retrieve-test',
        version: '1.0.0',
        rules: [
          {
            id: 'rule-1',
            action: 'encrypt' as const,
            conditions: [
              {
                field: 'dataClassification',
                operator: 'equals' as const,
                value: 'confidential',
              },
            ],
            required: ['fhe_encryption' as const],
          },
        ],
      }

      await policyStore.savePolicy(policy)
      const retrieved = await policyStore.getPolicy('retrieve-test')

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe('retrieve-test')
      expect(retrieved?.version).toBe('1.0.0')
    })

    it('returns null for non-existent policy', async () => {
      const retrieved = await policyStore.getPolicy('non-existent')
      expect(retrieved).toBeNull()
    })

    it('verifies the retrieved policy matches the saved one', async () => {
      const originalPolicy = {
        id: 'match-test',
        version: '3.2.1',
        rules: [
          {
            id: 'rule-a',
            action: 'delete' as const,
            conditions: [
              {
                field: 'userConsent',
                operator: 'equals' as const,
                value: 'false',
              },
            ],
            required: ['consent_verified' as const],
          },
          {
            id: 'rule-b',
            action: 'share' as const,
            conditions: [
              {
                field: 'recipient',
                operator: 'contains' as const,
                value: '@example.com',
              },
            ],
            required: ['audit_logged' as const],
          },
        ],
      }

      await policyStore.savePolicy(originalPolicy)
      const retrieved = await policyStore.getPolicy('match-test')

      expect(retrieved).toBeDefined()
      expect(retrieved?.id).toBe(originalPolicy.id)
      expect(retrieved?.version).toBe(originalPolicy.version)
      expect(retrieved?.rules).toHaveLength(2)
      expect(retrieved?.rules[0].id).toBe('rule-a')
      expect(retrieved?.rules[0].action).toBe('delete')
      expect(retrieved?.rules[1].id).toBe('rule-b')
    })
  })
})

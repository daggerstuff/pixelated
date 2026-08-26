import { MongoMemoryServer } from 'mongodb-memory-server'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { PolicyStore } from '../policy-store'
import type { GovernancePolicy } from '../types'

describe('PolicyStore', () => {
  let mongo: MongoMemoryServer
  let store: PolicyStore

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    store = new PolicyStore()
    await store.initialize(mongo.getUri())
  })

  afterAll(async () => {
    await store.disconnect()
    await mongo.stop()
  })

  it('stores and retrieves policy', async () => {
    const policy: GovernancePolicy = { id: 'test', version: '1.0.0', rules: [] }
    await store.savePolicy(policy)
    const retrieved = await store.getPolicy('test')
    expect(retrieved).toMatchObject(policy)
  })

  it('updates existing policy on save', async () => {
    const policy: GovernancePolicy = {
      id: 'update-test',
      version: '1.0.0',
      rules: [],
    }
    await store.savePolicy(policy)

    const updated: GovernancePolicy = {
      id: 'update-test',
      version: '2.0.0',
      rules: [],
    }
    await store.savePolicy(updated)

    const retrieved = await store.getPolicy('update-test')
    expect(retrieved?.version).toBe('2.0.0')
  })

  it('tracks version history on policy updates', async () => {
    const v1: GovernancePolicy = {
      id: 'versioned',
      version: '1.0.0',
      rules: [
        {
          id: 'r1',
          action: 'encrypt',
          conditions: [],
          required: ['fhe_encryption'],
        },
      ],
    }
    await store.savePolicy(v1)

    const v2: GovernancePolicy = {
      id: 'versioned',
      version: '2.0.0',
      rules: [
        {
          id: 'r2',
          action: 'access',
          conditions: [],
          required: ['audit_logged'],
        },
      ],
    }
    await store.savePolicy(v2)

    const history = await store.getPolicyHistory('versioned')
    expect(history.length).toBe(2)
    expect(history?.[0].version).toBe('2.0.0')
    expect(history?.[0].previousVersion).toBe('1.0.0')
    expect(history?.[1].version).toBe('1.0.0')
    expect(history?.[1].previousVersion).toBeNull()
  })
})

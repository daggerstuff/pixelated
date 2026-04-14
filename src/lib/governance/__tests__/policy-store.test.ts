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
})

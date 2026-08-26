import { MongoMemoryServer } from 'mongodb-memory-server'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'

import { PolicyEngine } from '../policy-engine'
import { PolicyStore } from '../policy-store'
import type { GovernancePolicy } from '../types'

describe('PolicyEngine hot-reload', () => {
  let mongo: MongoMemoryServer
  let store: PolicyStore
  let engine: PolicyEngine

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    store = new PolicyStore()
    await store.initialize(mongo.getUri())
  })

  afterAll(async () => {
    await store.disconnect()
    await mongo.stop()
  })

  beforeEach(() => {
    engine = new PolicyEngine()
    engine.setPolicyStore(store)
  })

  it('reloads policies from MongoDB store', async () => {
    const v1: GovernancePolicy = {
      id: 'hot-reload-test',
      version: '1.0.0',
      rules: [
        {
          id: 'r1',
          action: 'access',
          conditions: [{ field: 'role', operator: 'equals', value: 'admin' }],
          required: [],
        },
      ],
    }
    await store.savePolicy(v1)
    engine.addPolicyId('hot-reload-test')

    await engine.reloadPolicies()
    const result = await engine.evaluate({
      action: 'access',
      context: { role: 'admin' },
    })
    expect(result.allowed).toBe(true)
  })

  it('picks up policy version changes on reload', async () => {
    const v1: GovernancePolicy = {
      id: 'version-change',
      version: '1.0.0',
      rules: [
        {
          id: 'r1',
          action: 'access',
          conditions: [{ field: 'role', operator: 'equals', value: 'admin' }],
          required: [],
        },
      ],
    }
    await store.savePolicy(v1)
    engine.addPolicyId('version-change')
    await engine.reloadPolicies()

    const first = await engine.evaluate({
      action: 'access',
      context: { role: 'admin' },
    })
    expect(first.allowed).toBe(true)

    const v2: GovernancePolicy = {
      id: 'version-change',
      version: '2.0.0',
      rules: [
        {
          id: 'r2',
          action: 'access',
          conditions: [
            { field: 'role', operator: 'equals', value: 'superadmin' },
          ],
          required: [],
        },
      ],
    }
    await store.savePolicy(v2)
    await engine.reloadPolicies()

    expect(engine.getVersion()).toBe('2.0.0')

    const granted = await engine.evaluate({
      action: 'access',
      context: { role: 'superadmin' },
    })
    expect(granted.allowed).toBe(true)

    const denied = await engine.evaluate({
      action: 'access',
      context: { role: 'admin' },
    })
    expect(denied.allowed).toBe(false)
  })

  it('does nothing when no policy store is configured', async () => {
    const bare = new PolicyEngine()
    bare.addPolicyId('some-id')
    await bare.reloadPolicies()
    expect(bare.getVersion()).toBeNull()
  })
})

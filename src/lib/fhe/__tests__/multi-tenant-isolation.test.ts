/// <reference types="vitest" />

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { tenantManager } from '../tenant-manager'
import { EncryptionMode } from '../types'

describe('FHE Multi-tenant Isolation', () => {
  const tenant1 = {
    tenantId: 'test-tenant-1',
    isolationLevel: 'shared' as const,
  }

  const tenant2 = {
    tenantId: 'test-tenant-2',
    isolationLevel: 'dedicated' as const,
  }

  beforeEach(async () => {
    await tenantManager.initialize()
    await tenantManager.registerTenant(tenant1)
    await tenantManager.registerTenant(tenant2)
  })

  afterEach(async () => {
    await tenantManager.removeTenant(tenant1.tenantId)
    await tenantManager.removeTenant(tenant2.tenantId)
  })

  it('registers and retrieves tenants', () => {
    const allTenants = tenantManager.getAllTenants()
    expect(allTenants).toHaveLength(2)

    expect(tenantManager.getTenant(tenant1.tenantId)).toMatchObject(tenant1)
    expect(tenantManager.getTenant(tenant2.tenantId)).toMatchObject(tenant2)
  })

  it('tracks tenant operations against resource limits', async () => {
    const limitedTenant = {
      tenantId: 'limited-tenant',
      isolationLevel: 'shared' as const,
      resourceLimits: {
        maxOperationsPerMinute: 2,
      },
    }

    await tenantManager.registerTenant(limitedTenant)

    expect(tenantManager.trackOperation(limitedTenant.tenantId)).toBe(true)
    expect(tenantManager.trackOperation(limitedTenant.tenantId)).toBe(true)
    expect(tenantManager.trackOperation(limitedTenant.tenantId)).toBe(false)

    await tenantManager.removeTenant(limitedTenant.tenantId)
  })

  it('applies tenant-specific configuration overrides', async () => {
    const customTenant = {
      tenantId: 'custom-config-tenant',
      isolationLevel: 'custom' as const,
      customConfig: {
        customParam1: 'value1',
        customParam2: 'value2',
      },
      resourceLimits: {
        maxKeySize: 1024,
      },
    }

    await tenantManager.registerTenant(customTenant)

    const baseConfig = {
      mode: EncryptionMode.FHE,
      keySize: 2048,
    }

    const configWithTenant = tenantManager.applyTenantConfig(
      baseConfig,
      customTenant.tenantId,
    )

    expect(configWithTenant.tenantConfig?.tenantId).toBe(customTenant.tenantId)
    expect(configWithTenant.keySize).toBe(1024)
    expect(configWithTenant.customParam1).toBe('value1')
    expect(configWithTenant.customParam2).toBe('value2')

    await tenantManager.removeTenant(customTenant.tenantId)
  })

  it('generates tenant-specific key prefixes', () => {
    expect(
      tenantManager.getTenantKeyPrefix(tenant1.tenantId, 'key_'),
    ).toBe('key__tenant_test-tenant-1_')
  })

  it('enhances operation parameters with tenant information', () => {
    const enhanced = tenantManager.enhanceOperationParams(
      { operation: 'test', additionalParam: 'value' },
      tenant1.tenantId,
    )

    expect(enhanced).toEqual({
      operation: 'test',
      additionalParam: 'value',
      tenantId: tenant1.tenantId,
    })
  })
})

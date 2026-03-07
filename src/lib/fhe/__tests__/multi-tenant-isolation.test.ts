/// <reference types="vitest" />

// Vitest automatically makes these globals available in test files
// No need to import describe, it, expect, or vi

/**
 * Multi-tenant Isolation Tests
 *
 * This test suite verifies that the FHE multi-tenant isolation system
 * correctly manages tenant-specific encryption contexts and prevents
 * cross-tenant data access.
 */

import { fheService } from '../index'
import { tenantManager } from '../tenant-manager'
import type { EncryptionOptions } from '../types'
import { EncryptionMode } from '../types'

describe('FHE Multi-tenant Isolation', () => {
  // Set up test tenants
  const tenant1 = {
    tenantId: 'test-tenant-1',
    isolationLevel: 'shared' as const,
  }

  const tenant2 = {
    tenantId: 'test-tenant-2',
    isolationLevel: 'dedicated' as const,
  }

  // Test data
  const testData = 'This is confidential data'

  // Encrypted data placeholders
  let encryptedTenant1: string

  beforeEach(async () => {
    // Initialize FHE service with multi-tenancy enabled
    await fheService.initialize({
      mode: EncryptionMode.FHE,
      enableMultiTenancy: true,
    } as EncryptionOptions & { enableMultiTenancy: boolean })

    // Register test tenants
    await tenantManager.initialize()
    await tenantManager.registerTenant(tenant1)
    await tenantManager.registerTenant(tenant2)

    // Encrypt test data for each tenant
    encryptedTenant1 = await fheService.encrypt(testData, tenant1.tenantId)
  })

  afterEach(async () => {
    // Clean up test tenants
    await tenantManager.removeTenant(tenant1.tenantId)
    await tenantManager.removeTenant(tenant2.tenantId)

    // Reset any mocks
    vi.resetAllMocks()
  })

  it('should enable/disable multi-tenant isolation', () => {
    // Check initial state (should be enabled from beforeEach)
    expect(fheService.isMultiTenantEnabled()).toBe(true)

    // Disable multi-tenant isolation
    fheService.setMultiTenantEnabled(false)
    expect(fheService.isMultiTenantEnabled()).toBe(false)

    // Re-enable multi-tenant isolation
    fheService.setMultiTenantEnabled(true)
    expect(fheService.isMultiTenantEnabled()).toBe(true)
  })

  it('should register and retrieve tenants', async () => {
    // Get all tenants and check if our test tenants are registered
    const allTenants = tenantManager.getAllTenants()
    expect(allTenants).toHaveLength(2)

    // Check if tenant1 is correctly registered
    const retrievedTenant1 = tenantManager.getTenant(tenant1.tenantId)
    expect(retrievedTenant1).toBeDefined()
    expect(retrievedTenant1?.tenantId).toBe(tenant1.tenantId)
    expect(retrievedTenant1?.isolationLevel).toBe(tenant1.isolationLevel)

    // Check if tenant2 is correctly registered
    const retrievedTenant2 = tenantManager.getTenant(tenant2.tenantId)
    expect(retrievedTenant2).toBeDefined()
    expect(retrievedTenant2?.tenantId).toBe(tenant2.tenantId)
    expect(retrievedTenant2?.isolationLevel).toBe(tenant2.isolationLevel)
  })

  it('should encrypt and decrypt data for a specific tenant', async () => {
    // Encrypt data for tenant1
    const encrypted = await fheService.encrypt(testData, tenant1.tenantId)
    expect(encrypted).toBeDefined()

    // Decrypt data for tenant1
    const decrypted = await fheService.decrypt(encrypted, tenant1.tenantId)
    expect(decrypted).toBe(testData)
  })

  it('should prevent decryption of data from other tenants', async () => {
    // Mock console.warn to prevent test output noise
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Try to decrypt tenant1's data with tenant2's context
    await expect(async () => {
      // In a real scenario, this would fail because the metadata would include tenant1's ID
      // However, in our test setup, we need to simulate this by creating data with tenant metadata
      await fheService.decrypt(encryptedTenant1, tenant2.tenantId)
    }).rejects.toThrow('Access denied')
  })

  it('should track operations for rate limiting', () => {
    // Set up a tenant with rate limits
    const tenantWithLimits = {
      tenantId: 'limited-tenant',
      isolationLevel: 'shared' as const,
      resourceLimits: {
        maxOperationsPerMinute: 5,
      },
    }

    // Register the tenant
    tenantManager.registerTenant(tenantWithLimits)

    // Track operations up to the limit
    for (let i = 0; i < 5; i++) {
      expect(tenantManager.trackOperation(tenantWithLimits.tenantId)).toBe(true)
    }

    // The next operation should exceed the limit
    expect(tenantManager.trackOperation(tenantWithLimits.tenantId)).toBe(false)

    // Clean up
    tenantManager.removeTenant(tenantWithLimits.tenantId)
  })

  it('should apply tenant-specific configuration', () => {
    // Set up a tenant with custom configuration
    const tenantWithCustomConfig = {
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

    // Register the tenant
    tenantManager.registerTenant(tenantWithCustomConfig)

    // Create a base config
    const baseConfig = {
      mode: EncryptionMode.FHE,
      keySize: 2048,
    }

    // Apply tenant configuration
    const configWithTenant = tenantManager.applyTenantConfig(
      baseConfig,
      tenantWithCustomConfig.tenantId,
    )

    // Verify tenant-specific configuration was applied
    expect(configWithTenant.tenantConfig).toBeDefined()
    expect(configWithTenant.tenantConfig?.tenantId).toBe(
      tenantWithCustomConfig.tenantId,
    )
    expect(configWithTenant.enableMultiTenancy).toBe(true)

    // Verify resource limits were applied
    expect(configWithTenant.keySize).toBe(1024) // Should be limited by tenant's maxKeySize

    // Verify custom parameters were merged
    expect(configWithTenant.customParam1).toBe('value1')
    expect(configWithTenant.customParam2).toBe('value2')

    // Clean up
    tenantManager.removeTenant(tenantWithCustomConfig.tenantId)
  })

  it('should generate tenant-specific key prefixes', () => {
    const basePrefix = 'key_'
    const tenantPrefix = tenantManager.getTenantKeyPrefix(
      tenant1.tenantId,
      basePrefix,
    )

    expect(tenantPrefix).toBe(`${basePrefix}_tenant_${tenant1.tenantId}_`)
  })

  it('should enhance operation parameters with tenant information', () => {
    const baseParams = {
      operation: 'test',
      additionalParam: 'value',
    }

    const enhancedParams = tenantManager.enhanceOperationParams(
      baseParams,
      tenant1.tenantId,
    )

    expect(enhancedParams).toEqual({
      ...baseParams,
      tenantId: tenant1.tenantId,
    })
  })
})

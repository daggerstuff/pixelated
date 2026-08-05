import { TenantConfig } from './types'

interface FHETenantResources {
  keyId: string
  allocatedAt: number
  context: Record<string, unknown>
}

class TenantManager {
  private readonly tenants: Map<string, TenantConfig> = new Map()
  private readonly operationCounts: Map<string, number> = new Map()
  private readonly fheResources: Map<string, FHETenantResources> = new Map()

  async initialize(): Promise<void> {
    this.tenants.clear()
    this.operationCounts.clear()
    this.fheResources.clear()
  }

  async registerTenant(config: TenantConfig): Promise<void> {
    this.tenants.set(config.tenantId, config)
    this.operationCounts.set(config.tenantId, 0)
  }

  async removeTenant(tenantId: string): Promise<void> {
    this.tenants.delete(tenantId)
    this.operationCounts.delete(tenantId)
    this.fheResources.delete(tenantId)
  }

  getTenant(tenantId: string): TenantConfig | undefined {
    return this.tenants.get(tenantId)
  }

  getAllTenants(): TenantConfig[] {
    return Array.from(this.tenants.values())
  }

  getFHEResources(tenantId: string): FHETenantResources | undefined {
    return this.fheResources.get(tenantId)
  }

  async setupTenantResources(
    tenantId: string,
    keyId: string,
    context: Record<string, unknown> = {},
  ): Promise<boolean> {
    this.fheResources.set(tenantId, {
      keyId,
      allocatedAt: Date.now(),
      context,
    })
    return true
  }

  trackOperation(tenantId: string): boolean {
    const tenant = this.getTenant(tenantId)
    if (!tenant) return false

    const currentCount = this.operationCounts.get(tenantId) ?? 0
    const limit = tenant.resourceLimits?.maxOperationsPerMinute

    if (limit !== undefined && currentCount >= limit) {
      return false
    }

    this.operationCounts.set(tenantId, currentCount + 1)
    return true
  }

  applyTenantConfig(
    baseConfig: Record<string, unknown>,
    tenantId: string,
  ): Record<string, unknown> & { tenantConfig?: TenantConfig } {
    const tenant = this.getTenant(tenantId)
    if (!tenant) {
      return baseConfig
    }

    const { customConfig, resourceLimits } = tenant

    // Create a new config merging base, custom, and resource limits
    // We prioritize tenant specific overrides
    return {
      ...baseConfig,
      ...customConfig,
      // Apply resource limits if they map to config properties
      ...(resourceLimits?.maxKeySize
        ? { keySize: resourceLimits.maxKeySize }
        : {}),
      tenantConfig: tenant,
    }
  }

  getTenantKeyPrefix(tenantId: string, basePrefix: string): string {
    return `${basePrefix}_tenant_${tenantId}_`
  }

  enhanceOperationParams<T extends object>(
    params: T,
    tenantId: string,
  ): T & { tenantId: string } {
    return {
      ...params,
      tenantId,
    }
  }
}

export const tenantManager = new TenantManager()

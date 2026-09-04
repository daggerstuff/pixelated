/**
 * Configuration manager helpers — pure logic extracted from
 * ConfigurationManager.ts (no instance state).
 */

import type { MultiRegionConfig } from './configuration-manager.types'

export async function validateConfiguration(
  config: MultiRegionConfig,
): Promise<void> {
  const errors: string[] = []

  // Validate deployment configuration
  if (
    !config.deployment ||
    !config.deployment.regions ||
    config.deployment.regions.length === 0
  ) {
    errors.push('Deployment configuration must include at least one region')
  }

  // Validate region configurations
  for (const region of config.deployment.regions) {
    if (!region.id || !region.name) {
      errors.push(
        `Region configuration missing required fields: ${JSON.stringify(region)}`,
      )
    }

    if (
      !region.provider ||
      !['aws', 'gcp', 'azure'].includes(region.provider)
    ) {
      errors.push(
        `Invalid provider for region ${region.id}: ${region.provider}`,
      )
    }

    if (!region.capacity || region.capacity.minInstances < 1) {
      errors.push(`Invalid capacity configuration for region ${region.id}`)
    }
  }

  // Validate edge computing configuration
  if (config.edgeComputing?.locations.length === 0) {
    errors.push(
      'Edge computing configuration must include at least one location',
    )
  }

  // Validate traffic routing configuration
  if (
    !config.trafficRouting.strategy ||
    ![
      'latency-based',
      'health-based',
      'compliance-based',
      'weighted-round-robin',
    ].includes(config.trafficRouting.strategy)
  ) {
    errors.push('Invalid traffic routing strategy')
  }

  // Validate feature flags
  if (!config.featureFlags) {
    errors.push('Feature flags configuration is required')
  }

  // Validate secrets (basic structure check)
  if (!config.secrets?.cloudProviders) {
    errors.push('Secrets configuration is required')
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join(', ')}`)
  }
}

export function mergeConfigurations(
  base: MultiRegionConfig,
  updates: Partial<MultiRegionConfig>,
): MultiRegionConfig {
  return {
    ...base,
    ...updates,
    deployment: {
      ...base.deployment,
      ...updates.deployment,
      regions: updates.deployment?.regions ?? base.deployment.regions,
    },
    featureFlags: {
      ...base.featureFlags,
      ...updates.featureFlags,
    },
    monitoring: {
      ...base.monitoring,
      ...updates.monitoring,
    },
    compliance: {
      ...base.compliance,
      ...updates.compliance,
    },
  }
}

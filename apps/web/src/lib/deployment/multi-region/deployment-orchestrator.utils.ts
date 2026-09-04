/**
 * Deployment orchestrator helpers — pure logic extracted from
 * DeploymentOrchestrator.ts (no instance state).
 */

import { createBuildSafeLogger } from '../../logging/build-safe-logger'
import type { RegionConfig } from './MultiRegionDeploymentManager'
import type {
  DeploymentPlan,
  DeploymentPhase,
  DeploymentExecution,
  ValidationStep,
} from './deployment-orchestrator.types'

const logger = createBuildSafeLogger('DeploymentOrchestrator')

export function createDefaultDeploymentPlans(): DeploymentPlan[] {
  return [
    {
      id: 'standard-multi-region',
      name: 'Standard Multi-Region Deployment',
      regions: [],
      phases: [
        {
          id: 'infrastructure',
          name: 'Infrastructure Deployment',
          type: 'infrastructure',
          regions: [],
          dependencies: [],
          timeout: 1800000, // 30 minutes
          rollbackEnabled: true,
        },
        {
          id: 'services',
          name: 'Service Deployment',
          type: 'services',
          regions: [],
          dependencies: ['infrastructure'],
          timeout: 1200000, // 20 minutes
          rollbackEnabled: true,
        },
        {
          id: 'monitoring',
          name: 'Monitoring Setup',
          type: 'monitoring',
          regions: [],
          dependencies: ['services'],
          timeout: 600000, // 10 minutes
          rollbackEnabled: false,
        },
        {
          id: 'validation',
          name: 'Deployment Validation',
          type: 'validation',
          regions: [],
          dependencies: ['monitoring'],
          timeout: 300000, // 5 minutes
          rollbackEnabled: false,
        },
      ],
      dependencies: [],
      rollbackPoints: [],
      validationSteps: [
        {
          id: 'health-check',
          name: 'Health Check Validation',
          type: 'health-check',
          target: 'all-regions',
          timeout: 120000,
          successCriteria: { minHealthScore: 80 },
        },
        {
          id: 'performance-test',
          name: 'Performance Test',
          type: 'performance-test',
          target: 'all-regions',
          timeout: 180000,
          successCriteria: { maxResponseTime: 200, minThroughput: 100 },
        },
      ],
    },
    {
      id: 'rolling-deployment',
      name: 'Rolling Multi-Region Deployment',
      regions: [],
      phases: [
        {
          id: 'region-1',
          name: 'Deploy to Region 1',
          type: 'services',
          regions: [],
          dependencies: [],
          timeout: 900000, // 15 minutes
          rollbackEnabled: true,
        },
        {
          id: 'validate-region-1',
          name: 'Validate Region 1',
          type: 'validation',
          regions: [],
          dependencies: ['region-1'],
          timeout: 300000, // 5 minutes
          rollbackEnabled: false,
        },
        {
          id: 'region-2',
          name: 'Deploy to Region 2',
          type: 'services',
          regions: [],
          dependencies: ['validate-region-1'],
          timeout: 900000, // 15 minutes
          rollbackEnabled: true,
        },
        {
          id: 'validate-region-2',
          name: 'Validate Region 2',
          type: 'validation',
          regions: [],
          dependencies: ['region-2'],
          timeout: 300000, // 5 minutes
          rollbackEnabled: false,
        },
      ],
      dependencies: [],
      rollbackPoints: [],
      validationSteps: [],
    },
  ]
}

export async function deployServices(
  phase: DeploymentPhase,
  regions: RegionConfig[],
): Promise<Record<string, unknown>[]> {
  try {
    logger.info(`Deploying services for phase: ${phase.id}`, {
      regions: regions.length,
    })

    // Simulate service deployment
    // In a real implementation, this would deploy containers, serverless functions, etc.
    const serviceDeploymentPromises = regions.map(async (region) => {
      logger.info(`Deploying services to region: ${region.name}`)

      // Simulate deployment delay
      await new Promise((resolve) =>
        setTimeout(resolve, 5000 + Math.random() * 10000),
      )

      return {
        regionId: region.id,
        services: ['api-gateway', 'core-services', 'ai-services'],
        status: 'deployed',
        timestamp: new Date(),
      }
    })

    const results = await Promise.allSettled(serviceDeploymentPromises)

    return results
      .filter((result) => result.status === 'fulfilled')
      .map(
        (result) =>
          (result as PromiseFulfilledResult<Record<string, unknown>>).value,
      )
  } catch (error: unknown) {
    logger.error('Service deployment failed', { error })
    throw error
  }
}

export async function setupMonitoring(
  phase: DeploymentPhase,
  regions: RegionConfig[],
): Promise<Record<string, unknown>[]> {
  try {
    logger.info(`Setting up monitoring for phase: ${phase.id}`, {
      regions: regions.length,
    })

    // Simulate monitoring setup
    const monitoringSetupPromises = regions.map(async (region) => {
      logger.info(`Setting up monitoring for region: ${region.name}`)

      // Simulate setup delay
      await new Promise((resolve) =>
        setTimeout(resolve, 2000 + Math.random() * 3000),
      )

      return {
        regionId: region.id,
        monitoring: {
          metrics: 'enabled',
          alerts: 'configured',
          dashboards: 'created',
        },
        timestamp: new Date(),
      }
    })

    const results = await Promise.allSettled(monitoringSetupPromises)

    return results
      .filter((result) => result.status === 'fulfilled')
      .map(
        (result) =>
          (result as PromiseFulfilledResult<Record<string, unknown>>).value,
      )
  } catch (error: unknown) {
    logger.error('Monitoring setup failed', { error })
    throw error
  }
}

export async function performPhaseValidation(
  phase: DeploymentPhase,
  regions: RegionConfig[],
): Promise<Record<string, unknown>[]> {
  try {
    logger.info(`Performing phase validation for: ${phase.id}`, {
      regions: regions.length,
    })

    // Simulate validation
    const validationResults = regions.map((region) => ({
      regionId: region.id,
      validation: {
        healthCheck: 'passed',
        connectivity: 'verified',
        performance: 'acceptable',
      },
      timestamp: new Date(),
    }))

    // Simulate some validation failures randomly
    if (Math.random() < 0.1) {
      // 10% failure rate for simulation
      throw new Error('Phase validation failed - simulated failure')
    }

    return validationResults
  } catch (error: unknown) {
    logger.error('Phase validation failed', { error })
    throw error
  }
}

export async function checkPhaseDependencies(
  phase: DeploymentPhase,
  execution: DeploymentExecution,
): Promise<boolean> {
  if (phase.dependencies.length === 0) {
    return true
  }

  for (const dependencyId of phase.dependencies) {
    const dependencyResult = execution.results.find(
      (r) => r.phaseId === dependencyId,
    )

    if (dependencyResult?.status !== 'success') {
      logger.warn(
        `Phase dependency not met: ${dependencyId} for phase: ${phase.id}`,
      )
      return false
    }
  }

  return true
}

export async function validateHealthCheck(
  step: ValidationStep,
  _execution: DeploymentExecution,
): Promise<{ success: boolean; error?: string }> {
  try {
    // In a real implementation, this would check health scores from HealthMonitor
    const minHealthScore =
      (typeof step.successCriteria['minHealthScore'] === 'number'
        ? step.successCriteria['minHealthScore']
        : undefined) ?? 80

    // Simulate health check validation
    const simulatedHealthScore = 85 + Math.random() * 10 // 85-95 range

    if (simulatedHealthScore >= minHealthScore) {
      return { success: true }
    } else {
      return {
        success: false,
        error: `Health score ${simulatedHealthScore.toFixed(1)} below minimum ${minHealthScore}`,
      }
    }
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Unknown error',
    }
  }
}

export async function validatePerformanceTest(
  step: ValidationStep,
  _execution: DeploymentExecution,
): Promise<{ success: boolean; error?: string }> {
  try {
    // In a real implementation, this would run actual performance tests
    const maxResponseTime =
      (typeof step.successCriteria['maxResponseTime'] === 'number'
        ? step.successCriteria['maxResponseTime']
        : undefined) ?? 200
    const minThroughput =
      (typeof step.successCriteria['minThroughput'] === 'number'
        ? step.successCriteria['minThroughput']
        : undefined) ?? 100

    // Simulate performance test results
    const responseTime = 150 + Math.random() * 50 // 150-200ms range
    const throughput = 120 + Math.random() * 30 // 120-150 range

    if (responseTime <= maxResponseTime && throughput >= minThroughput) {
      return { success: true }
    } else {
      const errors: string[] = []
      if (responseTime > maxResponseTime) {
        errors.push(
          `Response time ${responseTime.toFixed(0)}ms exceeds maximum ${maxResponseTime}ms`,
        )
      }
      if (throughput < minThroughput) {
        errors.push(
          `Throughput ${throughput.toFixed(0)} below minimum ${minThroughput}`,
        )
      }
      return { success: false, error: errors.join(', ') }
    }
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Unknown error',
    }
  }
}

export async function validateSecurityScan(
  _step: ValidationStep,
  _execution: DeploymentExecution,
): Promise<{ success: boolean; error?: string }> {
  try {
    // In a real implementation, this would run security scanning tools
    // Simulate security scan (95% success rate)
    const securityScore = Math.random() * 100

    if (securityScore > 80) {
      // 80+ is considered passing
      return { success: true }
    } else {
      return {
        success: false,
        error: `Security scan score ${securityScore.toFixed(1)} below threshold`,
      }
    }
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Unknown error',
    }
  }
}

export async function validateComplianceCheck(
  _step: ValidationStep,
  _execution: DeploymentExecution,
): Promise<{ success: boolean; error?: string }> {
  try {
    // In a real implementation, this would run compliance checks
    // Simulate compliance check (90% success rate)
    const compliancePassed = Math.random() > 0.1

    if (compliancePassed) {
      return { success: true }
    } else {
      return { success: false, error: 'Compliance requirements not met' }
    }
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error instanceof Error
            ? error.message
            : 'Unknown error'
          : 'Unknown error',
    }
  }
}

export async function validateDeploymentPlan(plan: DeploymentPlan): Promise<void> {
  const errors: string[] = []

  if (!plan.id || !plan.name) {
    errors.push('Plan must have id and name')
  }

  if (!plan.phases || plan.phases.length === 0) {
    errors.push('Plan must have at least one phase')
  }

  // Validate phases
  for (const phase of plan.phases) {
    if (!phase.id || !phase.name) {
      errors.push(`Phase must have id and name: ${JSON.stringify(phase)}`)
    }

    if (
      !['infrastructure', 'services', 'monitoring', 'validation'].includes(
        phase.type,
      )
    ) {
      errors.push(`Invalid phase type: ${phase.type}`)
    }

    if (phase.timeout < 60000) {
      // 1 minute minimum
      errors.push(`Phase timeout too short: ${phase.timeout}ms`)
    }
  }

  // Validate dependencies
  const phaseIds = plan.phases.map((p) => p.id)
  for (const phase of plan.phases) {
    for (const dep of phase.dependencies) {
      if (!phaseIds.includes(dep)) {
        errors.push(`Phase dependency not found: ${dep} in phase ${phase.id}`)
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Deployment plan validation failed: ${errors.join(', ')}`)
  }
}

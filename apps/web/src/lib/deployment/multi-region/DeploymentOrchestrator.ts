/**
 * Deployment Orchestrator
 *
 * Orchestrates complex multi-region deployments with dependency management,
 * rollback capabilities, and automated deployment pipelines.
 */

import { EventEmitter } from 'events'

import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('DeploymentOrchestrator')
import type {
  DeploymentOrchestratorConfig,
  DeploymentPlan,
  DeploymentPhase,
  RollbackPoint,
  ValidationStep,
  DeploymentExecution,
  DeploymentPhaseResult,
} from './deployment-orchestrator.types'
export type {
  DeploymentOrchestratorConfig,
  DeploymentPlan,
  DeploymentPhase,
  RollbackPoint,
  ValidationStep,
  DeploymentExecution,
  DeploymentPhaseResult,
} from './deployment-orchestrator.types'
import {
  createDefaultDeploymentPlans,
  deployServices,
  setupMonitoring,
  performPhaseValidation,
  checkPhaseDependencies,
  validateHealthCheck,
  validatePerformanceTest,
  validateSecurityScan,
  validateComplianceCheck,
  validateDeploymentPlan,
} from './deployment-orchestrator.utils'
import { CloudProviderManager, DeploymentResult } from './CloudProviderManager'
import { RegionConfig } from './MultiRegionDeploymentManager'


export class DeploymentOrchestrator extends EventEmitter {
  private readonly config: DeploymentOrchestratorConfig
  private readonly cloudProviderManager: CloudProviderManager
  private readonly deploymentPlans: Map<string, DeploymentPlan> = new Map()
  private readonly activeExecutions: Map<string, DeploymentExecution> =
    new Map()
  private readonly rollbackPoints: Map<string, RollbackPoint> = new Map()
  private isInitialized = false

  constructor(
    config: DeploymentOrchestratorConfig,
    cloudProviderManager: CloudProviderManager,
  ) {
    super()
    this.config = config
    this.cloudProviderManager = cloudProviderManager
  }

  /**
   * Initialize deployment orchestrator
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Deployment Orchestrator')

      // Validate configuration
      await this.validateConfiguration()

      // Initialize deployment plans
      await this.initializeDeploymentPlans()

      // Setup event listeners
      this.setupEventListeners()

      this.isInitialized = true
      logger.info('Deployment Orchestrator initialized successfully')

      this.emit('initialized', {
        maxParallelDeployments: this.config.maxParallelDeployments,
      })
    } catch (error: unknown) {
      logger.error('Failed to initialize Deployment Orchestrator', { error })
      if (error instanceof Error) {
        throw new Error('Initialization failed', { cause: error })
      }
      throw error
    }
  }

  /**
   * Validate orchestrator configuration
   */
  private async validateConfiguration(): Promise<void> {
    const errors: string[] = []

    if (this.config.maxParallelDeployments < 1) {
      errors.push('maxParallelDeployments must be at least 1')
    }

    if (this.config.deploymentTimeout < 60000) {
      // 1 minute minimum
      errors.push('deploymentTimeout must be at least 60000ms')
    }

    if (this.config.retryAttempts < 0) {
      errors.push('retryAttempts must be non-negative')
    }

    if (this.config.retryDelay < 0) {
      errors.push('retryDelay must be non-negative')
    }

    if (errors.length > 0) {
      throw new Error(`Configuration validation failed: ${errors.join(', ')}`)
    }
  }

  /**
   * Initialize deployment plans
   */
  private async initializeDeploymentPlans(): Promise<void> {
    try {
      // Load default deployment plans
      const defaultPlans = createDefaultDeploymentPlans()

      for (const plan of defaultPlans) {
        this.deploymentPlans.set(plan.id, plan)
      }

      logger.info(`Initialized ${defaultPlans.length} deployment plans`)
    } catch (error: unknown) {
      logger.error('Failed to initialize deployment plans', { error })
      throw error
    }
  }

  /**
   * Create default deployment plans
   */

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Cloud provider manager events are not currently exposed in this implementation.
    // Keep this method for future extension without failing initialization.
  }

  /**
   * Execute deployment plan
   */
  async executeDeployment(
    planId: string,
    regions: RegionConfig[],
  ): Promise<DeploymentExecution> {
    if (!this.isInitialized) {
      throw new Error('Deployment orchestrator not initialized')
    }

    const plan = this.deploymentPlans.get(planId)
    if (!plan) {
      throw new Error(`Deployment plan not found: ${planId}`)
    }

    try {
      logger.info(`Starting deployment execution for plan: ${plan.name}`, {
        planId,
        regions: regions.length,
      })

      // Create execution record
      const execution = this.createExecution(planId, regions)
      this.activeExecutions.set(execution.id, execution)

      // Update plan with actual regions
      const updatedPlan = { ...plan, regions }

      // Execute deployment phases
      await this.executeDeploymentPhases(execution, updatedPlan)

      // Complete execution
      execution.status = 'completed'
      execution.completedAt = new Date()

      logger.info(
        `Deployment execution completed successfully: ${execution.id}`,
      )
      this.emit('deployment-completed', { executionId: execution.id, planId })

      return execution
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error instanceof Error
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : 'Unknown error'
          : 'Unknown error'
      logger.error(`Deployment execution failed for plan: ${planId}`, {
        error: message,
      })

      const execution = this.activeExecutions.get(`exec-${planId}`)
      if (execution) {
        execution.status = 'failed'
        execution.completedAt = new Date()
        execution.errors.push(message)

        // Attempt rollback if enabled
        if (this.config.rollbackOnFailure) {
          await this.performRollback(execution)
        }
      }

      this.emit('deployment-failed', { planId, error: message })
      throw error
    }
  }

  /**
   * Create deployment execution record
   */
  private createExecution(
    planId: string,
    _regions: RegionConfig[],
  ): DeploymentExecution {
    return {
      id: `exec-${planId}-${Date.now()}`,
      planId,
      status: 'running',
      currentPhase: '',
      startedAt: new Date(),
      results: [],
      errors: [],
      rollbackPoint: undefined,
    }
  }

  /**
   * Execute deployment phases
   */
  private async executeDeploymentPhases(
    execution: DeploymentExecution,
    plan: DeploymentPlan,
  ): Promise<void> {
    try {
      logger.info(
        `Executing deployment phases for execution: ${execution.id}`,
        {
          totalPhases: plan.phases.length,
        },
      )

      for (const phase of plan.phases) {
        execution.currentPhase = phase.id

        logger.info(`Executing deployment phase: ${phase.name}`, {
          phaseId: phase.id,
          type: phase.type,
          regions: phase.regions.length,
        })

        // Check dependencies
        if (!(await checkPhaseDependencies(phase, execution))) {
          logger.warn(`Skipping phase due to unmet dependencies: ${phase.id}`)
          execution.results.push({
            phaseId: phase.id,
            status: 'skipped',
            startedAt: new Date(),
            completedAt: new Date(),
            results: [],
            errors: ['Dependencies not met'],
          })
          continue
        }

        // Create rollback point if enabled
        if (phase.rollbackEnabled) {
          await this.createRollbackPoint(execution, phase)
        }

        // Execute phase
        const phaseResult = await this.executePhase(
          phase,
          plan.regions,
          execution,
        )
        execution.results.push(phaseResult)

        // Handle phase failure
        if (phaseResult.status === 'failed') {
          logger.error(`Phase execution failed: ${phase.id}`, {
            errors: phaseResult.errors,
          })

          if (phase.rollbackEnabled && this.config.rollbackOnFailure) {
            await this.rollbackPhase(execution, phase)
            execution.status = 'rolled-back'
          } else {
            throw new Error(
              `Phase ${phase.id} failed: ${phaseResult.errors.join(', ')}`,
            )
          }

          return // Stop execution on failure
        }

        // Perform validation if this is the validation phase
        if (phase.type === 'validation') {
          const validationResult = await this.performValidation(execution, plan)
          if (!validationResult.success) {
            throw new Error(
              `Validation failed: ${validationResult.errors.join(', ')}`,
            )
          }
        }
      }
    } catch (error: unknown) {
      logger.error('Deployment phase execution failed', {
        error:
          error instanceof Error
            ? error instanceof Error
              ? error instanceof Error
                ? error.message
                : 'Unknown error'
              : 'Unknown error'
            : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Execute individual deployment phase
   */
  private async executePhase(
    phase: DeploymentPhase,
    regions: RegionConfig[],
    _execution: DeploymentExecution,
  ): Promise<DeploymentPhaseResult> {
    const startTime = new Date()

    try {
      let phaseResults: (DeploymentResult | Record<string, unknown>)[] = []
      const phaseErrors: string[] = []

      switch (phase.type) {
        case 'infrastructure':
          phaseResults = await this.deployInfrastructure(phase, regions)
          break

        case 'services':
          phaseResults = await deployServices(phase, regions)
          break

        case 'monitoring':
          phaseResults = await setupMonitoring(phase, regions)
          break

        case 'validation':
          phaseResults = await performPhaseValidation(phase, regions)
          break

        default:
          throw new Error(`Unknown phase type: ${phase.type}`)
      }

      return {
        phaseId: phase.id,
        status: 'success',
        startedAt: startTime,
        completedAt: new Date(),
        results: phaseResults,
        errors: phaseErrors,
      }
    } catch (error: unknown) {
      logger.error(`Phase execution failed: ${phase.id}`, { error })

      return {
        phaseId: phase.id,
        status: 'failed',
        startedAt: startTime,
        completedAt: new Date(),
        results: [],
        errors: [
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : 'Unknown error',
        ],
      }
    }
  }

  /**
   * Deploy infrastructure
   */
  private async deployInfrastructure(
    phase: DeploymentPhase,
    regions: RegionConfig[],
  ): Promise<DeploymentResult[]> {
    try {
      logger.info(`Deploying infrastructure for phase: ${phase.id}`, {
        regions: regions.length,
      })

      const deploymentPromises = regions.map(async (region) =>
        this.cloudProviderManager.deployRegion(region),
      )

      const results = await Promise.allSettled(deploymentPromises)

      const successfulResults = results
        .filter((result) => result.status === 'fulfilled')
        .map((result) => result.value)

      const failedResults = results
        .filter((result) => result.status === 'rejected')
        .map((result) => result.reason)

      if (failedResults.length > 0) {
        logger.warn(`Some infrastructure deployments failed`, {
          failedCount: failedResults.length,
        })
        // Don't throw here, let the caller handle partial failures
      }

      return successfulResults
    } catch (error: unknown) {
      logger.error('Infrastructure deployment failed', { error })
      throw error
    }
  }

  /**
   * Deploy services
   */

  /**
   * Setup monitoring
   */

  /**
   * Perform phase validation
   */

  /**
   * Check phase dependencies
   */

  /**
   * Create rollback point
   */
  private async createRollbackPoint(
    execution: DeploymentExecution,
    phase: DeploymentPhase,
  ): Promise<void> {
    try {
      const rollbackPoint: RollbackPoint = {
        id: `rollback-${execution.id}-${phase.id}`,
        name: `Rollback point for ${phase.name}`,
        phaseId: phase.id,
        snapshot: {
          executionId: execution.id,
          phaseId: phase.id,
          timestamp: new Date(),
          // In a real implementation, this would include actual system state
          state: 'deployment-state-snapshot',
        },
        createdAt: new Date(),
      }

      this.rollbackPoints.set(rollbackPoint.id, rollbackPoint)
      execution.rollbackPoint = rollbackPoint.id

      logger.info(
        `Created rollback point: ${rollbackPoint.id} for phase: ${phase.id}`,
      )
    } catch (error: unknown) {
      logger.error(`Failed to create rollback point for phase: ${phase.id}`, {
        error,
      })
      // Don't fail the deployment if rollback point creation fails
    }
  }

  /**
   * Perform rollback
   */
  private async performRollback(execution: DeploymentExecution): Promise<void> {
    try {
      logger.info(`Performing rollback for execution: ${execution.id}`)

      if (!execution.rollbackPoint) {
        logger.warn('No rollback point available for execution')
        return
      }

      const rollbackPoint = this.rollbackPoints.get(execution.rollbackPoint)
      if (!rollbackPoint) {
        logger.error('Rollback point not found')
        return
      }

      // Perform rollback operations
      // In a real implementation, this would restore system state
      logger.info(`Rolling back to point: ${rollbackPoint.id}`)

      // Simulate rollback delay
      await new Promise((resolve) => setTimeout(resolve, 5000))

      logger.info('Rollback completed successfully')
      this.emit('rollback-completed', {
        executionId: execution.id,
        rollbackPointId: rollbackPoint.id,
      })
    } catch (error: unknown) {
      logger.error('Rollback failed', { error })
      this.emit('rollback-failed', {
        executionId: execution.id,
        error:
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Rollback specific phase
   */
  private async rollbackPhase(
    execution: DeploymentExecution,
    phase: DeploymentPhase,
  ): Promise<void> {
    try {
      logger.info(
        `Rolling back phase: ${phase.id} for execution: ${execution.id}`,
      )

      // Find the rollback point for this phase
      const rollbackPoint = Array.from(this.rollbackPoints.values()).find(
        (rp) => rp.phaseId === phase.id && rp.id.includes(execution.id),
      )

      if (!rollbackPoint) {
        logger.warn(`No rollback point found for phase: ${phase.id}`)
        return
      }

      // Perform phase-specific rollback
      // In a real implementation, this would undo the phase's changes
      logger.info(`Rolling back phase: ${phase.name}`)

      // Simulate rollback operations
      await new Promise((resolve) => setTimeout(resolve, 3000))

      logger.info(`Phase rollback completed: ${phase.id}`)
    } catch (error: unknown) {
      logger.error(`Phase rollback failed: ${phase.id}`, { error })
      throw error
    }
  }

  /**
   * Perform deployment validation
   */
  private async performValidation(
    execution: DeploymentExecution,
    plan: DeploymentPlan,
  ): Promise<{ success: boolean; errors: string[] }> {
    try {
      logger.info(
        `Performing deployment validation for execution: ${execution.id}`,
      )

      const validationResults: string[] = []
      let validationFailed = false

      for (const validationStep of plan.validationSteps) {
        logger.info(`Executing validation step: ${validationStep.name}`)

        try {
          const result = await this.executeValidationStep(
            validationStep,
            execution,
          )

          if (result.success) {
            validationResults.push(`✓ ${validationStep.name}`)
          } else {
            validationResults.push(`✗ ${validationStep.name}: ${result.error}`)
            validationFailed = true
          }
        } catch (error: unknown) {
          validationResults.push(
            `✗ ${validationStep.name}: ${error instanceof Error ? (error instanceof Error ? error.message : 'Unknown error') : 'Unknown error'}`,
          )
          validationFailed = true
        }
      }

      const result = {
        success: !validationFailed,
        errors: validationFailed
          ? validationResults.filter((r) => r.startsWith('✗'))
          : [],
      }

      logger.info(
        `Deployment validation completed: ${result.success ? 'PASSED' : 'FAILED'}`,
      )
      this.emit('validation-completed', {
        executionId: execution.id,
        success: result.success,
      })

      return result
    } catch (error: unknown) {
      logger.error('Deployment validation failed', { error })
      return {
        success: false,
        errors: [
          error instanceof Error
            ? error instanceof Error
              ? error.message
              : 'Unknown error'
            : 'Unknown error',
        ],
      }
    }
  }

  /**
   * Execute validation step
   */
  private async executeValidationStep(
    step: ValidationStep,
    execution: DeploymentExecution,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      switch (step.type) {
        case 'health-check':
          return await validateHealthCheck(step, execution)

        case 'performance-test':
          return await validatePerformanceTest(step, execution)

        case 'security-scan':
          return await validateSecurityScan(step, execution)

        case 'compliance-check':
          return await validateComplianceCheck(step, execution)

        default:
          throw new Error(`Unknown validation step type: ${step.type}`)
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

  /**
   * Validate health check
   */

  /**
   * Validate performance test
   */

  /**
   * Validate security scan
   */

  /**
   * Validate compliance check
   */

  /**
   * Get deployment plan
   */
  getDeploymentPlan(planId: string): DeploymentPlan | undefined {
    return this.deploymentPlans.get(planId)
  }

  /**
   * Get all deployment plans
   */
  getAllDeploymentPlans(): DeploymentPlan[] {
    return Array.from(this.deploymentPlans.values())
  }

  /**
   * Get active executions
   */
  getActiveExecutions(): DeploymentExecution[] {
    return Array.from(this.activeExecutions.values())
  }

  /**
   * Get execution by ID
   */
  getExecution(executionId: string): DeploymentExecution | undefined {
    return this.activeExecutions.get(executionId)
  }

  /**
   * Get deployment statistics
   */
  getDeploymentStatistics(): {
    totalPlans: number
    activeExecutions: number
    completedExecutions: number
    failedExecutions: number
    rollbackPoints: number
  } {
    const executions = Array.from(this.activeExecutions.values())

    return {
      totalPlans: this.deploymentPlans.size,
      activeExecutions: executions.filter((e) => e.status === 'running').length,
      completedExecutions: executions.filter((e) => e.status === 'completed')
        .length,
      failedExecutions: executions.filter((e) => e.status === 'failed').length,
      rollbackPoints: this.rollbackPoints.size,
    }
  }

  /**
   * Create custom deployment plan
   */
  async createDeploymentPlan(plan: DeploymentPlan): Promise<void> {
    try {
      // Validate plan structure
      await validateDeploymentPlan(plan)

      this.deploymentPlans.set(plan.id, plan)

      logger.info(`Created custom deployment plan: ${plan.name}`, {
        planId: plan.id,
      })
      this.emit('plan-created', { planId: plan.id, name: plan.name })
    } catch (error: unknown) {
      logger.error('Failed to create deployment plan', { error })
      throw error
    }
  }

  /**
   * Validate deployment plan
   */

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      logger.info('Cleaning up Deployment Orchestrator')

      // Cancel active executions
      for (const execution of this.activeExecutions.values()) {
        if (execution.status === 'running') {
          execution.status = 'failed'
          execution.errors.push('Orchestrator cleanup initiated')
          execution.completedAt = new Date()
        }
      }

      this.activeExecutions.clear()
      this.deploymentPlans.clear()
      this.rollbackPoints.clear()
      this.isInitialized = false

      logger.info('Deployment Orchestrator cleanup completed')
    } catch (error: unknown) {
      logger.error('Deployment Orchestrator cleanup failed', { error })
      throw error
    }
  }
}

export default DeploymentOrchestrator

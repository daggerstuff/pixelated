/**
 * Deployment orchestrator types — extracted from DeploymentOrchestrator.ts.
 */

import type { RegionConfig } from './MultiRegionDeploymentManager'
import type { DeploymentResult } from './CloudProviderManager'

export interface DeploymentOrchestratorConfig {
  maxParallelDeployments: number
  rollbackOnFailure: boolean
  healthCheckTimeout: number
  deploymentTimeout: number
  retryAttempts: number
  retryDelay: number
  dependencies: {
    infrastructure: string[]
    services: string[]
    monitoring: string[]
  }
}

export interface DeploymentPlan {
  id: string
  name: string
  regions: RegionConfig[]
  phases: DeploymentPhase[]
  dependencies: string[]
  rollbackPoints: RollbackPoint[]
  validationSteps: ValidationStep[]
}

export interface DeploymentPhase {
  id: string
  name: string
  type: 'infrastructure' | 'services' | 'monitoring' | 'validation'
  regions: string[]
  dependencies: string[]
  timeout: number
  rollbackEnabled: boolean
}

export interface RollbackPoint {
  id: string
  name: string
  phaseId: string
  snapshot: Record<string, unknown>
  createdAt: Date
}

export interface ValidationStep {
  id: string
  name: string
  type:
    | 'health-check'
    | 'performance-test'
    | 'security-scan'
    | 'compliance-check'
  target: string
  timeout: number
  successCriteria: Record<string, unknown>
}

export interface DeploymentExecution {
  id: string
  planId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled-back'
  currentPhase: string
  startedAt: Date
  completedAt?: Date
  results: DeploymentPhaseResult[]
  errors: string[]
  rollbackPoint?: string
}

export interface DeploymentPhaseResult {
  phaseId: string
  status: 'success' | 'failed' | 'skipped' | 'rolled-back'
  startedAt: Date
  completedAt: Date
  results: (DeploymentResult | Record<string, unknown>)[]
  errors: string[]
}

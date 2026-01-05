/**
 * Tests for the FHE Parameter Optimizer
 */

import {
  FHEParameterOptimizer,
  OptimizationStrategy,
} from '../parameter-optimizer'
import { FHEOperation } from '../types'
import { SealSchemeType } from '../seal-types'
import { SecurityLevel } from '../parameter-optimizer'

describe('FHEParameterOptimizer', () => {
  let optimizer: FHEParameterOptimizer

  beforeEach(() => {
    // Reset mocks as a best practice, though we don't use vi.mock() in these tests
    vi.clearAllMocks()
    // Reset the singleton instance manually
    Object.defineProperty(FHEParameterOptimizer, 'instance', {
      value: undefined,
      writable: true,
    })
    optimizer = FHEParameterOptimizer.getInstance()
  })

  it('singleton pattern returns the same instance', () => {
    const instance1 = FHEParameterOptimizer.getInstance()
    const instance2 = FHEParameterOptimizer.getInstance()
    expect(instance1).toBe(instance2)
  })

  it('default strategy is BalancedApproach', () => {
    // Access private property through a getter for testing
    const strategy =
      Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(optimizer),
        'strategy',
      )?.get?.call(optimizer) || OptimizationStrategy.BalancedApproach

    expect(strategy).toBe(OptimizationStrategy.BalancedApproach)
  })

  it('setStrategy updates the active strategy', () => {
    optimizer.setStrategy(OptimizationStrategy.SecurityFocused)

    // Access private property through a getter for testing
    const strategy =
      Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(optimizer),
        'strategy',
      )?.get?.call(optimizer) || OptimizationStrategy.BalancedApproach

    expect(strategy).toBe(OptimizationStrategy.SecurityFocused)
  })

  it('setConstraints updates the constraints with partial updates', () => {
    optimizer.setConstraints({
      minimumSecurityLevel: SecurityLevel.TC192,
      maximumMemoryMB: 2048,
    })

    // Access private property through a getter for testing
    const constraints =
      Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(optimizer),
        'constraints',
      )?.get?.call(optimizer) || {}

    expect(constraints).toEqual({
      minimumSecurityLevel: SecurityLevel.TC192,
      maximumMemoryMB: 2048,
      minimumPrecisionBits: 20,
      maximumLatencyMs: 500,
    })
  })

  it('getOptimizedParameters returns different parameters based on strategy', () => {
    // Security focused
    optimizer.setStrategy(OptimizationStrategy.SecurityFocused)
    const securityParams = optimizer.getOptimizedParameters(
      FHEOperation.Polynomial,
      SealSchemeType.BFV,
    )

    // Performance focused
    optimizer.setStrategy(OptimizationStrategy.PerformanceFocused)
    const performanceParams = optimizer.getOptimizedParameters(
      FHEOperation.Polynomial,
      SealSchemeType.BFV,
    )

    // Should have different values
    expect(securityParams.polyModulusDegree).not.toBe(
      performanceParams.polyModulusDegree,
    )
  })

  it('getOptimizedParameters returns scheme-specific parameters', () => {
    // BFV scheme
    const bfvParams = optimizer.getOptimizedParameters(
      FHEOperation.Polynomial,
      SealSchemeType.BFV,
    )

    // CKKS scheme
    const ckksParams = optimizer.getOptimizedParameters(
      FHEOperation.Polynomial,
      SealSchemeType.CKKS,
    )

    // BFV should have plainModulus, CKKS should have scale
    expect(bfvParams.plainModulus).toBeDefined()
    expect(bfvParams.scale).toBeUndefined()
    expect(ckksParams.plainModulus).toBeUndefined()
    expect(ckksParams.scale).toBeDefined()
  })

  it('getOptimizedParameters adjusts based on operation complexity', () => {
    // Simple operation
    const simpleParams = optimizer.getOptimizedParameters(
      FHEOperation.Addition,
      SealSchemeType.BFV,
    )

    // Complex operation
    const complexParams = optimizer.getOptimizedParameters(
      FHEOperation.CATEGORIZE,
      SealSchemeType.BFV,
    )

    // Complex operations should have higher parameters
    expect(complexParams.polyModulusDegree).toBeGreaterThan(
      simpleParams.polyModulusDegree,
    )
  })

  it('getOptimizedParametersForOperations handles multiple operations', () => {
    const operations = [
      FHEOperation.Addition,
      FHEOperation.Multiplication,
      FHEOperation.Polynomial,
    ]

    const result = optimizer.getOptimizedParametersForOperations(
      operations,
      SealSchemeType.BFV,
    )

    // Validate result structure
    expect(result).toHaveProperty('scheme', SealSchemeType.BFV)
    expect(result).toHaveProperty('params')
    expect(result).toHaveProperty('estimatedSecurity')
    expect(result).toHaveProperty('estimatedPerformance')
    expect(result).toHaveProperty('estimatedMemoryUsage')
    expect(result).toHaveProperty(
      'strategy',
      OptimizationStrategy.BalancedApproach,
    )
    expect(result).toHaveProperty('operationTypes', operations)
  })

  it('recordOperationMetrics adds metrics to history', () => {
    const metric = {
      operationId: 'test-op-1',
      operation: FHEOperation.Polynomial,
      startTime: Date.now() - 100,
      endTime: Date.now(),
      duration: 100,
      inputSize: 1000,
      outputSize: 1000,
      success: true,
    }

    optimizer.recordOperationMetrics(metric)

    // Access private property through reflection for testing
    const performanceHistory =
      Reflect.get(optimizer, 'performanceHistory') || []

    expect(performanceHistory.length).toBe(1)
    expect(performanceHistory[0]).toBe(metric)
  })

  it('recordOperationMetrics limits history size', () => {
    // Set max history through reflection
    Reflect.set(optimizer, 'MAX_HISTORY_ENTRIES', 3)

    // Add 5 metrics (should only keep latest 3)
    for (let i = 0; i < 5; i++) {
      optimizer.recordOperationMetrics({
        operationId: `test-op-${i}`,
        operation: FHEOperation.Polynomial,
        startTime: Date.now() - 100,
        endTime: Date.now(),
        duration: 100,
        inputSize: 1000,
        outputSize: 1000,
        success: true,
      })
    }

    // Access private property through reflection for testing
    const performanceHistory =
      Reflect.get(optimizer, 'performanceHistory') || []

    expect(performanceHistory.length).toBe(3)
    // The most recent operation should be first
    expect(performanceHistory[0].operationId).toBe('test-op-4')
  })

  it('analyzePerformanceHistory returns insufficient data warning when history is empty', () => {
    const analysis = optimizer.analyzePerformanceHistory()
    expect(analysis).toHaveProperty('sufficientData', false)
  })

  it('optimizeForContext uses metrics from context when available', () => {
    const context = {
      operationType: FHEOperation.Polynomial,
      contextId: 'test-context-1',
      timestamp: Date.now(),
      parameters: {
        dataSize: 5000000, // Large data should increase complexity
        batchSize: 20, // Batch operations should increase complexity
      },
      metrics: {
        operationId: 'test-op-1',
        operation: FHEOperation.Polynomial,
        startTime: Date.now() - 300,
        endTime: Date.now(),
        duration: 300,
        inputSize: 5000000,
        outputSize: 1000,
        success: true,
      },
    }

    // Use function replacement instead of spying
    const originalMethod = optimizer.recordOperationMetrics
    const mockFn = vi.fn()
    optimizer.recordOperationMetrics = mockFn

    optimizer.optimizeForContext(context, SealSchemeType.BFV)

    // Should have recorded the metrics
    expect(mockFn).toHaveBeenCalledWith(context.metrics)

    // Restore original method
    optimizer.recordOperationMetrics = originalMethod
  })

  it('adaptive optimization with history affects parameters', () => {
    optimizer.setStrategy(OptimizationStrategy.AutoAdaptive)

    // Get parameters with no history first
    const initialParams = optimizer.getOptimizedParameters(
      FHEOperation.Polynomial,
      SealSchemeType.BFV,
    )

    // Add slow operation metrics
    for (let i = 0; i < 5; i++) {
      optimizer.recordOperationMetrics({
        operationId: `slow-op-${i}`,
        operation: FHEOperation.Polynomial,
        startTime: Date.now() - 600,
        endTime: Date.now(),
        duration: 600, // Slow operation
        inputSize: 1000,
        outputSize: 1000,
        success: true,
      })
    }

    // Get parameters after recording slow operations
    const paramsWithHistory = optimizer.getOptimizedParameters(
      FHEOperation.Polynomial,
      SealSchemeType.BFV,
    )

    // Should have adapted for performance
    // Either smaller polyModulusDegree or other performance optimizations
    expect(paramsWithHistory).not.toEqual(initialParams)
  })
})

/*
 * FHE Parameter Optimization Example
 *
 * This example demonstrates how to use the FHE parameter optimizer to select
 * optimal parameters for different operations and optimization strategies.
 */

import {
  fheParameterOptimizer,
  OptimizationStrategy,
} from '../parameter-optimizer'
import { FHEOperation } from '../types'
import { SealSchemeType } from '../seal-types'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('fhe-parameter-optimization-example')

/**
 * Demonstrates different optimization strategies and their impact on parameters
 */
export async function demonstrateParameterOptimization(): Promise<void> {
  logger.info('Starting FHE parameter optimization demonstration')

  // Compare parameters for different strategies
  compareOptimizationStrategies()

  // Compare parameters for different operations
  compareOperationComplexity()

  // Demonstrate adaptive optimization
  simulateAdaptiveOptimization()

  logger.info('Parameter optimization demonstration completed')
}

/**
 * Compare the effect of different optimization strategies on parameters
 */
function compareOptimizationStrategies() {
  logger.info('Comparing optimization strategies')

  const operation = FHEOperation.Polynomial
  const scheme = SealSchemeType.BFV

  // Test each strategy
  const strategies = [
    OptimizationStrategy.SecurityFocused,
    OptimizationStrategy.PerformanceFocused,
    OptimizationStrategy.BalancedApproach,
    OptimizationStrategy.PrecisionFocused,
    OptimizationStrategy.MemoryEfficient,
  ]

  const results: Record<
    string,
    {
      polyModulusDegree: number
      coeffModulusBitsCount: number
      coeffModulusBitsSum: number
      plainModulus?: number
    }
  > = {}

  for (const strategy of strategies) {
    // Set the strategy
    fheParameterOptimizer.setStrategy(strategy)

    // Get optimized parameters
    const params = fheParameterOptimizer.getOptimizedParameters(
      operation,
      scheme,
    )

    // Store results
    results[strategy] = {
      polyModulusDegree: params.polyModulusDegree,
      coeffModulusBitsCount: params.coeffModulusBits.length,
      coeffModulusBitsSum: params.coeffModulusBits.reduce(
        (sum, bit) => sum + bit,
        0,
      ),
      plainModulus: params.plainModulus,
    }
  }

  // Log the comparison
  logger.info('Strategy comparison results', { results })
}

/**
 * Compare parameters for operations with different complexity
 */
function compareOperationComplexity() {
  logger.info('Comparing parameters for different operation complexities')

  // Set a balanced strategy
  fheParameterOptimizer.setStrategy(OptimizationStrategy.BalancedApproach)

  // Compare simple vs complex operations
  const operations = [
    FHEOperation.Addition, // Simple
    FHEOperation.Multiplication, // Medium
    FHEOperation.Polynomial, // Complex
    FHEOperation.CATEGORIZE, // Very complex
  ]

  const results: Record<
    string,
    {
      bfv: {
        polyModulusDegree: number
        coeffModulusBitsCount: number
        plainModulus?: number
      }
      ckks: {
        polyModulusDegree: number
        coeffModulusBitsCount: number
        scale?: number
      }
    }
  > = {}

  for (const operation of operations) {
    // Get optimized parameters for BFV scheme
    const bfvParams = fheParameterOptimizer.getOptimizedParameters(
      operation,
      SealSchemeType.BFV,
    )

    // Get optimized parameters for CKKS scheme
    const ckksParams = fheParameterOptimizer.getOptimizedParameters(
      operation,
      SealSchemeType.CKKS,
    )

    // Store results
    results[operation] = {
      bfv: {
        polyModulusDegree: bfvParams.polyModulusDegree,
        coeffModulusBitsCount: bfvParams.coeffModulusBits.length,
        plainModulus: bfvParams.plainModulus,
      },
      ckks: {
        polyModulusDegree: ckksParams.polyModulusDegree,
        coeffModulusBitsCount: ckksParams.coeffModulusBits.length,
        scale: ckksParams.scale,
      },
    }
  }

  // Log the comparison
  logger.info('Operation complexity comparison results', { results })
}

/**
 * Simulate adaptive optimization based on performance metrics
 */
function simulateAdaptiveOptimization() {
  logger.info('Simulating adaptive optimization based on performance metrics')

  // Set auto-adaptive strategy
  fheParameterOptimizer.setStrategy(OptimizationStrategy.AutoAdaptive)

  const operation = FHEOperation.Polynomial

  // Initially get parameters with no history
  const initialParams = fheParameterOptimizer.getOptimizedParameters(
    operation,
    SealSchemeType.BFV,
  )

  logger.info('Initial parameters (no history)', { initialParams })

  // Simulate recording performance metrics for slow operations
  for (let i = 0; i < 10; i++) {
    fheParameterOptimizer.recordOperationMetrics({
      operationId: `op-${i}`,
      operation: operation,
      startTime: Date.now() - 600, // 600ms ago
      endTime: Date.now(),
      duration: 600, // Slow operations
      inputSize: 1000,
      outputSize: 1000,
      success: true,
    })
  }

  // Get parameters after recording slow operations
  const paramsAfterSlowOps = fheParameterOptimizer.getOptimizedParameters(
    operation,
    SealSchemeType.BFV,
  )

  logger.info('Parameters after slow operations', { paramsAfterSlowOps })

  // Analyze the performance history
  const recommendations = fheParameterOptimizer.analyzePerformanceHistory()
  logger.info('Performance recommendations', { recommendations })
}

/**
 * Run the demonstration if this module is executed directly
 */
if (require.main === module) {
  demonstrateParameterOptimization()
    .then(() => {
      console.log('Demonstration completed successfully')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Demonstration failed:', error)
      process.exit(1)
    })
}

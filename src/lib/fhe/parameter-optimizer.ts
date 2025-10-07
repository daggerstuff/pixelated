/**
 * FHE Parameter Optimizer
 *
 * This module provides functionality to optimize FHE parameters for Microsoft SEAL
 * based on operation types, data characteristics, and security requirements.
 * It automatically adjusts parameters like polynomial modulus degree, coefficient
 * modulus bits, and plain modulus to find the optimal balance between:
 *
 * 1. Security (against known attacks)
 * 2. Performance (speed of operations)
 * 3. Precision (for approximate schemes like CKKS)
 * 4. Memory usage
 *
 * The optimizer includes both static presets and dynamic optimization capabilities.
 */

import { FHEOperation } from './types'
import type { FHEPerformanceMetrics, FHEOperationContext } from './types'
import {
  SealSchemeType,
  type SealEncryptionParamsOptions,
  SEAL_PARAMETER_PRESETS,
} from './seal-types'
import { createBuildSafeLogger } from '../logging/build-safe-logger'

// Define specific return types for analyzePerformanceHistory
interface OperationStat {
  avgDuration: number
  count: number
  trend: 'improving' | 'stable' | 'degrading'
}

interface InsufficientPerformanceData {
  sufficientData: false
  message: string
}

interface PerformanceAnalysis {
  sufficientData: true
  operationStats: Record<string, OperationStat>
  parameterRecommendations: Record<
    string,
    { action: string; suggestion: string }
  >
  recommendations?: Record<string, unknown>
  overallTrend?: 'improving' | 'stable' | 'degrading'
}

type AnalyzePerformanceHistoryReturn =
  | InsufficientPerformanceData
  | PerformanceAnalysis

// Get logger for this module
const logger = createBuildSafeLogger('fhe-parameter-optimizer')

// Operation complexity ratings (1-10) for different operations
const OPERATION_COMPLEXITY: Record<FHEOperation, number> = {
  [FHEOperation.Addition]: 1,
  [FHEOperation.Subtraction]: 1,
  [FHEOperation.Multiplication]: 5,
  [FHEOperation.Square]: 4,
  [FHEOperation.Negation]: 1,
  [FHEOperation.Polynomial]: 7,
  [FHEOperation.Rotation]: 4,
  [FHEOperation.Rescale]: 3,
  [FHEOperation.SENTIMENT]: 8,
  [FHEOperation.CATEGORIZE]: 9,
  [FHEOperation.SUMMARIZE]: 7,
  [FHEOperation.TOKENIZE]: 6,
  [FHEOperation.FILTER]: 5,
  [FHEOperation.CUSTOM]: 8,
  [FHEOperation.WORD_COUNT]: 3,
  [FHEOperation.CHARACTER_COUNT]: 2,
  [FHEOperation.KEYWORD_DENSITY]: 6,
  [FHEOperation.READING_LEVEL]: 7,
  [FHEOperation.ANALYZE]: 8,
}

/**
 * Parameter optimization strategy determines how the optimizer selects parameters
 */
export enum OptimizationStrategy {
  SecurityFocused = 'security-focused', // Prioritize security over performance
  PerformanceFocused = 'performance-focused', // Prioritize performance over security (but maintain minimum security)
  BalancedApproach = 'balanced-approach', // Balance security and performance
  PrecisionFocused = 'precision-focused', // Focus on numerical stability and precision (primarily for CKKS)
  MemoryEfficient = 'memory-efficient', // Optimize for lower memory usage
  AutoAdaptive = 'auto-adaptive', // Automatically adapt based on operation history
}

/**
 * Security level enum for optimization constraints
 */
export enum SecurityLevel {
  TC128 = 'tc128',
  TC192 = 'tc192',
  TC256 = 'tc256',
}

/**
 * Optimization constraints to ensure minimum security and functionality
 */
export interface OptimizationConstraints {
  minimumSecurityLevel: SecurityLevel
  maximumMemoryMB?: number
  minimumPrecisionBits?: number
  maximumLatencyMs?: number
}

/**
 * Parameter optimization result
 */
export interface ParameterOptimizationResult {
  scheme: SealSchemeType
  params: SealEncryptionParamsOptions
  estimatedSecurity: number // In bits
  estimatedPerformance: number // Relative score
  estimatedMemoryUsage: number // In MB
  strategy: OptimizationStrategy
  operationTypes: FHEOperation[]
}

/**
 * FHE Parameter Optimizer class
 *
 * This class analyzes operation patterns and data characteristics to
 * recommend optimal FHE parameters for the Microsoft SEAL library.
 */
export class FHEParameterOptimizer {
  private static instance: FHEParameterOptimizer

  // Performance history for auto-adaptation
  private performanceHistory: FHEPerformanceMetrics[] = []

  // Maximum entries to keep in performance history
  private readonly MAX_HISTORY_ENTRIES = 100

  // Current strategy
  private strategy: OptimizationStrategy = OptimizationStrategy.BalancedApproach

  // Default constraints
  private constraints: OptimizationConstraints = {
    minimumSecurityLevel: SecurityLevel.TC128,
    maximumMemoryMB: 1024,
    minimumPrecisionBits: 20,
    maximumLatencyMs: 500,
  }

  /**
   * Get singleton instance of the optimizer
   */
  public static getInstance(): FHEParameterOptimizer {
    if (!FHEParameterOptimizer.instance) {
      FHEParameterOptimizer.instance = new FHEParameterOptimizer()
    }
    return FHEParameterOptimizer.instance
  }

  /**
   * Private constructor for singleton pattern
   */
  private constructor() {
    logger.info('Initializing FHE Parameter Optimizer')
  }

  /**
   * Set the optimization strategy
   *
   * @param strategy The strategy to use for parameter optimization
   */
  public setStrategy(strategy: OptimizationStrategy): void {
    this.strategy = strategy
    logger.info(`Optimization strategy set to ${strategy}`)
  }

  /**
   * Set constraints for the optimization process
   *
   * @param constraints Constraints to apply during optimization
   */
  public setConstraints(constraints: Partial<OptimizationConstraints>): void {
    this.constraints = { ...this.constraints, ...constraints }
    logger.info('Optimization constraints updated', {
      constraints: this.constraints,
    })
  }

  /**
   * Record operation performance metrics for future optimization
   *
   * @param metrics Performance metrics to record
   */
  public recordOperationMetrics(metrics: FHEPerformanceMetrics): void {
    // Add to beginning of array for faster recent access
    this.performanceHistory.unshift(metrics)

    // Trim history if too large
    if (this.performanceHistory.length > this.MAX_HISTORY_ENTRIES) {
      this.performanceHistory.pop()
    }

    logger.debug('Recorded FHE operation metrics', {
      operationId: metrics.operationId,
      operation: metrics.operation,
      duration: metrics.duration,
    })
  }

  /**
   * Get optimized parameters for a specific operation type
   *
   * @param operation The FHE operation type
   * @param scheme The SEAL scheme type
   * @returns Optimized encryption parameters
   */
  public getOptimizedParameters(
    operation: FHEOperation,
    scheme: SealSchemeType = SealSchemeType.BFV,
  ): SealEncryptionParamsOptions {
    // Get the complexity rating for this operation
    const complexity = OPERATION_COMPLEXITY[operation] || 5

    // Start with appropriate base preset based on the scheme
    let basePreset = 'bfv-default'

    if (scheme === SealSchemeType.CKKS) {
      basePreset = 'ckks-default'
    } else if (scheme === SealSchemeType.BGV) {
      basePreset = 'bgv-default'
    }

    // Apply strategy-based modifications
    switch (this.strategy) {
      case OptimizationStrategy.SecurityFocused:
        return this.optimizeForSecurity(basePreset, complexity, scheme)

      case OptimizationStrategy.PerformanceFocused:
        return this.optimizeForPerformance(basePreset, complexity, scheme)

      case OptimizationStrategy.PrecisionFocused:
        return this.optimizeForPrecision(basePreset, complexity, scheme)

      case OptimizationStrategy.MemoryEfficient:
        return this.optimizeForMemory(basePreset, complexity, scheme)

      case OptimizationStrategy.AutoAdaptive:
        return this.adaptiveOptimization(operation, scheme)

      case OptimizationStrategy.BalancedApproach:
      default:
        return this.balancedOptimization(basePreset, complexity, scheme)
    }
  }

  /**
   * Get optimized parameters for multiple operations
   *
   * @param operations Array of FHE operations
   * @param scheme The SEAL scheme type
   * @returns Optimized parameters that work well for all operations
   */
  public getOptimizedParametersForOperations(
    operations: FHEOperation[],
    scheme: SealSchemeType = SealSchemeType.BFV,
  ): ParameterOptimizationResult {
    // Find the most complex operation
    const maxComplexity = Math.max(
      ...operations.map((op) => OPERATION_COMPLEXITY[op] || 5),
    )

    // Base parameters on the scheme
    let basePreset = 'bfv-default'
    if (scheme === SealSchemeType.CKKS) {
      basePreset = 'ckks-default'
    } else if (scheme === SealSchemeType.BGV) {
      basePreset = 'bgv-default'
    }

    // Create a customized parameter set based on operation needs
    const params = this.createCustomParameters(
      basePreset,
      maxComplexity,
      scheme,
    )

    // Calculate estimates for the result
    const estimatedSecurity = this.estimateSecurityBits(params)
    const estimatedPerformance = this.estimatePerformanceScore(
      params,
      operations,
    )
    const estimatedMemoryUsage = this.estimateMemoryUsage(params)

    return {
      scheme,
      params,
      estimatedSecurity,
      estimatedPerformance,
      estimatedMemoryUsage,
      strategy: this.strategy,
      operationTypes: operations,
    }
  }

  /**
   * Optimize parameters for a specific context and operation
   *
   * @param context FHE operation context
   * @param scheme The SEAL scheme type
   * @returns Optimized parameters for the context
   */
  public optimizeForContext(
    context: FHEOperationContext,
    scheme: SealSchemeType = SealSchemeType.BFV,
  ): SealEncryptionParamsOptions {
    // Extract operation type from context
    const operationType = context.operationType as FHEOperation

    // If we have metrics, use them for optimization
    if (context.metrics) {
      this.recordOperationMetrics(context.metrics)
    }

    // Use context parameters for more informed optimization
    const complexityModifier = this.getComplexityModifierFromContext(context)
    const baseComplexity = OPERATION_COMPLEXITY[operationType] || 5
    const adjustedComplexity = Math.min(
      10,
      Math.max(1, baseComplexity * complexityModifier),
    )

    // Start with base preset
    let basePreset = 'bfv-default'
    if (scheme === SealSchemeType.CKKS) {
      basePreset = 'ckks-default'
    } else if (scheme === SealSchemeType.BGV) {
      basePreset = 'bgv-default'
    }

    // Create context-specific parameters
    return this.createCustomParameters(basePreset, adjustedComplexity, scheme)
  }

  /**
   * Analyzes recent performance history to recommend parameter adjustments
   *
   * @returns Recommended parameter adjustments based on performance history
   */
  public analyzePerformanceHistory(): AnalyzePerformanceHistoryReturn {
    if (this.performanceHistory.length < 5) {
      return {
        sufficientData: false,
        message: 'Insufficient performance data for analysis',
      }
    }

    // Group by operation type
    const operationGroups: Record<string, FHEPerformanceMetrics[]> = {}

    for (const metric of this.performanceHistory) {
      if (!operationGroups[metric.operation]) {
        operationGroups[metric.operation] = []
      }
      operationGroups[metric.operation].push(metric)
    }

    // Calculate average durations by operation
    const operationStats: Record<
      string,
      {
        avgDuration: number
        count: number
        trend: 'improving' | 'stable' | 'degrading'
      }
    > = {}

    for (const [operation, metrics] of Object.entries(operationGroups)) {
      // Only analyze if we have enough samples
      if (metrics.length >= 3) {
        // Calculate average duration
        const avgDuration =
          metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length

        // Determine performance trend
        // Compare first half vs second half of metrics
        const midpoint = Math.floor(metrics.length / 2)
        const recentMetrics = metrics.slice(0, midpoint)
        const olderMetrics = metrics.slice(midpoint)

        const recentAvg =
          recentMetrics.reduce((sum, m) => sum + m.duration, 0) /
          recentMetrics.length
        const olderAvg =
          olderMetrics.reduce((sum, m) => sum + m.duration, 0) /
          olderMetrics.length

        // Define trend (5% threshold for significance)
        let trend: 'improving' | 'stable' | 'degrading' = 'stable'
        const changeRatio = recentAvg / olderAvg

        if (changeRatio < 0.95) {
          trend = 'improving'
        } else if (changeRatio > 1.05) {
          trend = 'degrading'
        }

        operationStats[operation] = {
          avgDuration,
          count: metrics.length,
          trend,
        }
      }
    }

    // Generate recommendations based on stats
    const result: PerformanceAnalysis = {
      sufficientData: true,
      operationStats,
      parameterRecommendations: {},
    }

    // Make specific recommendations for each operation type
    for (const [operation, stats] of Object.entries(operationStats)) {
      if (stats.trend === 'degrading') {
        result.parameterRecommendations[operation] = {
          action: 'optimize',
          suggestion:
            stats.avgDuration > 400
              ? 'Consider reducing polynomial modulus degree or security level'
              : 'Consider batch processing or pre-computing',
        }
      }
    }

    return result
  }

  /**
   * Security-focused optimization
   */
  private optimizeForSecurity(
    basePreset: string,
    complexity: number,
    scheme: SealSchemeType,
  ): SealEncryptionParamsOptions {
    // Start with high security preset
    const baseParams = { ...SEAL_PARAMETER_PRESETS['high-security'] }

    // For very complex operations, increase security further
    if (complexity > 7) {
      // Increase polynomial modulus degree for complex operations
      baseParams.polyModulusDegree = 32768

      // Adjust coefficient modulus bits for the larger poly modulus
      baseParams.coeffModulusBits = [60, 40, 40, 40, 40, 40, 40, 40, 60]
    }

    // For CKKS, ensure appropriate scale
    if (scheme === SealSchemeType.CKKS) {
      baseParams.scale = Math.pow(2, 40)
      delete baseParams.plainModulus
    } else {
      // For BFV/BGV, ensure appropriate plain modulus
      baseParams.plainModulus = 1032193
    }

    return baseParams
  }

  /**
   * Performance-focused optimization
   */
  private optimizeForPerformance(
    basePreset: string,
    complexity: number,
    scheme: SealSchemeType,
  ): SealEncryptionParamsOptions {
    // Start with high performance preset
    const baseParams = { ...SEAL_PARAMETER_PRESETS['high-performance'] }

    // For very complex operations, we may need to trade some performance for functionality
    if (complexity > 8) {
      // Increase polynomial modulus degree for multiplications and complex operations
      baseParams.polyModulusDegree = 8192

      // Adjust coefficient modulus for more multiplicative depth
      baseParams.coeffModulusBits = [30, 20, 20, 20, 20, 30]
    } else if (complexity < 3) {
      // For simple operations, we can reduce parameters
      baseParams.polyModulusDegree = 4096
      baseParams.coeffModulusBits = [30, 20, 30]
    }

    // Scheme-specific adjustments
    if (scheme === SealSchemeType.CKKS) {
      baseParams.scale = Math.pow(2, 30) // Lower precision for better performance
      delete baseParams.plainModulus
    } else {
      // Use a smaller plain modulus for better performance
      baseParams.plainModulus = 65537 // Prime and power of 2 + 1
    }

    return baseParams
  }

  /**
   * Precision-focused optimization (primarily for CKKS)
   */
  private optimizeForPrecision(
    basePreset: string,
    complexity: number,
    scheme: SealSchemeType,
  ): SealEncryptionParamsOptions {
    // Start with CKKS default or an appropriate preset
    const baseParams =
      scheme === SealSchemeType.CKKS
        ? { ...SEAL_PARAMETER_PRESETS['ckks-default'] }
        : { ...SEAL_PARAMETER_PRESETS[basePreset] }

    if (scheme === SealSchemeType.CKKS) {
      // For CKKS, increase precision by using larger scale and coefficient modulus
      baseParams.scale = Math.pow(2, 50)

      // Adjust polynomial modulus degree based on complexity
      if (complexity > 7) {
        baseParams.polyModulusDegree = 16384
        baseParams.coeffModulusBits = [60, 50, 50, 50, 50, 50, 60]
      } else {
        baseParams.polyModulusDegree = 8192
        baseParams.coeffModulusBits = [60, 50, 50, 50, 60]
      }
    } else {
      // For BFV/BGV, use larger plain modulus for better precision
      baseParams.plainModulus = 2097151 // Larger prime

      if (complexity > 7) {
        baseParams.polyModulusDegree = 16384
      }
    }

    return baseParams
  }

  /**
   * Memory-efficient optimization
   */
  private optimizeForMemory(
    basePreset: string,
    complexity: number,
    scheme: SealSchemeType,
  ): SealEncryptionParamsOptions {
    // Start with low-security preset which has smaller parameters
    const baseParams = { ...SEAL_PARAMETER_PRESETS['low-security'] }

    // For high complexity, we still need adequate parameters
    if (complexity > 8) {
      baseParams.polyModulusDegree = 8192
      baseParams.coeffModulusBits = [40, 30, 30, 40]
    } else if (complexity < 4) {
      // For simple operations, we can use even smaller parameters
      baseParams.polyModulusDegree = 2048
      baseParams.coeffModulusBits = [40, 40]
    }

    // Scheme-specific adjustments
    if (scheme === SealSchemeType.CKKS) {
      baseParams.scale = Math.pow(2, 30) // Lower precision for memory efficiency
      delete baseParams.plainModulus
    } else {
      baseParams.plainModulus = 40961 // Smaller plain modulus
    }

    return baseParams
  }

  /**
   * Balanced optimization (default)
   */
  private balancedOptimization(
    basePreset: string,
    complexity: number,
    scheme: SealSchemeType,
  ): SealEncryptionParamsOptions {
    // Start with the default preset for the scheme
    const baseParams = { ...SEAL_PARAMETER_PRESETS[basePreset] }

    // Adjust based on complexity
    if (complexity > 7) {
      // For complex operations, increase parameters moderately
      baseParams.polyModulusDegree = 16384

      if (scheme === SealSchemeType.CKKS) {
        baseParams.coeffModulusBits = [60, 40, 40, 40, 40, 40, 60]
        baseParams.scale = Math.pow(2, 40)
        delete baseParams.plainModulus
      } else {
        baseParams.coeffModulusBits = [60, 40, 40, 40, 40, 40, 60]
        baseParams.plainModulus = 1032193
      }
    } else if (complexity < 3) {
      // For simple operations, reduce parameters slightly
      baseParams.polyModulusDegree = 4096

      if (scheme === SealSchemeType.CKKS) {
        baseParams.coeffModulusBits = [60, 40, 40, 60]
        baseParams.scale = Math.pow(2, 40)
        delete baseParams.plainModulus
      } else {
        baseParams.coeffModulusBits = [60, 40, 40, 60]
        baseParams.plainModulus = 1032193
      }
    }

    return baseParams
  }

  /**
   * Adaptive optimization based on operation history
   */
  private adaptiveOptimization(
    operation: FHEOperation,
    scheme: SealSchemeType,
  ): SealEncryptionParamsOptions {
    // Find relevant performance metrics for this operation
    const relevantMetrics = this.performanceHistory.filter(
      (m) => m.operation === operation,
    )

    // If we don't have enough data, fall back to balanced approach
    if (relevantMetrics.length < 3) {
      logger.debug(
        'Insufficient history for adaptive optimization, using balanced approach',
      )
      return this.balancedOptimization(
        scheme === SealSchemeType.CKKS
          ? 'ckks-default'
          : scheme === SealSchemeType.BGV
            ? 'bgv-default'
            : 'bfv-default',
        OPERATION_COMPLEXITY[operation] || 5,
        scheme,
      )
    }

    // Calculate average duration
    const avgDuration =
      relevantMetrics.reduce((sum, m) => sum + m.duration, 0) /
      relevantMetrics.length

    // Choose strategy based on performance
    if (avgDuration > 500) {
      // Operations are slow, optimize for performance
      logger.debug('Operations are slow, optimizing for performance')
      return this.optimizeForPerformance(
        scheme === SealSchemeType.CKKS
          ? 'ckks-default'
          : scheme === SealSchemeType.BGV
            ? 'bgv-default'
            : 'bfv-default',
        OPERATION_COMPLEXITY[operation] || 5,
        scheme,
      )
    } else if (avgDuration < 100) {
      // Operations are fast, can optimize for security or precision
      logger.debug('Operations are fast, optimizing for security')
      return this.optimizeForSecurity(
        scheme === SealSchemeType.CKKS
          ? 'ckks-default'
          : scheme === SealSchemeType.BGV
            ? 'bgv-default'
            : 'bfv-default',
        OPERATION_COMPLEXITY[operation] || 5,
        scheme,
      )
    } else {
      // Operations are reasonable, use balanced approach
      logger.debug(
        'Operations have reasonable performance, using balanced approach',
      )
      return this.balancedOptimization(
        scheme === SealSchemeType.CKKS
          ? 'ckks-default'
          : scheme === SealSchemeType.BGV
            ? 'bgv-default'
            : 'bfv-default',
        OPERATION_COMPLEXITY[operation] || 5,
        scheme,
      )
    }
  }

  /**
   * Create custom parameters based on complexity and scheme
   */
  private createCustomParameters(
    basePreset: string,
    complexity: number,
    scheme: SealSchemeType,
  ): SealEncryptionParamsOptions {
    // Start with base preset
    const params = { ...SEAL_PARAMETER_PRESETS[basePreset] }

    // Adjust polynomial modulus degree based on complexity
    if (complexity >= 9) {
      params.polyModulusDegree = 32768
    } else if (complexity >= 7) {
      params.polyModulusDegree = 16384
    } else if (complexity >= 4) {
      params.polyModulusDegree = 8192
    } else {
      params.polyModulusDegree = 4096
    }

    // Adjust coefficient modulus bits based on polynomial modulus degree
    switch (params.polyModulusDegree) {
      case 32768:
        params.coeffModulusBits = [60, 50, 50, 50, 50, 50, 50, 50, 60]
        break
      case 16384:
        params.coeffModulusBits = [60, 50, 50, 50, 50, 60]
        break
      case 8192:
        params.coeffModulusBits = [60, 40, 40, 40, 60]
        break
      case 4096:
        params.coeffModulusBits = [60, 40, 40, 60]
        break
      default:
        params.coeffModulusBits = [60, 40, 60]
    }

    // Scheme-specific adjustments
    if (scheme === SealSchemeType.CKKS) {
      // For CKKS, set scale based on complexity
      if (complexity >= 8) {
        params.scale = Math.pow(2, 50) // Higher precision for complex operations
      } else if (complexity >= 5) {
        params.scale = Math.pow(2, 40) // Default precision
      } else {
        params.scale = Math.pow(2, 30) // Lower precision for simple operations
      }

      // CKKS doesn't use plain modulus
      delete params.plainModulus
    } else if (complexity >= 8) {
      params.plainModulus = 2097151 // Larger prime for complex operations
    } else if (complexity >= 5) {
      params.plainModulus = 1032193 // Default
    } else {
      params.plainModulus = 65537 // Smaller prime for simple operations
    }

    return params
  }

  /**
   * Get complexity modifier from operation context
   */
  private getComplexityModifierFromContext(
    context: FHEOperationContext,
  ): number {
    // Default modifier
    let modifier = 1.0

    // If we have parameters, adjust based on them
    if (context.parameters) {
      // Check for data size
      const dataSize = context.parameters.dataSize as number
      if (dataSize && dataSize > 1000000) {
        modifier *= 1.5 // Large data increases complexity
      } else if (dataSize && dataSize < 1000) {
        modifier *= 0.8 // Small data decreases complexity
      }

      // Check for batch operations
      const batchSize = context.parameters.batchSize as number
      if (batchSize && batchSize > 10) {
        modifier *= 1.3 // Batch operations increase complexity
      }
    }

    return modifier
  }

  /**
   * Determine appropriate security level based on operation complexity
   */
  private determineSecurityLevel(complexity: number): SecurityLevel {
    if (complexity >= 9) {
      return SecurityLevel.TC256 // Highest security for critical operations
    } else if (complexity >= 7) {
      return SecurityLevel.TC192 // High security for important operations
    } else {
      return SecurityLevel.TC128 // Standard security
    }
  }

  /**
   * Estimate security level in bits for given parameters
   */
  private estimateSecurityBits(params: SealEncryptionParamsOptions): number {
    // Simple estimation based on polynomial modulus degree
    // In practice, this would use the LWE estimator or similar
    switch (params.polyModulusDegree) {
      case 32768:
        return 256
      case 16384:
        return 192
      case 8192:
        return 128
      case 4096:
        return 100
      default:
        return 80
    }
  }

  /**
   * Estimate performance score for parameters and operations
   */
  private estimatePerformanceScore(
    params: SealEncryptionParamsOptions,
    operations: FHEOperation[],
  ): number {
    // Base score starts at 100
    let score = 100

    // Adjust based on polynomial modulus degree (larger = slower)
    switch (params.polyModulusDegree) {
      case 32768:
        score -= 50
        break
      case 16384:
        score -= 30
        break
      case 8192:
        score -= 15
        break
      case 4096:
        score -= 5
        break
    }

    // Adjust based on coefficient modulus size
    score -= params.coeffModulusBits.length * 5

    // Adjust based on operation complexity
    const avgComplexity =
      operations.reduce((sum, op) => sum + (OPERATION_COMPLEXITY[op] || 5), 0) /
      operations.length

    score -= avgComplexity * 3

    // Ensure score is within reasonable bounds
    return Math.max(10, Math.min(100, score))
  }

  /**
   * Estimate memory usage for parameters
   */
  private estimateMemoryUsage(params: SealEncryptionParamsOptions): number {
    // Basic estimation in MB
    // In practice, would be more precise based on all parameters
    const baseSize = params.polyModulusDegree * 0.000128
    const coeffModSizeFactor =
      params.coeffModulusBits.reduce((sum, bits) => sum + bits, 0) * 0.00001

    return baseSize * (1 + coeffModSizeFactor)
  }
}

// Export a default instance
export const fheParameterOptimizer = FHEParameterOptimizer.getInstance()

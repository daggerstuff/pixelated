/**
 * MentalArena Python bridge types — extracted from MentalArenaPythonBridge.ts.
 */

export interface PythonBridgeConfig {
  mentalArenaPath: string
  pythonPath: string
  virtualEnvPath?: string
  timeout?: number
  maxRetries?: number
  enableLogging?: boolean
  securityMode?: 'strict' | 'standard' | 'development'
}

export interface PythonExecutionResult {
  success: boolean
  output: unknown
  error?: string | undefined
  exitCode?: number | undefined
  executionTime: number
  metadata: {
    command: string
    timestamp: string
    processId: number
  }
}

export interface GenerateDataOptions {
  baseModel: string
  outputFile: string
  numSessions: number
  disorders?: string[]
  maxTurns?: number
  temperature?: number
  qualityThreshold?: number
  useEncryption?: boolean
}

export interface ModelEvaluationOptions {
  modelPath: string
  testDataPath: string
  outputPath: string
  metrics?: string[]
  batchSize?: number
}

export interface SymptomAnalysisOptions {
  text: string
  analysisType: 'encoding' | 'decoding' | 'validation'
  context?: Record<string, unknown>
}

/**
 * Production-grade Python bridge for MentalArena integration
 */

/**
 * Performance metrics tracker for the Python bridge
 */
export class BridgePerformanceMetrics {
  private executions: Array<{
    timestamp: number
    duration: number
    success: boolean
  }> = []
  private initializationTime: number = 0

  recordExecution(duration: number, success: boolean): void {
    this.executions.push({
      timestamp: Date.now(),
      duration,
      success,
    })

    // Keep only last 1000 executions
    if (this.executions.length > 1000) {
      this.executions = this.executions.slice(-1000)
    }
  }

  recordInitialization(duration: number): void {
    this.initializationTime = duration
  }

  getMetrics(): {
    totalExecutions: number
    averageExecutionTime: number
    successRate: number
    initializationTime: number
  } {
    if (this.executions.length === 0) {
      return {
        totalExecutions: 0,
        averageExecutionTime: 0,
        successRate: 0,
        initializationTime: this.initializationTime,
      }
    }

    const totalDuration = this.executions.reduce(
      (sum, exec) => sum + exec.duration,
      0,
    )
    const successfulExecutions = this.executions.filter(
      (exec) => exec.success,
    ).length

    return {
      totalExecutions: this.executions.length,
      averageExecutionTime: totalDuration / this.executions.length,
      successRate: (successfulExecutions / this.executions.length) * 100,
      initializationTime: this.initializationTime,
    }
  }
}

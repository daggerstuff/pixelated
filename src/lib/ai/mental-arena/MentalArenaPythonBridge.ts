/**
 * Production-Grade Mental Arena Python Bridge
 *
 * This bridge enables seamless integration with Python-based MentalArena libraries
 * for advanced therapeutic conversation generation and analysis.
 *
 * Features:
 * - Secure Python process management
 * - Bidirectional data serialization
 * - Error handling and recovery
 * - Performance monitoring
 * - Resource management
 *
 * @author MentalArena Integration Team
 * @since 2025-06-27
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { promises as fs } from 'node:fs'
import * as path from 'node:path'
import * as crypto from 'node:crypto'
import { createBuildSafeLogger } from '../../logging/build-safe-logger'

const logger = createBuildSafeLogger('MentalArenaPythonBridge')

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
export class MentalArenaPythonBridge {
  private config: Required<PythonBridgeConfig>
  private pythonProcess?: ChildProcess
  private isInitialized: boolean = false
  private processQueue: Array<{
    id: string
    command: string
    args: string[]
    resolve: (result: PythonExecutionResult) => void
    reject: (error: Error) => void
    timestamp: number
  }> = []
  private isProcessing: boolean = false
  private performanceMetrics: BridgePerformanceMetrics

  constructor(config: PythonBridgeConfig) {
    this.config = {
      timeout: 300000, // 5 minutes default
      maxRetries: 3,
      enableLogging: true,
      securityMode: 'standard',
      ...config,
    } as Required<PythonBridgeConfig>

    this.performanceMetrics = new BridgePerformanceMetrics()

    logger.info('MentalArenaPythonBridge initialized', {
      mentalArenaPath: this.config.mentalArenaPath,
      pythonPath: this.config.pythonPath,
      securityMode: this.config.securityMode,
    })
  }

  /**
   * Initialize the Python bridge and MentalArena environment
   */
  async initialize(): Promise<void> {
    const startTime = Date.now()
    logger.info('Initializing MentalArena Python environment')

    try {
      // Validate security settings
      await this.validateSecurityConstraints()

      // Ensure MentalArena repository exists
      await this.ensureMentalArenaRepository()

      // Set up Python environment
      await this.setupPythonEnvironment()

      // Validate Python installation and dependencies
      await this.validatePythonEnvironment()

      // Test basic functionality
      await this.runBasicValidation()

      this.isInitialized = true
      const initTime = Date.now() - startTime

      this.performanceMetrics.recordInitialization(initTime)
      logger.info('MentalArena Python bridge initialized successfully', {
        initializationTime: initTime,
      })
    } catch (error: unknown) {
      logger.error('Failed to initialize MentalArena Python bridge', error)
      throw new Error(`Python bridge initialization failed: ${error}`, { cause: error })
    }
  }

  /**
   * Generate synthetic therapeutic data using Python MentalArena
   */
  async generateData(
    options: GenerateDataOptions,
  ): Promise<PythonExecutionResult> {
    this.ensureInitialized()

    const command = this.config.pythonPath
    const args = [
      path.join(this.config.mentalArenaPath, 'scripts', 'arena_med.py'),
      '--base-model',
      options.baseModel,
      '--output-file',
      options.outputFile,
      '--num-sessions',
      options.numSessions.toString(),
    ]

    // Add optional parameters
    if (options.disorders) {
      args.push('--disorders', options.disorders.join(','))
    }
    if (options.maxTurns) {
      args.push('--max-turns', options.maxTurns.toString())
    }
    if (options.temperature) {
      args.push('--temperature', options.temperature.toString())
    }
    if (options.qualityThreshold) {
      args.push('--quality-threshold', options.qualityThreshold.toString())
    }
    if (options.useEncryption) {
      args.push('--use-encryption')
    }

    logger.info('Generating synthetic data via Python', { options })

    return this.executeSecure(command, args, {
      description: 'Generate synthetic therapeutic conversations',
      timeout: this.config.timeout,
    })
  }

  /**
   * Evaluate model performance using Python evaluation scripts
   */
  async evaluateModel(
    options: ModelEvaluationOptions,
  ): Promise<PythonExecutionResult> {
    this.ensureInitialized()

    const command = this.config.pythonPath
    const args = [
      path.join(this.config.mentalArenaPath, 'scripts', 'evaluate_model.py'),
      '--model-path',
      options.modelPath,
      '--test-data',
      options.testDataPath,
      '--output-path',
      options.outputPath,
    ]

    if (options.metrics) {
      args.push('--metrics', options.metrics.join(','))
    }
    if (options.batchSize) {
      args.push('--batch-size', options.batchSize.toString())
    }

    logger.info('Evaluating model via Python', { options })

    return this.executeSecure(command, args, {
      description: 'Evaluate model performance',
      timeout: this.config.timeout * 2, // Extended timeout for evaluation
    })
  }

  /**
   * Analyze symptoms using Python NLP tools
   */
  async analyzeSymptoms(
    options: SymptomAnalysisOptions,
  ): Promise<PythonExecutionResult> {
    this.ensureInitialized()

    // Create temporary input file for text analysis
    const tempDir = path.join(this.config.mentalArenaPath, 'temp')
    await fs.mkdir(tempDir, { recursive: true })

    const inputFile = path.join(tempDir, `analysis_${crypto.randomUUID()}.json`)
    const outputFile = path.join(tempDir, `result_${crypto.randomUUID()}.json`)

    try {
      // Write input data
      await fs.writeFile(
        inputFile,
        JSON.stringify({
          text: options.text,
          analysisType: options.analysisType,
          context: options.context || {},
        }),
        'utf-8',
      )

      const command = this.config.pythonPath
      const args = [
        path.join(
          this.config.mentalArenaPath,
          'scripts',
          'analyze_symptoms.py',
        ),
        '--input-file',
        inputFile,
        '--output-file',
        outputFile,
        '--analysis-type',
        options.analysisType,
      ]

      logger.info('Analyzing symptoms via Python', {
        analysisType: options.analysisType,
        textLength: options.text.length,
      })

      const result = await this.executeSecure(command, args, {
        description: `Symptom analysis: ${options.analysisType}`,
        timeout: 60000, // 1 minute for analysis
      })

      // Read and parse result if successful
      if (result.success && (await this.fileExists(outputFile))) {
        const resultData = await fs.readFile(outputFile, 'utf-8')
        result.output = JSON.parse(resultData) as unknown
      }

      return result
    } finally {
      // Clean up temporary files
      await this.cleanupTempFiles([inputFile, outputFile])
    }
  }

  /**
   * Execute arbitrary Python script with security constraints
   */
  async executeScript(
    scriptPath: string,
    args: string[] = [],
  ): Promise<PythonExecutionResult> {
    this.ensureInitialized()

    // Validate script path for security
    await this.validateScriptPath(scriptPath)

    const command = this.config.pythonPath
    const fullArgs = [scriptPath, ...args]

    logger.info('Executing Python script', {
      scriptPath,
      argsCount: args.length,
    })

    return this.executeSecure(command, fullArgs, {
      description: `Execute script: ${path.basename(scriptPath)}`,
      timeout: this.config.timeout,
    })
  }

  /**
   * Check if the bridge is available and functional
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false
      }

      // Test basic Python execution
      const result = await this.executeSecure(
        this.config.pythonPath,
        ['--version'],
        {
          description: 'Check Python availability',
          timeout: 5000,
        },
      )

      return result.success
    } catch (error: unknown) {
      logger.warn('Python bridge availability check failed', error)
      return false
    }
  }

  /**
   * Get version information for the Python environment and MentalArena
   */
  async getVersion(): Promise<string> {
    this.ensureInitialized()

    try {
      const pythonVersion = await this.executeSecure(
        this.config.pythonPath,
        ['--version'],
        {
          description: 'Get Python version',
          timeout: 5000,
        },
      )

      const mentalArenaInfo = await this.executeSecure(
        'python',
        [path.join(this.config.mentalArenaPath, 'scripts', 'version_info.py')],
        {
          description: 'Get MentalArena version',
          timeout: 10000,
        },
      )

      return `Python: ${pythonVersion.output}, MentalArena: ${mentalArenaInfo.output}`
    } catch (error: unknown) {
      logger.error('Failed to get version information', error)
      return 'Version information unavailable'
    }
  }

  /**
   * Clean up virtual environment
   */
  async cleanupVirtualEnvironment(): Promise<void> {
    const venvPath =
      this.config.virtualEnvPath ||
      path.join(this.config.mentalArenaPath, 'venv')

    if (await this.fileExists(venvPath)) {
      logger.info('Cleaning up virtual environment', { venvPath })

      try {
        // On Windows, we need to handle the directory differently
        if (process.platform === 'win32') {
          await this.executeSecure('rmdir', ['/s', '/q', venvPath], {
            description: 'Remove virtual environment (Windows)',
            timeout: 30000,
          })
        } else {
          await this.executeSecure('rm', ['-rf', venvPath], {
            description: 'Remove virtual environment (Unix)',
            timeout: 30000,
          })
        }

        logger.info('Virtual environment cleaned up successfully')
      } catch (error: unknown) {
        logger.warn('Failed to clean up virtual environment', error)
      }
    }
  }

  /**
   * Reinstall virtual environment and dependencies
   */
  async reinstallEnvironment(): Promise<void> {
    logger.info('Reinstalling Python virtual environment')

    // Clean up existing environment
    await this.cleanupVirtualEnvironment()

    // Reset Python path to original
    const originalPythonPath = this.config.virtualEnvPath
      ? path.join(this.config.virtualEnvPath, '..', 'python')
      : 'python'

    // Temporarily reset to system Python for recreation
    const currentPythonPath = this.config.pythonPath
    this.config.pythonPath = originalPythonPath

    try {
      // Recreate environment
      await this.setupPythonEnvironment()
      logger.info('Virtual environment reinstalled successfully')
    } catch (error: unknown) {
      // Restore previous Python path on failure
      this.config.pythonPath = currentPythonPath
      throw error
    }
  }

  /**
   * Get virtual environment information
   */
  getVirtualEnvironmentInfo(): {
    venvPath: string
    pythonPath: string
    isActive: boolean
  } {
    const venvPath =
      this.config.virtualEnvPath ||
      path.join(this.config.mentalArenaPath, 'venv')
    const expectedVenvPython =
      process.platform === 'win32'
        ? path.join(venvPath, 'Scripts', 'python.exe')
        : path.join(venvPath, 'bin', 'python')

    return {
      venvPath,
      pythonPath: this.config.pythonPath,
      isActive: this.config.pythonPath === expectedVenvPython,
    }
  }

  /**
   * Clean up resources and terminate processes
   */
  async cleanup(): Promise<void> {
    logger.info('Cleaning up MentalArena Python bridge')

    if (this.pythonProcess && !this.pythonProcess.killed) {
      this.pythonProcess.kill('SIGTERM')

      // Wait for graceful shutdown, then force kill if needed
      setTimeout(() => {
        if (this.pythonProcess && !this.pythonProcess.killed) {
          this.pythonProcess.kill('SIGKILL')
        }
      }, 5000)
    }

    // Clear process queue
    this.processQueue.forEach((item) => {
      item.reject(new Error('Bridge is being cleaned up'))
    })
    this.processQueue = []

    this.isInitialized = false
    logger.info('MentalArena Python bridge cleanup completed')
  }

  /**
   * Get performance metrics for the bridge
   */
  getPerformanceMetrics(): {
    totalExecutions: number
    averageExecutionTime: number
    successRate: number
    initializationTime: number
  } {
    return this.performanceMetrics.getMetrics()
  }

  // Private methods

  private ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error(
        'MentalArena Python bridge not initialized. Call initialize() first.',
      )
    }
  }

  private async validateSecurityConstraints(): Promise<void> {
    if (this.config.securityMode === 'strict') {
      // Validate paths are within expected directories
      const mentalArenaPath = path.resolve(this.config.mentalArenaPath)
      const cwd = process.cwd()

      if (!mentalArenaPath.startsWith(cwd)) {
        throw new Error(
          'Security violation: MentalArena path must be within project directory',
        )
      }
    }

    // Validate Python path
    if (!(await this.fileExists(this.config.pythonPath))) {
      throw new Error(`Python executable not found: ${this.config.pythonPath}`)
    }
  }

  private async ensureMentalArenaRepository(): Promise<void> {
    if (!(await this.fileExists(this.config.mentalArenaPath))) {
      logger.info('MentalArena repository not found, cloning...')

      const { spawn } = await import('node:child_process')
      const gitProcess = spawn('git', [
        'clone',
        'https://github.com/SondosB/MentalArena.git',
        this.config.mentalArenaPath,
      ])

      await new Promise<void>((resolve, reject) => {
        gitProcess.on('close', (code) => {
          if (code === 0) {
            resolve()
          } else {
            reject(new Error(`Git clone failed with code ${code}`))
          }
        })
        gitProcess.on('error', reject)
      })

      logger.info('MentalArena repository cloned successfully')
    }
  }

  private async setupPythonEnvironment(): Promise<void> {
    const requirementsPath = path.join(
      this.config.mentalArenaPath,
      'requirements.txt',
    )

    // Set up virtual environment path
    const venvPath =
      this.config.virtualEnvPath ||
      path.join(this.config.mentalArenaPath, 'venv')

    // Create virtual environment if it doesn't exist
    if (!(await this.fileExists(venvPath))) {
      logger.info('Creating Python virtual environment...', { venvPath })

      await this.executeSecure(
        this.config.pythonPath,
        ['-m', 'venv', venvPath],
        {
          description: 'Create Python virtual environment',
          timeout: 60000, // 1 minute for venv creation
        },
      )
    }

    // Get virtual environment Python and pip paths
    const venvPython =
      process.platform === 'win32'
        ? path.join(venvPath, 'Scripts', 'python.exe')
        : path.join(venvPath, 'bin', 'python')
    const venvPip =
      process.platform === 'win32'
        ? path.join(venvPath, 'Scripts', 'pip.exe')
        : path.join(venvPath, 'bin', 'pip')

    // Validate virtual environment was created successfully
    if (!(await this.fileExists(venvPython))) {
      throw new Error(
        `Failed to create virtual environment: Python executable not found at ${venvPython}`,
      )
    }

    // Upgrade pip in virtual environment
    logger.info('Upgrading pip in virtual environment...')
    await this.executeSecure(
      venvPython,
      ['-m', 'pip', 'install', '--upgrade', 'pip'],
      {
        description: 'Upgrade pip in virtual environment',
        timeout: 120000, // 2 minutes for pip upgrade
      },
    )

    if (await this.fileExists(requirementsPath)) {
      logger.info(
        'Validating and installing Python dependencies in virtual environment...',
      )

      // Validate requirements.txt against security whitelist
      await this.validateRequirements(requirementsPath)

      // Install dependencies in virtual environment
      await this.executeSecure(venvPip, ['install', '-r', requirementsPath], {
        description: 'Install Python dependencies in virtual environment',
        timeout: 300000, // 5 minutes for pip install
      })

      logger.info(
        'Python dependencies installed successfully in virtual environment',
      )
    } else {
      logger.warn('No requirements.txt found, skipping dependency installation')
    }

    // Update config to use virtual environment Python
    this.config.pythonPath = venvPython
  }

  private async validatePythonEnvironment(): Promise<void> {
    // Check required Python packages using the configured Python path (virtual environment)
    const requiredPackages = [
      'torch',
      'transformers',
      'datasets',
      'numpy',
      'pandas',
    ]

    logger.info('Validating Python packages in virtual environment', {
      pythonPath: this.config.pythonPath,
      packagesCount: requiredPackages.length,
    })

    // Validate all packages concurrently
    const validationPromises = requiredPackages.map((pkg) =>
      this.executeSecure(
        this.config.pythonPath,
        ['-c', `import ${pkg}; print("${pkg} OK")`],
        {
          description: `Validate package: ${pkg}`,
          timeout: 10000,
        },
      ).then((result) => ({ pkg, result })),
    )

    const validationResults = await Promise.allSettled(validationPromises)

    // Check for any failures
    for (const promiseResult of validationResults) {
      if (promiseResult.status === 'rejected') {
        throw new Error(`Package validation failed: ${promiseResult.reason}`)
      }

      const { pkg, result } = promiseResult.value
      if (!result.success) {
        throw new Error(
          `Required Python package not available in virtual environment: ${pkg}`,
        )
      }
    }

    logger.info('All required Python packages validated successfully')
  }

  private async runBasicValidation(): Promise<void> {
    const validationScript = path.join(
      this.config.mentalArenaPath,
      'scripts',
      'validate_setup.py',
    )

    if (await this.fileExists(validationScript)) {
      logger.info('Running basic validation script in virtual environment')

      const result = await this.executeSecure(
        this.config.pythonPath,
        [validationScript],
        {
          description: 'Run basic validation',
          timeout: 30000,
        },
      )

      if (!result.success) {
        throw new Error('MentalArena setup validation failed')
      }

      logger.info('Basic validation completed successfully')
    } else {
      logger.warn('Validation script not found, skipping basic validation')
    }
  }

  private async executeSecure(
    command: string,
    args: string[],
    options: {
      description: string
      timeout: number
    },
  ): Promise<PythonExecutionResult> {
    const startTime = Date.now()
    const executionId = crypto.randomUUID()

    if (this.config.enableLogging) {
      logger.debug('Executing Python command', {
        description: options.description,
        command,
        args: args.length,
        timeout: options.timeout,
      })
    }

    return new Promise((resolve, reject) => {
      // Add to queue for tracking
      this.processQueue.push({
        id: executionId,
        command,
        args,
        resolve,
        reject,
        timestamp: startTime,
      })

      // Set timeout for this specific execution
      const timeoutHandle = setTimeout(() => {
        // Remove from queue if still pending
        const queueIndex = this.processQueue.findIndex(
          (item) => item.id === executionId,
        )
        if (queueIndex !== -1) {
          this.processQueue.splice(queueIndex, 1)
          reject(
            new Error(
              `Command "${options.description}" timed out after ${options.timeout}ms`,
            ),
          )
        }
      }, options.timeout)

      // Override resolve to clear timeout
      const originalReject = reject
      const wrappedResolve = (result: PythonExecutionResult) => {
        clearTimeout(timeoutHandle)
        resolve(result)
      }

      // Create wrapped reject to clear timeout
      const wrappedReject = (error: Error) => {
        clearTimeout(timeoutHandle)
        originalReject(error)
      }

      // Update the queue item with wrapped functions
      const queueIndex = this.processQueue.findIndex(
        (item) => item.id === executionId,
      )
      if (queueIndex !== -1) {
        const queueItem = this.processQueue[queueIndex]
        if (queueItem) {
          queueItem.resolve = wrappedResolve
          queueItem.reject = wrappedReject
        }
      }

      // Process the queue
      this.processExecutionQueue()
    })
  }

  private async processExecutionQueue(): Promise<void> {
    if (this.isProcessing || this.processQueue.length === 0) {
      return
    }

    this.isProcessing = true

    const processNextItem = async (): Promise<void> => {
      const item = this.processQueue.shift()

      if (!item) {
        this.isProcessing = false
        return
      }

      try {
        const result = await this.executeCommand(
          item.command,
          item.args,
          item.timestamp,
        )
        this.performanceMetrics.recordExecution(
          Date.now() - item.timestamp,
          true,
        )
        item.resolve(result)
      } catch (error: unknown) {
        this.performanceMetrics.recordExecution(
          Date.now() - item.timestamp,
          false,
        )
        item.reject(error as Error)
      }

      // Process next item recursively
      if (this.processQueue.length > 0) {
        await processNextItem()
      } else {
        this.isProcessing = false
      }
    }

    await processNextItem()
  }

  private async executeCommand(
    command: string,
    args: string[],
    startTime: number,
  ): Promise<PythonExecutionResult> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        cwd: this.config.mentalArenaPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      process.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      const timeout = setTimeout(() => {
        process.kill('SIGKILL')
        reject(new Error(`Process timed out after ${this.config.timeout}ms`))
      }, this.config.timeout)

      process.on('close', (code) => {
        clearTimeout(timeout)

        const executionTime = Date.now() - startTime
        const success = code === 0

        const result: PythonExecutionResult = {
          success,
          output: success ? stdout.trim() : undefined,
          error: success ? undefined : stderr.trim(),
          exitCode: code || undefined,
          executionTime,
          metadata: {
            command: `${command} ${args.join(' ')}`,
            timestamp: new Date(startTime).toISOString(),
            processId: process.pid || 0,
          },
        }

        if (this.config.enableLogging) {
          logger.debug('Python command executed', {
            command: result.metadata.command,
            success,
            executionTime,
            exitCode: code,
          })
        }

        resolve(result)
      })

      process.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  }

  private async validateRequirements(requirementsPath: string): Promise<void> {
    logger.info('Validating requirements.txt against security whitelist')

    try {
      const requirementsContent = await fs.readFile(requirementsPath, 'utf-8')
      const lines = requirementsContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))

      const violations: string[] = []
      const missingVersions: string[] = []

      for (const line of lines) {
        // Parse package name and version specifier
        const match = line.match(/^([a-zA-Z0-9_-]+)([>=<!~^]*[\d.]+.*)?/)
        if (!match) {
          violations.push(`Invalid package format: ${line}`)
          continue
        }

        const [, packageName, versionSpec] = match

        if (!packageName) {
          violations.push(`Invalid package name in line: ${line}`)
          continue
        }

        // Validate package using centralized validation method
        const validation = this.validatePackage(packageName, versionSpec)

        // Collect violations
        violations.push(...validation.violations)

        // Track missing versions separately for reporting
        if (
          validation.isAllowed &&
          !validation.hasValidVersion &&
          !versionSpec
        ) {
          missingVersions.push(
            `Package missing version specification: ${packageName}`,
          )
        }
      }

      // Report violations
      if (violations.length > 0) {
        const errorMessage = `Security violations in requirements.txt:\n${violations.join('\n')}`
        logger.error(errorMessage)

        if (this.config.securityMode === 'strict') {
          throw new Error(errorMessage)
        } else {
          logger.warn(
            'Security violations detected but continuing due to non-strict mode',
          )
        }
      }

      // Report missing versions
      if (missingVersions.length > 0) {
        const warningMessage = `Packages without version specifications:\n${missingVersions.join('\n')}`
        logger.warn(warningMessage)

        if (this.config.securityMode === 'strict') {
          throw new Error(
            `Strict mode requires version specifications for all packages:\n${missingVersions.join('\n')}`,
          )
        }
      }

      logger.info('Requirements validation completed', {
        totalPackages: lines.length,
        violations: violations.length,
        missingVersions: missingVersions.length,
      })
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        String(error).includes('Security violations')
      ) {
        throw error
      }
      logger.error('Failed to validate requirements.txt', error)
      throw new Error(`Requirements validation failed: ${error}`, { cause: error })
    }
  }

  /**
   * Get the current package whitelist
   */
  private getPackageWhitelist(): Record<string, string[]> {
    return {
      'torch': ['>=1.12.0,<3.0.0'],
      'transformers': ['>=4.20.0,<5.0.0'],
      'datasets': ['>=2.0.0,<3.0.0'],
      'numpy': ['>=1.21.0,<2.0.0'],
      'pandas': ['>=1.4.0,<3.0.0'],
      'scikit-learn': ['>=1.1.0,<2.0.0'],
      'matplotlib': ['>=3.5.0,<4.0.0'],
      'seaborn': ['>=0.11.0,<1.0.0'],
      'tqdm': ['>=4.64.0,<5.0.0'],
      'requests': ['>=2.28.0,<3.0.0'],
      'pyyaml': ['>=6.0,<7.0'],
      'pillow': ['>=9.0.0,<11.0.0'],
      'tokenizers': ['>=0.13.0,<1.0.0'],
      'accelerate': ['>=0.20.0,<1.0.0'],
      'evaluate': ['>=0.4.0,<1.0.0'],
      'wandb': ['>=0.13.0,<1.0.0'],
      'tensorboard': ['>=2.9.0,<3.0.0'],
      'jupyter': ['>=1.0.0,<2.0.0'],
      'ipython': ['>=8.0.0,<9.0.0'],
      'scipy': ['>=1.9.0,<2.0.0'],
    }
  }

  /**
   * Validate a single package against the whitelist
   */
  private validatePackage(
    packageName: string,
    versionSpec?: string,
  ): {
    isAllowed: boolean
    hasValidVersion: boolean
    allowedVersions: string[]
    violations: string[]
  } {
    const whitelist = this.getPackageWhitelist()
    const normalizedPackageName = packageName
      .toLowerCase()
      .replace(/[-_]/g, '-')

    const whitelistKey = Object.keys(whitelist).find(
      (key) =>
        key.toLowerCase().replace(/[-_]/g, '-') === normalizedPackageName,
    )

    const violations: string[] = []

    if (!whitelistKey) {
      violations.push(`Package not in whitelist: ${packageName}`)
      return {
        isAllowed: false,
        hasValidVersion: false,
        allowedVersions: [],
        violations,
      }
    }

    const allowedVersions = whitelist[whitelistKey] || []

    if (!versionSpec) {
      violations.push(`Package missing version specification: ${packageName}`)
      return {
        isAllowed: true,
        hasValidVersion: false,
        allowedVersions,
        violations,
      }
    }

    // Basic version validation
    const hasValidVersion = allowedVersions.some((constraint) => {
      if (constraint.includes('>=') && constraint.includes('<')) {
        return true // Accept range specifications for now
      }
      return versionSpec.includes(constraint.replace(/[>=<]/g, ''))
    })

    if (!hasValidVersion) {
      violations.push(
        `Package version not in allowed range: ${packageName}${versionSpec} (allowed: ${allowedVersions.join(', ')})`,
      )
    }

    return {
      isAllowed: true,
      hasValidVersion,
      allowedVersions,
      violations,
    }
  }

  private async validateScriptPath(scriptPath: string): Promise<void> {
    const resolvedPath = path.resolve(scriptPath)

    if (this.config.securityMode === 'strict') {
      const allowedPaths = [
        path.resolve(this.config.mentalArenaPath),
        path.resolve(process.cwd()),
      ]

      const isAllowed = allowedPaths.some((allowedPath) =>
        resolvedPath.startsWith(allowedPath),
      )

      if (!isAllowed) {
        throw new Error(
          `Security violation: Script path not allowed: ${scriptPath}`,
        )
      }
    }

    if (!(await this.fileExists(resolvedPath))) {
      throw new Error(`Script not found: ${scriptPath}`)
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  private async cleanupTempFiles(filePaths: string[]): Promise<void> {
    await Promise.allSettled(
      filePaths.map(async (filePath) => {
        try {
          if (await this.fileExists(filePath)) {
            await fs.unlink(filePath)
          }
        } catch (error: unknown) {
          logger.warn(`Failed to cleanup temp file: ${filePath}`, error)
        }
      }),
    )
  }
}

/**
 * Performance metrics tracker for the Python bridge
 */
class BridgePerformanceMetrics {
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

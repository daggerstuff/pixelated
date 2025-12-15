/**
 * Outlier AI Task Orchestrator
 * 
 * Main orchestrator for automating Outlier AI tasks using Browser Use MCP
 */

import type { OutlierTask, TaskExecutionResult, OutlierConfig } from './types'
import { TaskMonitor } from './TaskMonitor'
import { TaskExecutor } from './TaskExecutor'
import { BrowserManager } from './BrowserManager'
import { QualityController } from './QualityController'

export class OutlierOrchestrator {
  private config: OutlierConfig
  private monitor: TaskMonitor
  private executor: TaskExecutor
  private browserManager: BrowserManager
  private qualityController: QualityController
  private isRunning = false
  private activeTasks = new Map<string, OutlierTask>()
  private completedTasks: TaskExecutionResult[] = []

  constructor(config: OutlierConfig) {
    this.config = config
    this.monitor = new TaskMonitor(config)
    this.executor = new TaskExecutor(config)
    this.browserManager = new BrowserManager()
    this.qualityController = new QualityController(config.qualityThreshold)
  }

  /**
   * Initialize and start the orchestrator
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Orchestrator is already running')
    }

    console.log('🚀 Starting Outlier AI Orchestrator...')

    // Initialize browser session
    await this.browserManager.initialize()

    // Login to Outlier AI
    await this.login()

    // Start monitoring for tasks
    this.isRunning = true
    await this.startMonitoring()

    console.log('✅ Orchestrator started successfully')
  }

  /**
   * Stop the orchestrator
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping orchestrator...')
    this.isRunning = false
    await this.browserManager.cleanup()
    console.log('✅ Orchestrator stopped')
  }

  /**
   * Login to Outlier AI platform
   */
  private async login(): Promise<void> {
    console.log('🔐 Logging into Outlier AI...')

    const session = await this.browserManager.getSession()
    if (!session.pageId) {
      throw new Error('Browser session not initialized')
    }

    // Navigate to login page
    await this.browserManager.navigate(this.config.loginUrl)

    // Wait for page to load
    await this.browserManager.waitForPageLoad()

    // Fill login form
    await this.browserManager.fillForm({
      username: this.config.username,
      password: this.config.password,
    })

    // Submit and wait for dashboard
    await this.browserManager.submitForm()
    await this.browserManager.waitForNavigation(this.config.dashboardUrl)

    console.log('✅ Successfully logged in')
  }

  /**
   * Start monitoring for available tasks
   */
  private async startMonitoring(): Promise<void> {
    const monitorLoop = async () => {
      while (this.isRunning) {
        try {
          // Check for available tasks
          const availableTasks = await this.monitor.findAvailableTasks(
            this.browserManager
          )

          // Process new tasks
          for (const task of availableTasks) {
            if (this.activeTasks.size < this.config.maxConcurrentTasks) {
              await this.processTask(task)
            }
          }

          // Check status of active tasks
          await this.checkActiveTasks()

          // Wait before next check
          await this.sleep(this.config.checkInterval)
        } catch (error) {
          console.error('❌ Error in monitoring loop:', error)
          await this.sleep(5000) // Wait 5 seconds on error
        }
      }
    }

    monitorLoop()
  }

  /**
   * Process a new task
   */
  private async processTask(task: OutlierTask): Promise<void> {
    if (this.activeTasks.has(task.id)) {
      return
    }

    this.activeTasks.set(task.id, task)
    console.log(`📋 Processing task: ${task.title} (${task.type})`)

    // Execute task asynchronously
    this.executeTask(task).catch((error) => {
      console.error(`❌ Task ${task.id} failed:`, error)
      this.activeTasks.delete(task.id)
    })
  }

  /**
   * Execute a task
   */
  private async executeTask(task: OutlierTask): Promise<void> {
    const startTime = Date.now()
    const session = await this.browserManager.getSession()

    try {
      // Navigate to task
      await this.browserManager.navigate(task.url)
      await this.browserManager.waitForPageLoad()

      // Quality check before execution
      const qualityCheck = await this.qualityController.validateTask(task)
      if (!qualityCheck.passed) {
        throw new Error(`Quality check failed: ${qualityCheck.reason}`)
      }

      // Execute task using appropriate agent
      const result = await this.executor.execute(task, session)

      // Quality check after execution
      const finalCheck = await this.qualityController.validateResult(
        task,
        result
      )
      if (!finalCheck.passed) {
        throw new Error(`Final quality check failed: ${finalCheck.reason}`)
      }

      // Submit task
      if (result.success && !result.submitted) {
        await this.executor.submit(task, session)
        result.submitted = true
      }

      const executionTime = Date.now() - startTime
      result.executionTime = executionTime

      this.completedTasks.push(result)
      this.activeTasks.delete(task.id)

      console.log(
        `✅ Task ${task.id} completed in ${executionTime}ms - Submitted: ${result.submitted}`
      )
    } catch (error) {
      const result: TaskExecutionResult = {
        taskId: task.id,
        success: false,
        submitted: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      }

      this.completedTasks.push(result)
      this.activeTasks.delete(task.id)

      throw error
    }
  }

  /**
   * Check status of active tasks
   */
  private async checkActiveTasks(): Promise<void> {
    for (const [taskId, _task] of this.activeTasks.entries()) {
      try {
        const status = await this.monitor.checkTaskStatus(
          taskId,
          this.browserManager
        )

        if (status === 'completed' || status === 'submitted') {
          this.activeTasks.delete(taskId)
          console.log(`✅ Task ${taskId} marked as ${status}`)
        }
      } catch (error) {
        console.error(`❌ Error checking task ${taskId}:`, error)
      }
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      active: this.activeTasks.size,
      completed: this.completedTasks.length,
      successful: this.completedTasks.filter((t) => t.success).length,
      submitted: this.completedTasks.filter((t) => t.submitted).length,
      totalEarnings: this.completedTasks
        .filter((t) => t.submitted)
        .reduce((sum, t) => sum + (t.taskId ? 0 : 0), 0), // TODO: Calculate from tasks
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

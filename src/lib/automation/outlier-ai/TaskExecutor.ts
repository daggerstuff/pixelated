/**
 * Task Executor
 * 
 * Executes different types of Outlier AI tasks
 */

import type {
  OutlierTask,
  TaskExecutionResult,
  OutlierConfig,
  BrowserSession,
  TaskAgent,
} from './types'
import { BrowserManager } from './BrowserManager'
import { PromptDesignAgent } from './agents/PromptDesignAgent'
import { OutputEvaluationAgent } from './agents/OutputEvaluationAgent'
import { ContentModerationAgent } from './agents/ContentModerationAgent'
import { DataLabelingAgent } from './agents/DataLabelingAgent'
import { RankingAgent } from './agents/RankingAgent'
import { RewritingAgent } from './agents/RewritingAgent'
import { FactCheckingAgent } from './agents/FactCheckingAgent'

export class TaskExecutor {
  private config: OutlierConfig
  private agents: TaskAgent[]

  constructor(config: OutlierConfig) {
    this.config = config
    this.agents = [
      new PromptDesignAgent(),
      new OutputEvaluationAgent(),
      new ContentModerationAgent(),
      new DataLabelingAgent(),
      new RankingAgent(),
      new RewritingAgent(),
      new FactCheckingAgent(),
    ]
  }

  /**
   * Execute a task using the appropriate agent
   */
  async execute(
    task: OutlierTask,
    session: BrowserSession
  ): Promise<TaskExecutionResult> {
    console.log(`⚙️ Executing task: ${task.id} (${task.type})`)

    // Find appropriate agent
    const agent = this.agents.find((a) => a.canHandle(task))

    if (!agent) {
      throw new Error(`No agent found for task type: ${task.type}`)
    }

    console.log(`🤖 Using agent: ${agent.name}`)

    // Execute task
    const _browserManager = new BrowserManager()
    return await agent.execute(task, session)
  }

  /**
   * Submit completed task
   */
  async submit(task: OutlierTask, _session: BrowserSession): Promise<void> {
    console.log(`📤 Submitting task: ${task.id}`)

    const _browserManager = new BrowserManager()

    // Navigate to task submission page
    await _browserManager.navigate(task.url)
    await _browserManager.waitForPageLoad()

    // Find and click submit button
    await _browserManager.click('button[type="submit"], .submit-button, [data-action="submit"]')

    // Wait for confirmation
    await _browserManager.waitForElement('.success-message, .confirmation', 10000)

    console.log(`✅ Task ${task.id} submitted successfully`)
  }
}

/**
 * Outlier AI Automation System
 * 
 * Main entry point for Outlier AI task automation
 */

export { OutlierOrchestrator } from './OutlierOrchestrator'
export { BrowserManager } from './BrowserManager'
export { TaskMonitor } from './TaskMonitor'
export { TaskExecutor } from './TaskExecutor'
export { QualityController } from './QualityController'
export type {
  OutlierTask,
  TaskExecutionResult,
  OutlierConfig,
  BrowserSession,
  TaskAgent,
  TaskType,
  TaskStatus,
} from './types'

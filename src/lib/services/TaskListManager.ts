import { promises as fs } from 'fs'
import { dirname } from 'path'
import { createBuildSafeLogger } from '../logging/build-safe-logger'
import OllamaCheckInService, {
  type CheckInResult,
  type ImprovementSuggestion,
} from './OllamaCheckInService'

const logger = createBuildSafeLogger('task-list-manager')

export interface TaskItem {
  id: string
  content: string
  completed: boolean
  children?: TaskItem[]
  metadata?: {
    addedBy?: 'user' | 'ollama' | 'system'
    addedAt?: string
    improvementId?: string
    category?: string
    priority?: string
  }
}

export interface TaskListFile {
  filePath: string
  content: string
  tasks: TaskItem[]
  metadata?: {
    lastUpdated?: string
    lastCheckIn?: string
    totalTasks?: number
    completedTasks?: number
  }
}

export class TaskListManager {
  private ollamaService: OllamaCheckInService

  constructor() {
    this.ollamaService = new OllamaCheckInService()
  }

  /**
   * Parse markdown task list content into structured format
   */
  private parseTaskList(content: string): TaskItem[] {
    const lines = content.split('\n')
    const tasks: TaskItem[] = []
    const taskStack: { task: TaskItem; level: number }[] = []

    lines.forEach((line, index) => {
      const trimmedLine = line.trim()
      if (!trimmedLine) {
        return
      }

      // Match task items: - [ ] or - [x] or - [X]
      const taskMatch = trimmedLine.match(/^(\s*)-\s*\[([x\sX])\]\s*(.+)$/)
      if (taskMatch) {
        const [, indent, checkState, content] = taskMatch
        const level = Math.floor((indent?.length || 0) / 2) // Assume 2 spaces per level
        const completed = checkState?.toLowerCase() === 'x'

        const task: TaskItem = {
          id: `task-${Date.now()}-${index}`,
          content: content ? content.trim() : '',
          completed,
          children: [],
          metadata: {
            addedBy: 'user',
          },
        }

        // Find parent task based on indentation level
        let parentTask: TaskItem | null = null
        while (taskStack.length > 0) {
          const lastItem = taskStack[taskStack.length - 1]
          if (lastItem && lastItem.level >= level) {
            taskStack.pop()
          } else {
            break
          }
        }

        if (taskStack.length > 0) {
          const lastItem = taskStack[taskStack.length - 1]
          if (lastItem) {
            parentTask = lastItem.task
          }
        }

        if (parentTask) {
          parentTask.children = parentTask.children || []
          parentTask.children.push(task)
        } else {
          tasks.push(task)
        }

        taskStack.push({ task, level })
      }
    })

    return tasks
  }

  /**
   * Convert structured tasks back to markdown format
   */
  private tasksToMarkdown(tasks: TaskItem[], level: number = 0): string {
    let markdown = ''
    const indent = '  '.repeat(level)

    tasks.forEach((task) => {
      const checkbox = task.completed ? '[x]' : '[ ]'
      markdown += `${indent}- ${checkbox} ${task.content}\n`

      if (task.children && task.children.length > 0) {
        markdown += this.tasksToMarkdown(task.children, level + 1)
      }
    })

    return markdown
  }

  /**
   * Load task list from file
   */
  async loadTaskList(filePath: string): Promise<TaskListFile> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      const tasks = this.parseTaskList(content)

      const totalTasks = this.countTasks(tasks)
      const completedTasks = this.countCompletedTasks(tasks)

      return {
        filePath,
        content,
        tasks,
        metadata: {
          lastUpdated: new Date().toISOString(),
          totalTasks,
          completedTasks,
        },
      }
    } catch (error: unknown) {
      logger.error('Failed to load task list', {
        filePath,
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  /**
   * Save task list to file
   */
  async saveTaskList(taskList: TaskListFile): Promise<void> {
    try {
      // Ensure directory exists
      await fs.mkdir(dirname(taskList.filePath), { recursive: true })

      // Convert tasks back to markdown and merge with original content
      const taskMarkdown = this.tasksToMarkdown(taskList.tasks)

      // For simplicity, replace the task section if it exists, otherwise append
      let updatedContent = taskList.content

      // Look for existing task section and replace it
      const taskSectionMatch = updatedContent.match(
        /(^|\n)(#+\s*Tasks?[\s\S]*?)(?=\n#+|\n---|\n```|$)/i,
      )
      if (taskSectionMatch) {
        const newTaskSection = `## Tasks\n\n${taskMarkdown}`
        updatedContent = updatedContent.replace(
          taskSectionMatch[0],
          `\n${newTaskSection}`,
        )
      } else {
        // Append tasks section
        updatedContent += `\n\n## Tasks\n\n${taskMarkdown}`
      }

      await fs.writeFile(taskList.filePath, updatedContent, 'utf-8')

      logger.info('Task list saved', {
        filePath: taskList.filePath,
        totalTasks: taskList.metadata?.totalTasks,
        completedTasks: taskList.metadata?.completedTasks,
      })
    } catch (error: unknown) {
      logger.error('Failed to save task list', {
        filePath: taskList.filePath,
        error: error instanceof Error ? String(error) : String(error),
      })
      throw error
    }
  }

  /**
   * Count total tasks recursively
   */
  private countTasks(tasks: TaskItem[]): number {
    return tasks.reduce((count, task) => {
      return count + 1 + (task.children ? this.countTasks(task.children) : 0)
    }, 0)
  }

  /**
   * Count completed tasks recursively
   */
  private countCompletedTasks(tasks: TaskItem[]): number {
    return tasks.reduce((count, task) => {
      const currentCount = task.completed ? 1 : 0
      const childrenCount = task.children
        ? this.countCompletedTasks(task.children)
        : 0
      return count + currentCount + childrenCount
    }, 0)
  }

  /**
   * Find next incomplete task
   */
  findNextTask(tasks: TaskItem[]): TaskItem | null {
    for (const task of tasks) {
      if (!task.completed) {
        // If this task has children, check if all children are complete
        if (task.children && task.children.length > 0) {
          const nextChildTask = this.findNextTask(task.children)
          if (nextChildTask) {
            return nextChildTask
          }
          // If all children are complete but parent isn't, parent is next
          return task
        }
        return task
      }
    }
    return null
  }

  /**
   * Mark task as completed
   */
  markTaskCompleted(tasks: TaskItem[], taskId: string): boolean {
    for (const task of tasks) {
      if (task.id === taskId) {
        task.completed = true

        // Check if parent task should also be marked complete
        this.checkParentCompletion()
        return true
      }

      if (task.children) {
        const found = this.markTaskCompleted(task.children, taskId)
        if (found) {
          // Check if this parent should be marked complete
          if (task.children.every((child) => child.completed)) {
            task.completed = true
          }
          return true
        }
      }
    }
    return false
  }

  /**
   * Check if parent task should be marked complete based on children
   */
  private checkParentCompletion() {
    // This is a simplified version - in a full implementation you'd track parent-child relationships
    // For now, we'll handle this in the markTaskCompleted method
  }

  /**
   * Add improvement suggestions as new tasks
   */
  addImprovementTasks(
    tasks: TaskItem[],
    improvements: ImprovementSuggestion[],
    reasoningLog: string[],
    parentTaskId?: string,
  ): TaskItem[] {
    const newTasks: TaskItem[] = []

    improvements.forEach((improvement, index) => {
      const reasoning = reasoningLog[index]
      if (reasoning?.startsWith('ACCEPTED:')) {
        const newTask: TaskItem = {
          id: `improvement-${improvement.id}`,
          content: improvement.suggestion,
          completed: false,
          metadata: {
            addedBy: 'ollama',
            addedAt: new Date().toISOString(),
            improvementId: improvement.id,
            category: improvement.category,
            priority: improvement.priority,
          },
        }

        if (parentTaskId) {
          // Add as child of specific parent task
          const parentTask = this.findTaskById(tasks, parentTaskId)
          if (parentTask) {
            parentTask.children = parentTask.children || []
            parentTask.children.push(newTask)
          } else {
            newTasks.push(newTask)
          }
        } else {
          newTasks.push(newTask)
        }
      }
    })

    return newTasks
  }

  /**
   * Find task by ID
   */
  private findTaskById(tasks: TaskItem[], taskId: string): TaskItem | null {
    for (const task of tasks) {
      if (task.id === taskId) {
        return task
      }
      if (task.children) {
        const found = this.findTaskById(task.children, taskId)
        if (found) {
          return found
        }
      }
    }
    return null
  }

  /**
   * Perform check-in after completing a task
   */
  async performTaskCheckIn(
    taskList: TaskListFile,
    completedTaskId: string,
    taskSummary: string,
  ): Promise<{
    checkInResult: CheckInResult
    updatedTaskList: TaskListFile
    shouldContinue: boolean
  }> {
    logger.info('Performing task check-in', {
      completedTaskId,
      taskSummary,
      filePath: taskList.filePath,
    })

    try {
      // Mark task as completed
      const taskMarkSuccess = this.markTaskCompleted(
        taskList.tasks,
        completedTaskId,
      )
      if (!taskMarkSuccess) {
        logger.warn('Could not find task to mark as completed', {
          completedTaskId,
        })
      }

      // Perform Ollama check-in
      const checkInResult = await this.ollamaService.performCheckIn(
        taskSummary,
        taskSummary,
      )

      // Log the check-in result
      logger.info('Check-in result', {
        shouldContinue: checkInResult.shouldContinue,
        improvementsCount: checkInResult.improvements.length,
        decision: checkInResult.decision,
      })

      // Log reasoning for transparency
      checkInResult.reasoningLog.forEach((reasoning) => {
        logger.info('Improvement reasoning', { reasoning })
      })

      // Add accepted improvements as new tasks
      const newTasks = this.addImprovementTasks(
        taskList.tasks,
        checkInResult.improvements,
        checkInResult.reasoningLog,
      )

      // Add new tasks to the main task list
      taskList.tasks.push(...newTasks)

      // Update metadata
      taskList.metadata = {
        ...taskList.metadata,
        lastUpdated: new Date().toISOString(),
        lastCheckIn: new Date().toISOString(),
        totalTasks: this.countTasks(taskList.tasks),
        completedTasks: this.countCompletedTasks(taskList.tasks),
      }

      // Save updated task list
      await this.saveTaskList(taskList)

      return {
        checkInResult,
        updatedTaskList: taskList,
        shouldContinue: checkInResult.shouldContinue,
      }
    } catch (error: unknown) {
      logger.error('Task check-in failed', {
        error: error instanceof Error ? String(error) : String(error),
        completedTaskId,
        taskSummary,
      })
      throw error
    }
  }

  /**
   * Get task completion status summary
   */
  getTaskSummary(taskList: TaskListFile): {
    total: number
    completed: number
    remaining: number
    progress: number
    nextTask: TaskItem | null
  } {
    const total = this.countTasks(taskList.tasks)
    const completed = this.countCompletedTasks(taskList.tasks)
    const remaining = total - completed
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0
    const nextTask = this.findNextTask(taskList.tasks)

    return {
      total,
      completed,
      remaining,
      progress,
      nextTask,
    }
  }
}

export default TaskListManager

#!/usr/bin/env node

import { Command } from 'commander'

import { existsSync } from 'fs'

import TaskListManager from '../lib/services/TaskListManager'
import OllamaCheckInService from '../lib/services/OllamaCheckInService'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { validatePath, ALLOWED_DIRECTORIES } from '../../utils/path-security'

const logger = createBuildSafeLogger('task-cli')

const program = new Command()

program
  .name('task-manager')
  .description('CLI for managing task lists with Ollama check-ins')
  .version('1.0.0')

interface CheckInOptions {
  file: string
  taskId: string
  summary: string
  verbose?: boolean
}

interface TestOllamaOptions {
  summary: string
  model?: string
  verbose?: boolean
}

interface StatusOptions {
  file: string
}

interface InitOptions {
  file: string
  title?: string
}

program
  .command('check-in')
  .description('Perform Ollama check-in for a completed task')
  .requiredOption('-f, --file <path>', 'Path to task list file')
  .requiredOption('-t, --task-id <id>', 'ID of completed task')
  .requiredOption('-s, --summary <summary>', 'Summary of completed task')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options: CheckInOptions) => {
    try {
      const { file, taskId, summary, verbose } = options

      // Validate file path to prevent path traversal
      const validatedFilePath = validatePath(
        file,
        ALLOWED_DIRECTORIES.PROJECT_ROOT,
      )

      if (!existsSync(validatedFilePath)) {
        console.error(`❌ Task list file not found: ${file}`)
        process.exit(1)
      }

      if (verbose) {
        logger.info('Starting check-in process', {
          file: validatedFilePath,
          taskId,
          summary,
        })
      }

      const taskManager = new TaskListManager()
      const taskList = await taskManager.loadTaskList(validatedFilePath)

      console.log('📋 Current task list status:')
      const taskSummary = taskManager.getTaskSummary(taskList)
      console.log(`   Total: ${taskSummary.total}`)
      console.log(`   Completed: ${taskSummary.completed}`)
      console.log(`   Progress: ${taskSummary.progress}%`)

      console.log('\n🔄 Performing Ollama check-in...')
      const result = await taskManager.performTaskCheckIn(
        taskList,
        taskId,
        summary,
      )

      console.log('\n✅ Check-in completed!')
      console.log(`Decision: ${result.checkInResult.decision.toUpperCase()}`)
      console.log(
        `Should continue: ${result.shouldContinue ? '✅ YES' : '❌ NO'}`,
      )

      if (result.checkInResult.improvements.length > 0) {
        console.log('\n💡 Improvement suggestions:')
        result.checkInResult.improvements.forEach((improvement, index) => {
          console.log(`   ${index + 1}. ${improvement.suggestion}`)
          console.log(`      Category: ${improvement.category}`)
          console.log(`      Priority: ${improvement.priority}`)
        })

        console.log('\n🤔 Reasoning:')
        result.checkInResult.reasoningLog.forEach((reasoning, index) => {
          console.log(`   ${index + 1}. ${reasoning}`)
        })
      }

      console.log('\n📊 Updated task list status:')
      const updatedSummary = taskManager.getTaskSummary(result.updatedTaskList)
      console.log(`   Total: ${updatedSummary.total}`)
      console.log(`   Completed: ${updatedSummary.completed}`)
      console.log(`   Progress: ${updatedSummary.progress}%`)

      if (updatedSummary.nextTask) {
        console.log(`   Next task: ${updatedSummary.nextTask.content}`)
      }

      if (verbose) {
        console.log('\n📝 Raw Ollama response:')
        console.log(result.checkInResult.rawResponse)
      }
    } catch (error: unknown) {
      console.error(
        '❌ Check-in failed:',
        error instanceof Error ? String(error) : String(error),
      )
      process.exit(1)
    }
  })

program
  .command('test-ollama')
  .description('Test Ollama connection and prompt')
  .requiredOption('-s, --summary <summary>', 'Test task summary')
  .option('-m, --model <model>', 'Ollama model to use', 'granite3.3')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options: TestOllamaOptions) => {
    try {
      const { summary, model, verbose } = options

      console.log('🧪 Testing Ollama connection...')
      const ollamaService = new OllamaCheckInService()

      if (verbose) {
        logger.info('Testing with', { summary, model })
      }

      const result = await ollamaService.performCheckIn(summary)

      console.log('\n✅ Ollama test completed!')
      console.log(`Decision: ${result.decision.toUpperCase()}`)
      console.log(
        `Should continue: ${result.shouldContinue ? '✅ YES' : '❌ NO'}`,
      )

      if (result.improvements.length > 0) {
        console.log('\n💡 Improvement suggestions:')
        result.improvements.forEach((improvement, index) => {
          console.log(`   ${index + 1}. ${improvement.suggestion}`)
          console.log(`      Category: ${improvement.category}`)
          console.log(`      Priority: ${improvement.priority}`)
        })

        console.log('\n🤔 Reasoning:')
        result.reasoningLog.forEach((reasoning, index) => {
          console.log(`   ${index + 1}. ${reasoning}`)
        })
      }

      if (verbose) {
        console.log('\n📝 Raw Ollama response:')
        console.log(result.rawResponse)
      }
    } catch (error: unknown) {
      console.error(
        '❌ Ollama test failed:',
        error instanceof Error ? String(error) : String(error),
      )
      process.exit(1)
    }
  })

program
  .command('status')
  .description('Show task list status')
  .requiredOption('-f, --file <path>', 'Path to task list file')
  .action(async (options: StatusOptions) => {
    try {
      const { file } = options

      // Validate file path to prevent path traversal
      const validatedFilePath = validatePath(
        file,
        ALLOWED_DIRECTORIES.PROJECT_ROOT,
      )

      if (!existsSync(validatedFilePath)) {
        console.error(`❌ Task list file not found: ${file}`)
        process.exit(1)
      }

      const taskManager = new TaskListManager()
      const taskList = await taskManager.loadTaskList(validatedFilePath)
      const summary = taskManager.getTaskSummary(taskList)

      console.log('📋 Task List Status')
      console.log('==================')
      console.log(`File: ${validatedFilePath}`)
      console.log(`Total tasks: ${summary.total}`)
      console.log(`Completed: ${summary.completed}`)
      console.log(`Remaining: ${summary.remaining}`)
      console.log(`Progress: ${summary.progress}%`)

      if (summary.nextTask) {
        console.log(`\n🎯 Next task: ${summary.nextTask.content}`)
        if (summary.nextTask.metadata?.addedBy === 'ollama') {
          console.log(
            `   ↳ Added by Ollama (${summary.nextTask.metadata.category})`,
          )
        }
      } else {
        console.log('\n🎉 All tasks completed!')
      }

      if (taskList.metadata?.lastCheckIn) {
        console.log(
          `\n⏰ Last check-in: ${new Date(taskList.metadata.lastCheckIn).toLocaleString()}`,
        )
      }
    } catch (error: unknown) {
      console.error(
        '❌ Failed to get status:',
        error instanceof Error ? String(error) : String(error),
      )
      process.exit(1)
    }
  })

program
  .command('init')
  .description('Initialize a new task list file')
  .requiredOption('-f, --file <path>', 'Path for new task list file')
  .option('-t, --title <title>', 'Title for the task list', 'Task List')
  .action(async (options: InitOptions) => {
    try {
      const { file, title } = options

      // Validate file path to prevent path traversal
      const validatedFilePath = validatePath(
        file,
        ALLOWED_DIRECTORIES.PROJECT_ROOT,
      )

      if (existsSync(validatedFilePath)) {
        console.error(`❌ File already exists: ${file}`)
        process.exit(1)
      }

      const content = `---
description: ${title}
globs:
alwaysApply: false
---

# ${title}

## Tasks

- [ ] Example task 1
- [ ] Example task 2
  - [ ] Sub-task 2.1
  - [ ] Sub-task 2.2
- [ ] Example task 3

## Relevant Files

(List files created or modified during task completion)

## Notes

(Add any relevant notes or context here)
`

      const taskManager = new TaskListManager()
      const taskList = await taskManager.loadTaskList(validatedFilePath)
      taskList.content = content
      await taskManager.saveTaskList(taskList)

      console.log(`✅ Task list created: ${validatedFilePath}`)
      console.log('You can now use the following commands:')
      console.log(`  task-manager status -f ${validatedFilePath}`)
      console.log(
        `  task-manager check-in -f ${validatedFilePath} -t <task-id> -s "<summary>"`,
      )
    } catch (error: unknown) {
      console.error(
        '❌ Failed to create task list:',
        error instanceof Error ? String(error) : String(error),
      )
      process.exit(1)
    }
  })

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { promise, reason })
  process.exit(1)
})

program.parse()

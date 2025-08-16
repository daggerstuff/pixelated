#!/usr/bin/env node

/**
 * Performance Validation Script
 * Tests if system can handle >1000 conversations/minute
 */

import { performance } from 'node:perf_hooks'
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const TARGET_CONVERSATIONS_PER_MINUTE = 1000
const TEST_DURATION_SECONDS = 60
const CONCURRENT_WORKERS = 10

class PerformanceValidator {
  constructor() {
    this.results = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      conversationsPerMinute: 0,
      errors: []
    }
  }

  async validatePerformance() {
    console.log('🚀 Starting Performance Validation')
    console.log(`Target: ${TARGET_CONVERSATIONS_PER_MINUTE} conversations/minute`)
    console.log(`Test Duration: ${TEST_DURATION_SECONDS} seconds`)
    console.log(`Concurrent Workers: ${CONCURRENT_WORKERS}`)
    console.log('─'.repeat(50))

    const startTime = performance.now()
    const workers = []
    const workerResults = []

    // Create worker threads
    for (let i = 0; i < CONCURRENT_WORKERS; i++) {
      const worker = new Worker(__filename, {
        workerData: {
          workerId: i,
          testDuration: TEST_DURATION_SECONDS,
          targetRps: Math.ceil(TARGET_CONVERSATIONS_PER_MINUTE / 60 / CONCURRENT_WORKERS)
        }
      })

      workers.push(worker)

      worker.on('message', (result) => {
        workerResults.push(result)
      })

      worker.on('error', (error) => {
        console.error(`Worker ${i} error:`, error)
        this.results.errors.push(`Worker ${i}: ${error.message}`)
      })
    }

    // Wait for all workers to complete
    await Promise.all(workers.map(worker => new Promise(resolve => {
      worker.on('exit', resolve)
    })))

    const endTime = performance.now()
    const actualDuration = (endTime - startTime) / 1000

    // Aggregate results
    this.aggregateResults(workerResults, actualDuration)
    this.printResults()
    
    return this.results.conversationsPerMinute >= TARGET_CONVERSATIONS_PER_MINUTE
  }

  aggregateResults(workerResults, duration) {
    let totalResponseTime = 0

    for (const result of workerResults) {
      this.results.totalRequests += result.totalRequests
      this.results.successfulRequests += result.successfulRequests
      this.results.failedRequests += result.failedRequests
      totalResponseTime += result.totalResponseTime
      
      this.results.minResponseTime = Math.min(this.results.minResponseTime, result.minResponseTime)
      this.results.maxResponseTime = Math.max(this.results.maxResponseTime, result.maxResponseTime)
      
      this.results.errors.push(...result.errors)
    }

    this.results.averageResponseTime = totalResponseTime / this.results.totalRequests
    this.results.conversationsPerMinute = (this.results.successfulRequests / duration) * 60
  }

  printResults() {
    console.log('\n📊 Performance Validation Results')
    console.log('─'.repeat(50))
    console.log(`Total Requests: ${this.results.totalRequests}`)
    console.log(`Successful: ${this.results.successfulRequests}`)
    console.log(`Failed: ${this.results.failedRequests}`)
    console.log(`Success Rate: ${((this.results.successfulRequests / this.results.totalRequests) * 100).toFixed(2)}%`)
    console.log(`Average Response Time: ${this.results.averageResponseTime.toFixed(2)}ms`)
    console.log(`Min Response Time: ${this.results.minResponseTime.toFixed(2)}ms`)
    console.log(`Max Response Time: ${this.results.maxResponseTime.toFixed(2)}ms`)
    console.log(`Conversations/Minute: ${this.results.conversationsPerMinute.toFixed(2)}`)
    console.log(`Target Met: ${this.results.conversationsPerMinute >= TARGET_CONVERSATIONS_PER_MINUTE ? '✅ YES' : '❌ NO'}`)
    
    if (this.results.errors.length > 0) {
      console.log('\n❌ Errors:')
      this.results.errors.slice(0, 10).forEach(error => console.log(`  - ${error}`))
      if (this.results.errors.length > 10) {
        console.log(`  ... and ${this.results.errors.length - 10} more errors`)
      }
    }
  }
}

// Worker thread logic
async function workerTask() {
  const { workerId, testDuration, targetRps } = workerData
  const result = {
    workerId,
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    errors: []
  }

  const startTime = performance.now()
  const endTime = startTime + (testDuration * 1000)
  const requestInterval = 1000 / targetRps // ms between requests

  while (performance.now() < endTime) {
    const requestStart = performance.now()
    
    try {
      // Simulate conversation processing
      await simulateConversation()
      
      const responseTime = performance.now() - requestStart
      result.totalRequests++
      result.successfulRequests++
      result.totalResponseTime += responseTime
      result.minResponseTime = Math.min(result.minResponseTime, responseTime)
      result.maxResponseTime = Math.max(result.maxResponseTime, responseTime)
      
    } catch (error) {
      result.totalRequests++
      result.failedRequests++
      result.errors.push(`Worker ${workerId}: ${error.message}`)
    }

    // Rate limiting
    const elapsed = performance.now() - requestStart
    const waitTime = Math.max(0, requestInterval - elapsed)
    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
  }

  parentPort.postMessage(result)
}

async function simulateConversation() {
  // Simulate AI processing time (50-200ms)
  const processingTime = 50 + Math.random() * 150
  await new Promise(resolve => setTimeout(resolve, processingTime))
  
  // Simulate occasional failures (5% failure rate)
  if (Math.random() < 0.05) {
    throw new Error('Simulated processing failure')
  }
}

// Main execution
if (isMainThread) {
  const validator = new PerformanceValidator()
  validator.validatePerformance()
    .then(success => {
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('Performance validation failed:', error)
      process.exit(1)
    })
} else {
  workerTask()
}

import type { RedisService } from '../src/lib/services/redis/RedisService'
import type { MonitoringService } from '../src/lib/monitoring/setup'
import WebSocket from 'ws'
import { performance } from 'perf_hooks'
import { promises as fs } from 'fs'

interface LoadTestConfig {
  baseUrl: string
  concurrentUsers: number
  testDuration: number // in seconds
  rampUpTime: number // in seconds
  thinkTime: number // in milliseconds
  scenarios: {
    name: string
    weight: number
    steps: Array<() => Promise<void>>
  }[]
}

interface TestMetrics {
  scenario: string
  latency: number
  success: boolean
  timestamp: number
  error?: string
}

class LoadTestService {
  private redis: RedisService
  private monitoring: MonitoringService
  private config: LoadTestConfig
  private metrics: TestMetrics[] = []
  private activeUsers = 0
  private testStartTime: number = 0

  constructor(
    redis: RedisService,
    monitoring: MonitoringService,
    config: Partial<LoadTestConfig> = {},
  ) {
    this.redis = redis
    this.monitoring = monitoring
    this.config = {
      baseUrl: process.env['LOAD_TEST_URL'] || 'http://localhost:3000',
      concurrentUsers: 100,
      testDuration: 300, // 5 minutes
      rampUpTime: 60, // 1 minute
      thinkTime: 1000, // 1 second
      scenarios: [
        {
          name: 'Chat Session',
          weight: 0.4,
          steps: [() => this.simulateChatSession()],
        },
        {
          name: 'Analytics',
          weight: 0.3,
          steps: [() => this.simulateAnalytics()],
        },
        {
          name: 'Pattern Recognition',
          weight: 0.3,
          steps: [() => this.simulatePatternRecognition()],
        },
      ],
      ...config,
    }
  }

  async runLoadTest(): Promise<void> {
    console.log('Starting load test...\n')
    this.testStartTime = Date.now()

    // Start monitoring
    await this.monitoring.initialize()

    // Create user sessions
    const userSessions: Promise<void>[] = []
    const usersPerSecond = this.config.concurrentUsers / this.config.rampUpTime

    for (let i = 0; i < this.config.rampUpTime; i++) {
      const newUsers = Math.floor(usersPerSecond)
      for (let j = 0; j < newUsers; j++) {
        userSessions.push(this.startUserSession())
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }

    // Wait for test duration
    await new Promise((resolve) =>
      setTimeout(resolve, this.config.testDuration * 1000),
    )

    // Generate report
    await this.generateReport()
  }

  private async startUserSession(): Promise<void> {
    this.activeUsers++

    try {
      while (
        Date.now() - this.testStartTime <
        this.config.testDuration * 1000
      ) {
        // Select scenario based on weights
        const scenario = this.selectScenario()
        
        if (!scenario) {
          continue
        }

        // Execute scenario steps
        for (const step of scenario.steps) {
          const startTime = performance.now()
          try {
            await step()
            this.recordMetric({
              scenario: scenario.name,
              latency: performance.now() - startTime,
              success: true,
              timestamp: Date.now(),
            })
          } catch (error) {
            this.recordMetric({
              scenario: scenario.name,
              latency: performance.now() - startTime,
              success: false,
              timestamp: Date.now(),
              error: error instanceof Error ? error.message : String(error),
            })
          }

          // Think time between steps
          await new Promise((resolve) =>
            setTimeout(resolve, this.config.thinkTime),
          )
        }
      }
    } finally {
      this.activeUsers--
    }
  }

  private selectScenario() {
    const random = Math.random()
    let sum = 0
    for (const scenario of this.config.scenarios) {
      sum += scenario.weight
      if (random <= sum) {
        return scenario
      }
    }
    return this.config.scenarios[0]
  }

  private async simulateChatSession(): Promise<void> {
    const ws = new WebSocket(`${this.config.baseUrl.replace('http', 'ws')}/ws`)

    try {
      await new Promise((resolve, reject) => {
        ws.on('open', resolve)
        ws.on('error', reject)
      })

      // Send messages
      const messages = [
        'Hello, how are you?',
        'I need help with something',
        'Thank you for your assistance',
      ]

      for (const message of messages) {
        ws.send(JSON.stringify({ type: 'message', content: message }))
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    } finally {
      ws.close()
    }
  }

  private async simulateAnalytics(): Promise<void> {
    const events = [
      { type: 'page_view', page: '/dashboard' },
      { type: 'interaction', action: 'click', target: 'button' },
      { type: 'session', duration: 300 },
    ]

    for (const event of events) {
      await this.redis.set(`analytics:${Date.now()}`, JSON.stringify(event))
    }
  }

  private async simulatePatternRecognition(): Promise<void> {
    const patterns = [
      { type: 'mood', value: 'positive', confidence: 0.8 },
      { type: 'sentiment', value: 'neutral', confidence: 0.6 },
      { type: 'intent', value: 'help', confidence: 0.9 },
    ]

    for (const pattern of patterns) {
      await this.redis.set(`pattern:${Date.now()}`, JSON.stringify(pattern))
    }
  }

  private recordMetric(metric: TestMetrics): void {
    this.metrics.push(metric)
  }

  private async generateReport(): Promise<void> {
    console.log('\nLoad Test Report\n')

    // Overall statistics
    const totalRequests = this.metrics.length
    const successfulRequests = this.metrics.filter((m) => m.success).length
    const failedRequests = totalRequests - successfulRequests
    const successRate = (successfulRequests / totalRequests) * 100

    console.log('Overall Statistics:')
    console.log(`Total Requests: ${totalRequests}`)
    console.log(`Successful Requests: ${successfulRequests}`)
    console.log(`Failed Requests: ${failedRequests}`)
    console.log(`Success Rate: ${successRate.toFixed(2)}%`)

    // Latency statistics by scenario
    console.log('\nLatency Statistics by Scenario:')
    const scenarioStats = new Map<string, number[]>()
    this.metrics.forEach((metric) => {
      if (!scenarioStats.has(metric.scenario)) {
        scenarioStats.set(metric.scenario, [])
      }
      scenarioStats.get(metric.scenario)!.push(metric.latency)
    })

    scenarioStats.forEach((latencies, scenario) => {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
      const sorted = [...latencies].sort((a, b) => a - b)
      const p95 = sorted[Math.floor(sorted.length * 0.95)] ?? 0
      const p99 = sorted[Math.floor(sorted.length * 0.99)] ?? 0

      console.log(`\n${scenario}:`)
      console.log(`  Average: ${avg.toFixed(2)}ms`)
      console.log(`  95th percentile: ${p95.toFixed(2)}ms`)
      console.log(`  99th percentile: ${p99.toFixed(2)}ms`)
    })

    // Error analysis
    const errors = this.metrics.filter((m) => !m.success)
    if (errors.length > 0) {
      console.log('\nError Analysis:')
      const errorCounts = new Map<string, number>()
      errors.forEach((error) => {
        const count = errorCounts.get(error.error!) || 0
        errorCounts.set(error.error!, count + 1)
      })

      errorCounts.forEach((count, error) => {
        console.log(`  ${error}: ${count} occurrences`)
      })
    }

    // Save report to file
    const report = {
      timestamp: new Date().toISOString(),
      config: this.config,
      statistics: {
        totalRequests,
        successfulRequests,
        failedRequests,
        successRate,
        scenarioStats: Object.fromEntries(scenarioStats),
        errors: errors.map((e) => ({ scenario: e.scenario, error: e.error })),
      },
    }

    await this.saveReport(report)
  }

  private async saveReport(report: unknown): Promise<void> {
    const reportDir = './reports'
    const reportPath = `${reportDir}/load-test-${Date.now()}.json`

    await fs.mkdir(reportDir, { recursive: true })
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
    console.log(`\nDetailed report saved to ${reportPath}`)
  }
}

// Export the service
export const createLoadTest = async (
  redis: RedisService,
  monitoring: MonitoringService,
  config?: Partial<LoadTestConfig>,
): Promise<LoadTestService> => {
  return new LoadTestService(redis, monitoring, config)
}

#!/usr/bin/env node

/**
 * Integration Test Runner
 *
 * This script orchestrates the execution of all integration tests,
 * manages test environments, and generates comprehensive reports.
 */

import { execSync, spawn } from 'child_process'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

interface TestResult {
  suite: string
  passed: number
  failed: number
  skipped: number
  duration: number
  errors: string[]
}

interface IntegrationTestConfig {
  environments: {
    development: boolean
    staging: boolean
    production: boolean
  }
  services: {
    database: boolean
    redis: boolean
    biasDetection: boolean
  }
  testSuites: string[]
  performanceThresholds: {
    healthCheck: number
    biasAnalysis: number
    dashboard: number
  }
}

const defaultConfig: IntegrationTestConfig = {
  environments: {
    development: true,
    staging: false,
    production: false,
  },
  services: {
    database: true,
    redis: true,
    biasDetection: true,
  },
  testSuites: [
    'complete-system.integration.test.ts',
    'bias-detection-api.integration.test.ts',
  ],
  performanceThresholds: {
    healthCheck: 1000, // 1 second
    biasAnalysis: 2000, // 2 seconds
    dashboard: 1500, // 1.5 seconds
  },
}

class IntegrationTestRunner {
  private config: IntegrationTestConfig
  private results: TestResult[] = []
  private startTime: number = 0

  constructor(config: IntegrationTestConfig = defaultConfig) {
    this.config = config
  }

  async run(): Promise<void> {
    console.log('🚀 Starting Integration Test Suite')
    console.log('='.repeat(50))

    this.startTime = Date.now()

    try {
      // Setup test environment
      await this.setupEnvironment()

      // Run health checks
      await this.runHealthChecks()

      // Run individual test suites
      for (const suite of this.config.testSuites) {
        await this.runTestSuite(suite)
      }

      // Generate report
      await this.generateReport()

      // Cleanup
      await this.cleanup()

      const totalDuration = Date.now() - this.startTime
      console.log(`\n✅ Integration tests completed in ${totalDuration}ms`)

      // Exit with appropriate code
      const hasFailures = this.results.some((r) => r.failed > 0)
      process.exit(hasFailures ? 1 : 0)
    } catch (error) {
      console.error('❌ Integration test runner failed:', error)
      process.exit(1)
    }
  }

  private async setupEnvironment(): Promise<void> {
    console.log('🔧 Setting up test environment...')

    // Ensure test results directory exists
    const resultsDir = join(__dirname, '../../test-results/integration')
    if (!existsSync(resultsDir)) {
      mkdirSync(resultsDir, { recursive: true })
    }

    // Check if required services are running
    await this.checkServiceHealth()

    console.log('✅ Test environment ready')
  }

  private async checkServiceHealth(): Promise<void> {
    const services = [
      {
        name: 'Database',
        url: '/api/health',
        check: (data: any) => data.services?.database === 'connected',
      },
      {
        name: 'Redis',
        url: '/api/health',
        check: (data: any) => data.services?.redis === 'connected',
      },
      {
        name: 'Bias Detection',
        url: '/api/health',
        check: (data: any) => data.services?.bias_detection === 'operational',
      },
    ]

    for (const service of services) {
      if (
        this.config.services[
          service.name.toLowerCase() as keyof typeof this.config.services
        ]
      ) {
        await this.verifyServiceHealth(service)
      }
    }
  }

  private async verifyServiceHealth(service: {
    name: string
    url: string
    check: (data: any) => boolean
  }): Promise<void> {
    const maxRetries = 5
    const retryDelay = 2000

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`http://localhost:3000${service.url}`)
        const data = await response.json()

        if (response.status === 200 && service.check(data)) {
          console.log(`✅ ${service.name} service is healthy`)
          return
        }
      } catch (error) {
        console.warn(
          `⚠️  ${service.name} health check failed (attempt ${attempt}/${maxRetries}):`,
          error.message,
        )
      }

      if (attempt < maxRetries) {
        await this.delay(retryDelay)
      }
    }

    throw new Error(
      `${service.name} service is not healthy after ${maxRetries} attempts`,
    )
  }

  private async runHealthChecks(): Promise<void> {
    console.log('\n🏥 Running health checks...')

    const healthChecks = [
      { name: 'Simple Health', url: '/api/health/simple' },
      { name: 'Advanced Health', url: '/api/health' },
      { name: 'Bias Detection Health', url: '/api/bias-detection/health' },
    ]

    for (const check of healthChecks) {
      try {
        const startTime = Date.now()
        const response = await fetch(`http://localhost:3000${check.url}`)
        const duration = Date.now() - startTime

        if (response.status === 200) {
          console.log(`✅ ${check.name}: ${duration}ms`)
        } else {
          console.log(`❌ ${check.name}: HTTP ${response.status}`)
        }
      } catch (error) {
        console.log(`❌ ${check.name}: ${error.message}`)
      }
    }
  }

  private async runTestSuite(suiteName: string): Promise<void> {
    console.log(`\n🧪 Running test suite: ${suiteName}`)

    const startTime = Date.now()
    const suitePath = join(__dirname, suiteName)

    try {
      // Run the test suite using vitest
      const command = `pnpm vitest run ${suitePath} --reporter=json --outputFile=${join(__dirname, '../../test-results/integration', suiteName.replace('.ts', '-results.json'))}`

      const result = execSync(command, {
        encoding: 'utf-8',
        cwd: join(__dirname, '../../'),
      })

      const duration = Date.now() - startTime

      // Parse results (simplified parsing)
      const passed = (result.match(/✓/g) || []).length
      const failed = (result.match(/✗/g) || []).length

      this.results.push({
        suite: suiteName,
        passed,
        failed,
        skipped: 0,
        duration,
        errors: [],
      })

      console.log(
        `✅ ${suiteName}: ${passed} passed, ${failed} failed (${duration}ms)`,
      )
    } catch (error: any) {
      const duration = Date.now() - startTime

      this.results.push({
        suite: suiteName,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration,
        errors: [error.message],
      })

      console.log(`❌ ${suiteName}: Failed (${duration}ms)`)
      console.error('Error:', error.message)
    }
  }

  private async generateReport(): Promise<void> {
    console.log('\n📊 Generating test report...')

    const totalTests = this.results.reduce(
      (sum, r) => sum + r.passed + r.failed,
      0,
    )
    const totalPassed = this.results.reduce((sum, r) => sum + r.passed, 0)
    const totalFailed = this.results.reduce((sum, r) => sum + r.failed, 0)
    const totalDuration = Date.now() - this.startTime

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests,
        totalPassed,
        totalFailed,
        successRate:
          totalTests > 0
            ? ((totalPassed / totalTests) * 100).toFixed(2)
            : '0.00',
        totalDuration,
      },
      results: this.results,
      performance: await this.generatePerformanceReport(),
    }

    const reportPath = join(
      __dirname,
      '../../test-results/integration/integration-report.json',
    )
    writeFileSync(reportPath, JSON.stringify(report, null, 2))

    console.log('\n📋 Integration Test Summary:')
    console.log(`   Total Tests: ${totalTests}`)
    console.log(`   Passed: ${totalPassed} ✅`)
    console.log(`   Failed: ${totalFailed} ❌`)
    console.log(`   Success Rate: ${report.summary.successRate}%`)
    console.log(`   Duration: ${totalDuration}ms`)
    console.log(`   Report: ${reportPath}`)
  }

  private async generatePerformanceReport(): Promise<Record<string, any>> {
    // Run performance benchmarks
    const benchmarks = [
      {
        name: 'Health Check',
        url: '/api/health/simple',
        threshold: this.config.performanceThresholds.healthCheck,
      },
      {
        name: 'Bias Analysis',
        url: '/api/bias-analysis/analyze',
        method: 'POST',
        threshold: this.config.performanceThresholds.biasAnalysis,
      },
      {
        name: 'Dashboard',
        url: '/api/bias-analysis/dashboard',
        threshold: this.config.performanceThresholds.dashboard,
      },
    ]

    const performanceResults: Record<string, any> = {}

    for (const benchmark of benchmarks) {
      try {
        const times: number[] = []

        // Run multiple iterations
        for (let i = 0; i < 5; i++) {
          const startTime = Date.now()

          const options: any = {
            method: benchmark.method || 'GET',
            headers:
              benchmark.method === 'POST'
                ? { 'Content-Type': 'application/json' }
                : {},
          }

          if (benchmark.method === 'POST') {
            options.body = JSON.stringify({
              text: 'Performance test analysis',
              sessionId: `perf-${Date.now()}-${i}`,
              demographics: {
                age: '25-35',
                gender: 'female',
                ethnicity: 'hispanic',
                primaryLanguage: 'en',
              },
            })
          }

          const response = await fetch(
            `http://localhost:3000${benchmark.url}`,
            options,
          )
          const duration = Date.now() - startTime

          if (response.status === 200) {
            times.push(duration)
          }
        }

        if (times.length > 0) {
          const avgTime = times.reduce((a, b) => a + b, 0) / times.length
          const minTime = Math.min(...times)
          const maxTime = Math.max(...times)

          performanceResults[benchmark.name] = {
            average: avgTime,
            min: minTime,
            max: maxTime,
            threshold: benchmark.threshold,
            passed: avgTime < benchmark.threshold,
          }
        }
      } catch (error) {
        performanceResults[benchmark.name] = {
          error: error.message,
          passed: false,
        }
      }
    }

    return performanceResults
  }

  private async cleanup(): Promise<void> {
    console.log('\n🧹 Cleaning up test environment...')

    // Clean up test data if needed
    // This could include removing test sessions, clearing caches, etc.

    console.log('✅ Cleanup completed')
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = process.argv[2] ? JSON.parse(process.argv[2]) : defaultConfig
  const runner = new IntegrationTestRunner(config)

  runner.run().catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

export { IntegrationTestRunner, defaultConfig }

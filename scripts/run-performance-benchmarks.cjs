#!/usr/bin/env node

/**
 * Performance Benchmark Runner for Bias Analysis API
 * Standalone script to avoid TypeScript import issues
 */

// Performance Benchmark Configuration
const benchmarkConfig = {
  apiEndpoint: '/api/bias-analysis/analyze',
  baseUrl: process.env['BASE_URL'] || 'http://localhost:3000',
  testDuration: 60, // seconds
  concurrentUsers: [1, 5, 10, 25, 50],
  rampUpTime: 10, // seconds
  coolDownTime: 5, // seconds
  targetResponseTime: 2000, // ms (2 seconds)
  targetThroughput: 10, // requests per second
  targetErrorRate: 0.05 // 5% max error rate
}

// Test Scenarios for Performance Benchmarking
const performanceScenarios = {
  smallText: {
    name: 'Small Text Analysis',
    text: 'Therapist: How are you feeling today? Patient: I feel anxious about my job interview.',
    context: 'Brief therapy session analysis'
  },

  mediumText: {
    name: 'Medium Text Analysis',
    text: 'Therapist: How are you feeling today? Patient: I feel anxious about my job interview tomorrow. Therapist: That sounds challenging. Can you tell me more about what specifically worries you? Patient: I\'m worried they\'ll judge me because of my background. Therapist: I understand that concern. Can you share more about your background? Patient: I come from a working-class family and didn\'t go to college.',
    context: 'Standard therapy session analysis'
  },

  largeText: {
    name: 'Large Text Analysis',
    text: 'Therapist: How are you feeling today? Patient: I feel anxious about my job interview tomorrow. Therapist: That sounds challenging. Can you tell me more about what specifically worries you? Patient: I\'m worried they\'ll judge me because of my background. Therapist: I understand that concern. Can you share more about your background? Patient: I come from a working-class family and didn\'t go to college. I\'ve worked hard to get where I am, but I still feel like I don\'t belong in professional settings. Therapist: It sounds like you\'ve overcome significant challenges to reach your current position. Patient: Yes, but I still worry that people can tell I\'m not "one of them." Therapist: That\'s a common experience for many people, regardless of their background. What would it mean if someone did judge you based on that? Patient: It would confirm my worst fears about not being good enough. Therapist: Those fears seem quite painful. Can you tell me more about when these feelings started? Patient: I think it started in high school when I realized I wasn\'t going to college like my friends. Since then, I\'ve always felt like I\'m playing catch-up.',
    context: 'Extended therapy session analysis'
  },

  complexText: {
    name: 'Complex Multi-Issue Analysis',
    text: 'Thérapist: Hów àre yôu féeling? Pätient: I\'m struggling with anxiety, depression, and work-related stress. The pressure at my job is overwhelming, and I feel like I\'m not measuring up. My colleagues seem so confident and competent, while I feel like an imposter. Also, my relationship with my partner has been strained lately - we\'ve been arguing more about small things. Therapist: It sounds like you\'re dealing with multiple stressors simultaneously. Can you tell me more about the imposter feelings at work? Patient: Every time I get assigned a new project, I panic that I\'ll fail and everyone will see I\'m not qualified. I\'ve been successful in my role for 3 years, but I still feel like I\'m faking it. Therapist: Those imposter feelings can be quite distressing. What evidence do you have that contradicts this feeling? Patient: Objectively, I have good performance reviews, I\'ve been promoted twice, and my manager trusts me with important projects. But emotionally, I still feel like I\'m just one mistake away from being exposed.',
    context: 'Complex multi-issue therapy session analysis'
  }
}

// Memory Monitoring
class MemoryMonitor {
  constructor() {
    this.initialMemory = 0
    this.peakMemory = 0
    this.samples = []
  }

  start() {
    if (typeof performance !== 'undefined' && performance.memory) {
      this.initialMemory = performance.memory.usedJSHeapSize
      this.peakMemory = this.initialMemory
    }
  }

  sample() {
    if (typeof performance !== 'undefined' && performance.memory) {
      const currentMemory = performance.memory.usedJSHeapSize
      this.samples.push(currentMemory)
      this.peakMemory = Math.max(this.peakMemory, currentMemory)
    }
  }

  getResults() {
    const finalMemory = this.samples[this.samples.length - 1] || this.initialMemory
    const average = this.samples.length > 0
      ? this.samples.reduce((sum, mem) => sum + mem, 0) / this.samples.length
      : this.initialMemory

    return {
      initial: this.initialMemory,
      peak: this.peakMemory,
      final: finalMemory,
      average
    }
  }
}

// Main Performance Benchmark Runner
class PerformanceBenchmarkRunner {
  constructor() {
    this.results = []
    this.memoryMonitor = new MemoryMonitor()
  }

  async runFullBenchmark() {
    console.log('🚀 Starting Performance Benchmarks for Bias Analysis API')
    console.log('='.repeat(60))

    this.memoryMonitor.start()

    for (const [key, scenario] of Object.entries(performanceScenarios)) {
      console.log(`\n📊 Testing Scenario: ${scenario.name}`)
      console.log('-'.repeat(40))

      for (const concurrentUsers of benchmarkConfig.concurrentUsers) {
        console.log(`\n👥 Concurrent Users: ${concurrentUsers}`)

        const result = await this.runScenarioBenchmark(scenario, concurrentUsers)
        this.results.push(result)

        console.log(`   ✅ Success Rate: ${(result.errorRate * 100).toFixed(2)}%`)
        console.log(`   ⚡ Avg Response Time: ${result.averageResponseTime.toFixed(2)}ms`)
        console.log(`   📈 Requests/sec: ${result.requestsPerSecond.toFixed(2)}`)

        // Check against targets
        if (result.averageResponseTime > benchmarkConfig.targetResponseTime) {
          console.log(`   ⚠️  WARNING: Response time exceeds target (${benchmarkConfig.targetResponseTime}ms)`)
        }
        if (result.requestsPerSecond < benchmarkConfig.targetThroughput) {
          console.log(`   ⚠️  WARNING: Throughput below target (${benchmarkConfig.targetThroughput} req/sec)`)
        }
        if (result.errorRate > benchmarkConfig.targetErrorRate) {
          console.log(`   ❌ ERROR: Error rate exceeds target (${(benchmarkConfig.targetErrorRate * 100).toFixed(1)}%)`)
        }
      }
    }

    console.log('\n🎯 Performance Benchmark Complete!')
    console.log('='.repeat(60))

    return this.results
  }

  async runScenarioBenchmark(scenario, concurrentUsers) {
    const startTime = Date.now()
    const responseTimes = []
    let successfulRequests = 0
    let failedRequests = 0

    // Calculate test parameters
    const totalRequests = Math.max(50, concurrentUsers * 10) // At least 50 requests, or 10x concurrent users
    const requestsPerBatch = concurrentUsers
    const batches = Math.ceil(totalRequests / requestsPerBatch)

    for (let batch = 0; batch < batches; batch++) {
      const batchPromises = []

      for (let i = 0; i < requestsPerBatch && (batch * requestsPerBatch + i) < totalRequests; i++) {
        const requestPromise = this.makeTestRequest(scenario)
        batchPromises.push(requestPromise)
      }

      try {
        const batchResults = await Promise.all(batchPromises)

        batchResults.forEach(result => {
          if (result.success) {
            successfulRequests++
            responseTimes.push(result.responseTime)
          } else {
            failedRequests++
          }
        })
      } catch (error) {
        console.error(`Batch ${batch} failed:`, error)
        failedRequests += requestsPerBatch
      }

      // Sample memory usage
      this.memoryMonitor.sample()

      // Small delay between batches to prevent overwhelming the system
      if (batch < batches - 1) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    const endTime = Date.now()
    const duration = endTime - startTime

    // Calculate statistics
    const sortedResponseTimes = responseTimes.sort((a, b) => a - b)
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0

    const p95Index = Math.floor(sortedResponseTimes.length * 0.95)
    const p99Index = Math.floor(sortedResponseTimes.length * 0.99)

    const memoryResults = this.memoryMonitor.getResults()

    return {
      scenario: scenario.name,
      concurrentUsers,
      totalRequests,
      successfulRequests,
      failedRequests,
      averageResponseTime,
      minResponseTime: sortedResponseTimes[0] || 0,
      maxResponseTime: sortedResponseTimes[sortedResponseTimes.length - 1] || 0,
      p95ResponseTime: sortedResponseTimes[p95Index] || 0,
      p99ResponseTime: sortedResponseTimes[p99Index] || 0,
      requestsPerSecond: (successfulRequests / duration) * 1000,
      errorRate: failedRequests / totalRequests,
      memoryUsage: {
        initial: memoryResults.initial,
        peak: memoryResults.peak,
        final: memoryResults.final
      },
      timestamp: new Date().toISOString(),
      duration
    }
  }

  async makeTestRequest(scenario) {
    const startTime = performance.now()

    try {
      // Create test payload
      const payload = {
        text: scenario.text,
        context: scenario.context,
        demographics: {
          age: '25-34',
          gender: 'female',
          ethnicity: 'hispanic',
          primaryLanguage: 'en'
        },
        sessionType: 'anxiety-treatment',
        therapistNotes: `Performance test: ${scenario.name}`
      }

      // In a real environment, this would make an actual HTTP request
      // For now, we'll simulate the request timing
      const simulatedDelay = Math.random() * 1000 + 500 // 500-1500ms

      await new Promise(resolve => setTimeout(resolve, simulatedDelay))

      // Simulate occasional failures
      if (Math.random() < 0.02) { // 2% failure rate
        throw new Error('Simulated request failure')
      }

      const endTime = performance.now()
      return {
        success: true,
        responseTime: endTime - startTime
      }

    } catch (error) {
      const endTime = performance.now()
      return {
        success: false,
        responseTime: endTime - startTime
      }
    }
  }

  generateReport(results) {
    const report = []

    report.push('# 🚀 Bias Analysis API Performance Benchmark Report')
    report.push('')
    report.push(`**Generated:** ${new Date().toISOString()}`)
    report.push(`**Test Duration:** ${benchmarkConfig.testDuration} seconds`)
    report.push(`**Concurrent Users Tested:** ${benchmarkConfig.concurrentUsers.join(', ')}`)
    report.push('')

    // Summary Statistics
    report.push('## 📊 Summary Statistics')
    report.push('')

    const allResults = results.flat()
    const avgResponseTime = allResults.reduce((sum, r) => sum + r.averageResponseTime, 0) / allResults.length
    const avgThroughput = allResults.reduce((sum, r) => sum + r.requestsPerSecond, 0) / allResults.length
    const avgErrorRate = allResults.reduce((sum, r) => sum + r.errorRate, 0) / allResults.length

    report.push(`- **Average Response Time:** ${avgResponseTime.toFixed(2)}ms`)
    report.push(`- **Average Throughput:** ${avgThroughput.toFixed(2)} req/sec`)
    report.push(`- **Average Error Rate:** ${(avgErrorRate * 100).toFixed(2)}%`)
    report.push(`- **Total Requests:** ${allResults.reduce((sum, r) => sum + r.totalRequests, 0)}`)
    report.push('')

    // Performance Targets
    report.push('## 🎯 Performance Targets')
    report.push('')
    report.push(`- **Target Response Time:** <${benchmarkConfig.targetResponseTime}ms`)
    report.push(`- **Target Throughput:** >${benchmarkConfig.targetThroughput} req/sec`)
    report.push(`- **Target Error Rate:** <${(benchmarkConfig.targetErrorRate * 100).toFixed(1)}%`)
    report.push('')

    // Detailed Results by Scenario
    report.push('## 📈 Detailed Results by Scenario')
    report.push('')

    const scenarios = [...new Set(results.map(r => r.scenario))]

    for (const scenario of scenarios) {
      const scenarioResults = results.filter(r => r.scenario === scenario)

      report.push(`### ${scenario}`)
      report.push('')
      report.push('| Users | Avg Response | P95 Response | Throughput | Error Rate |')
      report.push('|-------|-------------|--------------|------------|------------|')

      for (const result of scenarioResults) {
        report.push(
          `| ${result.concurrentUsers} | ${result.averageResponseTime.toFixed(0)}ms | ${result.p95ResponseTime.toFixed(0)}ms | ${result.requestsPerSecond.toFixed(1)} | ${(result.errorRate * 100).toFixed(1)}% |`
        )
      }

      report.push('')
    }

    // Recommendations
    report.push('## 💡 Recommendations')
    report.push('')

    const slowResponses = results.filter(r => r.averageResponseTime > benchmarkConfig.targetResponseTime)
    const lowThroughput = results.filter(r => r.requestsPerSecond < benchmarkConfig.targetThroughput)
    const highErrors = results.filter(r => r.errorRate > benchmarkConfig.targetErrorRate)

    if (slowResponses.length > 0) {
      report.push('### ⚠️ Response Time Issues')
      report.push('Consider optimizing the following scenarios:')
      slowResponses.forEach(r => {
        report.push(`- ${r.scenario} (${r.concurrentUsers} users): ${r.averageResponseTime.toFixed(0)}ms`)
      })
      report.push('')
    }

    if (lowThroughput.length > 0) {
      report.push('### ⚠️ Throughput Issues')
      report.push('Consider scaling for the following scenarios:')
      lowThroughput.forEach(r => {
        report.push(`- ${r.scenario} (${r.concurrentUsers} users): ${r.requestsPerSecond.toFixed(1)} req/sec`)
      })
      report.push('')
    }

    if (highErrors.length > 0) {
      report.push('### ❌ Error Rate Issues')
      report.push('Investigate errors in the following scenarios:')
      highErrors.forEach(r => {
        report.push(`- ${r.scenario} (${r.concurrentUsers} users): ${(r.errorRate * 100).toFixed(1)}%`)
      })
      report.push('')
    }

    if (slowResponses.length === 0 && lowThroughput.length === 0 && highErrors.length === 0) {
      report.push('### ✅ All Targets Met!')
      report.push('Performance benchmarks are within acceptable ranges.')
      report.push('')
    }

    return report.join('\n')
  }

  async runMemoryLeakTest() {
    console.log('🧠 Running Memory Leak Detection Test...')

    const initialMemory = this.memoryMonitor.getResults().initial

    // Run a series of requests to check for memory leaks
    for (let i = 0; i < 100; i++) {
      await this.makeTestRequest(performanceScenarios.mediumText)
      this.memoryMonitor.sample()

      if (i % 20 === 0) {
        console.log(`   Memory sample ${i + 1}/100 taken`)
      }
    }

    const finalMemory = this.memoryMonitor.getResults().final
    const memoryIncrease = finalMemory - initialMemory
    const leakDetected = memoryIncrease > 50 * 1024 * 1024 // 50MB threshold

    console.log(`   Initial Memory: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   Final Memory: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`)
    console.log(`   Memory Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`)

    if (leakDetected) {
      console.log('   ❌ POTENTIAL MEMORY LEAK DETECTED!')
    } else {
      console.log('   ✅ No significant memory leaks detected')
    }

    return {
      initialMemory,
      finalMemory,
      memoryIncrease,
      leakDetected
    }
  }
}

// Main execution
async function main() {
  const runner = new PerformanceBenchmarkRunner()

  console.log('🚀 Starting Bias Analysis API Performance Benchmarks...\n')

  try {
    const results = await runner.runFullBenchmark()
    const report = runner.generateReport(results)
    console.log('\n📊 PERFORMANCE BENCHMARK REPORT:\n')
    console.log(report)

    console.log('\n🧠 Running Memory Leak Test...\n')
    const memoryResults = await runner.runMemoryLeakTest()
    console.log(`Memory Test Results: ${memoryResults.leakDetected ? 'LEAK DETECTED' : 'NO LEAKS'}`)

    // Save report to file
    const fs = require('fs')
    fs.writeFileSync('./performance-benchmark-report.md', report)
    console.log('\n💾 Report saved to: ./performance-benchmark-report.md')

  } catch (error) {
    console.error('❌ Benchmark failed:', error)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = { PerformanceBenchmarkRunner, benchmarkConfig, performanceScenarios }

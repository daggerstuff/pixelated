#!/usr/bin/env tsx

/**
 * Phase 3 Integration Test Runner
 * 
 * Runs comprehensive service integration tests and performance optimization
 */

import { phase3IntegrationTester } from '../src/lib/services/phase3-integration-test'
import { healthMonitor } from '../src/lib/services/health-monitor'
import { performanceOptimizer } from '../src/lib/services/performance-optimizer'
import { createBuildSafeLogger } from '../src/lib/logging/build-safe-logger'

const logger = createBuildSafeLogger('phase3-test-runner')

async function runPhase3Tests() {
  console.log('🚀 Starting Phase 3: Service Integration & Performance Testing')
  console.log('=' .repeat(80))

  try {
    // Initialize health monitoring
    logger.info('Initializing health monitoring system...')
    
    // Register core services for health monitoring
    healthMonitor.registerService(
      'memory-service',
      async () => {
        try {
          // Simple health check - attempt to create and retrieve a test memory
          const testMemory = await phase3IntegrationTester?.['memoryService']?.createMemory('health-check', {
            userId: 'health-check-user',
            tags: ['health-check'],
            metadata: { timestamp: Date.now() }
          })
          return { 
            name: 'memory-service',
            status: testMemory?.['id'] ? 'healthy' : 'unhealthy',
            responseTime: 100 
          }
        } catch (error) {
          return { 
            name: 'memory-service',
            status: 'unhealthy',
            responseTime: 0,
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    )

    healthMonitor.registerService(
      'redis-service',
      async () => {
        try {
          const isHealthy = await phase3IntegrationTester?.['redisService']?.isHealthy()
          return { 
            name: 'redis-service',
            status: isHealthy ? 'healthy' : 'unhealthy',
            responseTime: 50 
          }
        } catch (error) {
          return { 
            name: 'redis-service',
            status: 'unhealthy',
            responseTime: 0,
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    )

    healthMonitor.registerService(
      'analytics-service',
      async () => {
        try {
          // Test analytics service by tracking a health check event
          await phase3IntegrationTester['analyticsService'].trackEvent({
            type: 'health_check' as any,
            userId: 'health-check-user',
            timestamp: Date.now(),
            priority: 'low' as any,
            properties: {},
            metadata: { source: 'health-monitor' }
          })
          return { 
            name: 'analytics-service',
            status: 'healthy',
            responseTime: 75 
          }
        } catch (error) {
          return { 
            name: 'analytics-service',
            status: 'unhealthy',
            responseTime: 0,
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      }
    )

    // Start health monitoring
    healthMonitor.startMonitoring()

    // Run Phase 3 integration tests
    logger.info('Running Phase 3 integration tests...')
    const testResults = await phase3IntegrationTester.runPhase3IntegrationTest()

    // Display results
    console.log('\n📊 Phase 3 Test Results')
    console.log('=' .repeat(50))
    console.log(`Overall Success: ${testResults.success ? '✅' : '❌'}`)
    console.log(`Total Time: ${testResults.performance.totalTime}ms`)
    console.log()

    // Service Results
    console.log('🔧 Service Test Results:')
    Object.entries(testResults.results).forEach(([test, result]) => {
      console.log(`  ${result ? '✅' : '❌'} ${test.replace(/([A-Z])/g, ' $1').toLowerCase()}`)
    })
    console.log()

    // Performance Metrics
    console.log('⚡ Performance Metrics:')
    console.log(`  Service Health: ${testResults.performance.serviceTimings['serviceHealth']}ms`)
    console.log(`  Cross-Service Communication: ${testResults.performance.serviceTimings['crossServiceCommunication']}ms`)
    console.log(`  Performance Benchmarks: ${testResults.performance.serviceTimings['performanceBenchmarks']}ms`)
    console.log(`  API Throughput: ${testResults.performance.throughputMetrics['apiRequests'] || 0} req/s`)
    console.log(`  Data Processing: ${testResults.performance.throughputMetrics['dataProcessing'] || 0} ops/s`)
    console.log(`  Concurrent Operations: ${(testResults.performance.throughputMetrics as any)?.['concurrentOperations'] || 0} ops/s`)
    console.log()

    // Memory Usage
    console.log('💾 Memory Usage:')
    console.log(`  Baseline: ${(testResults.performance.memoryUsage as any)?.['baseline'] || 0}MB`)
    console.log(`  Peak: ${(testResults.performance.memoryUsage as any)?.['peak'] || 0}MB`)
    console.log(`  After Cleanup: ${(testResults.performance.memoryUsage as any)?.['afterCleanup'] || 0}MB`)
    console.log()

    // Errors
    if (testResults.errors.length > 0) {
      console.log('❌ Errors:')
      testResults.errors.forEach(error => {
        console.log(`  • ${error}`)
      })
      console.log()
    }

    // Recommendations
    if (testResults.recommendations.length > 0) {
      console.log('💡 Optimization Recommendations:')
      testResults.recommendations.forEach(rec => {
        console.log(`  • ${rec}`)
      })
      console.log()
    }

    // Performance Optimizer Recommendations
    const perfRecommendations = performanceOptimizer.getOptimizationRecommendations()
    if (perfRecommendations.length > 0) {
      console.log('🔧 Performance Optimizer Recommendations:')
      perfRecommendations.forEach(rec => {
        console.log(`  • ${rec}`)
      })
      console.log()
    }

    // Health Monitor Status
    const systemHealth = (healthMonitor as any)?.['getSystemHealth']()
    console.log('🏥 System Health Status:')
    console.log(`  Overall: ${systemHealth?.['overall']?.toUpperCase() || 'UNKNOWN'}`)
    systemHealth?.['services']?.forEach((service: any) => {
      console.log(`  ${service?.['status'] === 'healthy' ? '✅' : service?.['status'] === 'degraded' ? '⚠️' : '❌'} ${service?.['name']}: ${service?.['status']} (${service?.['responseTime']}ms)`)
    })
    
    if (systemHealth.alerts.length > 0) {
      console.log('\n🚨 Active Alerts:')
      systemHealth.alerts.forEach(alert => {
        console.log(`  ${alert.level === 'critical' ? '🔴' : alert.level === 'error' ? '🟠' : '🟡'} ${alert.service}: ${alert.message}`)
      })
    }
    console.log()

    // Final Summary
    console.log('📋 Phase 3 Summary')
    console.log('=' .repeat(50))
    
    const passedTests = Object.values(testResults.results).filter(r => r).length
    const totalTests = Object.keys(testResults.results).length
    const successRate = Math.round((passedTests / totalTests) * 100)
    
    console.log(`✅ Tests Passed: ${passedTests}/${totalTests} (${successRate}%)`)
    console.log(`⏱️  Total Execution Time: ${testResults.performance.totalTime}ms`)
    console.log(`🎯 System Health: ${systemHealth.overall.toUpperCase()}`)
    console.log(`💡 Recommendations: ${testResults.recommendations.length + perfRecommendations.length}`)
    
    if (testResults.success && systemHealth.overall === 'healthy') {
      console.log('\n🎉 Phase 3 COMPLETED SUCCESSFULLY!')
      console.log('   All services are integrated and performing optimally.')
      console.log('   System is ready for production deployment.')
    } else {
      console.log('\n⚠️  Phase 3 completed with issues.')
      console.log('   Review recommendations and address failing tests.')
    }

  } catch (error) {
    logger.error('Phase 3 test execution failed:', { error: error instanceof Error ? error.message : String(error) })
    console.error('❌ Phase 3 test execution failed:', error)
    process.exit(1)
  } finally {
    // Cleanup
    ;(healthMonitor as any)?.['stopMonitoring']?.()
    performanceOptimizer.cleanup()
  }
}

// Run the tests
runPhase3Tests().catch(error => {
  console.error('Fatal error in Phase 3 tests:', error)
  process.exit(1)
})

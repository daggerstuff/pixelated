#!/usr/bin/env tsx

/**
 * Simplified Phase 3 Integration Test Runner
 * 
 * Focuses on core service integration without external dependencies
 */

import { createBuildSafeLogger } from '../src/lib/logging/build-safe-logger'
import { MemoryService } from '../src/lib/memory'
import { fheService } from '../src/lib/fhe'
import { EncryptionMode } from '../src/lib/fhe/types'

const logger = createBuildSafeLogger('phase3-simple-test')

interface TestResult {
  name: string
  success: boolean
  duration: number
  error?: string
}

class SimplePhase3Tester {
  private memoryService: MemoryService

  constructor() {
    this.memoryService = new MemoryService()
  }

  async runAllTests(): Promise<{
    success: boolean
    results: TestResult[]
    totalTime: number
  }> {
    const startTime = Date.now()
    const results: TestResult[] = []

    console.log('🚀 Starting Simplified Phase 3 Integration Tests')
    console.log('=' .repeat(60))

    // Test 1: Memory Service Basic Operations
    results.push(await this.testMemoryService())

    // Test 2: FHE Service Integration
    results.push(await this.testFHEService())

    // Test 3: Cross-Service Communication
    results.push(await this.testCrossServiceCommunication())

    // Test 4: Error Handling
    results.push(await this.testErrorHandling())

    // Test 5: Performance Benchmarks
    results.push(await this.testPerformanceBenchmarks())

    const totalTime = Date.now() - startTime
    const success = results.every(r => r.success)

    return { success, results, totalTime }
  }

  private async testMemoryService(): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      console.log('🧠 Testing Memory Service...')
      
      const userId = 'phase3-test-user-' + Date.now()
      
      // Test create
      const memory = await this.memoryService.createMemory('Test memory for Phase 3', {
        userId,
        tags: ['phase3-test', 'integration'],
        metadata: { testType: 'memory-service', timestamp: Date.now() }
      })

      if (!memory.id) {
        throw new Error('Memory creation failed - no ID returned')
      }

      // Test list
      const memories = await this.memoryService.listMemories(userId, { limit: 10 })
      if (memories.length === 0) {
        throw new Error('Memory listing failed - no memories found')
      }

      // Test search
      const searchResults = await this.memoryService.searchMemories(userId, 'Phase 3')
      if (searchResults.length === 0) {
        throw new Error('Memory search failed - no results found')
      }

      // Test update
      const updated = await this.memoryService.updateMemory(memory.id, userId, {
        content: 'Updated Phase 3 test memory',
        tags: ['phase3-test', 'integration', 'updated']
      })

      if (!updated) {
        throw new Error('Memory update failed')
      }

      // Test delete
      const deleted = await this.memoryService.deleteMemory(memory.id, userId)
      if (!deleted) {
        throw new Error('Memory deletion failed')
      }

      console.log('  ✅ Memory Service: All operations successful')
      return {
        name: 'Memory Service',
        success: true,
        duration: Date.now() - startTime
      }

    } catch (error) {
      console.log('  ❌ Memory Service: Failed')
      return {
        name: 'Memory Service',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async testFHEService(): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      console.log('🔐 Testing FHE Service...')
      
      // Initialize FHE service
      await fheService.initialize({
        mode: EncryptionMode.STANDARD,
        securityLevel: 'medium'
      })

      // Test encryption
      const testData = 'Sensitive Phase 3 test data for encryption'
      const encrypted = await fheService.encrypt(testData)

      if (encrypted === testData) {
        throw new Error('Encryption failed - data not encrypted')
      }

      // Test decryption
      const decrypted = await fheService.decrypt(encrypted)
      if (decrypted !== testData) {
        throw new Error('Decryption failed - data mismatch')
      }

      // Test key rotation
      await fheService.rotateKeys()

      console.log('  ✅ FHE Service: Encryption/decryption successful')
      return {
        name: 'FHE Service',
        success: true,
        duration: Date.now() - startTime
      }

    } catch (error) {
      console.log('  ❌ FHE Service: Failed')
      return {
        name: 'FHE Service',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async testCrossServiceCommunication(): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      console.log('🔄 Testing Cross-Service Communication...')
      
      const userId = 'cross-service-test-' + Date.now()
      const testData = 'Cross-service integration test data'

      // 1. Create memory
      const memory = await this.memoryService.createMemory(testData, {
        userId,
        tags: ['cross-service-test'],
        metadata: { testType: 'cross-service', timestamp: Date.now() }
      })

      if (!memory.id) {
        throw new Error('Cross-service test failed: Memory creation failed')
      }

      // 2. Encrypt the memory content
      await fheService.initialize({
        mode: EncryptionMode.STANDARD,
        securityLevel: 'medium'
      })

      const encryptedContent = await fheService.encrypt(memory.content)
      if (encryptedContent === memory.content) {
        throw new Error('Cross-service test failed: Encryption failed')
      }

      // 3. Update memory with encrypted content
      const updatedMemory = await this.memoryService.updateMemory(memory.id, userId, {
        content: encryptedContent,
        tags: ['cross-service-test', 'encrypted'],
        metadata: { 
          ...memory.metadata, 
          encrypted: true,
          encryptedAt: Date.now()
        }
      })

      if (!updatedMemory) {
        throw new Error('Cross-service test failed: Memory update failed')
      }

      // 4. Retrieve and decrypt
      const retrievedMemory = await this.memoryService.getMemory(memory.id, userId)
      if (!retrievedMemory) {
        throw new Error('Cross-service test failed: Memory retrieval failed')
      }

      const decryptedContent = await fheService.decrypt(retrievedMemory.content)
      if (decryptedContent !== testData) {
        throw new Error('Cross-service test failed: Decryption mismatch')
      }

      // Cleanup
      await this.memoryService.deleteMemory(memory.id, userId)

      console.log('  ✅ Cross-Service Communication: All operations successful')
      return {
        name: 'Cross-Service Communication',
        success: true,
        duration: Date.now() - startTime
      }

    } catch (error) {
      console.log('  ❌ Cross-Service Communication: Failed')
      return {
        name: 'Cross-Service Communication',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async testErrorHandling(): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      console.log('⚠️  Testing Error Handling...')
      
      // Test invalid memory creation
      try {
        await this.memoryService.createMemory('', {
          userId: '',
          tags: [],
          metadata: {}
        })
        throw new Error('Error handling test failed: Invalid memory creation should have failed')
      } catch (error) {
        // Expected error - this is good
      }

      // Test invalid memory retrieval
      try {
        await this.memoryService.getMemory('invalid-id', 'invalid-user')
        // This might not throw an error, just return null
      } catch (error) {
        // Expected error
      }

      // Test service recovery after error
      const userId = 'error-recovery-test-' + Date.now()
      const validMemory = await this.memoryService.createMemory('Recovery test', {
        userId,
        tags: ['error-recovery-test'],
        metadata: { testType: 'error-recovery' }
      })

      if (!validMemory.id) {
        throw new Error('Error handling test failed: Service recovery failed')
      }

      // Cleanup
      await this.memoryService.deleteMemory(validMemory.id, userId)

      console.log('  ✅ Error Handling: Service recovery successful')
      return {
        name: 'Error Handling',
        success: true,
        duration: Date.now() - startTime
      }

    } catch (error) {
      console.log('  ❌ Error Handling: Failed')
      return {
        name: 'Error Handling',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async testPerformanceBenchmarks(): Promise<TestResult> {
    const startTime = Date.now()
    
    try {
      console.log('⚡ Testing Performance Benchmarks...')
      
      const userId = 'perf-test-' + Date.now()
      const operationCount = 20 // Reduced for faster testing
      
      // Test concurrent memory operations
      const concurrentStart = Date.now()
      const operations = []
      
      for (let i = 0; i < operationCount; i++) {
        operations.push(
          this.memoryService.createMemory(`Performance test ${i}`, {
            userId,
            tags: ['performance-test'],
            metadata: { index: i, testType: 'performance' }
          })
        )
      }

      const results = await Promise.all(operations)
      const concurrentDuration = Date.now() - concurrentStart
      
      // Verify all operations succeeded
      const successfulOperations = results.filter(r => r.id).length
      if (successfulOperations !== operationCount) {
        throw new Error(`Performance test failed: Only ${successfulOperations}/${operationCount} operations succeeded`)
      }

      // Calculate throughput
      const throughput = Math.round((operationCount * 1000) / concurrentDuration)
      
      // Cleanup
      const cleanupOperations = results.map(memory => 
        this.memoryService.deleteMemory(memory.id, userId)
      )
      await Promise.all(cleanupOperations)

      console.log(`  ✅ Performance Benchmarks: ${throughput} operations/second`)
      return {
        name: 'Performance Benchmarks',
        success: true,
        duration: Date.now() - startTime
      }

    } catch (error) {
      console.log('  ❌ Performance Benchmarks: Failed')
      return {
        name: 'Performance Benchmarks',
        success: false,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

async function runSimplePhase3Tests() {
  try {
    const tester = new SimplePhase3Tester()
    const results = await tester.runAllTests()

    console.log('\n📊 Phase 3 Test Results')
    console.log('=' .repeat(60))
    
    results.results.forEach(result => {
      const status = result.success ? '✅' : '❌'
      const duration = `${result.duration}ms`
      console.log(`${status} ${result.name}: ${duration}`)
      if (result.error) {
        console.log(`    Error: ${result.error}`)
      }
    })

    console.log('\n📋 Summary')
    console.log('=' .repeat(30))
    const passedTests = results.results.filter(r => r.success).length
    const totalTests = results.results.length
    const successRate = Math.round((passedTests / totalTests) * 100)
    
    console.log(`✅ Tests Passed: ${passedTests}/${totalTests} (${successRate}%)`)
    console.log(`⏱️  Total Time: ${results.totalTime}ms`)
    
    if (results.success) {
      console.log('\n🎉 Phase 3 COMPLETED SUCCESSFULLY!')
      console.log('   Core service integration is working properly.')
      console.log('   System is ready for advanced integration testing.')
    } else {
      console.log('\n⚠️  Phase 3 completed with issues.')
      console.log('   Review failed tests and address underlying issues.')
    }

    process.exit(results.success ? 0 : 1)

  } catch (error) {
    console.error('❌ Phase 3 test execution failed:', error)
    process.exit(1)
  }
}

// Run the tests
runSimplePhase3Tests()

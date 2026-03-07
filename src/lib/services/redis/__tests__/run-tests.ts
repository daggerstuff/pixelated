import { spawn } from 'node:child_process'

interface TestResult {
  suite: string
  duration: number
  passed: boolean
  error?: string
}

/**
 * Runs a test command and returns the result
 */
async function runTest(
  command: string,
  args: string[],
  options: {
    suite: string
    timeout?: number
  },
): Promise<TestResult> {
  const start = Date.now()

  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      env: {
        ...process.env,
      },
    })

    let error = ''

    child.stdout.on('data', (data) => {
      process.stdout.write(data)
    })

    child.stderr.on('data', (data) => {
      error += data.toString()
      process.stderr.write(data)
    })

    const timer = options.timeout
      ? setTimeout(() => {
          child.kill()
          resolve({
            suite: options.suite,
            duration: Date.now() - start,
            passed: false,
            error: `Test timeout after ${options.timeout}ms`,
          })
        }, options.timeout)
      : null

    child.on('close', (code) => {
      if (timer) {
        clearTimeout(timer)
      }

      const result: TestResult = {
        suite: options.suite,
        duration: Date.now() - start,
        passed: code === 0,
      }

      if (code !== 0) {
        result.error = error
      }

      resolve(result)
    })
  })
}

/**
 * Main test runner function
 */
async function runTests() {
  const results: TestResult[] = []

  try {
    // Run unit tests
    results.push(
      await runTest(
        'vitest',
        ['RedisService.test.ts', '--config', 'vitest.config.ts'],
        {
          suite: 'Unit Tests',
          timeout: 30000,
        },
      ),
    )

    // Run integration tests
    results.push(
      await runTest(
        'vitest',
        ['RedisService.integration.test.ts', '--config', 'vitest.config.ts'],
        {
          suite: 'Integration Tests',
          timeout: 60000,
        },
      ),
    )

    // Run performance tests
    results.push(
      await runTest(
        'vitest',
        ['RedisService.perf.test.ts', '--config', 'vitest.config.ts'],
        {
          suite: 'Performance Tests',
          timeout: 120000,
        },
      ),
    )

    // Generate coverage report
    await runTest(
      'vitest',
      ['run', '--coverage', '--config', 'vitest.config.ts'],
      {
        suite: 'Coverage Report',
        timeout: 30000,
      },
    )

    // Count failed tests
    const failedTests = results.filter((result) => !result.passed).length

    // Log results summary
    console.log('\n=== Test Results Summary ===')
    results.forEach((result) => {
      const status = result.passed ? '✅ PASSED' : '❌ FAILED'
      console.log(`${status} ${result.suite} (${result.duration}ms)`)
      if (result.error) {
        console.log(`  Error: ${result.error}`)
      }
    })
    console.log(
      `\nTotal: ${results.length}, Passed: ${results.length - failedTests}, Failed: ${failedTests}`,
    )

    // Exit with appropriate code
    process.exit(failedTests > 0 ? 1 : 0)
  } catch (error: unknown) {
    console.error('Test execution failed:', error)
    process.exit(1)
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests()
}

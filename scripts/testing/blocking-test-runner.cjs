#!/usr/bin/env node

const { spawn } = require('child_process')
const path = require('path')

const localRunner = path.resolve(__dirname, './local-test-runner.cjs')

const blockingTests = [
  'src/lib/ai/bias-detection/__tests__/BiasDetectionEngine.test.ts',
  'src/lib/auth/__tests__/middleware.test.ts',
  'src/lib/auth/__tests__/multi-role-auth.test.ts',
  'src/components/admin/bias-detection/BiasDashboard.test.tsx',
  'src/tests/admin/system-health.test.ts',
  'tests/integration/auth0/auth0-integration.test.ts',
]

const child = spawn(process.execPath, [localRunner, ...blockingTests], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITEST_SUITE: process.env.VITEST_SUITE || 'blocking',
  },
})

child.on('exit', (code) => process.exit(code))
child.on('error', (err) => {
  console.error('Failed to run blocking test suite:', err)
  process.exit(1)
})

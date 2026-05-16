#!/usr/bin/env node
void (async () => {
  try {
    await import('./local-test-runner.mjs')
  } catch (error) {
    console.error('Failed to start local test runner:', error)
    throw error
  }
})()

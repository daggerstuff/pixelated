/**
 * Global setup file for MCP integration with Playwright
 *
 * This file handles any setup needed before running tests with MCP integration,
 * such as authenticating with MCP services, setting up environment variables,
 * or initializing resources.
 */

import type { FullConfig } from '@playwright/test'
import { execSync } from 'child_process'
import * as http from 'http'

/**
 * Check if the MCP server is running at the specified URL
 */
async function isMCPServerRunning(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    http
      .get(`${url}/health`, (res) => {
        if (res.statusCode === 200) {
          resolve(true)
        } else {
          resolve(false)
        }
      })
      .on('error', () => {
        resolve(false)
      })
  })
}

/**
 * Global setup function that runs before the tests
 */
async function globalSetup(_config: FullConfig) {
  // Set MCP server URL from environment or use default
  const mcpServerUrl = process.env['MCP_SERVER_URL'] || 'http://localhost:8033'
  process.env['MCP_SERVER_URL'] = mcpServerUrl

  // Enable MCP for tests
  process.env['MCP_ENABLED'] = 'true'

  const isServerRunning = await isMCPServerRunning(mcpServerUrl)

  if (!isServerRunning) {
    // If the server is not running and we're in CI, we should start it
    if (process.env['CI']) {
      try {
        // Start MCP server in background (this is just a simulation for CI)
        // In a real CI environment, the server would be started before this step
        execSync('pnpm mcp:start &', { stdio: 'inherit' })

        let attempts = 0
        while (attempts < 10) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
          const running = await isMCPServerRunning(mcpServerUrl)
          if (running) {
            break
          }
          attempts++
        }

        if (attempts >= 10) {
          throw new Error('Failed to start MCP server after multiple attempts')
        }
      } catch (error: unknown) {
        console.error('Failed to start MCP server:', error)
        throw new Error('MCP server failed to start')
      }
    } else {
      // If we're in development, warn but don't start automatically
      console.warn(
        '⚠️ MCP server is not running. Some tests may be skipped or fail.',
      )
      console.warn(`Please start the MCP server manually with: pnpm mcp:start`)
    }
  }

  // Try to authenticate with MCP server if credentials are provided
  if (process.env['MCP_AUTH_USERNAME'] && process.env['MCP_AUTH_PASSWORD']) {
    // In a real implementation, you might set up auth tokens or cookies here
  }
}

export default globalSetup

import { Command } from 'commander'

import { pingHealth } from '../client/http.js'
import { loadConfig } from '../config/loader.js'
import type { AgentConfig } from '../config/schema.js'
import { formatHealthResult, type HealthResult } from '../output/format.js'

export function registerHealthCommand(program: Command): void {
  program
    .command('health')
    .description('Ping all agent health endpoints')
    .option('-t, --timeout <ms>', 'health check timeout', '5000')
    .action(async (opts: { timeout: string }) => {
      const { config } = loadConfig()
      const timeoutMs = parseInt(opts.timeout, 10) || 5000

      const results: HealthResult[] = []
      const entries = Object.entries(config.agents)

      await Promise.all(
        entries.map(async ([name, agent]) => {
          const result = await pingHealth(agent.endpoint, timeoutMs)
          results.push({
            agent: name,
            endpoint: agent.endpoint,
            status: result.ok ? 'ok' : 'down',
            detail: result.detail,
          })
        }),
      )

      // Sort by agent name for stable output
      results.sort((a, b) => a.agent.localeCompare(b.agent))

      console.log(formatHealthResult(results))

      const anyDown = results.some((r) => r.status !== 'ok')
      if (anyDown) process.exit(1)
    })
}

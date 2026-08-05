import type { Command } from 'commander'
import pc from 'picocolors'

import { loadConfig } from '../lib/config-loader.js'
import { invokeAgentTool } from '../lib/invoke.js'

export function registerInvoke(root: Command): void {
  root
    .argument('[agent]', 'Agent name from config (e.g. content, advisor)')
    .argument('[tool]', 'Tool name to invoke')
    .option('--body <payload>', 'JSON request body')
    .option('--stdin', 'Read JSON request body from stdin')
    .option('--endpoint <url>', 'Override agent endpoint')
    .option(
      '--timeout <ms>',
      'Override request timeout in milliseconds',
      (value) => Number.parseInt(value, 10),
    )
    .action(
      async (
        agent: string | undefined,
        tool: string | undefined,
        options: {
          body?: string
          stdin?: boolean
          endpoint?: string
          timeout?: number
        },
      ) => {
        if (!agent || !tool) {
          root.outputHelp()
          process.exitCode = 1
          return
        }

        const cliOverrides: Record<string, unknown> = {}
        if (options.endpoint) {
          cliOverrides.agent = agent
          cliOverrides.endpoint = options.endpoint
        }
        if (options.timeout !== undefined) {
          cliOverrides.agent = agent
          cliOverrides.timeout = options.timeout
        }

        const { config } = loadConfig({ cliOverrides })
        const agentConfig = config.agents[agent]

        if (!agentConfig) {
          console.error(
            pc.red(
              `Unknown agent "${agent}". Known agents: ${Object.keys(config.agents).join(', ') || '(none)'}`,
            ),
          )
          process.exitCode = 1
          return
        }

        if (!agentConfig.tools.includes(tool)) {
          console.error(
            pc.yellow(
              `Warning: tool "${tool}" is not listed for agent "${agent}" (configured: ${agentConfig.tools.join(', ')})`,
            ),
          )
        }

        let body: unknown = {}
        if (options.stdin) {
          const chunks: Buffer[] = []
          for await (const chunk of process.stdin) {
            chunks.push(Buffer.from(chunk))
          }
          const raw = Buffer.concat(chunks).toString('utf8').trim()
          body = raw.length > 0 ? JSON.parse(raw) : {}
        } else if (options.body) {
          body = JSON.parse(options.body)
        }

        try {
          const result = await invokeAgentTool({
            endpoint: agentConfig.endpoint,
            tool,
            body,
            timeout: agentConfig.timeout,
            async: agentConfig.async,
          })
          console.log(JSON.stringify(result, null, 2))
        } catch (error) {
          console.error(
            pc.red(error instanceof Error ? error.message : String(error)),
          )
          process.exitCode = 1
        }
      },
    )
}

import type { Command } from 'commander'
import pc from 'picocolors'

import { loadConfig } from '../lib/config-loader.js'
import { invokeAgentTool } from '../lib/invoke.js'
import { formatAsyncResponse } from '../output/response.js'

export function registerInvoke(program: Command): void {
  /** Build a Basic auth header from EVE_AUTH_USERNAME/EVE_AUTH_PASSWORD env vars. */
  function buildAuthHeader(): string | undefined {
    const user = process.env.EVE_AUTH_USERNAME
    const pass = process.env.EVE_AUTH_PASSWORD
    if (user && pass) {
      return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
    }
    return undefined
  }

  program
    .command('invoke')
    .description('Invoke a tool on an agent via the Eve session API')
    .argument('<agent>', 'Agent name from config (e.g. content, advisor)')
    .argument('<tool>', 'Tool name to invoke')
    .option('--body <payload>', 'JSON request body')
    .option('--stdin', 'Read JSON request body from stdin')
    .option('--endpoint <url>', 'Override agent endpoint')
    .option(
      '--timeout <ms>',
      'Override request timeout in milliseconds',
      (value) => Number.parseInt(value, 10),
    )
    .option('--json', 'Output raw JSON response')
    .option('--compact', 'Compact single-line output')
    .option('--no-color', 'Disable colored output')
    .option('--async', 'Force async mode (returns task ID)')
    .option('--sync', 'Force sync mode (wait for result)')
    .option('--verbose', 'Show detailed request/response info')
    .option('--dry-run', 'Print request payload without calling agent')
    .action(
      async (
        agent: string,
        tool: string,
        options: {
          body?: string
          stdin?: boolean
          endpoint?: string
          timeout?: number
          json?: boolean
          compact?: boolean
          noColor?: boolean
          async?: boolean
          sync?: boolean
          verbose?: boolean
          dryRun?: boolean
        },
      ) => {
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
              `px: unknown agent "${agent}". Known agents: ${Object.keys(config.agents).join(', ') || '(none)'}`,
            ),
          )
          process.exitCode = 1
          return
        }

        if (!agentConfig.tools.includes(tool)) {
          console.error(
            pc.yellow(
              `px: warning — tool "${tool}" is not listed for agent "${agent}" (configured: ${agentConfig.tools.join(', ')})`,
            ),
          )
        }

        const isAsync = options.async
          ? true
          : options.sync
            ? false
            : agentConfig.async

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

        const sessionUrl = `${agentConfig.endpoint.replace(/\/$/, '')}/eve/v1/session`

        if (options.verbose) {
          console.error(
            pc.gray(`px: POST ${sessionUrl} (tool=${tool}, async=${isAsync}, timeout=${agentConfig.timeout}ms)`),
          )
        }

        if (options.dryRun) {
          const payload = {
            method: 'POST',
            url: sessionUrl,
            agent,
            tool,
            async: isAsync,
            timeout: agentConfig.timeout,
            body,
          }
          console.log(JSON.stringify(payload, null, 2))
          return
        }

        try {
          const authHeader = buildAuthHeader()
          const result = await invokeAgentTool({
            endpoint: agentConfig.endpoint,
            tool,
            body,
            timeout: agentConfig.timeout,
            async: isAsync,
            authHeader,
          })

          if (options.json) {
            console.log(JSON.stringify(result, null, 2))
          } else if (isAsync) {
            const channel = config.slack?.channel
            console.log(formatAsyncResponse(result.sessionId, channel))
          } else {
            const text = options.compact
              ? result.message.replace(/\n+/g, ' ')
              : result.message
            console.log(text)
          }

          if (options.verbose) {
            console.error(pc.gray(`px: response received (session ${result.sessionId})`))
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          console.error(pc.red(`px: ${msg}`))
          process.exitCode = 1
        }
      },
    )
}

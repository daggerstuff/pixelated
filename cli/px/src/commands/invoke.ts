import type { Command } from 'commander'
import pc from 'picocolors'

import { loadConfig } from '../lib/config-loader.js'
import { invokeAgentTool } from '../lib/invoke.js'
import { formatInteractiveResponse, formatAsyncResponse } from '../output/response.js'

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
    .option('--json', 'Output raw JSON response')
    .option('--compact', 'Compact single-line output')
    .option('--no-color', 'Disable colored output')
    .option('--async', 'Force async mode (returns task ID)')
    .option('--sync', 'Force sync mode (wait for result)')
    .option('--verbose', 'Show detailed request/response info')
    .action(
      async (
        agent: string | undefined,
        tool: string | undefined,
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
        },
        cmd: Command,
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

        const url = `${agentConfig.endpoint.replace(/\/$/, '')}/eve/v1/${tool}`

        if (options.verbose) {
          console.error(
            pc.gray(`px: POST ${url} (async=${isAsync}, timeout=${agentConfig.timeout}ms)`),
          )
        }

        if (cmd.args.includes('--dry-run')) {
          const payload = {
            method: 'POST',
            url,
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
          const result = await invokeAgentTool({
            endpoint: agentConfig.endpoint,
            tool,
            body,
            timeout: agentConfig.timeout,
            async: isAsync,
          })

          if (options.json) {
            console.log(JSON.stringify(result, null, 2))
          } else if (isAsync) {
            const taskId =
              (result as Record<string, unknown>)?.['task_id'] as string ??
              'unknown'
            const channel = config.slack?.channel
            console.log(formatAsyncResponse(taskId, channel))
          } else {
            console.log(
              formatInteractiveResponse(result, {
                compact: options.compact,
                noColor: options.noColor,
              }),
            )
          }

          if (options.verbose) {
            console.error(pc.gray(`px: response received`))
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error)
          console.error(pc.red(`px: ${msg}`))
          process.exitCode = 1
        }
      },
    )
}

import type { Command } from 'commander'
import pc from 'picocolors'

import { loadConfig } from '../lib/config-loader.js'
import { invokeAgentTool } from '../lib/invoke.js'
import { formatAsyncResponse } from '../output/response.js'

/**
 *
 * Each entry creates a `px <agent> <alias>` subcommand that wraps
 * `px invoke <agent> <tool>` with a friendlier name.
 *
 * Waves correspond to the PIX-4252 dogfooding rollout plan:
 *   Wave 1 — advisor, content
 *   Wave 2 — qa, supervisor
 *   Wave 3 — pipeline, session, intake
 */

interface ToolAlias {
  /** Short CLI subcommand name */
  alias: string
  /** Full tool name in agent config */
  tool: string
  /** One-line description */
  description: string
}

const AGENT_TOOLS: Record<string, ToolAlias[]> = {
  // ── Wave 1 ──────────────────────────────────────────
  advisor: [
    {
      alias: 'review',
      tool: 'review',
      description: 'Run advisor code review on current diff',
    },
    {
      alias: 'worktree',
      tool: 'get_worktree',
      description: 'Get worktree info for current branch',
    },
    {
      alias: 'read',
      tool: 'read_file',
      description: 'Read a file via advisor agent',
    },
  ],
  content: [
    {
      alias: 'audit',
      tool: 'audit_clinical_corpus',
      description: 'Audit clinical corpus for safety/quality',
    },
    {
      alias: 'corpus',
      tool: 'audit_corpus',
      description: 'Audit general content corpus',
    },
    {
      alias: 'score',
      tool: 'score_thread',
      description: 'Score a conversation thread',
    },
    {
      alias: 'showcase',
      tool: 'curate_showcase',
      description: 'Curate showcase examples',
    },
    {
      alias: 'gate',
      tool: 'gate_injection',
      description: 'Gate content injection for safety',
    },
  ],
  // ── Wave 2 ──────────────────────────────────────────
  qa: [
    {
      alias: 'score',
      tool: 'score_session',
      description: 'Score a training session',
    },
    {
      alias: 'sessions',
      tool: 'fetch_sessions',
      description: 'Fetch session list',
    },
    {
      alias: 'patterns',
      tool: 'detect_emotional_patterns',
      description: 'Detect emotional patterns in sessions',
    },
    {
      alias: 'flag',
      tool: 'flag_training_gap',
      description: 'Flag a training gap',
    },
    {
      alias: 'summarize',
      tool: 'summarize_cohort',
      description: 'Summarize cohort performance',
    },
    {
      alias: 'report',
      tool: 'generate_report',
      description: 'Generate QA report',
    },
  ],
  supervisor: [
    {
      alias: 'trends',
      tool: 'query_cohort_trends',
      description: 'Query cohort performance trends',
    },
    {
      alias: 'compare',
      tool: 'compare_trainees',
      description: 'Compare trainees side-by-side',
    },
    {
      alias: 'flagged',
      tool: 'list_flagged_sessions',
      description: 'List flagged sessions',
    },
    {
      alias: 'report',
      tool: 'generate_supervisor_report',
      description: 'Generate supervisor report',
    },
    {
      alias: 'timeline',
      tool: 'query_trainee_timeline',
      description: 'Query trainee activity timeline',
    },
    {
      alias: 'threshold',
      tool: 'adjust_threshold',
      description: 'Adjust clinical threshold',
    },
    {
      alias: 'status',
      tool: 'adjust_trainee_status',
      description: 'Adjust trainee status',
    },
    {
      alias: 'notify',
      tool: 'notify_slack',
      description: 'Send Slack notification via supervisor',
    },
  ],
  // ── Wave 3 ──────────────────────────────────────────
  pipeline: [
    {
      alias: 'curate',
      tool: 'curate_dataset',
      description: 'Curate training dataset',
    },
    {
      alias: 'train',
      tool: 'run_training',
      description: 'Run model training job',
    },
    {
      alias: 'eval',
      tool: 'run_evaluation',
      description: 'Run model evaluation',
    },
    {
      alias: 'staging',
      tool: 'promote_to_staging',
      description: 'Promote model to staging',
    },
    {
      alias: 'promote',
      tool: 'promote_to_production',
      description: 'Promote model to production',
    },
    {
      alias: 'rollback',
      tool: 'rollback_model',
      description: 'Rollback model to previous version',
    },
    {
      alias: 'health',
      tool: 'check_pipeline_health',
      description: 'Check pipeline health',
    },
    {
      alias: 'review',
      tool: 'evaluate_pipeline_review',
      description: 'Evaluate pipeline review',
    },
  ],
  session: [
    {
      alias: 'start',
      tool: 'start_session',
      description: 'Start a new session',
    },
    {
      alias: 'message',
      tool: 'process_message',
      description: 'Process a message in a session',
    },
    {
      alias: 'emotion',
      tool: 'analyze_emotion',
      description: 'Analyze emotion in session',
    },
    {
      alias: 'pace',
      tool: 'analyze_pace',
      description: 'Analyze session pace',
    },
    {
      alias: 'boundary',
      tool: 'check_clinical_boundary',
      description: 'Check clinical boundary',
    },
    {
      alias: 'validate',
      tool: 'validate_response',
      description: 'Validate a response',
    },
    {
      alias: 'hydrate',
      tool: 'hydrate_session',
      description: 'Hydrate session context',
    },
    { alias: 'save', tool: 'save_session', description: 'Save session state' },
    {
      alias: 'conclude',
      tool: 'conclude_session',
      description: 'Conclude a session',
    },
  ],
  intake: [
    {
      alias: 'register',
      tool: 'register_trainee',
      description: 'Register a new trainee',
    },
    {
      alias: 'assign',
      tool: 'assign_cohort',
      description: 'Assign trainee to cohort',
    },
    { alias: 'cohorts', tool: 'list_cohorts', description: 'List all cohorts' },
    {
      alias: 'status',
      tool: 'get_trainee_status',
      description: 'Get trainee status',
    },
    {
      alias: 'progress',
      tool: 'get_cohort_progress',
      description: 'Get cohort progress',
    },
    {
      alias: 'curriculum',
      tool: 'record_curriculum_step',
      description: 'Record curriculum step completion',
    },
  ],
  eve: [
    {
      alias: 'clean',
      tool: 'clean_corpus',
      description: 'Clean a corpus of synthetic data',
    },
    {
      alias: 'slop',
      tool: 'replace_slop',
      description: 'Replace slop in synthetic data',
    },
    {
      alias: 'regen',
      tool: 'regenerate_record',
      description: 'Regenerate a corpus record',
    },
    {
      alias: 'gate',
      tool: 'evaluate_corpus_gate',
      description: 'Evaluate corpus quality gate',
    },
  ],
}

interface InvokeOptions {
  body?: string
  stdin?: boolean
  json?: boolean
  async?: boolean
  sync?: boolean
  verbose?: boolean
  dryRun?: boolean
  compact?: boolean
  noColor?: boolean
}

async function runAgentTool(
  agent: string,
  tool: string,
  options: InvokeOptions,
): Promise<void> {
  const { config } = loadConfig({})
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
      pc.gray(
        `px: POST ${sessionUrl} (tool=${tool}, async=${isAsync}, timeout=${agentConfig.timeout}ms)`,
      ),
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
    const user = process.env.EVE_AUTH_USERNAME
    const pass = process.env.EVE_AUTH_PASSWORD
    const authHeader =
      user && pass
        ? `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`
        : undefined
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
      console.error(
        pc.gray(`px: response received (session ${result.sessionId})`),
      )
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    // Provider failures (timeout, network, 429/5xx) are transient — surface a
    // structured, renderable response instead of a bare exception.
    const transient =
      /timeout|timed out|fetch failed|network|ECONNRESET|429|5\d\d/.test(msg)
    const gracefulResponse = {
      error: msg,
      fallback: true,
      transient,
      message: transient
        ? 'LLM provider temporarily unavailable — retry in a moment'
        : `Agent invocation failed: ${msg}`,
    }
    if (options.json) {
      console.log(JSON.stringify(gracefulResponse, null, 2))
    } else {
      console.error(pc.red(`px: ${gracefulResponse.message}`))
    }
    process.exitCode = 1
  }
}

export function registerAgentCommands(program: Command): void {
  for (const [agentName, tools] of Object.entries(AGENT_TOOLS)) {
    const agentCmd = program
      .command(agentName)
      .description(
        `${agentName} agent — ${tools.length} tool${tools.length > 1 ? 's' : ''}`,
      )

    for (const { alias, tool, description } of tools) {
      // Register short alias (e.g. `px advisor review`)
      agentCmd
        .command(alias)
        .description(description)
        .option('--body <payload>', 'JSON request body')
        .option('--stdin', 'Read JSON request body from stdin')
        .option('--json', 'Output raw JSON response')
        .option('--async', 'Force async mode (returns task ID)')
        .option('--sync', 'Force sync mode (wait for result)')
        .option('--verbose', 'Show detailed request/response info')
        .option('--dry-run', 'Print request payload without calling agent')
        .option('--compact', 'Single-line summary output')
        .option('--no-color', 'Disable colored output')
        .action(async (...args: unknown[]) => {
          // Root-level options (from invoke) may consume flags before subcommand parsing
          const rootOpts = program.opts() as Record<string, unknown>
          const options = args[0] as InvokeOptions
          await runAgentTool(agentName, tool, {
            ...options,
            json: options.json ?? (rootOpts.json as boolean),
            compact: options.compact ?? (rootOpts.compact as boolean),
            noColor: options.noColor ?? (rootOpts.noColor as boolean),
          })
        })
      // Also register full tool name if different from alias (e.g. `px qa score_session`)
      if (alias !== tool) {
        agentCmd
          .command(tool)
          .description(description)
          .option('--body <payload>', 'JSON request body')
          .option('--stdin', 'Read JSON request body from stdin')
          .option('--json', 'Output raw JSON response')
          .option('--async', 'Force async mode (returns task ID)')
          .option('--sync', 'Force sync mode (wait for result)')
          .option('--verbose', 'Show detailed request/response info')
          .option('--dry-run', 'Print request payload without calling agent')
          .option('--compact', 'Single-line summary output')
          .option('--no-color', 'Disable colored output')
          .action(async (...args: unknown[]) => {
            // Root-level options (from invoke) may consume flags before subcommand parsing
            const rootOpts = program.opts() as Record<string, unknown>
            const options = args[0] as InvokeOptions
            await runAgentTool(agentName, tool, {
              ...options,
              json: options.json ?? (rootOpts.json as boolean),
              compact: options.compact ?? (rootOpts.compact as boolean),
              noColor: options.noColor ?? (rootOpts.noColor as boolean),
            })
          })
      }
    }
  }
}

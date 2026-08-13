import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'

import type { Command } from 'commander'
import pc from 'picocolors'

import { loadConfig } from '../lib/config-loader.js'

/**
 * Stubs for each agent tool. Keys are tool names; values are functions
 * that return a realistic response body given the request body.
 */
const TOOL_STUBS: Record<string, (body: unknown) => unknown> = {
  // ── advisor ─────────────────────────────────────────
  review: () => ({
    findings: [
      { severity: 'low', message: 'No blocking issues detected', path: 'src/index.ts' },
      { severity: 'medium', message: 'Consider extracting helper — function exceeds 50 lines', path: 'src/commands/serve.ts' },
    ],
    risk: 'low',
    summary: 'Diff looks clean. One medium finding on function length.',
  }),
  get_worktree: (body) => ({
    branch: (body as { branch?: string })?.branch ?? 'feature/foo',
    root: '/home/vivi/pixelated/.worktrees/feature-foo',
    is_clean: true,
  }),
  read_file: (body) => ({
    path: (body as { path?: string })?.path ?? 'src/index.ts',
    lines: 42,
    content: '// stub file content',
  }),

  // ── content ─────────────────────────────────────────
  audit_clinical_corpus: (body) => ({
    files_scanned: ((body as { files?: string[] })?.files ?? []).length || 3,
    issues: [],
    passed: true,
  }),
  audit_corpus: (body) => ({
    files_scanned: ((body as { files?: string[] })?.files ?? []).length || 3,
    issues: [],
    passed: true,
  }),
  score_thread: () => ({
    score: 4,
    dimensions: { empathy: 4, technique: 3, structure: 5 },
    notes: 'Strong session overall.',
  }),
  curate_showcase: () => ({
    selected: 5,
    candidates: 12,
  }),
  gate_injection: () => ({
    allowed: true,
    reason: 'Content passes safety gate.',
  }),

  // ── qa ──────────────────────────────────────────────
  score_session: () => ({
    task_id: randomUUID(),
    status: 'queued',
  }),
  fetch_sessions: () => ({
    sessions: [
      { id: 'sess_001', score: 4.2, trainee: 'alice' },
      { id: 'sess_002', score: 3.8, trainee: 'bob' },
    ],
    total: 2,
  }),
  detect_emotional_patterns: () => ({
    patterns: [
      { type: 'resistance', count: 3 },
      { type: 'breakthrough', count: 1 },
    ],
  }),
  flag_training_gap: () => ({
    flagged: true,
    gap: 'de-escalation',
    sessions_affected: 2,
  }),
  summarize_cohort: () => ({
    cohort: 'alpha',
    avg_score: 4.0,
    n_trainees: 8,
  }),
  generate_report: () => ({
    task_id: randomUUID(),
    status: 'queued',
  }),

  // ── pipeline ────────────────────────────────────────
  curate_dataset: () => ({
    task_id: randomUUID(),
    status: 'queued',
  }),
  run_training: () => ({
    task_id: randomUUID(),
    status: 'queued',
  }),
  run_evaluation: () => ({
    task_id: randomUUID(),
    status: 'queued',
  }),
  promote_to_staging: () => ({
    promoted: true,
    version: 'v1.2.0',
  }),
  promote_to_production: () => ({
    promoted: true,
    version: 'v1.2.0',
  }),
  rollback_model: () => ({
    rolled_back: true,
    to_version: 'v1.1.0',
  }),
  check_pipeline_health: () => ({
    status: 'healthy',
    checks: [
      { name: 'data_freshness', ok: true },
      { name: 'model_staleness', ok: true },
      { name: 'queue_depth', ok: true },
    ],
  }),
  evaluate_pipeline_review: () => ({
    task_id: randomUUID(),
    status: 'queued',
  }),

  // ── intake ──────────────────────────────────────────
  register_trainee: (body) => ({
    registered: true,
    trainee_id: randomUUID(),
    name: (body as { name?: string })?.name ?? 'New Trainee',
  }),
  assign_cohort: () => ({
    assigned: true,
    cohort: 'alpha',
  }),
  list_cohorts: () => ({
    cohorts: ['alpha', 'beta', 'gamma'],
  }),
  get_trainee_status: (body) => ({
    trainee_id: (body as { trainee_id?: string })?.trainee_id ?? 't_001',
    status: 'active',
    progress: 0.6,
  }),
  get_cohort_progress: () => ({
    cohort: 'alpha',
    avg_progress: 0.55,
    n_trainees: 8,
  }),
  record_curriculum_step: () => ({
    recorded: true,
    step: 'module_3',
  }),

  // ── supervisor ──────────────────────────────────────
  query_cohort_trends: () => ({
    cohort: 'alpha',
    trend: 'improving',
    data_points: [
      { week: 'W1', avg: 3.2 },
      { week: 'W2', avg: 3.8 },
      { week: 'W3', avg: 4.1 },
    ],
  }),
  compare_trainees: () => ({
    comparison: [
      { trainee: 'alice', score: 4.2 },
      { trainee: 'bob', score: 3.8 },
    ],
  }),
  list_flagged_sessions: () => ({
    flagged: [
      { session_id: 'sess_042', reason: 'low_empathy' },
    ],
  }),
  generate_supervisor_report: () => ({
    task_id: randomUUID(),
    status: 'queued',
  }),
  query_trainee_timeline: () => ({
    trainee: 'alice',
    events: [
      { date: '2026-08-01', type: 'session', score: 4 },
      { date: '2026-08-05', type: 'session', score: 5 },
    ],
  }),
  adjust_threshold: () => ({
    adjusted: true,
    new_threshold: 3.5,
  }),
  adjust_trainee_status: () => ({
    adjusted: true,
    new_status: 'on_hold',
  }),
  notify_slack: () => ({
    sent: true,
    channel: '#px-agent-results',
  }),

  // ── session ─────────────────────────────────────────
  start_session: () => ({
    session_id: randomUUID(),
    started: true,
  }),
  process_message: (body) => ({
    session_id: (body as { session_id?: string })?.session_id ?? 'sess_001',
    response: 'Stub response: message processed.',
  }),
  analyze_emotion: () => ({
    primary: 'anxious',
    confidence: 0.82,
  }),
  analyze_pace: () => ({
    pace: 'optimal',
    turns_per_minute: 2.5,
  }),
  check_clinical_boundary: () => ({
    within_bounds: true,
    concern: null,
  }),
  validate_response: () => ({
    valid: true,
    issues: [],
  }),
  hydrate_session: () => ({
    session_id: 'sess_001',
    context_loaded: true,
    message_count: 12,
  }),
  save_session: () => ({
    saved: true,
    session_id: 'sess_001',
  }),
  conclude_session: () => ({
    concluded: true,
    session_id: 'sess_001',
  }),

  // ── eve ─────────────────────────────────────────────
  clean_corpus: () => ({
    cleaned: true,
    removed: 3,
  }),
  replace_slop: () => ({
    replaced: 5,
  }),
  regenerate_record: () => ({
    regenerated: true,
    record_id: 'rec_001',
  }),
  evaluate_corpus_gate: () => ({
    passed: true,
    score: 0.92,
  }),
}

/**
 * In-memory session store for the stub Eve session API.
 */
interface StubSession {
  id: string
  message: string
  createdAt: number
}

const sessions = new Map<string, StubSession>()

interface ServeOptions {
  port?: string
  agent?: string
  verbose?: boolean
}

export function registerServeCommand(program: Command): void {
  program
    .command('serve')
    .description('Start a local stub agent server for development')
    .option('-p, --port <number>', 'Port to listen on', '2000')
    .option('-a, --agent <name>', 'Only serve tools for this agent')
    .option('-v, --verbose', 'Log each request')
    .action(async (opts: ServeOptions) => {
      const port = parseInt(opts.port ?? '2000', 10)

      // Load config to determine which tools to serve
      const { config } = loadConfig({})
      const agents = Object.entries(config.agents)

      // Filter to specific agent if --agent flag given
      const filteredAgents = opts.agent
        ? agents.filter(([name]) => name === opts.agent)
        : agents

      if (filteredAgents.length === 0) {
        console.error(pc.red(`px serve: agent "${opts.agent}" not found in config`))
        process.exitCode = 1
        return
      }

      // Build set of served tools for the status line
      const servedTools = new Set<string>()
      for (const [, agentConfig] of filteredAgents) {
        for (const tool of agentConfig.tools) {
          servedTools.add(tool)
        }
      }

      const server = createServer((req, res) => {
        handleRequest(req, res, opts.verbose ?? false, servedTools)
      })

      server.listen(port, () => {
        const agentNames = filteredAgents.map(([n]) => n).join(', ')
        console.log(pc.green(`px serve: stub server listening on http://localhost:${port}`))
        console.log(pc.gray(`  agents:  ${agentNames}`))
        console.log(pc.gray(`  tools:   ${servedTools.size} endpoints`))
        console.log(pc.gray(`  health:  GET /eve/v1/health`))
        console.log(pc.gray(`  session: POST /eve/v1/session, GET /eve/v1/session/:id/stream`))
        console.log(pc.gray(`  set PX_LOCAL=1 to route px commands to localhost`))
      })

      // Graceful shutdown
      const shutdown = () => {
        server.close(() => process.exit(0))
      }
      process.on('SIGINT', shutdown)
      process.on('SIGTERM', shutdown)
    })
}

function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  verbose: boolean,
  servedTools?: Set<string>,
): void {
  const url = req.url ?? ''

  if (verbose) {
    console.error(pc.gray(`  [serve] ${req.method} ${url}`))
  }

  // Health check
  if (req.method === 'GET' && url === '/eve/v1/health') {
    writeJson(res, 200, { ok: true, status: 'ok' })
    return
  }

  // Eve session API: POST /eve/v1/session
  if (req.method === 'POST' && url === '/eve/v1/session') {
    readBody(req, (body) => {
      const message = (body as { message?: string })?.message ?? ''
      const session: StubSession = {
        id: `wrun_${randomUUID()}`,
        message,
        createdAt: Date.now(),
      }
      sessions.set(session.id, session)

      writeJson(res, 200, {
        ok: true,
        sessionId: session.id,
        status: 'accepted',
      })

      if (verbose) {
        console.error(pc.gray(`  [serve] session ${session.id} created`))
      }
    })
    return
  }

  // Eve session stream: GET /eve/v1/session/:id/stream
  const streamMatch = url.match(/^\/eve\/v1\/session\/([^/]+)\/stream$/)
  if (req.method === 'GET' && streamMatch) {
    const sessionId = streamMatch[1]
    const session = sessions.get(sessionId)

    if (!session) {
      writeJson(res, 404, { error: 'session not found' })
      return
    }

    // Emit a minimal NDJSON event stream that the client expects
    const events = [
      { type: 'session.started', data: { sessionId } },
      { type: 'turn.started', data: {} },
      { type: 'message.received', data: { message: session.message } },
      {
        type: 'message.completed',
        data: {
          message: `[stub] Processed: ${session.message}`,
        },
      },
      { type: 'turn.completed', data: {} },
      { type: 'session.waiting', data: { wait: 'next-user-message' } },
    ]

    res.writeHead(200, {
      'content-type': 'application/x-ndjson',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })

    for (const event of events) {
      res.write(JSON.stringify(event) + '\n')
    }
    res.end()

    // Clean up session
    sessions.delete(sessionId)

    if (verbose) {
      console.error(pc.gray(`  [serve] stream closed for ${sessionId}`))
    }
    return
  }

  // Legacy tool invocation (backward compat): POST /eve/v1/<tool>
  if (req.method === 'POST' && url.startsWith('/eve/v1/') && !url.includes('/session')) {
    const tool = url.slice('/eve/v1/'.length)

    if (!tool) {
      writeJson(res, 400, { error: 'missing tool name' })
      return
    }

    const stub = TOOL_STUBS[tool]

    if (!stub) {
      writeJson(res, 404, {
        error: `unknown tool "${tool}"`,
        available: Object.keys(TOOL_STUBS),
      })
      return
    }

    // Filter by --agent flag if active
    if (servedTools && !servedTools.has(tool)) {
      writeJson(res, 404, {
        error: `tool "${tool}" not served on this instance`,
      })
      return
    }

    readBody(req, (body) => {
      let result: unknown
      try {
        result = stub(body)
      } catch {
        writeJson(res, 500, { error: 'stub execution failed' })
        return
      }

      writeJson(res, 200, result)

      if (verbose) {
        const summary = typeof result === 'object' && result !== null
          ? JSON.stringify(result).slice(0, 120)
          : String(result)
        console.error(pc.gray(`  [serve] → 200 ${summary}`))
      }
    })
    return
  }

  // Not found
  writeJson(res, 404, { error: 'not found' })
}

function readBody(req: IncomingMessage, cb: (body: unknown) => void): void {
  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', () => {
    if (chunks.length === 0) {
      cb({})
      return
    }
    const raw = Buffer.concat(chunks).toString('utf8')
    try {
      cb(raw.length > 0 ? JSON.parse(raw) : {})
    } catch {
      cb({})
    }
  })
  req.on('error', () => cb({}))
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

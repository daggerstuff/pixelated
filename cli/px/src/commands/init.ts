import { execSync } from 'node:child_process'
import { writeFileSync, existsSync, chmodSync } from 'node:fs'
import { join } from 'node:path'

import { Command } from 'commander'

import { loadConfig } from '../config/loader.js'
import type { AgentConfig } from '../config/schema.js'

const DEFAULT_CONFIG = {
  agents: {
    advisor: {
      endpoint: 'http://advisor-agent.pixelated.svc.cluster.local:2000',
      tools: ['review', 'get_worktree', 'read_file'],
      async: false,
      timeout: 30000,
    },
    content: {
      endpoint: 'http://content-agent.pixelated.svc.cluster.local:2000',
      tools: [
        'audit_corpus',
        'audit_clinical_corpus',
        'score_thread',
        'curate_showcase',
        'gate_injection',
      ],
      async: false,
      timeout: 30000,
    },
    qa: {
      endpoint: 'http://qa-agent.pixelated.svc.cluster.local:2000',
      tools: [
        'score_session',
        'fetch_sessions',
        'detect_emotional_patterns',
        'flag_training_gap',
        'summarize_cohort',
        'generate_report',
      ],
      async: true,
      timeout: 30000,
    },
    pipeline: {
      endpoint: 'http://pipeline-agent.pixelated.svc.cluster.local:2000',
      tools: [
        'curate_dataset',
        'run_training',
        'run_evaluation',
        'promote_to_staging',
        'promote_to_production',
        'rollback_model',
        'check_pipeline_health',
        'evaluate_pipeline_review',
      ],
      async: true,
      timeout: 30000,
    },
    intake: {
      endpoint: 'http://intake-agent.pixelated.svc.cluster.local:2000',
      tools: [
        'register_trainee',
        'assign_cohort',
        'list_cohorts',
        'get_trainee_status',
        'get_cohort_progress',
        'record_curriculum_step',
      ],
      async: false,
      timeout: 30000,
    },
    supervisor: {
      endpoint: 'http://supervisor-agent.pixelated.svc.cluster.local:2000',
      tools: [
        'query_cohort_trends',
        'compare_trainees',
        'list_flagged_sessions',
        'generate_supervisor_report',
        'query_trainee_timeline',
        'adjust_threshold',
        'adjust_trainee_status',
        'notify_slack',
      ],
      async: false,
      timeout: 30000,
    },
    session: {
      endpoint: 'http://session-agent.pixelated.svc.cluster.local:2000',
      tools: [
        'start_session',
        'process_message',
        'analyze_emotion',
        'analyze_pace',
        'check_clinical_boundary',
        'validate_response',
        'hydrate_session',
        'save_session',
        'conclude_session',
      ],
      async: false,
      timeout: 30000,
    },
  },
  slack: {
    channel: '#px-agent-results',
  },
  hooks: {
    'pre-commit': {
      agent: 'content',
      tool: 'audit_clinical_corpus',
      filter: 'scenarios/**',
    },
    'pre-push': { agent: 'advisor', tool: 'review' },
    'post-merge': {
      agent: 'pipeline',
      tool: 'check_pipeline_health',
      async: true,
    },
    'pr-open': { agent: 'advisor', tool: 'review', async: true },
    'pr-merge': {
      agent: 'qa',
      tool: 'score_session',
      filter: 'src/session/**',
      async: true,
    },
  },
}

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Install git hooks and write default config')
    .action(() => {
      const cwd = process.cwd()

      // Find repo root
      let dir = cwd
      while (dir !== '/') {
        if (existsSync(join(dir, '.git'))) break
        dir = join(dir, '..')
      }
      if (dir === '/') {
        console.error('px: could not find repo root (.git directory)')
        process.exit(1)
      }

      // Write default config if missing
      const configPath = join(dir, 'agents/px.config.json')
      if (!existsSync(configPath)) {
        writeFileSync(
          configPath,
          JSON.stringify(DEFAULT_CONFIG, null, 2) + '\n',
        )
        console.log(`Created: ${configPath}`)
      } else {
        console.log(`Exists:  ${configPath}`)
      }

      // Set git hooks path
      try {
        execSync('git config core.hooksPath cli/px/hooks', { cwd: dir })
        console.log('Git hooks path set to cli/px/hooks')
      } catch {
        console.error('px: failed to set git hooks path')
      }

      // Make hook scripts executable
      const hooksDir = join(dir, 'cli/px/hooks')
      if (existsSync(hooksDir)) {
        try {
          chmodSync(join(hooksDir, 'pre-commit.sh'), 0o755)
          chmodSync(join(hooksDir, 'pre-push.sh'), 0o755)
          chmodSync(join(hooksDir, 'post-merge.sh'), 0o755)
          chmodSync(join(hooksDir, 'pr-open.sh'), 0o755)
          chmodSync(join(hooksDir, 'pr-merge.sh'), 0o755)
          console.log('Hook scripts made executable')
        } catch {
          // Non-fatal
        }
      }

      // Show summary
      try {
        const { config } = loadConfig(dir)
        const agentCount = Object.keys(config.agents).length
        const toolCount = (
          Object.values(config.agents)
        ).reduce((sum, a) => sum + a.tools.length, 0)
        console.log(`\n${agentCount} agents, ${toolCount} tools configured.`)
        console.log('Run `px list` to see all agents.')
      } catch {
        // Config load may fail if just created
      }
    })
}

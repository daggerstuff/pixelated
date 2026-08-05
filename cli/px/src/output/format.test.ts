import { describe, it, expect } from 'vitest'

import type { LoadedConfig } from '../config/loader.js'
import type { PxConfig } from '../config/schema.js'
import { formatConfig, formatAgentList, formatHealthResult } from './format.js'

const config: PxConfig = {
  agents: {
    advisor: {
      endpoint: 'http://advisor:2000',
      tools: ['review', 'get_worktree'],
      async: false,
      timeout: 30000,
    },
    content: {
      endpoint: 'http://content:2000',
      tools: ['audit_clinical_corpus'],
      async: true,
      timeout: 60000,
    },
  },
  slack: { channel: '#px-results' },
  hooks: {
    'pre-commit': {
      agent: 'content',
      tool: 'audit_clinical_corpus',
      filter: 'scenarios/**',
    },
    'pre-push': { agent: 'advisor', tool: 'review' },
  },
}

describe('formatConfig', () => {
  it('shows sources, agents, slack, hooks', () => {
    const loaded: LoadedConfig = {
      config,
      sources: ['/repo/agents/px.config.json', '/repo/.px/config.json'],
    }
    const output = formatConfig(loaded)

    expect(output).toContain('resolved configuration')
    expect(output).toContain('Sources')
    expect(output).toContain('/repo/agents/px.config.json')
    expect(output).toContain('advisor')
    expect(output).toContain('http://advisor:2000')
    expect(output).toContain('review, get_worktree')
    expect(output).toContain('content')
    expect(output).toContain('#px-results')
    expect(output).toContain('Hooks')
    expect(output).toContain('pre-commit → content.audit_clinical_corpus')
    expect(output).toContain('filter: scenarios/**')
  })

  it('shows (none) for hooks when not configured', () => {
    const loaded: LoadedConfig = {
      config: { agents: config.agents },
      sources: ['/repo/agents/px.config.json'],
    }
    const output = formatConfig(loaded)
    expect(output).toContain('(none)')
  })
})

describe('formatAgentList', () => {
  it('lists all agents with details', () => {
    const output = formatAgentList(config)
    expect(output).toContain('available agents and tools')
    expect(output).toContain('advisor')
    expect(output).toContain('http://advisor:2000')
    expect(output).toContain('review, get_worktree')
    expect(output).toContain('async:    false')
    expect(output).toContain('content')
    expect(output).toContain('async:    true')
    expect(output).toContain('timeout:  60000ms')
  })

  it('shows hook mapping when hooks present', () => {
    const output = formatAgentList(config)
    expect(output).toContain('Hook mapping')
    expect(output).toContain('pre-commit → content.audit_clinical_corpus')
    expect(output).toContain('pre-push → advisor.review')
  })

  it('omits hook mapping when no hooks', () => {
    const output = formatAgentList({ agents: config.agents })
    expect(output).not.toContain('Hook mapping')
  })
})

describe('formatHealthResult', () => {
  it('shows ok/down/error counts and per-agent status', () => {
    const results = [
      {
        agent: 'advisor',
        endpoint: 'http://advisor:2000',
        status: 'ok' as const,
      },
      {
        agent: 'content',
        endpoint: 'http://content:2000',
        status: 'down' as const,
        detail: 'HTTP 503',
      },
      {
        agent: 'qa',
        endpoint: 'http://qa:2000',
        status: 'error' as const,
        detail: 'ECONNREFUSED',
      },
    ]
    const output = formatHealthResult(results)

    expect(output).toContain('agent health check')
    expect(output).toContain('✓')
    expect(output).toContain('advisor')
    expect(output).toContain('✗')
    expect(output).toContain('content')
    expect(output).toContain('HTTP 503')
    expect(output).toContain('!')
    expect(output).toContain('qa')
    expect(output).toContain('ECONNREFUSED')
    expect(output).toContain('1 ok, 1 down, 1 error (3 total)')
  })

  it('handles empty results', () => {
    const output = formatHealthResult([])
    expect(output).toContain('0 ok, 0 down, 0 error (0 total)')
  })
})

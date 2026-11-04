import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { loadConfig, findAgent, validateTool } from './loader.js'
import type { PxConfig, AgentConfig } from './schema.js'

// findRepoRoot() walks up from the given directory until it finds a `.git`
// entry, so a stray `.git` anywhere above the temp dir (e.g. /tmp/.git left by
// another tool) would make the "no repo root" case unreachable. Hide `.git`
// from existsSync for that one test so it stays deterministic.
const fsState = vi.hoisted(() => ({ hideGitDirs: false }))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return {
    ...actual,
    existsSync: (target: Parameters<typeof actual.existsSync>[0]) => {
      if (fsState.hideGitDirs && String(target).endsWith('.git')) return false
      return actual.existsSync(target)
    },
  }
})

// Helper: create a temp git repo with config
function createTempRepo(config: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), 'px-test-'))
  mkdirSync(join(dir, '.git'), { recursive: true })
  mkdirSync(join(dir, 'agents'), { recursive: true })
  writeFileSync(
    join(dir, 'agents', 'px.config.json'),
    JSON.stringify(config, null, 2),
  )
  return dir
}

const baseConfig: Record<string, unknown> = {
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
      async: false,
      timeout: 30000,
    },
  },
  hooks: {
    'pre-commit': { agent: 'content', tool: 'audit_clinical_corpus' },
  },
}

describe('loadConfig', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = createTempRepo(baseConfig)
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('uses strict loading when called with no arguments', () => {
    const noGitDir = mkdtempSync(join(tmpdir(), 'px-nogit-strict-'))
    const prevCwd = process.cwd()
    try {
      process.chdir(noGitDir)
      expect(() => loadConfig()).toThrow('repo root')
    } finally {
      process.chdir(prevCwd)
      rmSync(noGitDir, { recursive: true, force: true })
    }
  })

  it('loads default config from agents/px.config.json', () => {
    const { config, sources } = loadConfig(tempDir)
    expect(config.agents).toHaveProperty('advisor')
    expect(config.agents).toHaveProperty('content')
    expect(sources.length).toBeGreaterThanOrEqual(1)
    expect(sources[0]).toContain('agents/px.config.json')
  })

  it('throws if no repo root found', () => {
    const noGitDir = mkdtempSync(join(tmpdir(), 'px-nogit-'))
    fsState.hideGitDirs = true
    try {
      expect(() => loadConfig(noGitDir)).toThrow('repo root')
    } finally {
      fsState.hideGitDirs = false
      rmSync(noGitDir, { recursive: true, force: true })
    }
  })

  it('throws if config file missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'px-noconf-'))
    mkdirSync(join(dir, '.git'), { recursive: true })
    expect(() => loadConfig(dir)).toThrow('config not found')
    rmSync(dir, { recursive: true, force: true })
  })

  it('applies repo-local override (.px/config.json)', () => {
    // Create override
    mkdirSync(join(tempDir, '.px'), { recursive: true })
    writeFileSync(
      join(tempDir, '.px', 'config.json'),
      JSON.stringify({
        agents: {
          advisor: { endpoint: 'http://override:3000' },
        },
      }),
    )

    const { config, sources } = loadConfig(tempDir)
    expect(config.agents.advisor.endpoint).toBe('http://override:3000')
    expect(sources.length).toBe(2)
  })

  it('merges hooks from override', () => {
    mkdirSync(join(tempDir, '.px'), { recursive: true })
    writeFileSync(
      join(tempDir, '.px', 'config.json'),
      JSON.stringify({
        hooks: {
          'pre-push': { agent: 'advisor', tool: 'review' },
        },
      }),
    )

    const { config } = loadConfig(tempDir)
    expect(config.hooks).toHaveProperty('pre-commit')
    expect(config.hooks).toHaveProperty('pre-push')
  })
})

describe('environment endpoint overrides', () => {
  const originalFleetHost = process.env['PX_FLEET_HOST']
  const originalLocal = process.env['PX_LOCAL']

  afterEach(() => {
    if (originalFleetHost === undefined) {
      delete process.env['PX_FLEET_HOST']
    } else {
      process.env['PX_FLEET_HOST'] = originalFleetHost
    }
    if (originalLocal === undefined) {
      delete process.env['PX_LOCAL']
    } else {
      process.env['PX_LOCAL'] = originalLocal
    }
  })

  it('applies PX_FLEET_HOST to every agent, keeping each port', () => {
    const dir = createTempRepo({
      agents: {
        advisor: { endpoint: 'http://127.0.0.1:2005', tools: ['review'] },
        qa: { endpoint: 'http://127.0.0.1:2030', tools: ['score_session'] },
      },
    })
    delete process.env['PX_LOCAL']
    process.env['PX_FLEET_HOST'] = 'agents.example.com'

    try {
      const { config } = loadConfig(dir)
      expect(config.agents.advisor.endpoint).toBe(
        'http://agents.example.com:2005',
      )
      expect(config.agents.qa.endpoint).toBe('http://agents.example.com:2030')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('points every agent at the local stub server when PX_LOCAL=1', () => {
    const dir = createTempRepo({
      agents: {
        advisor: { endpoint: 'http://127.0.0.1:2005', tools: ['review'] },
        qa: { endpoint: 'http://127.0.0.1:2030', tools: ['score_session'] },
      },
    })
    delete process.env['PX_FLEET_HOST']
    process.env['PX_LOCAL'] = '1'

    try {
      const { config } = loadConfig(dir)
      expect(config.agents.advisor.endpoint).toBe('http://localhost:2000')
      expect(config.agents.qa.endpoint).toBe('http://localhost:2000')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('findAgent', () => {
  const config: PxConfig = {
    agents: {
      advisor: {
        endpoint: 'http://advisor:2000',
        tools: ['review'],
        async: false,
        timeout: 30000,
      },
    },
  }

  it('returns agent config when found', () => {
    const agent = findAgent(config, 'advisor')
    expect(agent.endpoint).toBe('http://advisor:2000')
  })

  it('throws with available agent list when not found', () => {
    expect(() => findAgent(config, 'nonexistent')).toThrow(
      /unknown agent.*Available:.*advisor/,
    )
  })
})

describe('validateTool', () => {
  const agent: AgentConfig = {
    endpoint: 'http://advisor:2000',
    tools: ['review', 'get_worktree'],
    async: false,
    timeout: 30000,
  }

  it('passes when tool exists', () => {
    expect(() => validateTool(agent, 'review')).not.toThrow()
    expect(() => validateTool(agent, 'get_worktree')).not.toThrow()
  })

  it('throws with available tools when tool not found', () => {
    expect(() => validateTool(agent, 'nonexistent')).toThrow(
      /does not expose tool.*Available:.*review.*get_worktree/,
    )
  })
})

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { loadConfig, loadConfigFile } from '../src/config/loader.js'
import { parsePxConfig } from '../src/config/schema.js'
import { deepMerge } from '../src/lib/deep-merge.js'

const testDir = dirname(fileURLToPath(import.meta.url))
const packageRoot = join(testDir, '..')
const repoDefaultConfig = join(
  packageRoot,
  '..',
  '..',
  'agents',
  'px.config.json',
)

describe('config schema', () => {
  it('validates the repo default config', () => {
    const config = loadConfigFile(repoDefaultConfig)
    expect(config.agents.content?.tools).toContain('audit_corpus')
    expect(config.hooks?.['pre-commit']?.agent).toBe('content')
  })

  it('rejects invalid agent endpoints', () => {
    expect(() =>
      parsePxConfig({
        agents: {
          bad: { endpoint: 'not-a-url', tools: ['x'] },
        },
      }),
    ).toThrow()
  })

  it('rejects config files with no agents section', () => {
    const path = join(tmpdir(), `px-no-agents-${Date.now()}.json`)
    writeFileSync(path, JSON.stringify({ hooks: {} }))
    expect(() => loadConfigFile(path)).toThrow()
    rmSync(path, { force: true })
  })
})

describe('deepMerge', () => {
  it('merges nested objects without clobbering siblings', () => {
    const merged = deepMerge(
      {
        agents: {
          content: {
            endpoint: 'http://[REDACTED]:2002',
            tools: ['audit_corpus'],
          },
        },
      },
      {
        agents: {
          content: { timeout: 60_000 },
        },
      },
    )

    expect(merged.agents.content.endpoint).toBe('http://[REDACTED]:2002')
    expect(merged.agents.content.timeout).toBe(60_000)
    expect(merged.agents.content.tools).toEqual(['audit_corpus'])
  })
})

describe('loadConfig precedence', () => {
  it('applies default < user < repo < cli overrides', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'px-config-repo-'))
    const userDir = mkdtempSync(join(tmpdir(), 'px-config-user-'))

    mkdirSync(join(repoRoot, 'agents'))
    mkdirSync(join(repoRoot, '.px'))
    mkdirSync(join(repoRoot, '.git'))
    mkdirSync(userDir, { recursive: true })
    mkdirSync(join(userDir, '.px'), { recursive: true })

    writeFileSync(
      join(repoRoot, 'agents', 'px.config.json'),
      JSON.stringify({
        agents: {
          content: {
            endpoint: 'http://default:2000',
            tools: ['audit_corpus'],
            async: false,
            timeout: 30000,
          },
        },
      }),
    )

    writeFileSync(
      join(userDir, '.px', 'config.json'),
      JSON.stringify({
        agents: {
          content: {
            endpoint: 'http://user:2000',
          },
        },
      }),
    )

    writeFileSync(
      join(repoRoot, '.px', 'config.json'),
      JSON.stringify({
        agents: {
          content: {
            endpoint: 'http://repo:2000',
          },
        },
      }),
    )

    const originalHome = process.env.HOME
    process.env.HOME = userDir

    try {
      const loaded = loadConfig({
        cwd: repoRoot,
        cliOverrides: {
          agent: 'content',
          endpoint: 'http://cli:2000',
        },
      })

      expect(loaded.config.agents.content?.endpoint).toBe('http://cli:2000')
      expect(loaded.sources.default).toContain('agents/px.config.json')
      expect(loaded.sources.user).toContain('.px/config.json')
      expect(loaded.sources.repo).toContain('.px/config.json')
      expect(loaded.sources.cli).toBe('cli flags')
    } finally {
      process.env.HOME = originalHome
    }
  })

  it('resolves default config from options.cwd, not process.cwd', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'px-config-cwd-'))
    const otherDir = mkdtempSync(join(tmpdir(), 'px-config-other-'))

    mkdirSync(join(repoRoot, 'agents'))
    mkdirSync(join(repoRoot, '.git'))
    writeFileSync(
      join(repoRoot, 'agents', 'px.config.json'),
      JSON.stringify({
        agents: {
          content: {
            endpoint: 'http://repo-cwd:2000',
            tools: ['audit_corpus'],
            async: false,
            timeout: 30000,
          },
        },
      }),
    )

    const originalHome = process.env.HOME
    process.env.HOME = otherDir

    try {
      const prevCwd = process.cwd()
      process.chdir(otherDir)
      try {
        const loaded = loadConfig({ cwd: repoRoot })
        expect(loaded.config.agents.content?.endpoint).toBe(
          'http://repo-cwd:2000',
        )
        expect(loaded.sources.default).toContain('agents/px.config.json')
      } finally {
        process.chdir(prevCwd)
      }
    } finally {
      process.env.HOME = originalHome
      rmSync(repoRoot, { recursive: true, force: true })
      rmSync(otherDir, { recursive: true, force: true })
    }
  })
})

describe('fleet host override', () => {
  it('swaps the host on every endpoint and keeps each agent port', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'px-config-fleet-'))
    const userDir = mkdtempSync(join(tmpdir(), 'px-config-fleet-user-'))

    mkdirSync(join(repoRoot, 'agents'))
    mkdirSync(join(repoRoot, '.git'))
    mkdirSync(join(userDir, '.px'), { recursive: true })

    writeFileSync(
      join(repoRoot, 'agents', 'px.config.json'),
      JSON.stringify({
        agents: {
          qa: { endpoint: 'http://127.0.0.1:2030', tools: ['score_session'] },
          session: {
            endpoint: 'http://127.0.0.1:2035',
            tools: ['start_session'],
          },
        },
      }),
    )

    const originalHome = process.env.HOME
    const originalFleetHost = process.env.PX_FLEET_HOST
    process.env.HOME = userDir
    process.env.PX_FLEET_HOST = '10.4.5.6'

    try {
      const loaded = loadConfig({ cwd: repoRoot })

      expect(loaded.config.agents.qa?.endpoint).toBe('http://10.4.5.6:2030')
      expect(loaded.config.agents.session?.endpoint).toBe(
        'http://10.4.5.6:2035',
      )
    } finally {
      process.env.HOME = originalHome
      if (originalFleetHost === undefined) {
        delete process.env.PX_FLEET_HOST
      } else {
        process.env.PX_FLEET_HOST = originalFleetHost
      }
    }
  })

  it('leaves endpoints untouched when PX_FLEET_HOST is unset', () => {
    const repoRoot = mkdtempSync(join(tmpdir(), 'px-config-nofleet-'))
    const userDir = mkdtempSync(join(tmpdir(), 'px-config-nofleet-user-'))

    mkdirSync(join(repoRoot, 'agents'))
    mkdirSync(join(repoRoot, '.git'))
    mkdirSync(join(userDir, '.px'), { recursive: true })

    writeFileSync(
      join(repoRoot, 'agents', 'px.config.json'),
      JSON.stringify({
        agents: {
          qa: { endpoint: 'http://127.0.0.1:2030', tools: ['score_session'] },
        },
      }),
    )

    const originalHome = process.env.HOME
    const originalFleetHost = process.env.PX_FLEET_HOST
    process.env.HOME = userDir
    delete process.env.PX_FLEET_HOST

    try {
      const loaded = loadConfig({ cwd: repoRoot })
      expect(loaded.config.agents.qa?.endpoint).toBe('http://127.0.0.1:2030')
    } finally {
      process.env.HOME = originalHome
      if (originalFleetHost !== undefined) {
        process.env.PX_FLEET_HOST = originalFleetHost
      }
    }
  })
})

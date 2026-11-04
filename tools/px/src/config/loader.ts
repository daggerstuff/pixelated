import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

import { deepMerge } from '../lib/deep-merge.js'
import { applyEndpointOverrides } from '../lib/endpoint-overrides.js'
import { isPlainObject } from '../lib/is-plain-object.js'
import {
  defaultConfigPath,
  repoConfigPath,
  userConfigPath,
} from '../lib/paths.js'
import type { PxConfig, AgentConfig } from './schema.js'
import {
  parseMergedPxConfig,
  parsePxConfig,
  WorkspaceConfigSchema,
} from './schema.js'

const DEFAULT_CONFIG_PATH = 'agents/px.config.json'
const REPO_LOCAL_OVERRIDE = '.px/config.json'
const USER_OVERRIDE = '.px/config.json'

type ConfigSource = 'default' | 'user' | 'repo' | 'cli'

export type LoadedConfig =
  | {
      config: PxConfig
      sources: string[]
    }
  | {
      config: PxConfig
      sources: Partial<Record<ConfigSource, string>>
    }

export interface LoadConfigOptions {
  cwd?: string
  cliOverrides?: Record<string, unknown>
}

function findRepoRoot(start: string): string | null {
  let dir = start
  while (dir !== '/') {
    if (existsSync(join(dir, '.git'))) return dir
    dir = resolve(dir, '..')
  }
  return null
}

function readJsonSafe(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
  } catch {
    return null
  }
}

function readJsonFile(path: string): Record<string, unknown> | undefined {
  try {
    const raw = readFileSync(path, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (!isPlainObject(parsed)) {
      throw new Error(`Config at ${path} must be a JSON object`)
    }
    return parsed
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

function mergeAgents(
  base: Record<string, AgentConfig>,
  override: Record<string, Partial<AgentConfig>>,
): Record<string, AgentConfig> {
  const result: Record<string, AgentConfig> = { ...base }
  for (const [key, val] of Object.entries(override)) {
    result[key] = { ...result[key], ...val }
  }
  return result
}

function mergeConfigs(base: PxConfig, override: Partial<PxConfig>): PxConfig {
  const merged: PxConfig = {
    agents: base.agents,
    slack: override.slack ?? base.slack,
    hooks: base.hooks,
    workspace: override.workspace ?? base.workspace,
  }
  if (override.agents) {
    merged.agents = mergeAgents(base.agents, override.agents)
  }
  if (base.hooks && override.hooks) {
    merged.hooks = { ...base.hooks, ...override.hooks }
  }
  if (merged.workspace) {
    const parsed = WorkspaceConfigSchema.parse(merged.workspace)
    merged.workspace = parsed
  }
  return merged
}

function cliOverridesToConfig(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const config: Record<string, unknown> = {}

  if (typeof overrides.endpoint === 'string') {
    const agentName =
      typeof overrides.agent === 'string' ? overrides.agent : 'default'
    config.agents = {
      [agentName]: { endpoint: overrides.endpoint },
    }
  }

  if (typeof overrides.timeout === 'number') {
    const agentName =
      typeof overrides.agent === 'string' ? overrides.agent : 'default'
    config.agents = {
      ...(isPlainObject(config.agents) ? config.agents : {}),
      [agentName]: {
        ...(isPlainObject(
          (config.agents as Record<string, unknown>)?.[agentName],
        )
          ? ((config.agents as Record<string, unknown>)[agentName] as Record<
              string,
              unknown
            >)
          : {}),
        timeout: overrides.timeout,
      },
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (key === 'endpoint' || key === 'timeout' || key === 'agent') {
      continue
    }
    config[key] = value
  }

  return config
}

function loadConfigFromPaths(
  options: LoadConfigOptions = {},
): LoadedConfig & { sources: Partial<Record<ConfigSource, string>> } {
  const cwd = options.cwd ?? process.cwd()
  const sources: Partial<Record<ConfigSource, string>> = {}

  const defaultPath = defaultConfigPath(cwd)
  const userPath = userConfigPath()
  const repoPath = repoConfigPath(cwd)

  const defaultRaw = readJsonFile(defaultPath)
  if (defaultRaw) {
    sources.default = defaultPath
  }

  const userRaw = readJsonFile(userPath)
  if (userRaw) {
    sources.user = userPath
  }

  const repoRaw = readJsonFile(repoPath)
  if (repoRaw) {
    sources.repo = repoPath
  }

  const cliRaw = options.cliOverrides
    ? cliOverridesToConfig(options.cliOverrides)
    : undefined
  if (cliRaw && Object.keys(cliRaw).length > 0) {
    sources.cli = 'cli flags'
  }

  const merged = deepMerge(defaultRaw ?? {}, userRaw, repoRaw, cliRaw)
  const config = parseMergedPxConfig(merged)

  // Environment overrides (PX_FLEET_HOST, PX_LOCAL)
  config.agents = applyEndpointOverrides(config.agents)

  return { config, sources }
}

function loadConfigStrict(cwd: string = process.cwd()): LoadedConfig {
  const sources: string[] = []

  const repoRoot = findRepoRoot(cwd)
  if (!repoRoot) {
    throw new Error(
      'px: could not find repo root (.git directory). Run from inside a git repo.',
    )
  }

  const defaultPath = join(repoRoot, DEFAULT_CONFIG_PATH)
  const defaultRaw = readJsonSafe(defaultPath)
  if (!defaultRaw) {
    throw new Error(
      `px: config not found at ${defaultPath}. Run \`px init\` to create it.`,
    )
  }
  sources.push(defaultPath)

  let config: PxConfig = defaultRaw as unknown as PxConfig

  const userPath = join(process.env['HOME'] ?? '/tmp', USER_OVERRIDE)
  const userRaw = readJsonSafe(userPath)
  if (userRaw) {
    sources.push(userPath)
    config = mergeConfigs(config, userRaw)
  }

  const repoLocalPath = join(repoRoot, REPO_LOCAL_OVERRIDE)
  const repoLocalRaw = readJsonSafe(repoLocalPath)
  if (repoLocalRaw) {
    sources.push(repoLocalPath)
    config = mergeConfigs(config, repoLocalRaw)
  }

  // 4. Environment overrides (PX_FLEET_HOST, PX_LOCAL)
  config = { ...config, agents: applyEndpointOverrides(config.agents) }

  return { config, sources }
}

export function loadConfig(): LoadedConfig
export function loadConfig(cwd: string): LoadedConfig
export function loadConfig(options: LoadConfigOptions): LoadedConfig
export function loadConfig(
  cwdOrOptions?: string | LoadConfigOptions,
): LoadedConfig {
  if (cwdOrOptions === undefined) {
    return loadConfigStrict()
  }
  if (typeof cwdOrOptions === 'string') {
    return loadConfigStrict(cwdOrOptions)
  }
  return loadConfigFromPaths(cwdOrOptions)
}

export function loadConfigFile(path: string): PxConfig {
  const raw = readJsonFile(path)
  if (!raw) {
    throw new Error(`Config file not found: ${path}`)
  }
  return parsePxConfig(raw)
}

export function findAgent(config: PxConfig, name: string): AgentConfig {
  const agent = config.agents[name]
  if (!agent) {
    const available = Object.keys(config.agents).join(', ')
    throw new Error(`px: unknown agent "${name}". Available: ${available}`)
  }
  return agent
}

export function validateTool(agent: AgentConfig, tool: string): void {
  if (!agent.tools.includes(tool)) {
    const available = agent.tools.join(', ')
    throw new Error(
      `px: agent "${agent.endpoint}" does not expose tool "${tool}". Available: ${available}`,
    )
  }
}

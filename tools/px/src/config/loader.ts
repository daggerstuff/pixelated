import { readFileSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'

import type { PxConfig, AgentConfig } from './schema.js'
import { WorkspaceConfigSchema } from './schema.js'

const DEFAULT_CONFIG_PATH = 'agents/px.config.json'
const REPO_LOCAL_OVERRIDE = '.px/config.json'
const USER_OVERRIDE = '.px/config.json' // relative to home

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
  // Validate workspace config after merge
  if (merged.workspace) {
    const parsed = WorkspaceConfigSchema.parse(merged.workspace)
    merged.workspace = parsed
  }
  return merged
}

export interface LoadedConfig {
  config: PxConfig
  sources: string[]
}

export function loadConfig(cwd: string = process.cwd()): LoadedConfig {
  const sources: string[] = []

  // 1. Default config from repo root
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

  // 2. User override (~/.px/config.json)
  const userPath = join(process.env['HOME'] ?? '/tmp', USER_OVERRIDE)
  const userRaw = readJsonSafe(userPath)
  if (userRaw) {
    sources.push(userPath)
    config = mergeConfigs(config, userRaw)
  }

  // 3. Repo-local override (.px/config.json relative to repo root)
  const repoLocalPath = join(repoRoot, REPO_LOCAL_OVERRIDE)
  const repoLocalRaw = readJsonSafe(repoLocalPath)
  if (repoLocalRaw) {
    sources.push(repoLocalPath)
    config = mergeConfigs(config, repoLocalRaw)
  }

  return { config, sources }
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

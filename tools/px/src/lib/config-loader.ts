import { readFileSync } from 'node:fs'

import { type PxConfig, parsePxConfig } from './config-schema.js'
import { deepMerge } from './deep-merge.js'
import { isPlainObject } from './is-plain-object.js'
import { defaultConfigPath, repoConfigPath, userConfigPath } from './paths.js'

type ConfigSource = 'default' | 'user' | 'repo' | 'cli'

export interface LoadedConfig {
  config: PxConfig
  sources: Partial<Record<ConfigSource, string>>
}

export interface LoadConfigOptions {
  cwd?: string
  cliOverrides?: Record<string, unknown>
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

export function loadConfig(options: LoadConfigOptions = {}): LoadedConfig {
  const cwd = options.cwd ?? process.cwd()
  const sources: Partial<Record<ConfigSource, string>> = {}

  const defaultPath = defaultConfigPath()
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

  const config = parsePxConfig(merged)

  // Local dev mode: when PX_LOCAL=1 is set, redirect all agent endpoints
  // to localhost so `px` commands hit a local stub server (from `px serve`).
  if (process.env['PX_LOCAL'] === '1') {
    const localPort = process.env['PX_LOCAL_PORT'] ?? '2000'
    const localEndpoint = `http://localhost:${localPort}`
    for (const agentName of Object.keys(config.agents)) {
      config.agents[agentName] = {
        ...config.agents[agentName],
        endpoint: localEndpoint,
      }
    }
  }

  return {
    config,
    sources,
  }
}

export function loadConfigFile(path: string): PxConfig {
  const raw = readJsonFile(path)
  if (!raw) {
    throw new Error(`Config file not found: ${path}`)
  }
  return parsePxConfig(raw)
}

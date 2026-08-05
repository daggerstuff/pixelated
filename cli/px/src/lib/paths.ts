import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = dirname(fileURLToPath(import.meta.url))

function findRepoRoot(startDir = process.cwd()): string {
  let current = resolve(startDir)

  while (true) {
    if (existsSync(join(current, '.git'))) {
      return current
    }

    const parent = dirname(current)
    if (parent === current) {
      return resolve(startDir)
    }

    current = parent
  }
}

export function defaultConfigPath(): string {
  const repoRoot = findRepoRoot()
  return join(repoRoot, 'agents', 'px.config.json')
}

export function userConfigPath(): string {
  return join(homedir(), '.px', 'config.json')
}

export function repoConfigPath(cwd = process.cwd()): string {
  return join(findRepoRoot(cwd), '.px', 'config.json')
}

function packageRoot(): string {
  return resolve(moduleDir, '..', '..')
}


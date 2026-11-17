import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Resolve the hackathon workspace that hosts the corpus repair scripts
 * (`scripts/fix/...`). The agents run with cwd = agents/<name>-agent, so the
 * repo root is two levels up. HACKATHON_ROOT overrides everything (containers,
 * alternate checkouts).
 */
export function hackathonRoot(): string | null {
  const candidates = [
    process.env.HACKATHON_ROOT,
    resolve(process.cwd(), '..', '..'),
    resolve(process.cwd(), '..', '..', 'hackathon'),
    '/home/vivi/pixelated/hackathon',
  ].filter((c): c is string => Boolean(c))

  for (const candidate of candidates) {
    const hackathonDir = candidate.endsWith('hackathon')
      ? candidate
      : resolve(candidate, 'hackathon')
    if (existsSync(resolve(hackathonDir, 'pyproject.toml'))) {
      return hackathonDir
    }
  }
  return null
}

export type HackathonScript =
  | { cwd: string; script: string }
  | { error: string }

/** Resolve a repo-relative script path (e.g. `scripts/fix/verify_repairs.py`). */
export function hackathonScript(relPath: string): HackathonScript {
  const root = hackathonRoot()
  if (!root) {
    return {
      error:
        'hackathon workspace not found (no pyproject.toml). ' +
        'Set HACKATHON_ROOT to the hackathon checkout.',
    }
  }
  const script = resolve(root, relPath)
  if (!existsSync(script)) {
    return {
      error:
        `corpus script not found: ${script}. ` +
        'The hackathon scripts/fix tree is not present in this checkout.',
    }
  }
  return { cwd: root, script }
}

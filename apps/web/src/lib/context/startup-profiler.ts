/**
 * Shared startup profiler for Pixelated agents.
 *
 * Wraps StartupProfiler from optimization.ts and provides a convenient
 * way to measure context consumption at any point in the agent lifecycle.
 *
 * Usage in agent code:
 *   import { profileAgentStartup } from '@/lib/context/startup-profiler.js'
 *   const report = await profileAgentStartup('pipeline-agent', { ... })
 */

import { StartupProfiler } from './optimization.js'

/**
 * Profile an agent's startup sequence.
 * Call this from any point where you want to measure context consumption.
 *
 * @param agentName - Name of the agent (e.g., 'pipeline-agent')
 * @param components - Map of component names to async loaders
 * @returns The profiler report after all components are loaded
 */
export async function profileAgentStartup(
  agentName: string,
  components: Record<string, () => Promise<unknown>>,
) {
  const profiler = new StartupProfiler()

  for (const [label, loader] of Object.entries(components)) {
    try {
      await profiler.profileAsync(label, async () => {
        const result = await loader()
        return result
      })
    } catch (err) {
      // error handled by caller
    }
  }

  const report = profiler.report()
  return report
}

/**
 * Options for profiling an agent's startup context from static connection
 * descriptions. This is the legacy shape used by agent entry points.
 */
export interface ProfileAndLogAgentStartupOptions {
  agentName: string
  agentDir: string
  connectionDescriptions?: Record<string, string>
}

/**
 * Profile and log an agent's startup context from its connection descriptions.
 *
 * This is a convenience wrapper around {@link StartupProfiler} for the common
 * case where the agent only needs to estimate the token footprint of its MCP
 * connection descriptions at startup.
 */
export function profileAndLogAgentStartup(
  options: ProfileAndLogAgentStartupOptions,
): void {
  const { agentName, connectionDescriptions } = options
  const profiler = new StartupProfiler()

  for (const [label, description] of Object.entries(
    connectionDescriptions ?? {},
  )) {
    profiler.profileText(label, description)
  }

  const report = profiler.report()
}

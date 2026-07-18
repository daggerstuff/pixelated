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

import { StartupProfiler, estimateTokens } from "./optimization.js";

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
  const profiler = new StartupProfiler();

  for (const [label, loader] of Object.entries(components)) {
    await profiler.profileAsync(label, async () => {
      const result = await loader();
      return result;
    });
  }

  const report = profiler.report();
  console.log(`[${agentName}] startup profile`, JSON.stringify(report, null, 2));
  return report;
}

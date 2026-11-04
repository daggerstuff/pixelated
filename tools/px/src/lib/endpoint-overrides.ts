/**
 * Environment-driven endpoint resolution.
 *
 * The committed `agents/px.config.json` endpoints are loopback addresses on the
 * fleet port map (see agents/deploy/README.md), so `px` works against a fleet
 * running on this machine. Both loaders apply the same overrides here so every
 * command resolves endpoints identically:
 *
 * - `PX_FLEET_HOST` swaps the hostname, keeping each agent's port.
 * - `PX_LOCAL=1` points every agent at `http://localhost:${PX_LOCAL_PORT:-2000}`.
 */
export function applyEndpointOverrides<T extends { endpoint: string }>(
  agents: Record<string, T>,
): Record<string, T> {
  const fleetHost = process.env['PX_FLEET_HOST']?.trim()
  const localMode = process.env['PX_LOCAL'] === '1'

  if (!fleetHost && !localMode) {
    return agents
  }

  const localEndpoint = `http://localhost:${process.env['PX_LOCAL_PORT'] ?? '2000'}`

  const resolved: Record<string, T> = {}
  for (const [name, agent] of Object.entries(agents)) {
    let endpoint = agent.endpoint

    if (fleetHost) {
      let url: URL
      try {
        url = new URL(endpoint)
      } catch {
        throw new Error(
          `px: cannot apply PX_FLEET_HOST to agent "${name}" because its endpoint "${endpoint}" is not a valid URL.`,
        )
      }
      url.hostname = fleetHost
      endpoint = url.origin
    }

    if (localMode) {
      endpoint = localEndpoint
    }

    resolved[name] = { ...agent, endpoint }
  }

  return resolved
}

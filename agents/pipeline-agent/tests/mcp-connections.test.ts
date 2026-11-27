import { describe, it, expect, vi, afterEach } from 'vitest'

// Both connection modules read their environment when they load, so every case
// imports a fresh copy after the environment is stubbed.
async function loadTrainingInfra() {
  vi.resetModules()
  const mod = await import('../agent/connections/training-infra-mcp.js')
  return mod.default
}

async function loadWorkersAi() {
  vi.resetModules()
  const mod = await import('../agent/connections/workers-ai-mcp.js')
  return mod.default
}

type TokenAuth = { getToken: () => Promise<{ token: string }> }

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('training infra MCP connection', () => {
  it('defaults to the local runner endpoint and follows TRAINING_INFRA_MCP_URL', async () => {
    vi.stubEnv('TRAINING_INFRA_MCP_URL', undefined)
    expect((await loadTrainingInfra()).url).toBe('http://127.0.0.1:8766/mcp')

    vi.stubEnv('TRAINING_INFRA_MCP_URL', 'http://training-infra.local/mcp')
    expect((await loadTrainingInfra()).url).toBe(
      'http://training-infra.local/mcp',
    )
  })

  it('carries no auth when no token is configured', async () => {
    vi.stubEnv('TRAINING_INFRA_MCP_TOKEN', '')
    expect((await loadTrainingInfra()).auth).toBeUndefined()
  })

  it('reads the bearer token on every call so a reused client sees a rotated token', async () => {
    vi.stubEnv('TRAINING_INFRA_MCP_TOKEN', 'token-one')
    const auth = (await loadTrainingInfra()).auth as TokenAuth | undefined
    expect(typeof auth?.getToken).toBe('function')

    await expect(auth?.getToken()).resolves.toEqual({ token: 'token-one' })

    // eve reuses the connection opened by an earlier step of the same turn
    // (eve 1.4.0, MCP client pooling), so the token is resolved per call
    // instead of being captured when the definition loads.
    vi.stubEnv('TRAINING_INFRA_MCP_TOKEN', 'token-two')
    await expect(auth?.getToken()).resolves.toEqual({ token: 'token-two' })
  })
})

describe('Workers AI MCP connection', () => {
  it('declares the deployed endpoint once and asks for SSE responses', async () => {
    const def = await loadWorkersAi()
    expect(def.url).toBe('https://workers-ai-mcp.coburncd.workers.dev/mcp')
    expect(def.headers).toEqual({
      Accept: 'application/json, text/event-stream',
    })
    expect(def.auth).toBeUndefined()
  })
})

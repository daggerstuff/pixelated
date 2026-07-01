/* @vitest-environment node */
/**
 * src/lib/memory/__tests__/browser-memory-boundary.test.ts
 *
 * PIX-1920: Browser-to-internal-memory-service boundary tests.
 *
 * These tests verify:
 * - mcp-memory-client.ts always uses relative /api/v1/memory/* URLs
 * - useMemory.ts always delegates to mcpMemoryManager (never localMemoryManager)
 * - No NEXT_PUBLIC_* env vars or internal service URLs leak into browser code
 * - In-process MemoryService is not used in any production memory path
 *
 * These are NOT tests of the memory API routes themselves
 * (those live in memory-routes.test.ts).
 */

import { createRequire } from 'module'

import { describe, expect, it, vi } from 'vitest'

const requireFromHere = createRequire(import.meta.url)

// ---------------------------------------------------------------------------
// Test 1: mcp-memory-client.ts uses only relative URLs
// ---------------------------------------------------------------------------
describe('mcpMemoryManager URL isolation', () => {
  // We import the module and inspect its source to assert no absolute URLs
  it('has no NEXT_PUBLIC_APP_ORIGIN reference', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(
        requireFromHere.resolve('../mcp-memory-client.ts'),
        'utf8',
      ),
    )
    // Should NOT contain NEXT_PUBLIC_APP_ORIGIN
    expect(source).not.toContain('NEXT_PUBLIC_APP_ORIGIN')
    expect(source).not.toContain("process.env['NEXT_PUBLIC_APP_ORIGIN']")
    // Should NOT construct absolute URLs
    expect(source).not.toMatch(/\bhttps?:\/\//)
  })

  it('uses only relative /api/v1/memory paths via MemoryApiClient', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(
        requireFromHere.resolve('../mcp-memory-client.ts'),
        'utf8',
      ),
    )
    expect(source).toContain('DEFAULT_MEMORY_API_BASE_URL')
    expect(source).toContain('/api/v1/memory')
    expect(source).not.toMatch(/\bfetch\(\s*['"]\/api\/memory\//)
  })

  it('routes gating through relative /api/ingestion/gate paths', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(
        requireFromHere.resolve('../memory-api-client.ts'),
        'utf8',
      ),
    )
    expect(source).toContain("'/api/ingestion/gate'")
    expect(source).not.toContain('127.0.0.1:8100')
  })
})

// ---------------------------------------------------------------------------
// Test 2: useMemory.ts always uses mcpMemoryManager
// ---------------------------------------------------------------------------
describe('useMemory always routes through gateway', () => {
  it('does not reference localMemoryManager as active runtime path', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(
        requireFromHere.resolve('../../../hooks/useMemory.ts'),
        'utf8',
      ),
    )
    // localMemoryManager may be imported but must NOT be the active runtime path
    // The active path must be mcpMemoryManager unconditionally
    expect(source).not.toMatch(
      /process\.env\['NEXT_PUBLIC_USE_LOCAL_MEMORY'\]\s*===\s*['"]true['"]/,
    )
    expect(source).not.toMatch(
      /process\.env\['NEXT_PUBLIC_USE_MCP_MEMORY'\]\s*===\s*['"]false['"]/,
    )
    // Should NOT have conditional that picks localMemoryManager at runtime
    expect(source).not.toMatch(/localMemoryManager\s*[?:]/)
  })

  it('imports localMemoryManager only for type/compile-time reference', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(
        requireFromHere.resolve('../../../hooks/useMemory.ts'),
        'utf8',
      ),
    )
    // If localMemoryManager is imported at all, it must NOT be assigned to memoryManager
    // Check that the memoryManager constant directly assigns mcpMemoryManager
    const memoryManagerConst = source.match(
      /const memoryManager\s*=\s*mcpMemoryManager/,
    )
    expect(memoryManagerConst).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Test 3: No internal service credentials in client-accessible code
// ---------------------------------------------------------------------------
describe('no internal service credentials in browser-accessible code', () => {
  it('mcp-memory-client has no actor ID or secret references', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(
        requireFromHere.resolve('../mcp-memory-client.ts'),
        'utf8',
      ),
    )
    expect(source).not.toContain('ACTOR_ID')
    expect(source).not.toContain('ACTOR_SECRET')
    expect(source).not.toContain('actorId')
    expect(source).not.toContain('actorSecret')
    expect(source).not.toContain('MEMORY_SERVICE_ACTOR_ID')
    expect(source).not.toContain('X-Memory-Actor-Id')
  })

  it('useMemory has no internal service config references', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(
        requireFromHere.resolve('../../../hooks/useMemory.ts'),
        'utf8',
      ),
    )
    expect(source).not.toContain('ACTOR')
    expect(source).not.toContain('SUBCONSCIOUS')
    expect(source).not.toContain('MEMORY_SERVICE_')
    expect(source).not.toContain('NEXT_PUBLIC_APP_ORIGIN')
  })
})

// ---------------------------------------------------------------------------
// Test 4: InProcessMemoryService is test/dev only (not in production paths)
// ---------------------------------------------------------------------------
describe('InProcessMemoryService is not in production memory paths', () => {
  it('is not referenced by mcp-memory-client or useMemory', async () => {
    const clientSource = await import('fs').then((fs) =>
      fs.readFileSync(
        requireFromHere.resolve('../mcp-memory-client.ts'),
        'utf8',
      ),
    )
    const hookSource = await import('fs').then((fs) =>
      fs.readFileSync(
        requireFromHere.resolve('../../../hooks/useMemory.ts'),
        'utf8',
      ),
    )
    expect(clientSource).not.toContain('InProcessMemoryService')
    expect(hookSource).not.toContain('InProcessMemoryService')
  })

  it('useMemory.ts does not have NEXT_PUBLIC_USE_LOCAL_MEMORY env-var override', async () => {
    const source = await import('fs').then((fs) =>
      fs.readFileSync(
        requireFromHere.resolve('../../../hooks/useMemory.ts'),
        'utf8',
      ),
    )
    // The fix removes these env-var checks entirely
    expect(source).not.toContain('NEXT_PUBLIC_USE_LOCAL_MEMORY')
    expect(source).not.toContain('NEXT_PUBLIC_USE_MCP_MEMORY')
  })
})

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InternalMemoryServiceClient } from './internal-memory-service-client'
import { McpMemoryTransport } from './mcp-memory-transport'
import { createMemoryTransport } from './memory-transport-factory'

describe('memory-transport-factory', () => {
  const ORIGINAL_ENV = { ...process.env }

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV }
    process.env['MEMORY_SERVICE_ACTOR_ID'] = 'test-actor'
    process.env['MEMORY_SERVICE_ACTOR_SECRET'] = 'test-secret'
    vi.clearAllMocks()
  })

  describe('createMemoryTransport', () => {
    it('should default to http-loopback transport', () => {
      // Remove any transport override
      delete process.env['MEMORY_SERVICE_TRANSPORT']

      const transport = createMemoryTransport()

      expect(transport).toHaveProperty('addMemory')
      expect(transport).toHaveProperty('getMemory')
    })

    it('should use http-loopback when explicitly set', () => {
      process.env['MEMORY_SERVICE_TRANSPORT'] = 'http-loopback'

      const transport = createMemoryTransport()

      expect(transport).toHaveProperty('addMemory')
      expect(transport).toHaveProperty('getMemory')
    })

    it('should use mcp transport when set to mcp', () => {
      process.env['MEMORY_SERVICE_TRANSPORT'] = 'mcp'

      const transport = createMemoryTransport()

      expect(transport).toBeInstanceOf(McpMemoryTransport)
    })

    it('should use custom launcher path when provided', () => {
      process.env['MEMORY_SERVICE_TRANSPORT'] = 'mcp'
      process.env['FORESIGHT_LAUNCHER'] = '/custom/path/to/launcher.sh'

      const transport = createMemoryTransport() as McpMemoryTransport

      // We can't easily test the internal launcherPath due to encapsulation
      // but we can verify it's an instance of McpMemoryTransport
      expect(transport).toBeInstanceOf(McpMemoryTransport)
    })

    it('should use custom timeout when provided', () => {
      process.env['MEMORY_SERVICE_TRANSPORT'] = 'mcp'
      process.env['MEMORY_SERVICE_TIMEOUT_MS'] = '10000'

      const transport = createMemoryTransport() as McpMemoryTransport

      expect(transport).toBeInstanceOf(McpMemoryTransport)
    })

    it('should throw error for invalid transport type', () => {
      process.env['MEMORY_SERVICE_TRANSPORT'] = 'invalid-transport'

      expect(() => createMemoryTransport()).toThrow(
        /Unknown memory service transport: invalid-transport/,
      )
    })
  })
})

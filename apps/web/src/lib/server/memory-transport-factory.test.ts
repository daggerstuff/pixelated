// @vitest-environment node

import type { UnifiedMemory } from '@pixelated/memory-schema'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  InternalMemoryServiceClient,
  type InternalMemoryRecord,
} from './internal-memory-service-client'
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

  describe('http-loopback adapter mapping', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    const httpTransport = () => {
      process.env['MEMORY_SERVICE_TRANSPORT'] = 'http-loopback'
      return createMemoryTransport()
    }

    const record = (
      overrides: Partial<InternalMemoryRecord> = {},
    ): InternalMemoryRecord => ({
      id: 'mem-1',
      content: 'session note',
      created_at: '2026-01-01T00:00:00.000Z',
      ...overrides,
    })

    it('projects a listed record into a fully populated UnifiedMemory', async () => {
      const spy = vi
        .spyOn(InternalMemoryServiceClient.prototype, 'listMemories')
        .mockResolvedValue({
          memories: [
            record({
              metadata: {
                category: 'decision',
                tags: ['a', 2, 'b'],
                importance: 0.9,
              },
            }),
          ],
          count: 1,
        })

      const transport = httpTransport()
      const result = await transport.listMemories({ userId: 'u1', limit: 10 })

      expect(spy).toHaveBeenCalledWith({ userId: 'u1', limit: 10 })
      expect(result.count).toBe(1)
      expect(result.memories).toEqual<UnifiedMemory[]>([
        {
          id: 'mem-1',
          tenantId: 'default',
          userId: 'u1',
          bankId: 'default',
          content: 'session note',
          scope: 'session',
          retention: 'short_term',
          category: 'decision',
          tags: ['a', 'b'],
          version: 1,
          schemaVersion: '1.0.0',
          sourceService: 'foresight',
          importance: 0.9,
          decayRate: 0.01,
          strengthTrend: 'stable',
          activationCount: 0,
          retrievalCount: 0,
          isGhost: false,
          gist: null,
          synthesizedFrom: [],
          vectorId: null,
          emotionalContext: null,
          empathyMetrics: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: null,
          accessedAt: null,
          lastRetrievedAt: null,
        },
      ])
    })

    it('falls back to the memory field and metadata defaults', async () => {
      vi.spyOn(
        InternalMemoryServiceClient.prototype,
        'listMemories',
      ).mockResolvedValue({
        memories: [{ id: 'mem-2', memory: 'legacy body' }],
        count: 1,
      })

      const result = await httpTransport().listMemories({
        userId: 'u1',
        limit: 10,
      })

      expect(result.memories).toMatchObject([
        {
          id: 'mem-2',
          content: 'legacy body',
          category: 'general',
          tags: [],
          importance: 0.5,
          updatedAt: null,
        },
      ])
      expect(typeof result.memories[0]?.createdAt).toBe('string')
    })

    it('prefers camelCase timestamps over snake_case ones', async () => {
      vi.spyOn(
        InternalMemoryServiceClient.prototype,
        'listMemories',
      ).mockResolvedValue({
        memories: [
          record({
            created_at: 'snake-created',
            createdAt: 'camel-created',
            updated_at: 'snake-updated',
            updatedAt: 'camel-updated',
          }),
        ],
        count: 1,
      })

      const result = await httpTransport().listMemories({
        userId: 'u1',
        limit: 10,
      })

      expect(result.memories).toMatchObject([
        { createdAt: 'camel-created', updatedAt: 'camel-updated' },
      ])
    })

    it('keeps a well-formed emotional context and empathy metrics', async () => {
      vi.spyOn(
        InternalMemoryServiceClient.prototype,
        'listMemories',
      ).mockResolvedValue({
        memories: [
          record({
            metadata: {
              emotional_context: {
                valence: -0.4,
                arousal: 0.6,
                dominance: 0.2,
                primaryEmotion: 'grief',
                intensity: 0.8,
              },
              metrics: {
                reciprocity: 0.5,
                validationAccuracy: 0.6,
                resistanceLevel: 0.1,
              },
            },
          }),
        ],
        count: 1,
      })

      const result = await httpTransport().listMemories({
        userId: 'u1',
        limit: 10,
      })

      expect(result.memories).toMatchObject([
        {
          emotionalContext: {
            valence: -0.4,
            arousal: 0.6,
            dominance: 0.2,
            primaryEmotion: 'grief',
            intensity: 0.8,
          },
          empathyMetrics: {
            reciprocity: 0.5,
            validationAccuracy: 0.6,
            resistanceLevel: 0.1,
          },
        },
      ])
    })

    it('discards emotional context and metrics that fail schema validation', async () => {
      vi.spyOn(
        InternalMemoryServiceClient.prototype,
        'listMemories',
      ).mockResolvedValue({
        memories: [
          record({
            metadata: {
              emotional_context: { valence: 'high' },
              metrics: { reciprocity: 2 },
            },
          }),
        ],
        count: 1,
      })

      const result = await httpTransport().listMemories({
        userId: 'u1',
        limit: 10,
      })

      expect(result.memories).toMatchObject([
        { emotionalContext: null, empathyMetrics: null },
      ])
    })

    it('ignores non-string tags, non-numeric importance and non-string category', async () => {
      vi.spyOn(
        InternalMemoryServiceClient.prototype,
        'listMemories',
      ).mockResolvedValue({
        memories: [
          record({
            metadata: {
              tags: 'not-an-array',
              importance: 'high',
              category: 42,
            },
          }),
        ],
        count: 1,
      })

      const result = await httpTransport().listMemories({
        userId: 'u1',
        limit: 10,
      })

      expect(result.memories).toMatchObject([
        { tags: [], importance: 0.5, category: 'general' },
      ])
    })

    it('projects search results through the same mapper', async () => {
      const spy = vi
        .spyOn(InternalMemoryServiceClient.prototype, 'searchMemories')
        .mockResolvedValue({
          memories: [record({ id: 'mem-3', metadata: { importance: 0.25 } })],
          count: 7,
        })

      const result = await httpTransport().searchMemories({
        userId: 'u2',
        query: 'grief',
        limit: 5,
      })

      expect(spy).toHaveBeenCalledWith({
        userId: 'u2',
        query: 'grief',
        limit: 5,
      })
      expect(result.count).toBe(7)
      expect(result.memories).toMatchObject([
        { id: 'mem-3', userId: 'u2', importance: 0.25 },
      ])
    })

    it('returns null from getMemory when the service has no record', async () => {
      const spy = vi
        .spyOn(InternalMemoryServiceClient.prototype, 'getMemory')
        .mockResolvedValue(null)

      const result = await httpTransport().getMemory({
        userId: 'u1',
        memoryId: 'missing',
      })

      expect(spy).toHaveBeenCalledWith({ userId: 'u1', memoryId: 'missing' })
      expect(result).toBeNull()
    })

    it('projects a single fetched record with the caller userId', async () => {
      vi.spyOn(
        InternalMemoryServiceClient.prototype,
        'getMemory',
      ).mockResolvedValue(record({ id: 'mem-4', metadata: { tags: ['x'] } }))

      const result = await httpTransport().getMemory({
        userId: 'u9',
        memoryId: 'mem-4',
      })

      expect(result).toMatchObject({
        id: 'mem-4',
        userId: 'u9',
        tags: ['x'],
        content: 'session note',
      })
    })

    it('delegates create, update, delete and stats without reshaping', async () => {
      const add = vi
        .spyOn(InternalMemoryServiceClient.prototype, 'addMemory')
        .mockResolvedValue({ memory_id: 'mem-9' })
      const update = vi
        .spyOn(InternalMemoryServiceClient.prototype, 'updateMemory')
        .mockResolvedValue(undefined)
      const remove = vi
        .spyOn(InternalMemoryServiceClient.prototype, 'deleteMemory')
        .mockResolvedValue(undefined)
      const stats = vi
        .spyOn(InternalMemoryServiceClient.prototype, 'getMemoryStats')
        .mockResolvedValue({
          totalMemories: 3,
          categoryCounts: { general: 3 },
        })

      const transport = httpTransport()

      await expect(
        transport.addMemory({ userId: 'u1', content: 'hello' }),
      ).resolves.toEqual({ memory_id: 'mem-9' })
      await transport.updateMemory({
        userId: 'u1',
        memoryId: 'mem-1',
        content: 'edited',
      })
      await transport.deleteMemory({ userId: 'u1', memoryId: 'mem-1' })
      await expect(transport.getMemoryStats({ userId: 'u1' })).resolves.toEqual(
        { totalMemories: 3, categoryCounts: { general: 3 } },
      )

      expect(add).toHaveBeenCalledWith({ userId: 'u1', content: 'hello' })
      expect(update).toHaveBeenCalledWith({
        userId: 'u1',
        memoryId: 'mem-1',
        content: 'edited',
      })
      expect(remove).toHaveBeenCalledWith({ userId: 'u1', memoryId: 'mem-1' })
      expect(stats).toHaveBeenCalledWith({ userId: 'u1' })
    })
  })
})

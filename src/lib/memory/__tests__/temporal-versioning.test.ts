// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { InProcessMemoryService } from './in-process-memory-service'

describe('InProcessMemoryService temporal versioning', () => {
  it('preserves old versions and returns only latest memories by default', async () => {
    const service = new InProcessMemoryService()
    const created = await service.createMemory('I live in NYC', {
      userId: 'user-1',
      tags: ['profile'],
      metadata: { category: 'location' },
    })

    const updated = await service.updateMemory(created.id, 'user-1', {
      content: 'I live in SF',
      metadata: { source: 'conversation' },
    })

    const latest = await service.listMemories('user-1')
    const history = await service.listMemories('user-1', {
      includeHistory: true,
      sortBy: 'validFrom',
      sortOrder: 'asc',
    })

    expect(updated).toMatchObject({
      id: created.id,
      content: 'I live in SF',
      isLatest: true,
      validUntil: undefined,
      metadata: { category: 'location', source: 'conversation' },
    })
    expect(latest).toHaveLength(1)
    expect(latest[0]).toMatchObject({
      id: created.id,
      content: 'I live in SF',
      isLatest: true,
    })
    expect(history).toHaveLength(2)
    expect(history[0]).toMatchObject({
      content: 'I live in NYC',
      isLatest: false,
    })
    expect(history[0].validUntil).toEqual(updated!.validFrom)
    expect(history[1]).toMatchObject({
      content: 'I live in SF',
      isLatest: true,
      validUntil: undefined,
    })
  })

  it('searches only latest memories unless history is requested', async () => {
    const service = new InProcessMemoryService()
    const created = await service.createMemory('I live in NYC', {
      userId: 'user-1',
    })

    await service.updateMemory(created.id, 'user-1', {
      content: 'I live in SF',
    })

    await expect(service.searchMemories('user-1', 'NYC')).resolves.toEqual([])
    await expect(
      service.searchMemories('user-1', 'NYC', { includeHistory: true }),
    ).resolves.toHaveLength(1)
  })

  it('getMemory returns only the latest version', async () => {
    const service = new InProcessMemoryService()
    const created = await service.createMemory('v1', { userId: 'u1' })
    await service.updateMemory(created.id, 'u1', { content: 'v2' })

    const result = await service.getMemory(created.id, 'u1')
    expect(result).not.toBeNull()
    expect(result!.content).toBe('v2')
    expect(result!.isLatest).toBe(true)
  })

  it('getMemoryCount counts only latest memories', async () => {
    const service = new InProcessMemoryService()
    const m1 = await service.createMemory('a', { userId: 'u1' })
    await service.createMemory('b', { userId: 'u1' })
    await service.updateMemory(m1.id, 'u1', { content: 'a2' })

    expect(await service.getMemoryCount('u1')).toBe(2)
  })
})

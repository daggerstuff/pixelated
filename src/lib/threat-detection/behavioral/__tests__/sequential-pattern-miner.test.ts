import { describe, expect, it, vi } from 'vitest'

import { SequentialPatternMiner } from '../miners/sequential-pattern-miner'

describe('SequentialPatternMiner', () => {
  it('uses true sequence support instead of last-item-only support', () => {
    const miner = new SequentialPatternMiner() as any
    const sequences = [
      ['A', 'X'],
      ['B', 'X'],
      ['A', 'Y'],
      ['B', 'Y'],
    ]

    const idLists = miner.buildIdLists(sequences)

    expect(
      miner.isFrequentSequence(['A', 'X'], idLists, 0.5, sequences.length),
    ).toBe(false)
    expect(
      miner.isFrequentSequence(['A'], idLists, 0.5, sequences.length),
    ).toBe(true)
  })

  it('selects SPADE for small, simple inputs', async () => {
    const miner = new SequentialPatternMiner() as any
    const spadeSpy = vi.spyOn(miner, 'spade').mockResolvedValue([])
    const prefixSpanSpy = vi.spyOn(miner, 'prefixSpan').mockResolvedValue([])

    await miner.mineFrequentPatterns([
      ['login', 'view'],
      ['login', 'logout'],
      ['view', 'logout'],
    ])

    expect(spadeSpy).toHaveBeenCalledTimes(1)
    expect(prefixSpanSpy).not.toHaveBeenCalled()
  })

  it('selects PrefixSpan and caps overly large inputs', async () => {
    const miner = new SequentialPatternMiner() as any
    const spadeSpy = vi.spyOn(miner, 'spade').mockResolvedValue([])
    const prefixSpanSpy = vi.spyOn(miner, 'prefixSpan').mockResolvedValue([])

    const largeInput = Array.from({ length: 7000 }, (_, index) => [
      'event',
      String(index),
    ])

    await miner.mineFrequentPatterns(largeInput)

    expect(spadeSpy).not.toHaveBeenCalled()
    expect(prefixSpanSpy).toHaveBeenCalledTimes(1)

    const [boundedInput] = prefixSpanSpy.mock.calls[0] as [unknown]
    expect(Array.isArray(boundedInput)).toBe(true)
    expect((boundedInput as string[][]).length).toBe(5000)
  })
})

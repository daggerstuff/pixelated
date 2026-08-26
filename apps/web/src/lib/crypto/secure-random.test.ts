/** @vitest-environment node */
import { describe, it, expect } from 'vitest'

import { secureRandomHex } from './secure-random'

const HEX_PATTERN = /^[0-9a-f]+$/

describe('secureRandomHex', () => {
  it('returns a hex string of expected length based on byte count', () => {
    const hex1 = secureRandomHex(16)
    expect(hex1).toHaveLength(32)
    expect(hex1).toMatch(HEX_PATTERN)

    const hex2 = secureRandomHex()
    expect(hex2).toHaveLength(64)
    expect(hex2).toMatch(HEX_PATTERN)
  })

  it('returns valid hex strings for varying byte counts', () => {
    for (const bytes of [1, 2, 4, 8, 16, 32, 64]) {
      const hex = secureRandomHex(bytes)
      expect(hex).toHaveLength(bytes * 2)
      expect(hex).toMatch(HEX_PATTERN)
    }
  })
})

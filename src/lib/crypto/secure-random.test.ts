import { describe, it, expect } from 'vitest'
import { secureRandomHex } from './secure-random'

describe('secureRandomHex', () => {
  it('returns a hex string of expected length based on byte count', () => {
    const hex1 = secureRandomHex(16)
    expect(hex1).toHaveLength(32)
    const hex2 = secureRandomHex()
    expect(hex2).toHaveLength(64)
  })
})

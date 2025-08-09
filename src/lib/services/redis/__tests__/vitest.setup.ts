import { customMatchers } from './test-utils'
import type { RedisErrorCode } from '../types'

// Extend Vitest's expect with custom matchers
// Make sure this is called exactly once
expect.extend(customMatchers)

// Define custom assertion interface
interface CustomMatchers {
  toBeRedisError(expectedCode: RedisErrorCode): void
  toBeInRedis(expectedValue: unknown): Promise<void>
  toExistInRedis(): Promise<void>
  toHaveTTL(expectedTTL: number): Promise<void>
}

// Augment the global scope with custom matcher types
declare global {
  namespace Vi {
    interface Assertion extends CustomMatchers {}
    interface AsymmetricMatchersContaining extends CustomMatchers {}
  }
}

export {}

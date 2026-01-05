import { customMatchers } from './test-utils'

// Extend Vitest's expect with custom matchers
// Make sure this is called exactly once
expect.extend(customMatchers as any)

// Custom matchers for Redis testing
// Note: Vitest custom matchers would be declared here if needed

export {}

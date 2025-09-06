import { vi } from 'vitest'

export const createBuildSafeLogger = vi.fn().mockReturnValue({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
})

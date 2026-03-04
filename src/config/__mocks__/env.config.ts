import { vi } from 'vitest'

export const config = {
  isProduction: vi.fn().mockReturnValue(false),
  isDevelopment: vi.fn().mockReturnValue(true),
  security: {
    encryption: {
      key: vi.fn().mockReturnValue('test-encryption-key-32-chars-long-!!!'),
    },
    audit: {
      enabled: vi.fn().mockReturnValue(true),
      retentionDays: vi.fn().mockReturnValue(30),
    }
  },
}

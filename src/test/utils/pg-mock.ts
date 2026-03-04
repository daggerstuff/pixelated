import { vi } from 'vitest'

const mockQuery = vi.fn().mockResolvedValue({ rows: [] })
const mockConnect = vi.fn().mockResolvedValue({
  query: mockQuery,
  release: vi.fn(),
})

export const Pool = vi.fn(function() {
  return {
    connect: mockConnect,
    query: mockQuery,
    on: vi.fn(),
    end: vi.fn(),
  }
})

export default {
  Pool,
}

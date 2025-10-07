/**
 * Logger mock for testing
 */

export const logger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  log: vi.fn(),
}

export type Logger = typeof logger
export const Logger = logger

export const getLogger = vi.fn(() => logger)

export default {
  logger,
  getLogger,
  Logger,
}

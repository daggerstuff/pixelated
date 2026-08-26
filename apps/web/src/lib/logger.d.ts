declare module '@/lib/logger' {
  interface Logger {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
    debug: (...args: unknown[]) => void
  }
  const logger: Logger
  export { logger }
}

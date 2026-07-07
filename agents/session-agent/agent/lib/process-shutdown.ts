const SHUTDOWN_SIGNALS = ['SIGTERM', 'SIGINT'] as const

export function registerProcessShutdown(
  cleanup: () => Promise<void> | void,
): () => void {
  let shuttingDown = false
  const listeners = SHUTDOWN_SIGNALS.map((signal) => {
    const listener = () => {
      if (shuttingDown) return
      shuttingDown = true

      void Promise.resolve(cleanup())
        .catch((error: unknown) => {
          console.error(
            `[process-shutdown] cleanup failed during ${signal}:`,
            error,
          )
        })
        .finally(() => {
          process.exit(0)
        })
    }

    process.once(signal, listener)
    return { signal, listener }
  })

  return () => {
    for (const { signal, listener } of listeners) {
      process.off(signal, listener)
    }
  }
}

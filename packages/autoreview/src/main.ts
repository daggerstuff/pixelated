import { main } from './cli'

// Dedicated entry point for `tsx src/main.ts` (the `review` script). Kept
// separate from cli.ts so importing the pure helpers in tests never triggers
// execution.
main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`AutoReview failed: ${message}`)
  process.exitCode = 1
})

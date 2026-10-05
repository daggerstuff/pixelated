import { runValidateCli } from './validate-cli'
import { decideValidation } from './validation'

// Dedicated entry point for `tsx src/validate-main.ts` (the `validate`
// script). A failed/timed-out validation exits non-zero so branch protection
// can block the merge.
runValidateCli(
  process.env,
  (url, init) => fetch(url, init),
  (message) => console.log(message),
)
  .then((result) => {
    if (decideValidation(result) === 'needs-review') {
      process.exitCode = 1
    }
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`AutoReview validation failed: ${message}`)
    process.exitCode = 1
  })

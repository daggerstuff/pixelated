/**
 * Shared retry with exponential backoff — promoted from auth/utils
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function retry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000,
): Promise<T> {
  let lastError: Error
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error: unknown) {
      lastError = error as Error
      if (i < maxRetries - 1) {
        await sleep(delay * Math.pow(2, i))
      }
    }
  }
  throw lastError!
}

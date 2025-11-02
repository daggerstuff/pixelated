/**
 * Resilient fetch helpers with per-attempt timeout and exponential backoff retries.
 */

export type RetryOptions = {
  retries?: number
  minDelay?: number // initial backoff delay in ms
  maxDelay?: number // max backoff delay cap
  factor?: number // exponential factor
  timeout?: number // per-attempt timeout in ms
  retryOn?:
    | number[]
    | ((
        response: Response | null,
        error: unknown | null,
        attempt: number,
      ) => boolean | Promise<boolean>)
  onRetry?: (attempt: number, responseOrError: Response | unknown) => void
}

const defaultRetryOn = (res: Response | null, err: unknown | null) => {
  if (err) {
    // Network errors, timeouts, and other fetch errors should retry
    return true
  }
  if (!res) {
    return true
  }
  // Retry on 408, 429, and 5xx
  if (res.status === 408 || res.status === 429) {
    return true
  }
  if (res.status >= 500 && res.status <= 599) {
    return true
  }
  return false
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: RetryOptions = {},
): Promise<Response> {
  const {
    retries = 2,
    minDelay = 300,
    maxDelay = 2000,
    factor = 2,
    timeout = 8000,
    retryOn = defaultRetryOn,
    onRetry,
  } = options

  const externalSignal = init.signal

  for (let attempt = 0; attempt <= retries; attempt++) {
    // Create a controller per attempt to enforce timeout while honoring external aborts
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const abortExternal = () => controller.abort()
    try {
      if (externalSignal) {
        if (externalSignal.aborted) {
          throw new DOMException('Aborted', 'AbortError')
        }
        externalSignal.addEventListener('abort', abortExternal, { once: true })
      }

      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      })

      if (attempt < retries) {
        const shouldRetry = Array.isArray(retryOn)
          ? retryOn.includes(response.status)
          : await (
              retryOn as (
                response: Response | null,
                error: unknown | null,
                attempt: number,
              ) => boolean | Promise<boolean>
            )(response, null, attempt)

        if (shouldRetry) {
          onRetry?.(attempt + 1, response)
          const delay = Math.min(maxDelay, minDelay * Math.pow(factor, attempt))
          await sleep(delay)
          continue
        }
      }

      return response
    } catch (err: unknown) {
      // If external abort triggered, rethrow immediately
      if (externalSignal && (externalSignal as AbortSignal).aborted) {
        clearTimeout(timeoutId)
        if (externalSignal) {
          ;(externalSignal as AbortSignal).removeEventListener(
            'abort',
            abortExternal,
          )
        }
        throw err
      }

      if (attempt < retries) {
        const shouldRetry = Array.isArray(retryOn)
          ? true // if error occurred, we retry regardless of status list
          : await (
              retryOn as (
                response: Response | null,
                error: unknown | null,
                attempt: number,
              ) => boolean | Promise<boolean>
            )(null, err, attempt)

        if (shouldRetry) {
          onRetry?.(attempt + 1, err)
          const delay = Math.min(maxDelay, minDelay * Math.pow(factor, attempt))
          await sleep(delay)
          continue
        }
      }

      throw err
    } finally {
      clearTimeout(timeoutId)
      if (externalSignal) {
        ;(externalSignal as AbortSignal).removeEventListener(
          'abort',
          abortExternal,
        )
      }
    }
  }

  // Should never reach here due to return/throw in loop
  throw new Error('fetchWithRetry: Exhausted retries')
}

export async function fetchJSONWithRetry<T = unknown>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: RetryOptions = {},
): Promise<T> {
  const res = await fetchWithRetry(input, init, options)
  const contentType = res.headers.get('content-type') || ''
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Request failed: ${res.status} ${res.statusText} ${text}`)
  }
  if (contentType.includes('application/json')) {
    return (await res.json()) as T
  }
  // If not JSON, try text and cast
  return (await res.text()) as unknown as T
}

export default fetchWithRetry

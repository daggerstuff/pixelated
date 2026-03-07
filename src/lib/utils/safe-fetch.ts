import { ALLOWED_DOMAINS } from '@/lib/constants'

// Build hostname to IP mapping at runtime or use a static list
const hostnameToIPMap: Record<string, string[]> = {
  // Populate with actual DNS resolutions to prevent DNS rebinding attacks
}

export const validateUrlForSSRF = (urlString: string): boolean => {
  try {
    const url = new URL(urlString)

    // Exact domain match only - no subdomain allowance for security
    const hostname = url.hostname.toLowerCase()
    if (!ALLOWED_DOMAINS.includes(hostname)) {
      return false
    }

    // Additional IP validation to prevent DNS rebinding
    // Note: In production, resolve hostname to IP and check against ALLOWED_IPS
    if (hostnameToIPMap[url.hostname]) {
      // Check resolved IP against whitelist
      // This requires DNS resolution with security considerations
    }

    // Check for suspicious patterns
    if (
      hostname.includes('localhost') ||
      hostname.includes('127.0.0.1') ||
      hostname.includes('192.168.') ||
      hostname.includes('10.') ||
      hostname.includes('172.') ||
      hostname.includes('internal')
    ) {
      return false
    }

    return true
  } catch {
    // For relative URLs (e.g., '/api/*'), they are considered safe
    // as long as they don't contain '..' for directory traversal
    return (
      urlString.startsWith('/') &&
      !urlString.includes('..') &&
      !urlString.includes('%2e%2e') && // URL-encoded '..'
      !urlString.includes('%5c') && // URL-encoded '\'
      !urlString.includes('..%2f') && // Double encoded path traversal
      /^[a-zA-Z0-9\-_./&=?]*$/.test(urlString)
    ) // Only safe characters
  }
}

// SSRF-protected fetch wrapper with timeout and security measures
export const safeFetch = async (
  url: string | URL | Request,
  options?: RequestInit & { timeout?: number; maxResponseSize?: number },
): Promise<Response> => {
  const urlString = typeof url === 'string' ? url : url.toString()

  if (!validateUrlForSSRF(urlString)) {
    throw new Error(
      `URL ${urlString} is not allowed. Only whitelisted domains are permitted to prevent SSRF attacks.`,
    )
  }

  // Apply security defaults
  const timeout = options?.timeout || 10000 // 10 second timeout by default
  const maxResponseSize = options?.maxResponseSize || 10 * 1024 * 1024 // 10MB max by default

  // Create AbortController for timeout
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })

    // Clear timeout on successful response
    clearTimeout(timeoutId)

    // If the response has no body, we don't need to check its size.
    if (!response.body) {
      return response
    }

    // Check response size by streaming, as Content-Length can be missing or spoofed.
    let receivedLength = 0
    const counterStream = new TransformStream({
      transform(chunk, controller) {
        receivedLength += chunk.length
        if (receivedLength > maxResponseSize) {
          controller.error(
            new Error(
              `Response size exceeds the limit of ${maxResponseSize} bytes.`,
            ),
          )
        } else {
          controller.enqueue(chunk)
        }
      },
    })

    // Create a new response with the monitored stream.
    const monitoredStream = response.body.pipeThrough(counterStream)

    return new Response(monitoredStream, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    })
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`, { cause: error })
    }

    throw error
  }
}

// SSRF-protected retry fetch function
export const retryFetchWithSSRFProtection = async (
  url: string,
  options?: RequestInit & { timeout?: number; maxResponseSize?: number },
  maxRetries = 3,
): Promise<Response> => {
  const opts = options ?? {}
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await safeFetch(url, opts)
    } catch (error: unknown) {
      if (i === maxRetries - 1) {
        throw error
      }
      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000))
    }
  }
  throw new Error('Retry logic failed to return a response.')
}

import { config } from '@/lib/config/env'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { z } from 'zod'
import { normalizeError, NetworkError, ValidationError } from '@/lib/error'
import { validateApiResponse } from '@/lib/validation/api'

const logger = createBuildSafeLogger('journal-research-api-client')

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

interface RequestInterceptorContext {
  url: URL
  init: RequestInit
}

interface ResponseInterceptorContext<T = unknown> {
  url: URL
  init: RequestInit
  response: Response
  data?: T
}

type RequestInterceptor = (
  context: RequestInterceptorContext,
) => void | Promise<void>
type ResponseInterceptor<T = unknown> = (
  context: ResponseInterceptorContext<T>,
) => void | Promise<void>
type ErrorInterceptor = (
  error: unknown,
  context: ResponseInterceptorContext | RequestInterceptorContext,
) => void | Promise<void>

export interface JournalResearchApiClientOptions {
  baseUrl?: string
  timeout?: number
  fetchImpl?: typeof fetch
  /**
   * Custom token retriever. Called before each request to attach Authorization header.
   */
  getAuthToken?: () => string | null | Promise<string | null>
  /**
   * Called when a 401/403 response is received.
   */
  onUnauthorized?: (context: ResponseInterceptorContext) => void | Promise<void>
}

export class JournalResearchApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'JournalResearchApiError'
    this.status = status
    this.details = details
  }
}

export class JournalResearchApiClient {
  private readonly baseUrl: string
  private readonly timeout: number
  private readonly fetchImpl: typeof fetch
  private readonly getAuthToken?: () => string | null | Promise<string | null>
  private readonly onUnauthorized?: (
    context: ResponseInterceptorContext,
  ) => void | Promise<void>

  private readonly requestInterceptors = new Set<RequestInterceptor>()
  private readonly responseInterceptors = new Set<ResponseInterceptor>()
  private readonly errorInterceptors = new Set<ErrorInterceptor>()

  constructor(options: JournalResearchApiClientOptions = {}) {
    const fallbackBaseUrl =
      (typeof window !== 'undefined'
        ? window?.location?.origin
        : config.apiUrl) + '/api/journal-research'

    this.baseUrl =
      options.baseUrl ??
      import.meta.env.PUBLIC_JOURNAL_RESEARCH_API_URL ??
      fallbackBaseUrl
    this.timeout = options.timeout ?? 30000
    this.fetchImpl = options.fetchImpl ?? fetch
    this.getAuthToken = options.getAuthToken
    this.onUnauthorized = options.onUnauthorized
  }

  getBaseUrl(): string {
    return this.baseUrl
  }

  addRequestInterceptor(interceptor: RequestInterceptor): () => void {
    this.requestInterceptors.add(interceptor)
    return () => this.requestInterceptors.delete(interceptor)
  }

  addResponseInterceptor(interceptor: ResponseInterceptor): () => void {
    this.responseInterceptors.add(interceptor)
    return () => this.responseInterceptors.delete(interceptor)
  }

  addErrorInterceptor(interceptor: ErrorInterceptor): () => void {
    this.errorInterceptors.add(interceptor)
    return () => this.errorInterceptors.delete(interceptor)
  }

  async request<T>(
    path: string,
    {
      method = 'GET',
      params,
      body,
      headers,
      signal,
      timeout,
      validator,
    }: {
      method?: HttpMethod
      params?: Record<string, string | number | boolean | undefined>
      body?: unknown
      headers?: HeadersInit
      signal?: AbortSignal
      timeout?: number
      validator?: z.ZodType<T>
    } = {},
  ): Promise<T> {
    const controller = new AbortController()
    const requestTimeout = timeout ?? this.timeout
    const timer = setTimeout(() => controller.abort(), requestTimeout)

    const url = new URL(path, this.baseUrl)
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue
        url.searchParams.append(key, String(value))
      }
    }

    const init: RequestInit = {
      method,
      headers: {
        'Content-Type': body ? 'application/json' : 'application/json',
        ...headers,
      },
      signal: signal ?? controller.signal,
      credentials: 'include',
    }

    if (body !== undefined) {
      init.body = body instanceof FormData ? body : JSON.stringify(body)
      if (body instanceof FormData) {
        const currentHeaders = new Headers(init.headers)
        currentHeaders.delete('Content-Type')
        init.headers = currentHeaders
      }
    }

    try {
      const authToken = await this.getAuthToken?.()
      if (authToken) {
        const currentHeaders = new Headers(init.headers)
        currentHeaders.set(
          'Authorization',
          authToken.startsWith('Bearer ') ? authToken : `Bearer ${authToken}`,
        )
        init.headers = currentHeaders
      }

      const requestContext: RequestInterceptorContext = { url, init }
      for (const interceptor of this.requestInterceptors) {
        await interceptor(requestContext)
      }

      const response = await this.fetchImpl(requestContext.url.toString(), {
        ...requestContext.init,
        signal: requestContext.init.signal ?? controller.signal,
      })

      clearTimeout(timer)

      let data: unknown
      const responseContext: ResponseInterceptorContext = {
        url: requestContext.url,
        init: requestContext.init,
        response,
      }

      if (response.status === 204) {
        data = undefined
      } else if (validator) {
        const json = await response.json().catch(() => ({}))
        try {
          data = await validateApiResponse(validator, json, {
            endpoint: path,
          })
        } catch (validationError) {
          if (validationError instanceof ValidationError) {
            throw new JournalResearchApiError(
              validationError.message,
              422,
              validationError.fieldErrors,
            )
          }
          throw validationError
        }
      } else {
        data = await response.json().catch(() => undefined)
      }

      responseContext.data = data

      if (!response.ok) {
        const normalizedError = normalizeError(
          new Error(`HTTP ${response.status}: ${response.statusText}`),
          {
            action: `${method} ${path}`,
            metadata: {
              statusCode: response.status,
              statusText: response.statusText,
            },
          },
        )

        let error: JournalResearchApiError
        if (normalizedError instanceof NetworkError) {
          error = new JournalResearchApiError(
            normalizedError.message,
            normalizedError.statusCode ?? response.status,
            data,
          )
        } else {
          error = new JournalResearchApiError(
            normalizedError.message,
            response.status,
            data,
          )
        }

        if (response.status === 401 || response.status === 403) {
          await this.onUnauthorized?.(responseContext)
        }

        await this.invokeErrorInterceptors(error, responseContext)
        throw error
      }

      for (const interceptor of this.responseInterceptors) {
        await interceptor(responseContext)
      }

      return data as T
    } catch (error: unknown) {
      clearTimeout(timer)

      const normalizedError = normalizeError(error, {
        action: `${method} ${path}`,
        metadata: {
          url: url.toString(),
        },
      })

      if (error instanceof DOMException && error.name === 'AbortError') {
        const timeoutError = new JournalResearchApiError(
          `Request timed out after ${requestTimeout}ms`,
          408,
        )
        await this.invokeErrorInterceptors(timeoutError, { url, init })
        throw timeoutError
      }

      await this.invokeErrorInterceptors(normalizedError, { url, init })
      logger.error('JournalResearchApiClient request failed', {
        error: normalizedError,
        path,
      })
      throw normalizedError
    }
  }

  private async invokeErrorInterceptors(
    error: unknown,
    context: ResponseInterceptorContext | RequestInterceptorContext,
  ) {
    for (const interceptor of this.errorInterceptors) {
      try {
        await interceptor(error, context)
      } catch (interceptorError) {
        logger.error('Error interceptor threw an exception', {
          interceptorError,
        })
      }
    }
  }
}

/**
 * Get authentication token from Better Auth session
 * Falls back to localStorage for backward compatibility
 */
async function getAuthTokenFromBetterAuth(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  
  try {
    // Try to get session from Better Auth client
    const { authClient } = await import('@/lib/auth-client')
    const session = await authClient.getSession()
    
    if (session?.data?.session?.token) {
      return session.data.session.token
    }
    
    // Fallback to localStorage for backward compatibility
    return (
      window.localStorage.getItem('auth_token') ??
      window.localStorage.getItem('authToken') ??
      null
    )
  } catch (error) {
    logger.warn('Failed to get auth token from Better Auth', { error })
    
    // Fallback to localStorage
    try {
      return (
        window.localStorage.getItem('auth_token') ??
        window.localStorage.getItem('authToken') ??
        null
      )
    } catch (localStorageError) {
      logger.warn('Failed to read auth token from localStorage', {
        error: localStorageError,
      })
      return null
    }
  }
}

/**
 * Handle unauthorized responses by redirecting to login
 */
async function handleUnauthorized(context: {
  url: URL
  init: RequestInit
  response: Response
  data?: unknown
}): Promise<void> {
  logger.warn('Unauthorized response received from Journal Research API', {
    url: context.url.toString(),
    status: context.response.status,
  })
  
  // Redirect to login if we're in the browser
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname
    window.location.href = `/auth/sign-in?redirect=${encodeURIComponent(currentPath)}`
  }
}

export const journalResearchApiClient = new JournalResearchApiClient({
  getAuthToken: getAuthTokenFromBetterAuth,
  onUnauthorized: handleUnauthorized,
})



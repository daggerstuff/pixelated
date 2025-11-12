import { config } from '@/lib/config/env'
import { createBuildSafeLogger } from '@/lib/logging/build-safe-logger'
import { z } from 'zod'

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
        const result = validator.safeParse(json)
        if (!result.success) {
          throw new JournalResearchApiError(
            'Response validation failed',
            422,
            result.error.flatten(),
          )
        }
        data = result.data
      } else {
        data = await response.json().catch(() => undefined)
      }

      responseContext.data = data

      if (!response.ok) {
        const error = new JournalResearchApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          data,
        )

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

      if (error instanceof DOMException && error.name === 'AbortError') {
        const timeoutError = new JournalResearchApiError(
          `Request timed out after ${requestTimeout}ms`,
          408,
        )
        await this.invokeErrorInterceptors(timeoutError, { url, init })
        throw timeoutError
      }

      await this.invokeErrorInterceptors(error, { url, init })
      logger.error('JournalResearchApiClient request failed', {
        error,
        path,
      })
      throw error
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

export const journalResearchApiClient = new JournalResearchApiClient({
  getAuthToken: () => {
    if (typeof window === 'undefined') return null
    try {
      return (
        window.localStorage.getItem('auth_token') ??
        window.localStorage.getItem('authToken')
      )
    } catch (error) {
      logger.warn('Failed to read auth token from localStorage', { error })
      return null
    }
  },
  onUnauthorized: async () => {
    logger.warn('Unauthorized response received from Journal Research API')
  },
})



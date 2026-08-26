type TokenProvider = (options?: {
  authorizationParams?: {
    audience?: string
    scope?: string
  }
}) => Promise<string>

interface AuthRequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: HeadersInit
}

export interface AuthRequestConfig {
  getAccessTokenSilently: TokenProvider
  audience?: string
  scope?: string
}

const readAudience = (): string | undefined => {
  return (
    import.meta.env['PUBLIC_AUTH0_AUDIENCE'] ??
    import.meta.env['VITE_AUTH0_AUDIENCE']
  )
}

export const fetchWithAuthToken = async (
  input: RequestInfo | URL,
  init: AuthRequestOptions = {},
  config: AuthRequestConfig,
): Promise<Response> => {
  const headers = new Headers(init.headers ?? {})
  const tokenAudience = config.audience ?? readAudience()
  const token = await config.getAccessTokenSilently(
    tokenAudience || config.scope
      ? {
          authorizationParams: {
            ...(tokenAudience ? { audience: tokenAudience } : {}),
            ...(config.scope ? { scope: config.scope } : {}),
          },
        }
      : undefined,
  )

  headers.set('Authorization', `Bearer ${token}`)

  return fetch(input, {
    ...init,
    headers,
  })
}

export const fetchJsonWithAuthToken = async <T>(
  input: RequestInfo | URL,
  init: AuthRequestOptions = {},
  config: AuthRequestConfig,
): Promise<T> => {
  const response = await fetchWithAuthToken(input, init, config)
  if (!response.ok) {
    const message = await response.text().catch(() => 'Request failed')
    throw new Error(`${response.status} ${response.statusText}: ${message}`)
  }

  return (await response.json()) as T
}

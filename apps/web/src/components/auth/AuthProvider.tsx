/// <reference types="astro/client" />

import { Auth0Provider } from '@auth0/auth0-react'
import React from 'react'

const AUTH0_CALLBACK_PATH = '/api/auth/auth0-callback'

type RedirectState = {
  returnTo?: string
}

function getEnvVariable(name: string): string | undefined {
  const env = (
    import.meta as unknown as { env: Record<string, string | undefined> }
  ).env
  return env[name]
}

const hasAuth0DomainShape = (value: string): boolean => {
  return (
    value.includes('.auth0.com') ||
    value.includes('.us.auth0.com') ||
    value.includes('.eu.auth0.com') ||
    value.includes('.au.auth0.com')
  )
}

const sanitizeReturnTo = (returnTo: string): string => {
  try {
    const destination = new URL(returnTo, window.location.origin)
    if (destination.origin !== window.location.origin) {
      return window.location.pathname
    }
    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    if (returnTo.startsWith('/')) {
      return returnTo
    }
    return window.location.pathname
  }
}

export const PixelatedAuthProvider = ({
  children,
}: {
  children: React.ReactNode
}) => {
  const domain =
    getEnvVariable('PUBLIC_AUTH0_DOMAIN') ??
    getEnvVariable('AUTH0_DOMAIN') ??
    getEnvVariable('VITE_AUTH0_DOMAIN')
  const clientId =
    getEnvVariable('PUBLIC_AUTH0_CLIENT_ID') ??
    getEnvVariable('AUTH0_CLIENT_ID') ??
    getEnvVariable('VITE_AUTH0_CLIENT_ID')
  const audience = getEnvVariable('PUBLIC_AUTH0_AUDIENCE')
  const redirectUri =
    typeof window !== 'undefined'
      ? `${window.location.origin}${AUTH0_CALLBACK_PATH}`
      : ''

  const onRedirectCallback = (appState: RedirectState | undefined) => {
    const returnTo = sanitizeReturnTo(
      appState?.returnTo ?? window.location.pathname,
    )
    window.history.replaceState({}, document.title, returnTo)
  }

  if (!domain || !clientId || !redirectUri) {
    return (
      <section className="border-rose-300 bg-rose-50 text-rose-800 dark:bg-rose-900/25 dark:text-rose-200 rounded-lg border px-4 py-3 text-sm">
        Auth0 is not fully configured. Set PUBLIC_AUTH0_DOMAIN and
        PUBLIC_AUTH0_CLIENT_ID in your environment before using social login.
      </section>
    )
  }

  if (typeof window === 'undefined') {
    return null
  }

  if (!hasAuth0DomainShape(domain)) {
    if (process.env['NODE_ENV'] !== 'test') {
      console.warn('[Auth0] Domain shape looks unusual:', domain)
    }
  }

  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        ...(audience ? { audience } : {}),
      }}
      useRefreshTokens={true}
      // Use in-memory cache to prevent cross-tab refresh token reuse.
      // localStorage shares the token across tabs which causes Auth0 to detect
      // "refresh token already used" and revoke the entire token family.
      cacheLocation="memory"
      useRefreshTokensFallback={true}
      onRedirectCallback={onRedirectCallback}
    >
      {children}
    </Auth0Provider>
  )
}

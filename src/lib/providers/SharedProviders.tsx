import type { ReactNode } from 'react'
import React from 'react'
import { AnalyticsProvider } from './AnalyticsProvider'
import { AuthProvider } from './AuthProvider'

import { ErrorBoundary } from './ErrorBoundary'
import { NotificationProvider } from './NotificationProvider'
import { SecurityProvider } from './SecurityProvider'
import { ThemeProvider } from './ThemeProvider'

interface SharedProvidersProps {
  children: ReactNode
  /**
   * Initial state for providers that support hydration
   */
  initialState?: {
    theme?: {
      theme?: 'light' | 'dark'
      systemPreference?: boolean
    }
    auth?: {
      user?: Record<string, unknown>
      isAuthenticated?: boolean
    }
  }
  /**
   * Configuration options for providers
   */
  config?: {
    enableAnalytics?: boolean
    enableNotifications?: boolean
    securityLevel?: 'standard' | 'hipaa' | 'maximum'
  }
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

/**
 * Shared providers component that composes all context providers
 * Providers are ordered based on dependencies (providers that depend on others come later)
 */
export function SharedProviders({
  children,
  initialState = {},
  config = {},
  onError,
}: SharedProvidersProps) {
  const {
    enableAnalytics = true,
    enableNotifications = true,
    securityLevel = 'hipaa',
  } = config

  return (
    <ErrorBoundary onError={onError}>
      <ThemeProvider initialState={initialState.theme}>
        <SecurityProvider level={securityLevel}>
          <AuthProvider initialState={initialState.auth}>
            {enableNotifications && (
              <NotificationProvider>{children}</NotificationProvider>
            )}
            {enableAnalytics && (
              <AnalyticsProvider>{children}</AnalyticsProvider>
            )}
            {!enableAnalytics && !enableNotifications && children}
          </AuthProvider>
        </SecurityProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

/**
 * HOC to wrap components with all shared providers
 */
export function withSharedProviders<T extends object>(
  Component: React.ComponentType<T>,
  options: Omit<SharedProvidersProps, 'children'> = {},
): React.FC<T> {
  return function WithSharedProvidersWrapper(props: T) {
    return (
      <SharedProviders {...options}>
        <Component {...props} />
      </SharedProviders>
    )
  }
}

import type { ReactNode } from 'react'
import React from 'react'

interface AnalyticsProviderProps {
  children: ReactNode
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  return <>{children}</>
}

export default AnalyticsProvider

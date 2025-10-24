import type { FC, ReactNode } from 'react'
import React from 'react'

interface ResponsiveUtilsProps {
  children: ReactNode
  className?: string
}

/**
 * Enhanced responsive utility components for consistent responsive behavior
 * Provides responsive visibility, spacing, and layout utilities
 */

// Responsive visibility utilities
export const ShowOnMobile: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="block sm:hidden">{children}</div>
)

export const HideOnMobile: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="hidden sm:block">{children}</div>
)

export const ShowOnTablet: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="hidden md:block lg:hidden">{children}</div>
)

export const ShowOnDesktop: FC<{ children: ReactNode }> = ({ children }) => (
  <div className="hidden lg:block">{children}</div>
)

// Responsive spacing utilities
export const ResponsivePadding: FC<{
  children: ReactNode
  className?: string
}> = ({ children, className = '' }) => (
  <div className={`p-4 sm:p-6 lg:p-8 ${className}`}>{children}</div>
)

export const ResponsiveMargin: FC<{
  children: ReactNode
  className?: string
}> = ({ children, className = '' }) => (
  <div className={`m-2 sm:m-4 lg:m-6 ${className}`}>{children}</div>
)

// Responsive container with max-width constraints
export const ResponsiveContainer: FC<{
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}> = ({ children, size = 'lg' }) => {
  const sizeClasses = {
    sm: 'max-w-sm mx-auto',
    md: 'max-w-md mx-auto',
    lg: 'max-w-4xl mx-auto',
    xl: 'max-w-6xl mx-auto',
    full: 'w-full',
  }

  return <div className={`${sizeClasses[size]} w-full`}>{children}</div>
}

// Touch-friendly button wrapper for mobile
export const TouchTarget: FC<{ children: ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={`min-h-[44px] min-w-[44px] flex items-center justify-center ${className}`}
  >
    {children}
  </div>
)

// Responsive text sizing
export const ResponsiveText: FC<{
  children: ReactNode
  size?: 'xs' | 'sm' | 'base' | 'lg' | 'xl'
  className?: string
}> = ({ children, size = 'base', className = '' }) => {
  const sizeClasses = {
    xs: 'text-xs sm:text-sm',
    sm: 'text-sm sm:text-base',
    base: 'text-base sm:text-lg',
    lg: 'text-lg sm:text-xl',
    xl: 'text-xl sm:text-2xl',
  }

  return <div className={`${sizeClasses[size]} ${className}`}>{children}</div>
}

// Responsive hook for window size detection
export const useResponsive = () => {
  const [windowSize, setWindowSize] = React.useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
  })

  React.useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return {
    isMobile: windowSize.width < 640,
    isTablet: windowSize.width >= 640 && windowSize.width < 1024,
    isDesktop: windowSize.width >= 1024,
    isLarge: windowSize.width >= 1280,
    width: windowSize.width,
    height: windowSize.height,
  }
}

// Breakpoint constants for consistent usage
export const BREAKPOINTS = {
  'xs': 0,
  'sm': 640,
  'md': 768,
  'lg': 1024,
  'xl': 1280,
  '2xl': 1536,
} as const

export type Breakpoint = keyof typeof BREAKPOINTS

// Main responsive utils component (for any additional wrapper functionality)
export const ResponsiveUtils: FC<ResponsiveUtilsProps> = ({
  children,
  className = '',
}) => {
  return <div className={`responsive-utils ${className}`}>{children}</div>
}

export default ResponsiveUtils

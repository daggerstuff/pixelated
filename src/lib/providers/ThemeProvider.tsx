import type { ReactNode } from 'react'
import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
export type ColorScheme = Theme | 'system'
export type ContrastMode = 'normal' | 'high'
export type MotionPreference = 'normal' | 'reduced'

interface ThemeContextValue {
  theme: Theme
  colorScheme: ColorScheme
  contrastMode: ContrastMode
  motionPreference: MotionPreference
  setColorScheme: (scheme: ColorScheme) => void
  setContrastMode: (mode: ContrastMode) => void
  setMotionPreference: (pref: MotionPreference) => void
}

interface ThemeProviderProps {
  children: ReactNode
  initialState?: {
    theme?: Theme
    systemPreference?: boolean
    contrastMode?: ContrastMode
    motionPreference?: MotionPreference
  }
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({
  children,
  initialState = {},
}: ThemeProviderProps) {
  // Initialize state with defaults or initial values
  const [colorScheme, setColorScheme] = useState<ColorScheme>(
    initialState.systemPreference ? 'system' : (initialState.theme ?? 'dark'),
  )
  const [contrastMode, setContrastMode] = useState<ContrastMode>(
    initialState.contrastMode ?? 'normal',
  )
  const [motionPreference, setMotionPreference] = useState<MotionPreference>(
    initialState.motionPreference ?? 'normal',
  )

  // Derive active theme based on color scheme and system preference
  const [activeTheme, setActiveTheme] = useState<Theme>(
    initialState.theme ?? 'dark',
  )

  // Handle system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    function updateTheme(e: MediaQueryListEvent | MediaQueryList) {
      if (colorScheme === 'system') {
        setActiveTheme(e.matches ? 'dark' : 'light')
      }
    }

    // Set initial value
    updateTheme(mediaQuery)

    // Listen for changes
    mediaQuery.addEventListener('change', updateTheme)
    return () => mediaQuery.removeEventListener('change', updateTheme)
  }, [colorScheme])

  // Update active theme when color scheme changes
  useEffect(() => {
    if (colorScheme !== 'system') {
      setActiveTheme(colorScheme)
    }
  }, [colorScheme])

  // Update document classes when preferences change
  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const root = document.documentElement
    const isDark = activeTheme === 'dark'

    // Update theme
    root.classList.toggle('dark', isDark)
    root.classList.toggle('light', !isDark)

    // Update contrast mode
    root.classList.toggle('high-contrast', contrastMode === 'high')

    // Update motion preference
    root.classList.toggle('reduced-motion', motionPreference === 'reduced')

    // Update color scheme meta tag
    const metaThemeColor = document.querySelector(
      'meta[name="theme-color"]',
    ) as HTMLElement
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        'content',
        isDark ? 'rgb(23, 23, 23)' : 'rgb(247, 247, 247)',
      )
    }
  }, [activeTheme, contrastMode, motionPreference])

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    localStorage.setItem(
      'theme-preferences',
      JSON.stringify({
        colorScheme,
        contrastMode,
        motionPreference,
      }),
    )
  }, [colorScheme, contrastMode, motionPreference])

  const value: ThemeContextValue = {
    theme: activeTheme,
    colorScheme,
    contrastMode,
    motionPreference,
    setColorScheme,
    setContrastMode,
    setMotionPreference,
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

// Export a HOC for wrapping components that need theme access
export function withTheme<T extends object>(
  Component: React.ComponentType<T>,
): React.FC<T & Pick<ThemeProviderProps, 'initialState'>> {
  return function WithThemeWrapper(
    props: T & Pick<ThemeProviderProps, 'initialState'>,
  ) {
    const { initialState, ...componentProps } = props
    return (
      <ThemeProvider initialState={initialState}>
        <Component {...(componentProps as T)} />
      </ThemeProvider>
    )
  }
}

import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

const getStoredTheme = (): Theme => {
  const storedTheme = localStorage.getItem('theme') as Theme | null
  if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
    return storedTheme
  }
  localStorage.setItem('theme', 'dark')
  return 'dark'
}

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'light' | 'dark'
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

export { ThemeContext }

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark')

  // Update theme when it changes
  useEffect(() => {
    // Persist theme to localStorage
    if (theme !== 'system') {
      localStorage.setItem('theme', theme)
    } else {
      localStorage.removeItem('theme')
    }

    // Resolve system theme using media query
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const updateResolvedTheme = () => {
      const newResolvedTheme =
        theme === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : theme

      setResolvedTheme(newResolvedTheme)

      // Apply theme to HTML element
      document.documentElement.classList.toggle(
        'dark',
        newResolvedTheme === 'dark',
      )
    }

    updateResolvedTheme()

    // Listen for system theme changes only when theme is 'system'
    if (theme === 'system') {
      mediaQuery.addEventListener('change', updateResolvedTheme)
    }

    // Always return cleanup function
    return () => {
      if (theme === 'system') {
        mediaQuery.removeEventListener('change', updateResolvedTheme)
      }
    }
  }, [theme])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export default ThemeProvider

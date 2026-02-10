import { useState, useEffect } from 'react'
import { UserMenu } from '../ui/UserMenu'
import { Navigation } from './Navigation'
import SearchBox from '../ui/SearchBox'
import { cn } from '@/lib/utils'

export interface HeaderProps {
  showUserMenu?: boolean
  className?: string
  position?: 'fixed' | 'sticky' | 'static'
}

export function Header({
  showUserMenu = true,
  className,
  position = 'fixed',
}: HeaderProps) {
  // Use null as initial state for safe hydration
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean | null>(null)
  const [isSearchOpen, setIsSearchOpen] = useState<boolean | null>(null)

  // Initialize state on client-side only
  useEffect(() => {
    setMobileMenuOpen(false)
    setIsSearchOpen(false)
  }, [])

  // Handle keyboard shortcut for search (Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen((prev) => !prev)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Safe check for client-side rendering
  const isBrowser = typeof window !== 'undefined'

  // Only render full interactive content on client-side
  if (!isBrowser || mobileMenuOpen === null || isSearchOpen === null) {
    return (
      <header
        className={cn(
          'z-30 w-full bg-card border-b border-border',
          position === 'fixed'
            ? 'fixed'
            : position === 'sticky'
              ? 'sticky top-0'
              : 'static',
          className,
        )}
      >
        <div className="px-3 py-3 lg:px-5 lg:pl-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center justify-start">
              <a href="/" className="flex ml-2 md:mr-24">
                <img
                  src="/favicon.svg"
                  className="h-8 mr-3"
                  alt="Pixelated Empathy Logo"
                />

                <span className="self-center text-xl font-semibold sm:text-2xl whitespace-nowrap brand-title">
                  Pixelated Empathy
                </span>
              </a>
            </div>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header
      className={cn(
        'z-30 w-full bg-card border-b border-border',
        position === 'fixed'
          ? 'fixed'
          : position === 'sticky'
            ? 'sticky top-0'
            : 'static',
        className,
      )}
    >
      <div className="px-3 py-3 lg:px-5 lg:pl-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-start">
            <button
              type="button"
              className="inline-flex items-center p-2 text-sm text-muted-foreground rounded-lg lg:hidden hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
              aria-expanded={mobileMenuOpen || false}
            >
              <svg
                className="w-6 h-6"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d={
                    mobileMenuOpen
                      ? 'M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                      : 'M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z'
                  }
                  clipRule="evenodd"
                />
              </svg>
            </button>
            <a href="/" className="flex ml-2 md:mr-24">
              <img
                src="/favicon.svg"
                className="h-8 mr-3"
                alt="Pixelated Empathy Logo"
              />{' '}
              <span className="self-center text-xl font-semibold sm:text-2xl whitespace-nowrap brand-title">
                Pixelated Empathy
              </span>
            </a>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex lg:items-center">
            <Navigation />
          </div>

          <div className="flex items-center">
            <div className="hidden lg:flex lg:items-center lg:ml-6">
              <button
                type="button"
                className="p-2 text-muted-foreground rounded-lg hover:text-foreground hover:bg-accent"
                onClick={() => setIsSearchOpen(!isSearchOpen)}
                aria-label="Search"
                aria-expanded={isSearchOpen || false}
                title="Search (Cmd+K)"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              <button
                type="button"
                className="p-2 text-muted-foreground rounded-lg hover:text-foreground hover:bg-accent"
                aria-label="View notifications"
              >
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                </svg>
              </button>
            </div>

            <div className="flex items-center ml-3">
              {showUserMenu && <UserMenu />}
            </div>
          </div>
        </div>
      </div>

      {/* Search Modal with FlexSearch */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card rounded-lg shadow-lg border border-border">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">Search</h3>
                <button
                  type="button"
                  className="text-muted-foreground bg-transparent hover:bg-accent hover:text-foreground rounded-lg text-sm p-1.5 ml-auto inline-flex items-center"
                  onClick={() => setIsSearchOpen(false)}
                  aria-label="Close search"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
              <SearchBox
                placeholder="Search content..."
                maxResults={8}
                minQueryLength={2}
                showNoResults={true}
                onResultClick={() => setIsSearchOpen(false)}
              />

              <div className="mt-4 text-xs text-muted-foreground">
                <p>Privacy-focused client-side search powered by FlexSearch</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden">
          <Navigation isMobile={true} />
        </div>
      )}
    </header>
  )
}

export default Header

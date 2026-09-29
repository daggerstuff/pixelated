import { useState, useRef, useEffect } from 'react'

import { authClient } from '@/lib/auth-client'

import { Avatar } from './avatar'

export interface UserMenuProps {
  className?: string
}

export function UserMenu({ className = '' }: UserMenuProps) {
  const { data: sessionData, isPending } = authClient.useSession()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Type assertion for auth0 session data
  const user = sessionData as {
    user_metadata?: { avatar_url?: string; full_name?: string }
    email?: string
  } | null

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) {
        return
      }
      if (menuRef.current && !menuRef.current.contains(target)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (isPending) {
    return (
      <div className={className}>
        <div className="inline-flex items-center rounded-none px-4 py-2 text-center text-sm font-medium text-foreground">
          Loading...
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={className}>
        <a
          href="/login"
          className="inline-flex items-center rounded-none px-4 py-2 text-center text-sm font-medium text-foreground transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Sign in
        </a>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        type="button"
        className="flex rounded-none text-sm focus:outline-none focus:ring-2 focus:ring-ring md:me-0"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="sr-only">Open user menu</span>
        <Avatar
          src={user.user_metadata?.avatar_url}
          initials={(() => {
            if (typeof user.email === 'string' && user.email.length > 0) {
              return user.email[0]?.toUpperCase() ?? 'U'
            }
            return 'U'
          })()}
          size="sm"
          className="h-8 w-8"
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-56 list-none divide-y divide-border rounded-none border border-border bg-card text-base">
          <div className="px-4 py-3">
            <span className="block text-sm font-medium text-foreground">
              {user.user_metadata?.full_name ?? user.email}
            </span>
            <span className="block truncate text-sm text-muted-foreground">
              {user.email?.toString() ?? ''}
            </span>
          </div>
          <ul className="py-2" role="none">
            <li>
              <a
                href="/dashboard"
                className="block px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                role="menuitem"
              >
                Dashboard
              </a>
            </li>
            <li>
              <a
                href="/settings"
                className="block px-4 py-2 text-sm text-foreground transition-colors hover:bg-secondary"
                role="menuitem"
              >
                Settings
              </a>
            </li>
            <li>
              <button
                onClick={async () => {
                  await authClient.signOut()
                  window.location.href = '/'
                }}
                className="block w-full px-4 py-2 text-left text-sm text-foreground transition-colors hover:bg-secondary"
                role="menuitem"
              >
                Sign out
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}

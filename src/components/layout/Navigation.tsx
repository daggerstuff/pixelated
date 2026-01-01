import type { UserRole } from '../../types/auth'
import React from 'react'

import { authClient } from '@/lib/auth-client'
import { useStore } from 'nanostores'
import { cn } from '@/lib/utils'

export interface NavigationItem {
  label: string
  href: string
  icon?: React.ReactNode
  requiresAuth?: boolean
  requiresGuest?: boolean
  roles?: UserRole[]
}

export interface NavigationProps {
  /** Navigation items to display */
  items?: NavigationItem[]
  /** Use vertical navigation layout instead of horizontal */
  vertical?: boolean
  /** Additional className for styling */
  className?: string
  /** Mobile navigation */
  isMobile?: boolean
}

// Default navigation items
const defaultItems: NavigationItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Dashboard', href: '/dashboard', requiresAuth: true },
  { label: 'Chat', href: '/chat', requiresAuth: true },
  { label: 'Simulator', href: '/simulator', requiresAuth: true },
  { label: 'Journal Research', href: '/journal-research', requiresAuth: true },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Login', href: '/login', requiresGuest: true },
  { label: 'Sign Up', href: '/signup', requiresGuest: true },
]

export function Navigation({
  items = defaultItems,
  vertical = false,
  className = '',
  isMobile = false,
}: NavigationProps) {
  const { data: user, isPending: loading } = authClient.useSession()
  const isAuthenticated = !!user?.user

  // Filter navigation items based on authentication state and user roles
  const filteredItems = items.filter((item) => {
    // Skip items that require auth when user is not authenticated
    if (item.requiresAuth && !isAuthenticated) {
      return false
    }

    // Skip items that require guest when user is authenticated
    if (item.requiresGuest && isAuthenticated) {
      return false
    }

    // Check if the user has any of the required roles
    if (item.roles && item.roles.length > 0) {
      if (!user?.user || !user.user.roles) {
        return false
      }

      const hasRequiredRole = user.user.roles.some((role) =>
        item.roles?.includes(role as UserRole),
      )

      if (!hasRequiredRole) {
        return false
      }
    }

    return true
  })

  return (
    <nav
      className={cn(
        vertical ? 'flex flex-col space-y-2' : 'flex',
        isMobile ? 'flex-col space-y-4 p-4' : 'items-center gap-6',
        className,
      )}
    >
      {filteredItems.map((item, index) => (
        <a
          key={`nav-item-${index}`}
          href={item.href}
          className={cn(
            'text-foreground/80 hover:text-foreground transition-colors duration-200',
            isMobile ? 'block py-2' : '',
          )}
        >
          {item.icon && <span className="mr-2">{item.icon}</span>}
          {item.label}
        </a>
      ))}
    </nav>
  )
}

export default Navigation

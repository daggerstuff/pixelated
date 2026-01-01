import React, { useState, useRef, useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { Avatar } from './avatar'
import { useStore } from 'nanostores'

export interface UserMenuProps {
  className?: string
}

export function UserMenu({ className = '' }: UserMenuProps) {
  const { data: user, isPending } = authClient.useSession()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (isPending) {
    return (
      <div className={className}>
        <div className="text-gray-700 dark:text-gray-300 font-medium rounded-lg text-sm px-4 py-2 text-center inline-flex items-center">
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
          className="text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-4 py-2 text-center inline-flex items-center"
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
        className="flex text-sm bg-gray-800 rounded-full md:me-0 focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-600"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="sr-only">Open user menu</span>
        <Avatar
          src={user.user_metadata?.avatar_url}
          initials={((user.email as string)?.[0] || 'U').toUpperCase()}
          size="sm"
          className="w-8 h-8"
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 z-50 text-base list-none bg-white divide-y divide-gray-100 rounded-lg shadow dark:bg-gray-700 dark:divide-gray-600">
          <div className="px-4 py-3">
            <span className="block text-sm text-gray-900 dark:text-white">
              {user.user_metadata?.full_name || user.email}
            </span>
            <span className="block text-sm text-gray-500 truncate dark:text-gray-400">
              {user.email?.toString() || ''}
            </span>
          </div>
          <ul className="py-2" role="none">
            <li>
              <a
                href="/dashboard"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white"
                role="menuitem"
              >
                Dashboard
              </a>
            </li>
            <li>
              <a
                href="/settings"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white"
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
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white"
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

export default UserMenu

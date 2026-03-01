import React, { useState, useRef, useEffect } from 'react'

import { authClient } from '@/lib/auth-client'

import { Avatar } from './avatar'

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
        <div className='text-gray-700 dark:text-gray-300 inline-flex items-center rounded-lg px-4 py-2 text-center text-sm font-medium'>
          Loading...
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={className}>
        <a
          href='/login'
          className='text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:ring-gray-300 inline-flex items-center rounded-lg px-4 py-2 text-center text-sm font-medium focus:ring-4'
        >
          Sign in
        </a>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        type='button'
        className='bg-gray-800 focus:ring-gray-300 dark:focus:ring-gray-600 flex rounded-full text-sm focus:ring-4 md:me-0'
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className='sr-only'>Open user menu</span>
        <Avatar
          src={user.user_metadata?.avatar_url}
          initials={((user.email as string)?.[0] || 'U').toUpperCase()}
          size='sm'
          className='h-8 w-8'
        />
      </button>

      {isOpen && (
        <div className='bg-white divide-gray-100 dark:bg-gray-700 dark:divide-gray-600 absolute right-0 z-50 mt-2 w-56 list-none divide-y rounded-lg text-base shadow'>
          <div className='px-4 py-3'>
            <span className='text-gray-900 dark:text-white block text-sm'>
              {user.user_metadata?.full_name || user.email}
            </span>
            <span className='text-gray-500 dark:text-gray-400 block truncate text-sm'>
              {user.email?.toString() || ''}
            </span>
          </div>
          <ul className='py-2' role='none'>
            <li>
              <a
                href='/dashboard'
                className='text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white block px-4 py-2 text-sm'
                role='menuitem'
              >
                Dashboard
              </a>
            </li>
            <li>
              <a
                href='/settings'
                className='text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white block px-4 py-2 text-sm'
                role='menuitem'
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
                className='text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-600 dark:hover:text-white block w-full px-4 py-2 text-left text-sm'
                role='menuitem'
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

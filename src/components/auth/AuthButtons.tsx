import React from 'react'

import { authClient } from '@/lib/auth-client'
// Remove AuthProvider wrapper dependency if possible, but keep structure for now if needed

const AuthButtonsInner = () => {
  const { data: session, isPending } = authClient.useSession()

  // Derived state
  const user = session?.user
  const isAuthenticated = !!user

  if (isPending) {
    return <div className='text-slate-300 text-sm font-medium'>Loading...</div>
  }

  if (isAuthenticated) {
    return (
      <div className='flex items-center gap-4'>
        <div className='text-slate-300 hidden text-sm font-medium lg:block'>
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.fullName || user.email}
              className='mr-2 inline-block h-8 w-8 rounded-full'
            />
          ) : null}
          {user?.fullName || user?.email}
        </div>
        <button
          onClick={() => authClient.signOut()}
          className='text-slate-300 hover:text-white text-sm font-medium transition-colors'
        >
          Log out
        </button>
      </div>
    )
  }

  return (
    <div className='flex items-center gap-4'>
      <a
        href='/api/auth/login'
        className='text-slate-300 hover:text-white text-sm font-medium transition-colors'
      >
        Log in
      </a>
      <a
        href='/api/auth/login?connection=google-oauth2'
        className='bg-white text-slate-950 hover:bg-slate-200 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors'
      >
        Get Started
      </a>
    </div>
  )
}

export const AuthButtons = () => {
  return <AuthButtonsInner />
}

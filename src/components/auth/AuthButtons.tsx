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
        <a
          href='/dashboard'
          className='border-white/10 text-white hover:border-white/25 hover:bg-white/5 rounded-[4px] border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors'
        >
          Dashboard
        </a>
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
        href='/demo-hub'
        className='rounded-[4px] bg-[var(--accent-primary)] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--bg-primary)] transition-all hover:-translate-y-px hover:brightness-110'
      >
        See Demo
      </a>
    </div>
  )
}

export const AuthButtons = () => {
  return <AuthButtonsInner />
}

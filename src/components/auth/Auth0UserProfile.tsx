import { useAuth0 } from '@auth0/auth0-react'
import React from 'react'

import { PixelatedAuthProvider } from './AuthProvider'

const UserProfileInner = () => {
  const { user, isAuthenticated, isLoading, loginWithRedirect } = useAuth0()

  if (isLoading) {
    return <div>Loading ...</div>
  }

  if (!isAuthenticated) {
    return (
      <div className='py-10 text-center'>
        <h2 className='mb-4 text-xl'>You are not logged in.</h2>
        <button
          onClick={() => loginWithRedirect()}
          className='bg-white text-slate-950 hover:bg-slate-200 rounded-full px-6 py-3 font-semibold transition-colors'
        >
          Log In to View Profile
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className='mb-6 flex items-center gap-4'>
        {user?.picture && (
          <img
            src={user.picture}
            alt={user.name}
            className='border-white/10 h-20 w-20 rounded-full border-2'
          />
        )}
        <div>
          <h2 className='text-white text-2xl font-bold'>{user?.name}</h2>
          <p className='text-slate-400'>{user?.email}</p>
        </div>
      </div>

      <div className='bg-slate-900/50 border-white/10 rounded-lg border p-6'>
        <h3 className='text-white mb-4 text-lg font-semibold'>
          User Profile Data (Auth0 SDK)
        </h3>
        <pre className='text-slate-300 overflow-auto whitespace-pre-wrap font-mono text-xs'>
          {JSON.stringify(user, null, 2)}
        </pre>
      </div>
    </div>
  )
}

export const Auth0UserProfile = () => {
  return (
    <PixelatedAuthProvider>
      <UserProfileInner />
    </PixelatedAuthProvider>
  )
}

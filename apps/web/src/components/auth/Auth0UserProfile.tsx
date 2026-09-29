import { useAuth0 } from '@auth0/auth0-react'

import { PixelatedAuthProvider } from './AuthProvider'

const UserProfileInner = () => {
  const { user, isAuthenticated, isLoading, loginWithRedirect } = useAuth0()

  if (isLoading) {
    return <div>Loading ...</div>
  }

  if (!isAuthenticated) {
    return (
      <div className="py-10 text-center">
        <h2 className="mb-4 text-xl">You are not logged in.</h2>
        <button
          onClick={async () => loginWithRedirect()}
          className="rounded-none bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-accent"
        >
          Log In to View Profile
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        {user?.picture && (
          <img
            src={user.picture}
            alt={user.name}
            className="h-20 w-20 rounded-none border-2 border-border"
          />
        )}
        <div>
          <h2 className="text-white text-2xl font-bold">{user?.name}</h2>
          <p className="text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      <div className="rounded-none border border-border bg-secondary p-6">
        <h3 className="text-white mb-4 text-lg font-semibold">
          User Profile Data (Auth0 SDK)
        </h3>
        <pre className="overflow-auto whitespace-pre-wrap font-mono text-xs text-muted-foreground">
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

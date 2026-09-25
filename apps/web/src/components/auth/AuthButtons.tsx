import { authClient } from '@/lib/auth-client'
// Remove AuthProvider wrapper dependency if possible, but keep structure for now if needed

const AuthButtonsInner = () => {
  const { data: session, isPending } = authClient.useSession()

  // Derived state
  const user = session?.user
  const isAuthenticated = !!user

  if (isPending) {
    return (
      <div className="text-sm font-medium text-muted-foreground">
        Loading...
      </div>
    )
  }

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-4">
        <div className="hidden text-sm font-medium text-muted-foreground lg:block">
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.fullName ?? user.email}
              className="mr-2 inline-block h-8 w-8 rounded-none"
            />
          ) : null}
          {user?.fullName ?? user?.email}
        </div>
        <button
          onClick={async () => authClient.signOut()}
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Log out
        </button>
        <a
          href="/dashboard"
          className="rounded-none border border-border px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:border-ring hover:bg-secondary"
        >
          Dashboard
        </a>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <a
        href="/api/auth/login"
        className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        Log in
      </a>
      <a
        href="/demo-hub"
        className="rounded-none bg-primary px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground transition-colors"
      >
        See Demo
      </a>
    </div>
  )
}

export const AuthButtons = () => {
  return <AuthButtonsInner />
}

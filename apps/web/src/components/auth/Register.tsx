import React, { useState, SyntheticEvent } from 'react'
export default function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState({
    email: '',
    password: '',
    fullName: '',
    termsAccepted: false,
  })

  // Simple validation without external schema
  const validateForm = () => {
    if (!user.email || !user.email.includes('@')) {
      return 'Please enter a valid email address'
    }
    if (!user.password || user.password.length < 6) {
      return 'Password must be at least 6 characters'
    }
    if (!user.fullName || user.fullName.trim().length === 0) {
      return 'Please enter your full name'
    }
    if (!user.termsAccepted) {
      return 'You must accept the Terms of Service'
    }
    return null
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setUser((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e: SyntheticEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(user),
      })

      const data = (await response.json()) as { error?: string }

      if (!response.ok) {
        setError(data.error ?? 'Registration failed')
        setIsLoading(false)
        return
      }

      // On success, redirect to login or dashboard
      window.location.assign('/login')
    } catch {
      setError('Network error. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="auth-container w-full max-w-md rounded-none border border-border bg-card p-6">
      <h2 className="mb-6 text-center text-2xl font-bold">Create Account</h2>

      {error && (
        <div
          className="mb-4 rounded-none border border-ring bg-secondary p-3 text-foreground"
          role="alert"
        >
          {error}
        </div>
      )}

      <form className="space-y-4" onSubmit={handleSubmit}>
        {['fullName', 'email', 'password', 'termsAccepted'].map((field) => (
          <div key={field} className="mb-4">
            {(() => {
              switch (field) {
                case 'fullName':
                  return (
                    <>
                      <label
                        className="block text-sm font-medium text-foreground"
                        htmlFor={field}
                      >
                        Full Name
                      </label>
                      <input
                        id={field}
                        type="text"
                        name={field}
                        value={user[field as keyof typeof user] as string}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-none border border-input bg-background focus:border-ring focus:ring-ring sm:ring-offset-0"
                        required
                      />
                    </>
                  )
                case 'email':
                  return (
                    <>
                      <label
                        className="block text-sm font-medium text-foreground"
                        htmlFor={field}
                      >
                        Email Address
                      </label>
                      <input
                        id={field}
                        type="email"
                        name={field}
                        value={user[field as keyof typeof user] as string}
                        onChange={handleChange}
                        autoComplete="email"
                        className="mt-1 block w-full rounded-none border border-input bg-background focus:border-ring focus:ring-ring sm:ring-offset-0"
                        required
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Must be a valid email address
                      </p>
                    </>
                  )
                case 'password':
                  return (
                    <>
                      <label
                        className="block text-sm font-medium text-foreground"
                        htmlFor={field}
                      >
                        Password
                      </label>
                      <input
                        id={field}
                        type="password"
                        name={field}
                        value={user[field as keyof typeof user] as string}
                        onChange={handleChange}
                        className="mt-1 block w-full rounded-none border border-input bg-background focus:border-ring focus:ring-ring sm:ring-offset-0"
                        required
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Must be at least 6 characters
                      </p>
                    </>
                  )
                case 'termsAccepted':
                  return (
                    <>
                      <div className="flex items-center space-x-2">
                        <input
                          id={field}
                          type="checkbox"
                          name={field}
                          checked={user[field]}
                          onChange={handleChange}
                          className="h-4 w-4 rounded-none border border-input focus:border-ring focus:ring-ring sm:ring-offset-0"
                        />
                        <label
                          htmlFor={field}
                          className="text-sm text-muted-foreground"
                        >
                          I agree to the
                          <a
                            href="/terms"
                            className="text-sm text-foreground hover:underline"
                          >
                            Terms of Service
                          </a>
                        </label>
                      </div>
                      <p
                        className="mt-1 hidden text-xs text-muted-foreground"
                        id="terms-error"
                      >
                        You must accept the Terms of Service
                      </p>
                    </>
                  )
                default:
                  return null
              }
            })()}
          </div>
        ))}

        {error && (
          <div
            className="mb-4 rounded-none border border-ring bg-secondary p-2 text-foreground"
            role="alert"
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-none bg-primary px-4 py-2 text-primary-foreground transition-colors hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-35"
        >
          {isLoading ? 'Creating Account...' : 'Register'}
        </button>
      </form>

      <div className="mt-6 text-center">
        <span className="text-sm text-muted-foreground">
          Already have an account?
        </span>
        <a href="/login" className="text-sm text-foreground hover:underline">
          Sign in
        </a>
      </div>
    </div>
  )
}

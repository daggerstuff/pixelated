import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'

interface LoginFormProps {
  redirectTo?: string
  showSignup?: boolean
  showResetPassword?: boolean
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const STORAGE_KEY_EMAIL = 'auth_remember_email'
const STORAGE_KEY_REMEMBER = 'auth_remember_me'

export function LoginForm({
  redirectTo,
  showSignup = true,
  showResetPassword = true,
}: LoginFormProps) {
  const { signIn, signInWithOAuth, resetPassword } = useAuth()
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetEmailSent, setResetEmailSent] = useState<boolean>(false)
  const [focusedInput, setFocusedInput] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState<boolean>(false)
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error' | 'loading' | 'info'
    message: string
  } | null>(null)

  const [errors, setErrors] = useState<{
    email?: string
    password?: string
  }>({})

  useEffect(() => {
    try {
      const rememberedEmail = localStorage.getItem(STORAGE_KEY_EMAIL)
      const rememberedFlag =
        localStorage.getItem(STORAGE_KEY_REMEMBER) === 'true'

      if (rememberedEmail && rememberedFlag) {
        setEmail(rememberedEmail)
        setRememberMe(true)
      }
    } catch (_e) {
      console.error('LocalStorage access error:', _e)
    }
  }, [])

  useEffect(() => {
    if (!toastMessage) {
      return
    }

    let toastId: string
    const { type, message } = toastMessage

    import('../ui/toast').then(({ toast }) => {
      if (type === 'loading') {
        toastId = toast.loading(message)
      } else if (type === 'success') {
        toast.success(message)
      } else if (type === 'error') {
        toast.error(message)
      } else if (type === 'info') {
        toast.info(message)
      }
    })

    return () => {
      if (type === 'loading') {
        import('../ui/toast').then(({ toast }) => {
          toast.dismiss(toastId)
        })
      }
    }
  }, [toastMessage])

  const validateEmail = (email: string): string | undefined => {
    if (!email) {
      return 'Email is required'
    }
    if (!EMAIL_REGEX.test(email)) {
      return 'Please enter a valid email address'
    }
    return undefined
  }

  const validatePassword = (password: string): string | undefined => {
    if (!password) {
      return 'Password is required'
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters'
    }
    return undefined
  }

  const validateForm = (): boolean => {
    const newErrors: {
      email?: string
      password?: string
    } = {}

    const emailError = validateEmail(email)
    if (emailError) {
      newErrors.email = emailError
    }

    if (mode === 'login') {
      const passwordError = validatePassword(password)
      if (passwordError) {
        newErrors.password = passwordError
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      setToastMessage({
        type: 'error',
        message: 'Please correct the form errors',
      })
      return
    }

    setIsLoading(true)

    try {
      if (mode === 'login') {
        if (rememberMe) {
          try {
            localStorage.setItem(STORAGE_KEY_EMAIL, email)
            localStorage.setItem(STORAGE_KEY_REMEMBER, 'true')
          } catch (_e) {
            // Silent fail for private browsing mode
          }
        } else {
          try {
            localStorage.removeItem(STORAGE_KEY_EMAIL)
            localStorage.removeItem(STORAGE_KEY_REMEMBER)
          } catch (_e) {
            // Silent fail for private browsing mode
          }
        }

        setToastMessage({ type: 'loading', message: 'Signing in...' })

        const response = await signIn(email, password)

        setToastMessage(null)

        if (response.error) {
          setToastMessage({
            type: 'error',
            message:
              typeof response.error === 'object' && response.error !== null
                ? (response.error as { message?: string }).message ||
                  'Login failed'
                : 'Login failed',
          })
          return
        }

        setToastMessage({ type: 'success', message: 'Successfully signed in!' })
      } else if (mode === 'reset') {
        setToastMessage({
          type: 'loading',
          message: 'Sending password reset email...',
        })

        await resetPassword(email, window.location.origin + '/auth-callback')

        setToastMessage(null)

        setToastMessage({
          type: 'success',
          message: 'Password reset email sent!',
        })

        setResetEmailSent(true)
      }
    } catch (error) {
      setToastMessage({
        type: 'error',
        message:
          error instanceof Error
            ? `Authentication error: ${error.message}`
            : 'An unexpected error occurred. Please try again.',
      })

      console.error('Login error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)

      setToastMessage({ type: 'loading', message: 'Connecting to Google...' })

      await signInWithOAuth('google', redirectTo)

      setToastMessage(null)

      setToastMessage({
        type: 'info',
        message: 'Redirecting to Google authentication...',
      })
    } catch (error) {
      setToastMessage({
        type: 'error',
        message:
          error instanceof Error
            ? `Google sign-in error: ${error.message}`
            : 'Failed to connect to Google. Please try again.',
      })

      setIsLoading(false)
    }
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    setEmail(value)

    if (errors.email) {
      setErrors((prev) => ({ ...prev, email: undefined }))
    }
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target
    setPassword(value)
    if (errors.password) {
      setErrors((prev) => ({ ...prev, password: undefined }))
    }
  }

  const handleRememberMeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRememberMe(e.target.checked)
  }

  const handleEmailBlur = () => {
    setFocusedInput(null)
    const error = validateEmail(email)
    setErrors((prev) => ({ ...prev, email: error }))
  }

  const handlePasswordBlur = () => {
    setFocusedInput(null)
    const error = validatePassword(password)
    setErrors((prev) => ({ ...prev, password: error }))
  }

  if (mode === 'reset' && resetEmailSent) {
    return (
      <div className="text-center">
        <h2 className="text-gradient">Password Reset Email Sent</h2>
        <p>
          Check your email for a link to reset your password. If it doesn&apos;t
          appear within a few minutes, check your spam folder.
        </p>
        <button
          onClick={() => {
            setMode('login')
            setResetEmailSent(false)
          }}
          className="btn btn-primary mt-4"
        >
          Return to Login
        </button>
      </div>
    )
  }

  return (
    <div className="auth-form-container text-center form-container">
      {mode === 'reset' && <h2 className="text-gradient">Reset Password</h2>}
      {mode === 'login' && <h2 className="text-gradient">Sign In</h2>}

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="form-group">
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <div
            className={`input-wrapper ${focusedInput === 'email' ? 'focused' : ''} ${errors.email ? 'error' : ''}`}
          >
            <input
              id="email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              onFocus={() => setFocusedInput('email')}
              onBlur={handleEmailBlur}
              required
              disabled={isLoading}
              placeholder="your@email.com"
              className="form-input"
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby={errors.email ? 'email-error' : undefined}
              autoComplete="email"
            />
          </div>
          {errors.email && (
            <div id="email-error" className="error-message text-sm mt-1">
              {errors.email}
            </div>
          )}
        </div>

        {mode === 'login' && (
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div
              className={`input-wrapper ${focusedInput === 'password' ? 'focused' : ''} ${errors.password ? 'error' : ''}`}
            >
              <input
                id="password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                onFocus={() => setFocusedInput('password')}
                onBlur={handlePasswordBlur}
                required
                disabled={isLoading}
                placeholder="••••••••"
                className="form-input"
                aria-invalid={errors.password ? 'true' : 'false'}
                aria-describedby={
                  errors.password ? 'password-error' : undefined
                }
                autoComplete="current-password"
              />
            </div>
            {errors.password && (
              <div id="password-error" className="error-message text-sm mt-1">
                {errors.password}
              </div>
            )}
          </div>
        )}

        {mode === 'login' && (
          <div className="form-group remember-me">
            <label htmlFor="rememberMeCheckbox" className="checkbox-container">
              <input
                id="rememberMeCheckbox"
                type="checkbox"
                checked={rememberMe}
                onChange={handleRememberMeChange}
                disabled={isLoading}
                className="remember-checkbox"
              />

              <span className="checkbox-label">Remember me</span>
            </label>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="loading-spinner"></span>
              <span>{mode === 'login' ? 'Signing in...' : 'Sending...'}</span>
            </span>
          ) : (
            <span>{mode === 'login' ? 'Sign In' : 'Send Reset Link'}</span>
          )}
        </button>
      </form>

      {mode === 'login' && (
        <>
          <div className="auth-separator">
            <hr className="my-4" />
          </div>

          <button
            onClick={handleGoogleSignIn}
            className="btn btn-outline"
            disabled={isLoading}
            aria-label="Sign in with Google"
          >
            Continue with Google
          </button>
        </>
      )}

      <div className="auth-links">
        {mode === 'login' && showResetPassword && (
          <button
            onClick={() => setMode('reset')}
            className="text-gray-400 text-sm hover:text-gray-300 underline"
          >
            Forgot your password?
          </button>
        )}

        {mode === 'reset' && (
          <button
            onClick={() => setMode('login')}
            className="text-gray-400 text-sm hover:text-gray-300 underline"
          >
            Back to Login
          </button>
        )}

        {mode === 'login' && showSignup && (
          <button
            onClick={() => (window.location.href = '/signup')}
            className="text-gray-400 text-sm hover:text-gray-300 underline mt-2"
          >
            Don&apos;t have an account? Sign up
          </button>
        )}
      </div>
    </div>
  )
}

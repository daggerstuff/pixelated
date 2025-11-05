import { useState, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { useAuth } from '../../hooks/useAuth'
import '@/styles/login-form-responsive.css'

interface LoginFormProps {
  readonly redirectTo?: string
  readonly showSignup?: boolean
  readonly showResetPassword?: boolean
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
    } catch (error_) {
      console.error('LocalStorage access error:', error_)
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

    // Always validate email
    const emailError = validateEmail(email)
    if (emailError) {
      newErrors.email = emailError
    }

    // Always validate password in login mode
    if (mode === 'login') {
      const passwordError = validatePassword(password)
      if (passwordError) {
        newErrors.password = passwordError
      }
    }

    // Set errors immediately using flushSync to ensure synchronous update
    // This is critical for tests and ensures React processes the state update
    flushSync(() => {
      setErrors(newErrors)
    })

    return Object.keys(newErrors).length === 0
  }

  const saveRememberMePreferences = (remember: boolean) => {
    try {
      if (remember) {
        localStorage.setItem(STORAGE_KEY_EMAIL, email)
        localStorage.setItem(STORAGE_KEY_REMEMBER, 'true')
      } else {
        localStorage.removeItem(STORAGE_KEY_EMAIL)
        localStorage.removeItem(STORAGE_KEY_REMEMBER)
      }
    } catch {
      // Silent fail for private browsing mode
    }
  }

  const handleLoginSubmit = async () => {
    saveRememberMePreferences(rememberMe)

    setToastMessage({ type: 'loading', message: 'Signing in...' })

    const response = await signIn(email, password)

    setToastMessage(null)

    if (response.error) {
      setToastMessage({
        type: 'error',
        message:
          typeof response.error === 'object' && response.error !== null
            ? (response.error as { message?: string }).message || 'Login failed'
            : 'Login failed',
      })
      return
    }

    setToastMessage({ type: 'success', message: 'Successfully signed in!' })
  }

  const handleResetSubmit = async () => {
    setToastMessage({
      type: 'loading',
      message: 'Sending password reset email...',
    })

    await resetPassword(email, globalThis.location.origin + '/auth-callback')

    setToastMessage(null)

    setToastMessage({
      type: 'success',
      message: 'Password reset email sent!',
    })

    setResetEmailSent(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Validate form - this will set errors state using flushSync
    // to ensure React processes the state update synchronously
    let isValid: boolean
    flushSync(() => {
      isValid = validateForm()
    })

    if (!isValid!) {
      // Errors have been set by validateForm() using flushSync
      // Notify user about validation errors
      setToastMessage({
        type: 'error',
        message: 'Please correct the form errors',
      })
      return
    }

    setIsLoading(true)

    try {
      if (mode === 'login') {
        await handleLoginSubmit()
      } else if (mode === 'reset') {
        await handleResetSubmit()
      }
    } catch (error: unknown) {
      setToastMessage({
        type: 'error',
        message:
          error instanceof Error
            ? `Authentication error: ${String(error)}`
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
    } catch (error: unknown) {
      setToastMessage({
        type: 'error',
        message:
          error instanceof Error
            ? `Google sign-in error: ${String(error)}`
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

  const renderResetSuccess = () => (
    <div className="text-center space-y-4">
      <h2 className="text-gradient text-responsive--heading">
        Password Reset Email Sent
      </h2>
      <p className="text-responsive--body">
        Check your email for a link to reset your password. If it doesn&apos;t
        appear within a few minutes, check your spam folder.
      </p>
      <button
        onClick={() => {
          setMode('login')
          setResetEmailSent(false)
        }}
        className="btn btn-primary btn-responsive touch-focus"
      >
        <span className="text-responsive--small">Return to Login</span>
      </button>
    </div>
  )

  const renderMainForm = () => (
    <div className="auth-form-container text-center form-container responsive-auth-container">
      {mode === 'reset' && (
        <h2
          className="text-gradient text-responsive--heading"
          data-testid="reset-password-heading"
        >
          Reset Password
        </h2>
      )}
      {mode === 'login' && (
        <h2 className="text-gradient text-responsive--heading">Sign In</h2>
      )}

      <form
        noValidate
        onSubmit={handleSubmit}
        className="auth-form form-responsive"
      >
        <div className="form-group form-group-responsive">
          <label htmlFor="email" className="form-label text-responsive--small">
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
              disabled={isLoading}
              placeholder="your@email.com"
              className="form-input input-responsive"
              aria-invalid={errors.email ? 'true' : 'false'}
              aria-describedby="email-error"
              autoComplete="email"
            />
          </div>
          <div
            id="email-error"
            className="error-message text-responsive--caption mt-1"
            role="alert"
            aria-live="polite"
            style={{
              display: errors.email ? ('block' as const) : ('none' as const),
            }}
          >
            {errors.email || ''}
          </div>
        </div>

        {mode === 'login' && renderPasswordField()}
        {mode === 'login' && renderRememberMe()}

        <button
          type="submit"
          className="btn btn-primary btn-responsive"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="loading-spinner"></span>
              <span className="text-responsive--small">
                {mode === 'login' ? 'Signing in...' : 'Sending...'}
              </span>
            </span>
          ) : (
            <span className="text-responsive--small">
              {mode === 'login' ? 'Sign In' : 'Send Reset Link'}
            </span>
          )}
        </button>
      </form>

      {mode === 'login' && renderOAuthSection()}
      {renderAuthLinks()}
    </div>
  )

  const renderPasswordField = () => (
    <div className="form-group form-group-responsive">
      <label htmlFor="password" className="form-label text-responsive--small">
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
          disabled={isLoading}
          placeholder="••••••••"
          className="form-input input-responsive"
          aria-invalid={errors.password ? 'true' : 'false'}
          aria-describedby="password-error"
          autoComplete="current-password"
        />
      </div>
      <div
        id="password-error"
        className="error-message text-responsive--caption mt-1"
        role="alert"
        aria-live="polite"
        style={{
          display: errors.password ? ('block' as const) : ('none' as const),
        }}
      >
        {errors.password || ''}
      </div>
    </div>
  )

  const renderRememberMe = () => (
    <div className="form-group remember-me form-group-responsive">
      <label
        htmlFor="rememberMeCheckbox"
        className="checkbox-container touch-target"
      >
        <input
          id="rememberMeCheckbox"
          type="checkbox"
          checked={rememberMe}
          onChange={handleRememberMeChange}
          disabled={isLoading}
          className="remember-checkbox"
        />

        <span className="checkbox-label text-responsive--small">
          Remember me
        </span>
      </label>
    </div>
  )

  const renderOAuthSection = () => (
    <>
      <div className="auth-separator">
        <hr className="my-4" />
      </div>

      <button
        onClick={handleGoogleSignIn}
        className="btn btn-outline btn-responsive"
        disabled={isLoading}
        aria-label="Sign in with Google"
      >
        <span className="text-responsive--small">Continue with Google</span>
      </button>
    </>
  )

  const renderAuthLinks = () => (
    <div className="auth-links space-y-2">
      {mode === 'login' && showResetPassword && (
        <button
          type="button"
          onClick={() => {
            // Use flushSync to ensure state update is processed synchronously
            // This fixes timing issues in tests
            flushSync(() => {
              setMode('reset')
              // Clear errors when switching modes
              setErrors({})
            })
          }}
          className="text-gray-400 text-responsive--small hover:text-gray-300 underline touch-focus"
          data-testid="forgot-password-button"
        >
          Forgot your password?
        </button>
      )}

      {mode === 'reset' && (
        <button
          type="button"
          onClick={() => setMode('login')}
          className="text-gray-400 text-responsive--small hover:text-gray-300 underline touch-focus"
        >
          Back to Login
        </button>
      )}

      {mode === 'login' && showSignup && (
        <button
          onClick={() => (globalThis.location.href = '/signup')}
          className="text-gray-400 text-responsive--small hover:text-gray-300 underline mt-2 touch-focus"
        >
          Don&apos;t have an account? Sign up
        </button>
      )}
    </div>
  )

  if (mode === 'reset' && resetEmailSent) {
    return renderResetSuccess()
  }

  return renderMainForm()
}

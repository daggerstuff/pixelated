import { useState, useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { toast } from '@/components/ui/toast'
import { Input } from '@/components/ui/input'
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
  // Better-auth hooks
  const { data: session } = authClient.useSession()

  // Form state
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [resetEmailSent, setResetEmailSent] = useState<boolean>(false)
  const [focusedInput, setFocusedInput] = useState<string | null>(null)
  const [rememberMe, setRememberMe] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Validation errors
  const [errors, setErrors] = useState<{
    email?: string
    password?: string
  }>({})

  // Load remembered email from localStorage
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

  // Redirect if already authenticated
  useEffect(() => {
    if (session?.user && redirectTo) {
      window.location.href = redirectTo
    } else if (session?.user) {
      window.location.href = '/dashboard'
    }
  }, [session, redirectTo])

  // Validation functions
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

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Save remember me preferences
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

  // Handle email/password login
  const handleLoginSubmit = async () => {
    if (!validateForm()) {
      toast.error('Please correct the form errors')
      return
    }

    saveRememberMePreferences(rememberMe)
    setIsLoading(true)

    try {
      const result = await authClient.signIn.email({
        email,
        password,
        rememberMe,
      })

      if (result.error) {
        const errorMessage =
          typeof result.error === 'object' && result.error !== null
            ? (result.error as { message?: string }).message ||
            'Login failed. Please check your credentials.'
            : 'Login failed. Please check your credentials.'

        toast.error(errorMessage)
        return
      }

      toast.success('Successfully signed in!')

      // Redirect will happen via useEffect when session updates
      if (redirectTo) {
        window.location.href = redirectTo
      } else {
        window.location.href = '/dashboard'
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred. Please try again.'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle password reset
  const handleResetSubmit = async () => {
    const emailError = validateEmail(email)
    if (emailError) {
      setErrors({ email: emailError })
      toast.error('Please enter a valid email address')
      return
    }

    setIsLoading(true)

    try {
      const resetUrl = `${window.location.origin}/auth-callback`
      await authClient.forgetPassword({
        email,
        redirectTo: resetUrl,
      })

      toast.success('Password reset email sent! Check your inbox.')
      setResetEmailSent(true)
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to send reset email. Please try again.'
      toast.error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (mode === 'login') {
      await handleLoginSubmit()
    } else if (mode === 'reset') {
      await handleResetSubmit()
    }
  }

  // Handle Google OAuth sign in
  const handleGoogleSignIn = async () => {
    setIsLoading(true)

    try {
      await authClient.signIn.social({
        provider: 'google',
        callbackURL: redirectTo || '/dashboard',
      })
      // OAuth redirect will happen automatically
      toast.info('Redirecting to Google authentication...')
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to connect to Google. Please try again.'
      toast.error(errorMessage)
      setIsLoading(false)
    }
  }

  // Input change handlers
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

  // Blur handlers for validation
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


  // Render reset success message
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
          setErrors({})
        }}
        className="btn btn-primary btn-responsive touch-focus"
      >
        <span className="text-responsive--small">Return to Login</span>
      </button>
    </div>
  )

  // Render main form
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
            <Input
              id="email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              onFocus={() => setFocusedInput('email')}
              onBlur={handleEmailBlur}
              disabled={isLoading}
              placeholder="your@email.com"
              className={`form-input input-responsive ${errors.email ? 'border-destructive' : ''}`}
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
            {errors.email ?? ''}
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

  // Render password field
  const renderPasswordField = () => (
    <div className="form-group form-group-responsive">
      <label htmlFor="password" className="form-label text-responsive--small">
        Password
      </label>
      <div
        className={`input-wrapper ${focusedInput === 'password' ? 'focused' : ''} ${errors.password ? 'error' : ''}`}
      >
        <Input
          id="password"
          type="password"
          value={password}
          onChange={handlePasswordChange}
          onFocus={() => setFocusedInput('password')}
          onBlur={handlePasswordBlur}
          disabled={isLoading}
          placeholder="••••••••"
          className={`form-input input-responsive ${errors.password ? 'border-destructive' : ''}`}
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
        {errors.password ?? ''}
      </div>
    </div>
  )

  // Render remember me checkbox
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

  // Render OAuth section
  const renderOAuthSection = () => (
    <>
      <div className="auth-separator">
        <hr className="my-4" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="btn btn-outline btn-responsive"
        disabled={isLoading}
        aria-label="Sign in with Google"
      >
        <span className="text-responsive--small">Continue with Google</span>
      </button>
    </>
  )

  // Render auth links
  const renderAuthLinks = () => (
    <div className="auth-links space-y-2">
      {mode === 'login' && showResetPassword && (
        <button
          type="button"
          onClick={() => {
            setMode('reset')
            setErrors({})
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
          onClick={() => {
            setMode('login')
            setErrors({})
          }}
          className="text-gray-400 text-responsive--small hover:text-gray-300 underline touch-focus"
        >
          Back to Login
        </button>
      )}

      {mode === 'login' && showSignup && (
        <button
          type="button"
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

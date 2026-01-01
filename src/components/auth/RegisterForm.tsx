import React, { useState, useEffect } from 'react'
import { authClient } from '@/lib/auth-client'
import { useStore } from 'nanostores'
import { AccessibilityAnnouncer } from '../ui/AccessibilityAnnouncer'
import {
  MobileFormValidation,
  ValidationRules,
} from '../ui/MobileFormValidation'
import { PasswordInputWithStrength } from '../ui/PasswordInputWithStrength'

interface RegisterFormProps {
  redirectTo?: string
  showLogin?: boolean
}

export function RegisterForm({
  redirectTo,
  showLogin = true,
}: RegisterFormProps) {
  const [email, setEmail] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [fullName, setFullName] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSuccessful, setIsSuccessful] = useState<boolean>(false)
  const [acceptTerms, setAcceptTerms] = useState<boolean>(false)
  const [announcement, setAnnouncement] = useState<string>('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formIsValid, setFormIsValid] = useState<boolean>(false)

  // Define validation rules
  const validationRules = {
    fullName: [
      ValidationRules.required('Full name is required'),
      ValidationRules.minLength(2, 'Name must be at least 2 characters'),
    ],

    email: [
      ValidationRules.required('Email is required'),
      ValidationRules.email('Please enter a valid email address'),
    ],

    password: [
      ValidationRules.required('Password is required'),
      ValidationRules.minLength(8, 'Password must be at least 8 characters'),
    ],

    terms: [
      {
        test: (value: string) => value === 'true',
        message: 'You must accept the Terms of Service and Privacy Policy',
      },
    ],
  }

  // Handle validation changes from the MobileFormValidation component
  const handleValidationChange = (
    isValid: boolean,
    errors: Record<string, string>,
  ) => {
    setFormIsValid(isValid)
    setFieldErrors(errors)
  }

  // Announce loading states and errors to screen readers
  useEffect(() => {
    if (isLoading) {
      setAnnouncement('Creating your account, please wait...')
    } else if (errorMessage) {
      setAnnouncement(`Error: ${errorMessage}`)
    } else if (isSuccessful) {
      setAnnouncement(
        'Registration successful! Please check your email to verify your account.',
      )
    }
  }, [isLoading, errorMessage, isSuccessful])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // The MobileFormValidation component will handle form validation
    // If the form reaches this point and is invalid, validation errors will be displayed

    if (!formIsValid) {
      // Form validation will be shown by the MobileFormValidation component
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const response = await authClient.signUp.email({
        email,
        password,
        name: fullName,
      })

      if (response.error) {
        setErrorMessage(
          typeof response.error === 'string'
            ? response.error
            : 'Registration failed',
        )
        return
      }

      if (response.data?.user) {
        setIsSuccessful(true)
      }
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? String(error) : 'An unexpected error occurred'
      setErrorMessage(errorMessage)
      console.error('Registration error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true)
      setErrorMessage('')
      setAnnouncement('Initiating Google sign in...')

      await authClient.signIn.social({
        provider: 'google',
        callbackURL: redirectTo || '/dashboard',
      })
      // OAuth redirects automatically, so no need to handle redirect here
    } catch (error: unknown) {
      setErrorMessage((error as Error).message)
      setIsLoading(false)
    }
  }

  if (isSuccessful) {
    return (
      <div className="auth-success" role="alert" aria-live="polite">
        <h2>Registration Successful</h2>
        <p>
          Please check your email to verify your account. If you don&apos;t see
          it within a few minutes, check your spam folder.
        </p>
      </div>
    )
  }

  return (
    <div className="auth-form-container">
      <h1>Create Account</h1>

      <AccessibilityAnnouncer message={announcement} clearDelay={3000} />

      {errorMessage && (
        <div className="error-message" role="alert" aria-live="assertive">
          {errorMessage}
        </div>
      )}

      <MobileFormValidation
        validationRules={validationRules}
        onValidationChange={handleValidationChange}
        validateOnChange={true}
        validateOnBlur={true}
        validateOnSubmit={true}
        focusFirstInvalidField={true}
        showErrorSummary={true}
      >
        <form
          onSubmit={handleSubmit}
          className="auth-form form-container"
          noValidate
        >
          <div className="form-group">
            <label htmlFor="fullName">
              Full Name
              <span className="sr-only">(required)</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              value={fullName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setFullName(e.target.value)
              }
              required
              disabled={isLoading}
              placeholder="John Doe"
              aria-required="true"
              aria-invalid={fieldErrors['fullName'] ? 'true' : 'false'}
              className="mobile-input"
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              Email
              <span className="sr-only">(required)</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setEmail(e.target.value)
              }
              required
              disabled={isLoading}
              placeholder="your@email.com"
              aria-required="true"
              aria-invalid={fieldErrors['email'] ? 'true' : 'false'}
              className="mobile-input"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <PasswordInputWithStrength
              label="Password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              minLength={8}
              placeholder="••••••••"
              autoComplete="new-password"
              showStrengthMeter={true}
              showStrengthText={true}
              {...(fieldErrors['password'] && {
                error: fieldErrors['password'],
              })}
              helperText="Password must be at least 8 characters"
            />
          </div>

          <div className="form-group">
            <div className="checkbox-wrapper">
              <input
                type="checkbox"
                id="terms"
                name="terms"
                checked={acceptTerms}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setAcceptTerms(e.target.checked)
                }
                required
                disabled={isLoading}
                aria-required="true"
                aria-invalid={fieldErrors['terms'] ? 'true' : 'false'}
                value={acceptTerms.toString()}
              />

              <label htmlFor="terms">
                I agree to the{' '}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Terms of Service (opens in new tab)"
                >
                  Terms of Service
                </a>{' '}
                and{' '}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Privacy Policy (opens in new tab)"
                >
                  Privacy Policy
                </a>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>
      </MobileFormValidation>

      <div
        className="auth-separator"
        role="separator"
        aria-orientation="horizontal"
      >
        <span>OR</span>
      </div>

      <button
        onClick={handleGoogleSignIn}
        className="btn btn-google"
        disabled={isLoading}
        aria-busy={isLoading}
        aria-label="Sign up with Google"
      >
        <span className="btn-icon">
          <svg
            viewBox="0 0 24 24"
            width="24"
            height="24"
            role="img"
            aria-label="Google logo"
          >
            <path
              fill="currentColor"
              d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"
            />
          </svg>
        </span>
        Sign up with Google
      </button>

      {showLogin && (
        <div className="auth-alternate-action">
          Already have an account?{' '}
          <a href="/login" className="auth-link">
            Log in
          </a>
        </div>
      )}
    </div>
  )
}

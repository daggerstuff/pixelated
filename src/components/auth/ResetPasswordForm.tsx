import { useState } from 'react'

import { authClient } from '@/lib/auth-client'

interface ResetPasswordFormProps {
  token: string
  email: string
}

export function ResetPasswordForm({ token, email }: ResetPasswordFormProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Basic validation
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setIsLoading(true)

    try {
      // Call auth service to verify token and set new password
      const response = await authClient.resetPassword({
        newPassword: password,
        token,
        email,
      })

      if (!response.error) {
        // Dispatch custom event that the parent page is listening for
        const event = new CustomEvent('password-reset-success')
        document.dispatchEvent(event)
      } else {
        throw new Error(response.error.message || 'Password reset failed')
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? (err)?.message || String(err)
          : 'An error occurred'
      setError(message)

      // Dispatch error event
      const event = new CustomEvent('password-reset-error', {
        detail: { message },
      })
      document.dispatchEvent(event)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className='reset-password-form'>
      {error && (
        <div className='error-message bg-red-50 border-red-200 text-red-700 mb-4 rounded border p-3'>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className='form-container'>
        <div className='form-group mb-4'>
          <label htmlFor='password' className='mb-2 block font-medium'>
            New Password
          </label>
          <input
            id='password'
            type='password'
            className='w-full rounded border p-2'
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPassword(e.target.value)
            }
            required
            disabled={isLoading}
            minLength={8}
            placeholder='••••••••'
            autoComplete='new-password'
          />

          <small className='text-gray-500 mt-1 text-xs'>
            Password must be at least 8 characters
          </small>
        </div>

        <div className='form-group mb-6'>
          <label htmlFor='confirmPassword' className='mb-2 block font-medium'>
            Confirm Password
          </label>
          <input
            id='confirmPassword'
            type='password'
            className='w-full rounded border p-2'
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setConfirmPassword(e.target.value)
            }
            required
            disabled={isLoading}
            placeholder='••••••••'
            autoComplete='new-password'
          />
        </div>

        <button
          type='submit'
          className='bg-teal-600 text-white hover:bg-teal-700 w-full rounded px-4 py-2 transition-colors'
          disabled={isLoading}
        >
          {isLoading ? 'Resetting Password...' : 'Reset Password'}
        </button>
      </form>
    </div>
  )
}

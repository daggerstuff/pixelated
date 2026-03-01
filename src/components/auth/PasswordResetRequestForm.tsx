import { useState } from 'react'

import { authClient } from '@/lib/auth-client'

import { toast } from '../ui/toast'

export default function PasswordResetRequestForm() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email) {
      toast.error('Email is required')
      return
    }

    setIsLoading(true)

    try {
      // Show loading toast
      const loadingToastId = toast.loading('Sending password reset email...')

      // Send password reset request
      const response = await authClient.forgetPassword({
        email,
        redirectTo: `${window.location.origin}/auth-callback`,
      })

      // Dismiss loading toast
      toast.dismiss(loadingToastId)

      // Check for success (forgetPassword returns { success: true })
      if ('success' in response && response.success) {
        // Dispatch custom success event that will be caught by the Astro component
        document.dispatchEvent(
          new CustomEvent('password-reset-request-success'),
        )

        // Clear the form
        setEmail('')
      } else {
        throw new Error('Failed to send password reset email')
      }
    } catch (error: unknown) {
      let errorMessage = 'An error occurred while requesting password reset'

      if (error instanceof Error) {
        errorMessage = String(error)
      }

      // Dispatch custom error event that will be caught by the Astro component
      document.dispatchEvent(
        new CustomEvent('password-reset-request-error', {
          detail: { message: errorMessage },
        }),
      )

      console.error('Password reset request error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className='space-y-4'>
      <div>
        <label htmlFor='email' className='mb-1 block text-sm font-medium'>
          Email
        </label>
        <input
          type='email'
          id='email'
          value={email}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setEmail(e.target.value)
          }
          required
          disabled={isLoading}
          className='border-gray-300 focus:ring-primary w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2'
          placeholder='Enter your email'
        />
      </div>

      <div>
        <button
          type='submit'
          disabled={isLoading}
          className='bg-primary text-white hover:bg-primary/90 focus:ring-primary w-full rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-offset-2'
        >
          {isLoading ? (
            <span className='flex items-center justify-center gap-2'>
              <span className='loading-spinner'></span>
              <span>Sending...</span>
            </span>
          ) : (
            <span>Send Reset Link</span>
          )}
        </button>
      </div>

      <div className='mt-4 text-center'>
        <a href='/login' className='text-primary text-sm hover:underline'>
          Back to login
        </a>
      </div>
    </form>
  )
}
